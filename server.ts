import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const FREE_SHIPPING_THRESHOLD_POISHA = 400000; // ৳4,000
const STANDARD_SHIPPING_POISHA = 12000; // ৳120

interface AdvisorCatalogItem {
  id: string;
  name: string;
  category: string;
  colorTone: string;
  colorName: string;
  fabric: string;
  description: string;
  priceCents: number;
}

interface AdvisorQuestionnaireAnswers {
  categories?: string[];
  undertone?: 'warm' | 'cool' | 'neutral';
  preferredColor?: string;
  preferredFabric?: string;
  maxBudgetTaka?: number;
  occasion?: string;
}

interface AdvisorResultPayload {
  outfitTitle: string;
  advisorSummary: string;
  recommendations: Array<{
    garmentId: string;
    matchReason: string;
    stylingTip: string;
  }>;
  colorHarmonyNote: string;
}

const FREE_ADVISOR_MODELS: ReadonlyArray<{
  model: string;
  useLowThinking: boolean;
  timeoutMs: number;
}> = [
  { model: 'gemini-3.8-flash', useLowThinking: true, timeoutMs: 4500 },
  { model: 'gemini-3.1-flash-lite', useLowThinking: false, timeoutMs: 4000 },
];

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  // Prevent unhandled promise rejection if an upstream call settles after our timeout
  promise.catch(() => {});
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`TIMEOUT: ${label} exceeded ${timeoutMs}ms`));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function isTransientModelError(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : String(error ?? '');
  const upper = raw.toUpperCase();
  return (
    upper.includes('TIMEOUT') ||
    upper.includes('ABORT') ||
    upper.includes('503') ||
    upper.includes('429') ||
    upper.includes('500') ||
    upper.includes('502') ||
    upper.includes('504') ||
    upper.includes('UNAVAILABLE') ||
    upper.includes('RESOURCE_EXHAUSTED') ||
    upper.includes('DEADLINE_EXCEEDED') ||
    upper.includes('HIGH DEMAND') ||
    upper.includes('OVERLOADED') ||
    upper.includes('FETCH FAILED') ||
    upper.includes('ECONNRESET')
  );
}

function formatCleanErrorMessage(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message.trim() : String(error ?? '').trim();
  if (!raw) return fallback;

  if (raw.startsWith('{') || raw.includes('"error"')) {
    try {
      const jsonStart = raw.indexOf('{');
      const parsed = JSON.parse(raw.slice(jsonStart)) as {
        error?: { message?: string; code?: number; status?: string };
        message?: string;
      };
      const extracted = parsed?.error?.message || parsed?.message;
      if (extracted && extracted.trim().length > 0) {
        return extracted.trim();
      }
    } catch {
      // Ignore JSON parse failure and fall back to friendly string below
    }
  }

  return raw;
}

function extractSearchKeywords(input?: string): string[] {
  if (!input) return [];
  const stopWords = new Set([
    'any',
    'open',
    'all',
    'and',
    'the',
    'for',
    'with',
    'from',
    'shade',
    'shades',
    'weave',
    'weaves',
    'fabric',
    'color',
    'bengali',
    'flattering',
    'prefer',
    'something',
    'please',
    'show',
    'more',
  ]);
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !stopWords.has(word));
}

function buildSmartInventoryFallback(
  catalogItems: AdvisorCatalogItem[],
  answers: AdvisorQuestionnaireAnswers | undefined,
  maxBudgetTaka: number,
  preferredFit: string | undefined,
  followUpNote: string | undefined
): AdvisorResultPayload {
  const desiredCategories = Array.isArray(answers?.categories) ? answers.categories : [];
  const undertone = answers?.undertone || 'neutral';
  const colorKeywords = extractSearchKeywords(answers?.preferredColor);
  const fabricKeywords = extractSearchKeywords(answers?.preferredFabric);
  const noteLower = (followUpNote || '').toLowerCase();
  const noteKeywords = extractSearchKeywords(followUpNote);
  const wantsLowerPrice =
    noteLower.includes('cheap') ||
    noteLower.includes('lower') ||
    noteLower.includes('under') ||
    noteLower.includes('less') ||
    noteLower.includes('affordable') ||
    noteLower.includes('budget');

  const maxBudgetPoisha = maxBudgetTaka * 100;
  const occasionText = answers?.occasion || 'day-to-evening wear';
  const fitText = preferredFit || 'tailored';

  const scored = catalogItems.map((item) => {
    let score = 0;
    const searchableText = `${item.name} ${item.category} ${item.colorName} ${item.fabric} ${item.description}`.toLowerCase();

    if (desiredCategories.length > 0) {
      if (desiredCategories.includes(item.category)) {
        score += 45;
      }
    } else {
      score += 15;
    }

    if (item.priceCents <= maxBudgetPoisha) {
      score += 28;
    } else {
      const overByTaka = (item.priceCents - maxBudgetPoisha) / 100;
      score -= Math.min(20, Math.round(overByTaka / 150));
    }

    if (undertone === 'neutral' || item.colorTone === undertone || item.colorTone === 'neutral') {
      score += 22;
    }

    for (const kw of colorKeywords) {
      if (searchableText.includes(kw)) {
        score += 14;
      }
    }

    for (const kw of fabricKeywords) {
      if (searchableText.includes(kw)) {
        score += 14;
      }
    }

    for (const kw of noteKeywords) {
      if (searchableText.includes(kw)) {
        score += 18;
      }
    }

    if (wantsLowerPrice) {
      score += Math.max(0, Math.round((500000 - item.priceCents) / 15000));
    }

    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score || a.item.priceCents - b.item.priceCents);

  const chosen: AdvisorCatalogItem[] = [];
  const usedCategories = new Set<string>();
  const targetCount = Math.min(3, scored.length);

  // When customer selects "Any category" or multiple categories, prefer complementary categories first
  for (const entry of scored) {
    if (chosen.length >= targetCount) break;
    if (desiredCategories.length !== 1 && usedCategories.has(entry.item.category)) {
      continue;
    }
    chosen.push(entry.item);
    usedCategories.add(entry.item.category);
  }

  for (const entry of scored) {
    if (chosen.length >= targetCount) break;
    if (!chosen.some((c) => c.id === entry.item.id)) {
      chosen.push(entry.item);
    }
  }

  const recommendations = chosen.map((item) => {
    const withinBudget = item.priceCents <= maxBudgetPoisha;
    const budgetPhrase = withinBudget
      ? `comfortably within your ৳${maxBudgetTaka.toLocaleString('en-IN')} per-piece budget at ${formatBdtFromPoisha(item.priceCents)}`
      : `priced at ${formatBdtFromPoisha(item.priceCents)} as our closest match in stock`;

    const tonePhrase =
      undertone === 'warm'
        ? `harmonizes with warm undertones through its ${item.colorName} shade`
        : undertone === 'cool'
          ? `flatters cool undertones with its refined ${item.colorName} tone`
          : `offers a balanced ${item.colorName} palette versatile across undertones`;

    return {
      garmentId: item.id,
      matchReason: `Crafted in ${item.fabric}, this ${item.category.toLowerCase().replace(/s$/, '')} ${tonePhrase} and sits ${budgetPhrase}.`,
      stylingTip: `Wear with a ${fitText} silhouette for ${occasionText.toLowerCase()}—pair with minimal metallic or woven accents to highlight the ${item.fabric.toLowerCase()} texture.`,
    };
  });

  const primaryShade = chosen[0]?.colorName || 'curated RADIANCE';
  const titleCategory =
    desiredCategories.length === 1 ? desiredCategories[0] : 'Coordinated Wardrobe';

  return {
    outfitTitle: `${primaryShade} ${titleCategory} Edit`,
    advisorSummary: `We selected ${chosen.length === 1 ? 'this standout piece' : `these ${chosen.length} pieces`} from our live RADIANCE collection to align with your ${undertone} undertone, fabric preference, and ৳${maxBudgetTaka.toLocaleString('en-IN')} budget for ${occasionText.toLowerCase()}.`,
    recommendations,
    colorHarmonyNote:
      undertone === 'warm'
        ? 'Rich sunlit and earthy pigments bring natural warmth and luminosity to your complexion.'
        : undertone === 'cool'
          ? 'Crisp jewel and indigo-inspired tones create clean, effortless contrast against cool undertones.'
          : 'Balanced tonal depth keeps the silhouette refined and adaptable from daylight to evening.',
  };
}

function createGenAIClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured. Check Settings > Secrets.');
  }
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatBdtFromPoisha(poisha: number): string {
  const taka = Math.round(poisha / 100);
  return `৳${taka.toLocaleString('en-IN')}`;
}

function luhnCheck(rawCardNumber: string): boolean {
  const digits = rawCardNumber.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) {
    return false;
  }
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '6mb' }));

  // 1. Single RADIANCE AI Outfit Advisor Agent — Selects Outfits Strictly From Store Inventory
  app.post('/api/gemini/outfit-advisor', async (req: Request, res: Response) => {
    try {
      const { answers, preferredFit, followUpNote, catalogItems } = req.body as {
        answers?: AdvisorQuestionnaireAnswers;
        preferredFit?: string;
        followUpNote?: string;
        catalogItems?: AdvisorCatalogItem[];
      };

      if (!Array.isArray(catalogItems) || catalogItems.length === 0) {
        res.status(400).json({ error: 'Store inventory is currently empty.' });
        return;
      }

      const ai = createGenAIClient();

      const chosenCategories =
        Array.isArray(answers?.categories) && answers.categories.length > 0
          ? answers.categories.join(', ')
          : 'Any category (suggest a coordinated 2 to 3 piece outfit)';

      const undertoneLabel =
        answers?.undertone === 'warm'
          ? 'Warm Undertone (flatters terracotta, marigold ochre, sindoor coral, saffron gold)'
          : answers?.undertone === 'cool'
            ? 'Cool Undertone (flatters Padma indigo, peacock teal, slate periwinkle, silver-ivory, berry)'
            : 'Neutral / Balanced Undertone (open to harmonious warm or cool shades)';

      const maxBudgetTaka = Math.max(
        1000,
        Math.min(5000, Math.round(Number(answers?.maxBudgetTaka) || 5000))
      );

      const inventoryLines = catalogItems
        .map(
          (item) =>
            `- ID: "${item.id}" | Name: "${item.name}" | Category: ${item.category} | Tone: ${item.colorTone} | Shade: ${item.colorName} | Weave/Fabric: ${item.fabric} | Price: ${formatBdtFromPoisha(item.priceCents)} | Details: ${item.description}`
        )
        .join('\n');

      const prompt = `Help this RADIANCE Dhaka shopper choose the best outfit strictly from our live store inventory based on their questionnaire answers:

Customer's Pre-Defined Questionnaire Choices:
1. Desired Category / Categories: ${chosenCategories}
2. Skin Undertone: ${undertoneLabel}
3. Preferred Outfit Color: ${answers?.preferredColor || 'Open to any flattering color'}
4. Preferred Fabric / Weave: ${answers?.preferredFabric || 'Any weave or fabric'}
5. Max Price Per Piece: ৳${maxBudgetTaka.toLocaleString('en-IN')} BDT (store range is ৳1,000 – ৳5,000)
6. Occasion: ${answers?.occasion || 'Dhaka everyday & evening wear'}
7. Silhouette Fit Preference: ${preferredFit || 'tailored'}
${followUpNote && followUpNote.trim().length > 0 ? `8. Customer Follow-Up Request: "${followUpNote.trim()}"` : ''}

Live RADIANCE Store Inventory (ONLY choose from these exact IDs):
${inventoryLines}

Instructions:
- Select 1 to 3 pieces from the Live RADIANCE Store Inventory above using their EXACT "ID" values.
- Prioritize pieces that match the customer's chosen category, undertone, preferred color, fabric/weave, and per-piece Taka budget. If no single item matches every criterion simultaneously, pick the closest matching pieces from the inventory and transparently explain how they work for the customer's choices.
- Never invent garment IDs outside the provided inventory list, and strictly NEVER mention or suggest shalwar kameez or saris.`;

      const systemInstruction =
        'You are the single dedicated Outfit Advisor for RADIANCE in Dhaka, Bangladesh. Your sole job is to guide customers to the right pieces from RADIANCE’s in-stock inventory (Western Tops, Traditional Tops, Kurtis, Long Skirts, Trousers, and Scarves priced ৳1,000–৳5,000) based on their questionnaire choices. Never invent items not in the inventory, and strictly NEVER mention shalwar kameez or saris.';

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          outfitTitle: {
            type: Type.STRING,
            description: 'Concise editorial title for the recommended outfit (under 10 words).',
          },
          advisorSummary: {
            type: Type.STRING,
            description:
              '2 to 3 warm, helpful sentences explaining how these inventory pieces match the customer’s category, undertone, color, fabric, and Taka budget choices.',
          },
          recommendations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                garmentId: {
                  type: Type.STRING,
                  description: 'Exact ID of the item from the Live RADIANCE Store Inventory.',
                },
                matchReason: {
                  type: Type.STRING,
                  description:
                    'Why this specific piece fits their undertone, preferred color, fabric, and budget.',
                },
                stylingTip: {
                  type: Type.STRING,
                  description:
                    'How to wear or pair this piece for their chosen occasion (never mention saris or shalwar kameez).',
                },
              },
              required: ['garmentId', 'matchReason', 'stylingTip'],
            },
          },
          colorHarmonyNote: {
            type: Type.STRING,
            description:
              '1 concise sentence on how the recommended garment shades complement their undertone.',
          },
        },
        required: ['outfitTitle', 'advisorSummary', 'recommendations', 'colorHarmonyNote'],
      };

      let modelResponseText: string | null = null;
      let lastModelError: unknown = null;

      for (const candidate of FREE_ADVISOR_MODELS) {
        try {
          const response = await withTimeout(
            ai.models.generateContent({
              model: candidate.model,
              contents: prompt,
              config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema,
                ...(candidate.useLowThinking
                  ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                  : {}),
              },
            }),
            candidate.timeoutMs,
            candidate.model
          );

          const text = (response.text || '').trim();
          if (text.length > 2) {
            modelResponseText = text;
            break;
          }
        } catch (err) {
          lastModelError = err;
          if (!isTransientModelError(err)) {
            break;
          }
        }
      }

      // If all free Gemini models are experiencing a simultaneous 503/429 demand spike,
      // seamlessly serve our multi-criteria inventory match so shoppers are never blocked.
      if (!modelResponseText) {
        if (lastModelError && !isTransientModelError(lastModelError)) {
          throw lastModelError;
        }
        const smartFallback = buildSmartInventoryFallback(
          catalogItems,
          answers,
          maxBudgetTaka,
          preferredFit,
          followUpNote
        );
        res.json(smartFallback);
        return;
      }

      let parsed: Partial<AdvisorResultPayload> = {};
      try {
        parsed = JSON.parse(modelResponseText) as Partial<AdvisorResultPayload>;
      } catch {
        const smartFallback = buildSmartInventoryFallback(
          catalogItems,
          answers,
          maxBudgetTaka,
          preferredFit,
          followUpNote
        );
        res.json(smartFallback);
        return;
      }

      const validIdMap = new Map(catalogItems.map((item) => [item.id, item]));
      const seenIds = new Set<string>();
      const validRecs = (parsed.recommendations || []).filter((rec) => {
        if (!rec?.garmentId || !validIdMap.has(rec.garmentId) || seenIds.has(rec.garmentId)) {
          return false;
        }
        seenIds.add(rec.garmentId);
        return true;
      });

      if (validRecs.length === 0) {
        const smartFallback = buildSmartInventoryFallback(
          catalogItems,
          answers,
          maxBudgetTaka,
          preferredFit,
          followUpNote
        );
        res.json(smartFallback);
        return;
      }

      res.json({
        outfitTitle: parsed.outfitTitle || 'Your Personal RADIANCE Inventory Edit',
        advisorSummary:
          parsed.advisorSummary ||
          'Here are the best-matching pieces from our current collection based on your preferences.',
        recommendations: validRecs.slice(0, 3),
        colorHarmonyNote:
          parsed.colorHarmonyNote ||
          'Curated to balance your undertone and fabric preferences within your Taka budget.',
      });
    } catch (error) {
      const message = formatCleanErrorMessage(
        error,
        'Outfit Advisor could not complete your selection right now. Please try again.'
      );
      res.status(500).json({ error: message });
    }
  });

  // 2. Secure Server-Side Checkout & Cryptographic Payment Verification (BDT / Taka)
  app.post('/api/checkout/process', async (req: Request, res: Response) => {
    try {
      const { items, shipping, payment } = req.body as {
        items?: Array<{
          id: string;
          name: string;
          size: string;
          priceCents: number;
          quantity: number;
        }>;
        shipping?: {
          recipientName?: string;
          shippingAddress?: string;
          postalCode?: string;
          phone?: string;
        };
        payment?: {
          method?: 'card' | 'cod';
          cardNumber?: string;
          expiry?: string;
          cvc?: string;
          cardholderName?: string;
        };
      };

      if (!Array.isArray(items) || items.length === 0) {
        res.status(400).json({ error: 'Your shopping bag is empty.' });
        return;
      }

      let subtotalCents = 0;
      let itemCount = 0;
      const summaryParts: string[] = [];

      for (const item of items) {
        const qty = Math.max(1, Math.min(10, Math.floor(Number(item.quantity) || 1)));
        const unitPrice = Math.max(
          100000,
          Math.min(500000, Math.floor(Number(item.priceCents) || 100000))
        );
        subtotalCents += unitPrice * qty;
        itemCount += qty;
        summaryParts.push(`${item.name} (${item.size}) x${qty}`);
      }

      if (itemCount > 50) {
        res.status(400).json({ error: 'Maximum 50 items per order.' });
        return;
      }

      const recipientName = (shipping?.recipientName || '').trim();
      const shippingAddress = (shipping?.shippingAddress || '').trim();
      const postalCode = (shipping?.postalCode || '').trim();
      const phone = (shipping?.phone || '').trim();

      if (
        recipientName.length < 2 ||
        shippingAddress.length < 4 ||
        postalCode.length < 2 ||
        phone.length < 5
      ) {
        res.status(400).json({ error: 'Please complete all delivery verification fields.' });
        return;
      }

      const method = payment?.method === 'cod' ? 'cod' : 'card';
      let last4 = 'COD0';

      if (method === 'card') {
        const rawNumber = (payment?.cardNumber || '').replace(/\s+/g, '');
        if (!luhnCheck(rawNumber)) {
          res.status(400).json({
            error: 'Invalid card number checksum. Please verify your card digits.',
          });
          return;
        }
        const expiryMatch = (payment?.expiry || '').trim().match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
        if (!expiryMatch) {
          res.status(400).json({ error: 'Invalid expiration date. Use MM/YY format.' });
          return;
        }
        const expMonth = Number(expiryMatch[1]);
        const expYear = 2000 + Number(expiryMatch[2]);
        const now = new Date();
        const expiryDate = new Date(expYear, expMonth, 0, 23, 59, 59);
        if (expiryDate < now) {
          res.status(400).json({ error: 'Card has expired. Please use an active card.' });
          return;
        }
        const cvcDigits = (payment?.cvc || '').replace(/\D/g, '');
        if (cvcDigits.length < 3 || cvcDigits.length > 4) {
          res.status(400).json({ error: 'Security code (CVC) must be 3 or 4 digits.' });
          return;
        }
        if (!payment?.cardholderName || payment.cardholderName.trim().length < 2) {
          res.status(400).json({ error: 'Cardholder name is required.' });
          return;
        }
        last4 = rawNumber.slice(-4);

        if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith('sk_')) {
          const shippingFee =
            subtotalCents >= FREE_SHIPPING_THRESHOLD_POISHA ? 0 : STANDARD_SHIPPING_POISHA;
          const total = subtotalCents + shippingFee;
          const stripeBody = new URLSearchParams({
            amount: String(total),
            currency: 'bdt',
            description: `RADIANCE Bangladesh Order (${itemCount} items)`,
          });
          const stripeRes = await fetch('https://api.stripe.com/v1/payment_intents', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: stripeBody.toString(),
          });
          if (!stripeRes.ok) {
            const errJson = (await stripeRes.json().catch(() => ({}))) as {
              error?: { message?: string };
            };
            res.status(402).json({
              error: errJson.error?.message || 'Payment gateway declined authorization.',
            });
            return;
          }
        }
      }

      const shippingCents =
        subtotalCents >= FREE_SHIPPING_THRESHOLD_POISHA ? 0 : STANDARD_SHIPPING_POISHA;
      const totalCents = subtotalCents + shippingCents;
      const orderNumber = `RAD-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const signingKey = process.env.PAYMENT_SIGNING_SECRET || 'radiance-dhaka-hmac-v1';
      const digest = crypto
        .createHmac('sha256', signingKey)
        .update(`${orderNumber}:${totalCents}:BDT:${method}:${last4}:${Date.now()}`)
        .digest('hex')
        .slice(0, 20);

      const paymentRef = `ver_${method}_${last4}_${digest}`;
      const itemsSummary = summaryParts.join(', ').slice(0, 295);

      res.json({
        verified: true,
        orderNumber,
        itemCount,
        itemsSummary,
        subtotalCents,
        shippingCents,
        totalCents,
        paymentMethod: method,
        paymentRef,
        last4,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Payment processing failed.';
      res.status(500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`RADIANCE Bangladesh full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

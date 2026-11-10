import { useState, type FormEvent } from 'react';
import { Check, RotateCcw, Ruler, Send, ShoppingBag, Sparkles } from 'lucide-react';
import { ALLOWED_CATEGORIES, formatTaka, getCompactSizeSummary } from '../data/catalog';
import type {
  FitPreference,
  GarmentCategory,
  GarmentItem,
  GarmentSize,
  OutfitAdvisorChoices,
  OutfitAdvisorResponse,
  PaletteMode,
} from '../types';
import { GarmentVisual } from './GarmentVisual';

interface StylistPageProps {
  activePalette: PaletteMode;
  preferredFit: FitPreference;
  catalog: GarmentItem[];
  onPaletteChange: (next: PaletteMode) => void;
  onOpenProductDetail: (item: GarmentItem) => void;
  onTryInFittingRoom: (item: GarmentItem) => void;
  onAddToBag: (item: GarmentItem, size: GarmentSize) => void;
}

const COLOR_OPTIONS: Array<{ label: string; swatchClass: string }> = [
  { label: 'Any Flattering Color', swatchClass: 'bg-gradient-to-r from-[#C4553A] to-[#2B4C7E]' },
  { label: 'Terracotta & Coral', swatchClass: 'bg-[#C4553A]' },
  { label: 'Marigold & Saffron Gold', swatchClass: 'bg-[#D48C2A]' },
  { label: 'Sindoor & Crimson', swatchClass: 'bg-[#C84339]' },
  { label: 'Padma Indigo & Blue', swatchClass: 'bg-[#2B4C7E]' },
  { label: 'Peacock Teal', swatchClass: 'bg-[#1F6E75]' },
  { label: 'Slate Periwinkle', swatchClass: 'bg-[#5B6FA3]' },
];

const FABRIC_OPTIONS: string[] = [
  'Any Bengali Weave',
  'Jamdani',
  'Dhakai Muslin',
  'Rajshahi Silk',
  'Tangail Cotton',
  'Woven Linen & Kantha',
];

const BUDGET_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 2500, label: 'Up to ৳2,500' },
  { value: 3500, label: 'Up to ৳3,500' },
  { value: 5000, label: 'Up to ৳5,000 (All)' },
];

const OCCASION_OPTIONS: string[] = [
  'Dhaka Office & Formal',
  'University & Everyday',
  'Festive & Evening Dinner',
  'Weekend & Travel',
];

const SIZES: GarmentSize[] = ['XS', 'S', 'M', 'L', 'XL'];

export function StylistPage({
  activePalette,
  preferredFit,
  catalog,
  onPaletteChange,
  onOpenProductDetail,
  onTryInFittingRoom,
  onAddToBag,
}: StylistPageProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [choices, setChoices] = useState<OutfitAdvisorChoices>({
    categories: [],
    undertone: activePalette,
    preferredColor: 'Any Flattering Color',
    preferredFabric: 'Any Bengali Weave',
    maxBudgetTaka: 5000,
    occasion: 'Dhaka Office & Formal',
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<OutfitAdvisorResponse | null>(null);
  const [followUpInput, setFollowUpInput] = useState('');
  const [selectedSizes, setSelectedSizes] = useState<Record<string, GarmentSize>>({});

  const toggleCategory = (cat: GarmentCategory) => {
    setChoices((prev) => {
      const exists = prev.categories.includes(cat);
      return {
        ...prev,
        categories: exists
          ? prev.categories.filter((c) => c !== cat)
          : [...prev.categories, cat],
      };
    });
  };

  const requestRecommendation = async (
    currentChoices: OutfitAdvisorChoices,
    followUpNote?: string
  ) => {
    setLoading(true);
    setErrorMsg(null);
    setStep(6);

    try {
      const response = await fetch('/api/gemini/outfit-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: currentChoices,
          preferredFit,
          followUpNote,
          catalogItems: catalog.map((item) => ({
            id: item.id,
            name: item.name,
            category: item.category,
            colorTone: item.colorTone,
            colorName: item.colorName,
            fabric: item.fabric,
            description: item.description,
            priceCents: item.priceCents,
          })),
        }),
      });

      const rawText = await response.text();
      let data: Partial<OutfitAdvisorResponse> & { error?: string } = {};
      try {
        data = JSON.parse(rawText) as Partial<OutfitAdvisorResponse> & { error?: string };
      } catch {
        if (!response.ok) {
          throw new Error('Outfit Advisor is temporarily busy. Please tap Try Again.');
        }
      }

      if (!response.ok) {
        const rawErr = (data.error || '').trim();
        let cleanErr = rawErr || 'Outfit Advisor is temporarily unavailable.';
        if (rawErr.startsWith('{')) {
          try {
            const nested = JSON.parse(rawErr) as { error?: { message?: string }; message?: string };
            cleanErr = nested.error?.message || nested.message || cleanErr;
          } catch {
            cleanErr = 'Outfit Advisor is temporarily busy. Please tap Try Again.';
          }
        }
        throw new Error(cleanErr);
      }

      setResult(data as OutfitAdvisorResponse);
      if (followUpNote) {
        setFollowUpInput('');
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to fetch outfit suggestion right now.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFollowUpSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!followUpInput.trim() || loading) return;
    void requestRecommendation(choices, followUpInput.trim());
  };

  const handleRestart = () => {
    setResult(null);
    setErrorMsg(null);
    setFollowUpInput('');
    setStep(1);
  };

  const answeredSummary = [
    {
      stepNum: 1 as const,
      label: 'Category',
      value:
        choices.categories.length === 0 ? 'Any Category (Full Outfit)' : choices.categories.join(', '),
    },
    {
      stepNum: 2 as const,
      label: 'Undertone',
      value:
        choices.undertone === 'warm'
          ? 'Warm Undertone'
          : choices.undertone === 'cool'
            ? 'Cool Undertone'
            : 'Neutral / Balanced',
    },
    {
      stepNum: 3 as const,
      label: 'Preferred Color',
      value: choices.preferredColor,
    },
    {
      stepNum: 4 as const,
      label: 'Bengali Weave',
      value: choices.preferredFabric,
    },
    {
      stepNum: 5 as const,
      label: 'Budget & Occasion',
      value: `Up to ৳${choices.maxBudgetTaka.toLocaleString('en-IN')} · ${choices.occasion}`,
    },
  ];

  return (
    <div className="py-6 md:py-10 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[#DED7C6]">
        <div>
          <p className="text-xs text-[#7A6350] mb-1.5">Guided Inventory Styling</p>
          <h1 className="text-3xl md:text-4xl font-semibold text-[#2C1E16] text-balance">
            RADIANCE Outfit Advisor
          </h1>
        </div>

        {step > 1 && (
          <button
            type="button"
            onClick={handleRestart}
            className="min-h-[40px] self-start sm:self-auto inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#5A4332] hover:text-[#2C1E16] bg-[#FCFBF7] border border-[#D4CCB8] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restart Questions</span>
          </button>
        )}
      </div>

      {/* Answered Choices Trail (Click any step to revise) */}
      {step > 1 && (
        <div className="rounded-xl border border-[#DED7C6] bg-[#FCFBF7] p-4 md:p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs font-medium text-[#2C1E16]">Your Outfit Preferences</span>
            <span className="text-[11px] text-[#7A6350]">Tap any answer to edit</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {answeredSummary.slice(0, step === 6 ? 5 : step - 1).map((entry) => (
              <button
                key={entry.label}
                type="button"
                onClick={() => setStep(entry.stepNum)}
                className="text-left p-2.5 rounded-lg bg-[#F7F4EC] hover:bg-[#EFEBE0] border border-[#DED7C6] transition-colors"
              >
                <span className="block text-[10px] text-[#7A6350]">{entry.label}</span>
                <span className="block text-xs font-medium text-[#2C1E16] truncate mt-0.5">
                  {entry.value}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Guided Pre-Defined Questions Card (Steps 1 to 5) */}
      {step < 6 && (
        <div className="rounded-xl border border-[#DED7C6] bg-[#FCFBF7] p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between text-xs text-[#7A6350]">
            <span>Question {step} of 5</span>
            <span>Select your preference below</span>
          </div>

          {/* Question 1: Category */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl md:text-2xl font-semibold text-[#2C1E16]">
                  1. Which category would you like to choose from?
                </h2>
                <p className="text-sm text-[#5A4332] mt-1">
                  Pick one or more categories from our collection, or keep &ldquo;Any Category&rdquo; for a coordinated outfit.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setChoices((prev) => ({ ...prev, categories: [] }))}
                  className={`min-h-[46px] px-4 py-3 rounded-lg border text-left text-xs font-medium flex items-center justify-between transition-colors ${
                    choices.categories.length === 0
                      ? 'border-[#435334] bg-[#435334] text-[#FCFBF7]'
                      : 'border-[#DED7C6] bg-[#F7F4EC] text-[#2C1E16] hover:border-[#435334]'
                  }`}
                >
                  <span>Any Category (Complete Outfit)</span>
                  {choices.categories.length === 0 && <Check className="w-4 h-4 shrink-0" />}
                </button>

                {ALLOWED_CATEGORIES.map((cat) => {
                  const selected = choices.categories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={`min-h-[46px] px-4 py-3 rounded-lg border text-left text-xs font-medium flex items-center justify-between transition-colors ${
                        selected
                          ? 'border-[#435334] bg-[#435334] text-[#FCFBF7]'
                          : 'border-[#DED7C6] bg-[#F7F4EC] text-[#2C1E16] hover:border-[#435334]'
                      }`}
                    >
                      <span>{cat}</span>
                      {selected && <Check className="w-4 h-4 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="min-h-[44px] px-6 py-2.5 text-xs font-medium bg-[#435334] hover:bg-[#344227] text-[#FCFBF7] rounded-lg transition-colors whitespace-nowrap"
                >
                  Next: Undertone
                </button>
              </div>
            </div>
          )}

          {/* Question 2: Undertone */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl md:text-2xl font-semibold text-[#2C1E16]">
                  2. What is your skin undertone?
                </h2>
                <p className="text-sm text-[#5A4332] mt-1">
                  This helps match warm golden-coral weaves versus cool indigo-teal pigments.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(
                  [
                    {
                      id: 'warm',
                      title: 'Warm Undertone',
                      desc: 'Golden, peachy, or warm olive glow; suits gold & brass jewelry.',
                      swatch: 'bg-[#C89B6E]',
                    },
                    {
                      id: 'cool',
                      title: 'Cool Undertone',
                      desc: 'Rosy or cool neutral glow; suits oxidized silver & platinum.',
                      swatch: 'bg-[#C7AC9B]',
                    },
                    {
                      id: 'neutral',
                      title: 'Neutral / Not Sure',
                      desc: 'Balanced undertone; suits both warm and cool Bengali textiles.',
                      swatch: 'bg-[#C4A383]',
                    },
                  ] as Array<{ id: PaletteMode; title: string; desc: string; swatch: string }>
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setChoices((prev) => ({ ...prev, undertone: opt.id }));
                      onPaletteChange(opt.id);
                      setStep(3);
                    }}
                    className={`p-4 rounded-xl border text-left transition-colors flex flex-col justify-between gap-3 ${
                      choices.undertone === opt.id
                        ? 'border-[#435334] bg-[#EFEBE0]'
                        : 'border-[#DED7C6] bg-[#F7F4EC] hover:border-[#435334]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[#2C1E16]">{opt.title}</span>
                      <span
                        className={`w-5 h-5 rounded-sm border border-black/15 shrink-0 ${opt.swatch}`}
                      />
                    </div>
                    <p className="text-xs text-[#5A4332] leading-relaxed">{opt.desc}</p>
                  </button>
                ))}
              </div>

              <div className="pt-2 flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="min-h-[40px] px-4 py-2 text-xs font-medium text-[#5A4332] hover:text-[#2C1E16]"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="min-h-[44px] px-6 py-2.5 text-xs font-medium bg-[#435334] hover:bg-[#344227] text-[#FCFBF7] rounded-lg transition-colors whitespace-nowrap"
                >
                  Next: Preferred Color
                </button>
              </div>
            </div>
          )}

          {/* Question 3: Preferred Color */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl md:text-2xl font-semibold text-[#2C1E16]">
                  3. What is your preferred outfit color?
                </h2>
                <p className="text-sm text-[#5A4332] mt-1">
                  Choose a shade family from our warm and cool Bangladeshi palette.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {COLOR_OPTIONS.map((col) => {
                  const selected = choices.preferredColor === col.label;
                  return (
                    <button
                      key={col.label}
                      type="button"
                      onClick={() => {
                        setChoices((prev) => ({ ...prev, preferredColor: col.label }));
                        setStep(4);
                      }}
                      className={`min-h-[46px] px-4 py-3 rounded-lg border text-left text-xs font-medium flex items-center justify-between gap-3 transition-colors ${
                        selected
                          ? 'border-[#435334] bg-[#EFEBE0] text-[#2C1E16]'
                          : 'border-[#DED7C6] bg-[#F7F4EC] text-[#2C1E16] hover:border-[#435334]'
                      }`}
                    >
                      <span className="truncate">{col.label}</span>
                      <span
                        className={`w-5 h-5 rounded-sm border border-black/15 shrink-0 ${col.swatchClass}`}
                      />
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="min-h-[40px] px-4 py-2 text-xs font-medium text-[#5A4332] hover:text-[#2C1E16]"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="min-h-[44px] px-6 py-2.5 text-xs font-medium bg-[#435334] hover:bg-[#344227] text-[#FCFBF7] rounded-lg transition-colors whitespace-nowrap"
                >
                  Next: Bengali Weave
                </button>
              </div>
            </div>
          )}

          {/* Question 4: Preferred Bengali Weave */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl md:text-2xl font-semibold text-[#2C1E16]">
                  4. Which traditional Bengali fabric or pattern do you prefer?
                </h2>
                <p className="text-sm text-[#5A4332] mt-1">
                  Select a signature weave or keep all heritage fabrics open.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {FABRIC_OPTIONS.map((fab) => {
                  const selected = choices.preferredFabric === fab;
                  return (
                    <button
                      key={fab}
                      type="button"
                      onClick={() => {
                        setChoices((prev) => ({ ...prev, preferredFabric: fab }));
                        setStep(5);
                      }}
                      className={`min-h-[46px] px-4 py-3 rounded-lg border text-left text-xs font-medium flex items-center justify-between transition-colors ${
                        selected
                          ? 'border-[#435334] bg-[#435334] text-[#FCFBF7]'
                          : 'border-[#DED7C6] bg-[#F7F4EC] text-[#2C1E16] hover:border-[#435334]'
                      }`}
                    >
                      <span>{fab}</span>
                      {selected && <Check className="w-4 h-4 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 flex justify-between">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="min-h-[40px] px-4 py-2 text-xs font-medium text-[#5A4332] hover:text-[#2C1E16]"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  className="min-h-[44px] px-6 py-2.5 text-xs font-medium bg-[#435334] hover:bg-[#344227] text-[#FCFBF7] rounded-lg transition-colors whitespace-nowrap"
                >
                  Next: Budget &amp; Occasion
                </button>
              </div>
            </div>
          )}

          {/* Question 5: Budget & Occasion */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl md:text-2xl font-semibold text-[#2C1E16]">
                  5. What is your per-piece budget and occasion?
                </h2>
                <p className="text-sm text-[#5A4332] mt-1">
                  All inventory pieces range between ৳1,000 and ৳5,000 BDT.
                </p>
              </div>

              <div className="space-y-2">
                <span className="block text-xs font-medium text-[#5A4332]">
                  Maximum Price Per Piece (BDT ৳)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {BUDGET_OPTIONS.map((b) => (
                    <button
                      key={b.value}
                      type="button"
                      onClick={() => setChoices((prev) => ({ ...prev, maxBudgetTaka: b.value }))}
                      className={`min-h-[44px] px-4 py-2.5 rounded-lg border text-xs font-medium font-mono tabular-nums transition-colors whitespace-nowrap ${
                        choices.maxBudgetTaka === b.value
                          ? 'border-[#435334] bg-[#435334] text-[#FCFBF7]'
                          : 'border-[#DED7C6] bg-[#F7F4EC] text-[#2C1E16] hover:border-[#435334]'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <span className="block text-xs font-medium text-[#5A4332]">Occasion</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {OCCASION_OPTIONS.map((occ) => (
                    <button
                      key={occ}
                      type="button"
                      onClick={() => setChoices((prev) => ({ ...prev, occasion: occ }))}
                      className={`min-h-[44px] px-4 py-2.5 rounded-lg border text-left text-xs font-medium transition-colors ${
                        choices.occasion === occ
                          ? 'border-[#435334] bg-[#EFEBE0] text-[#2C1E16]'
                          : 'border-[#DED7C6] bg-[#F7F4EC] text-[#2C1E16] hover:border-[#435334]'
                      }`}
                    >
                      {occ}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-[#DED7C6] flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="min-h-[42px] px-4 py-2 text-xs font-medium text-[#5A4332] hover:text-[#2C1E16]"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => void requestRecommendation(choices)}
                  className="min-h-[46px] inline-flex items-center gap-2 px-6 py-3 text-xs font-medium bg-[#435334] hover:bg-[#344227] text-[#FCFBF7] rounded-lg transition-colors whitespace-nowrap"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Choose My Outfit from Inventory</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 6: Single AI Outfit Advisor Inventory Results + Optional Refinement */}
      {step === 6 && (
        <div className="space-y-6">
          {loading && (
            <div className="rounded-xl border border-[#DED7C6] bg-[#FCFBF7] p-8 text-center space-y-2">
              <p className="text-sm font-medium text-[#2C1E16]">
                Selecting the best match from RADIANCE Dhaka inventory...
              </p>
              <p className="text-xs text-[#7A6350]">
                Evaluating category, undertone, shade, Bengali weave, and ৳ budget.
              </p>
            </div>
          )}

          {errorMsg && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-5 space-y-3">
              <p className="text-xs font-medium text-red-800">{errorMsg}</p>
              <button
                type="button"
                onClick={() => void requestRecommendation(choices)}
                className="min-h-[40px] px-4 py-2 text-xs font-medium bg-[#435334] text-[#FCFBF7] rounded-lg"
              >
                Try Again
              </button>
            </div>
          )}

          {!loading && result && (
            <div className="rounded-xl border border-[#DED7C6] bg-[#FCFBF7] p-6 md:p-8 space-y-6">
              <div className="pb-5 border-b border-[#DED7C6] space-y-2">
                <p className="text-xs text-[#435334] font-medium">
                  Outfit Advisor Selection · Verified Store Inventory
                </p>
                <h2 className="text-2xl md:text-3xl font-semibold text-[#2C1E16]">
                  {result.outfitTitle}
                </h2>
                <p className="text-sm text-[#5A4332] leading-relaxed">{result.advisorSummary}</p>
                <p className="text-xs text-[#7A6350] pt-1">
                  Color Harmony: <span className="text-[#2C1E16]">{result.colorHarmonyNote}</span>
                </p>
              </div>

              {/* Recommended Inventory Pieces */}
              <div className="space-y-5">
                {result.recommendations.map((rec) => {
                  const item = catalog.find((g) => g.id === rec.garmentId);
                  if (!item) return null;
                  const chosenSize = selectedSizes[item.id] || 'M';

                  return (
                    <article
                      key={item.id}
                      className="rounded-xl border border-[#DED7C6] bg-[#F7F4EC] p-4 sm:p-5 flex flex-col sm:flex-row gap-5"
                    >
                      <div
                        onClick={() => onOpenProductDetail(item)}
                        className="w-full sm:w-36 aspect-[3/4] rounded-lg overflow-hidden border border-[#DED7C6] bg-[#EFEBE0] cursor-pointer shrink-0"
                      >
                        <GarmentVisual
                          src={item.imageDataUrl}
                          alt={item.name}
                          tone={item.colorTone}
                          category={item.category}
                          className="w-full h-full"
                        />
                      </div>

                      <div className="flex-1 flex flex-col justify-between space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs text-[#7A6350]">
                            <span>{item.category}</span>
                            <span aria-hidden="true">·</span>
                            <span>{item.colorTone === 'warm' ? 'Warm Tone' : 'Cool Tone'}</span>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">{item.fabric}</span>
                          </div>

                          <div className="flex items-baseline justify-between gap-3">
                            <h3
                              onClick={() => onOpenProductDetail(item)}
                              className="text-lg font-semibold text-[#2C1E16] cursor-pointer hover:underline underline-offset-4"
                            >
                              {item.name}
                            </h3>
                            <span className="text-base font-mono tabular-nums font-medium text-[#435334] shrink-0">
                              {formatTaka(item.priceCents)}
                            </span>
                          </div>

                          <p className="text-xs text-[#2C1E16] leading-relaxed">
                            {rec.matchReason}
                          </p>
                          <p className="text-xs text-[#5A4332] leading-relaxed">
                            Styling Tip: {rec.stylingTip}
                          </p>
                        </div>

                        <div className="pt-3 border-t border-[#DED7C6] space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-1">
                              {SIZES.map((sz) => (
                                <button
                                  key={sz}
                                  type="button"
                                  onClick={() =>
                                    setSelectedSizes((prev) => ({ ...prev, [item.id]: sz }))
                                  }
                                  className={`min-h-[36px] px-2.5 py-1 text-xs font-medium rounded border transition-colors ${
                                    chosenSize === sz
                                      ? 'bg-[#435334] text-[#FCFBF7] border-[#435334]'
                                      : 'bg-[#FCFBF7] text-[#5A4332] border-[#D4CCB8] hover:border-[#435334]'
                                  }`}
                                >
                                  {sz}
                                </button>
                              ))}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onTryInFittingRoom(item)}
                                className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#2C1E16] bg-[#FCFBF7] border border-[#D4CCB8] hover:border-[#435334] rounded-lg transition-colors whitespace-nowrap shrink-0"
                              >
                                <Ruler className="w-3.5 h-3.5 text-[#435334]" />
                                <span>Try in Fitting Room</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onAddToBag(item, chosenSize)}
                                className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-[#FCFBF7] bg-[#435334] hover:bg-[#344227] rounded-lg transition-colors whitespace-nowrap shrink-0"
                              >
                                <ShoppingBag className="w-3.5 h-3.5" />
                                <span>Add Size {chosenSize}</span>
                              </button>
                            </div>
                          </div>

                          <p className="text-[11px] font-mono tabular-nums text-[#5A4332]">
                            {getCompactSizeSummary(item.category, chosenSize)}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {/* Optional Follow-Up Refinement to the Same Single Agent */}
              <form
                onSubmit={handleFollowUpSubmit}
                className="pt-5 border-t border-[#DED7C6] flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5"
              >
                <input
                  type="text"
                  value={followUpInput}
                  onChange={(e) => setFollowUpInput(e.target.value)}
                  placeholder="Optional adjustment (e.g., add a matching scarf or switch to trousers)..."
                  className="flex-1 min-h-[44px] px-3.5 py-2 text-sm bg-white rounded-lg border border-[#D4CCB8] text-[#2C1E16] focus:border-[#435334] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={loading || followUpInput.trim().length === 0}
                  className="min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-medium bg-[#5C3D28] hover:bg-[#472E1E] text-[#FCFBF7] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Refine Selection</span>
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

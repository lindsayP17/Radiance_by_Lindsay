import heroBengaliMannequinsImg from '../assets/images/hero_bengali_textile_mannequins_1793006669614.jpg';
import kurtiTerracottaJamdaniImg from '../assets/images/kurti_terracotta_jamdani_1793006671845.jpg';
import tradtopIndigoSilkImg from '../assets/images/tradtop_indigo_rajshahi_silk_1793006673381.jpg';
import westtopOchreLinenImg from '../assets/images/westtop_ochre_linen_blouse_1793006674380.jpg';
import skirtTealTangailImg from '../assets/images/skirt_teal_tangail_cotton_1793006676286.jpg';
import trousersPeriwinkleLinenImg from '../assets/images/trousers_periwinkle_linen_1793006679141.jpg';
import scarfCrimsonMuslinImg from '../assets/images/scarf_crimson_dhakai_muslin_1793006679093.jpg';
import {
  BLUEPRINT_CONSTRAINTS,
  type GarmentCategory,
  type GarmentItem,
  type GarmentSize,
  type GarmentTone,
} from '../types';

export type MeasurementUnit = 'in' | 'cm';

export interface SizeMeasurementSpec {
  size: GarmentSize;
  shortIn: string;
  shortCm: string;
  fields: Array<{
    label: string;
    inValue: string;
    cmValue: string;
  }>;
}

export function getCategorySizeChart(category: GarmentCategory): SizeMeasurementSpec[] {
  if (category === 'Long Skirts' || category === 'Trousers') {
    const lengthLabel = category === 'Trousers' ? 'Outseam' : 'Length';
    return [
      {
        size: 'XS',
        shortIn: 'W 26"',
        shortCm: 'W 66cm',
        fields: [
          { label: 'Waist', inValue: '26"', cmValue: '66 cm' },
          { label: 'Hip', inValue: '35"', cmValue: '89 cm' },
          { label: lengthLabel, inValue: '38"', cmValue: '97 cm' },
        ],
      },
      {
        size: 'S',
        shortIn: 'W 28"',
        shortCm: 'W 71cm',
        fields: [
          { label: 'Waist', inValue: '28"', cmValue: '71 cm' },
          { label: 'Hip', inValue: '37"', cmValue: '94 cm' },
          { label: lengthLabel, inValue: '39"', cmValue: '99 cm' },
        ],
      },
      {
        size: 'M',
        shortIn: 'W 30"',
        shortCm: 'W 76cm',
        fields: [
          { label: 'Waist', inValue: '30"', cmValue: '76 cm' },
          { label: 'Hip', inValue: '39"', cmValue: '99 cm' },
          { label: lengthLabel, inValue: '40"', cmValue: '102 cm' },
        ],
      },
      {
        size: 'L',
        shortIn: 'W 32–34"',
        shortCm: 'W 81–86cm',
        fields: [
          { label: 'Waist', inValue: '32–34"', cmValue: '81–86 cm' },
          { label: 'Hip', inValue: '41–43"', cmValue: '104–109 cm' },
          { label: lengthLabel, inValue: '41"', cmValue: '104 cm' },
        ],
      },
      {
        size: 'XL',
        shortIn: 'W 36"',
        shortCm: 'W 91cm',
        fields: [
          { label: 'Waist', inValue: '36"', cmValue: '91 cm' },
          { label: 'Hip', inValue: '45"', cmValue: '114 cm' },
          { label: lengthLabel, inValue: '42"', cmValue: '107 cm' },
        ],
      },
    ];
  }

  if (category === 'Scarves') {
    return [
      {
        size: 'XS',
        shortIn: '72" L',
        shortCm: '183cm',
        fields: [
          { label: 'Width', inValue: '26"', cmValue: '66 cm' },
          { label: 'Drape Length', inValue: '72"', cmValue: '183 cm' },
        ],
      },
      {
        size: 'S',
        shortIn: '76" L',
        shortCm: '193cm',
        fields: [
          { label: 'Width', inValue: '28"', cmValue: '71 cm' },
          { label: 'Drape Length', inValue: '76"', cmValue: '193 cm' },
        ],
      },
      {
        size: 'M',
        shortIn: '80" L',
        shortCm: '203cm',
        fields: [
          { label: 'Width', inValue: '30"', cmValue: '76 cm' },
          { label: 'Drape Length', inValue: '80"', cmValue: '203 cm' },
        ],
      },
      {
        size: 'L',
        shortIn: '84" L',
        shortCm: '213cm',
        fields: [
          { label: 'Width', inValue: '32"', cmValue: '81 cm' },
          { label: 'Drape Length', inValue: '84"', cmValue: '213 cm' },
        ],
      },
      {
        size: 'XL',
        shortIn: '88" L',
        shortCm: '224cm',
        fields: [
          { label: 'Width', inValue: '34"', cmValue: '86 cm' },
          { label: 'Drape Length', inValue: '88"', cmValue: '224 cm' },
        ],
      },
    ];
  }

  if (category === 'Western Tops' || category === 'Traditional Tops') {
    const isTrad = category === 'Traditional Tops';
    return [
      {
        size: 'XS',
        shortIn: '32"',
        shortCm: '81cm',
        fields: [
          { label: 'Bust', inValue: '32"', cmValue: '81 cm' },
          { label: 'Waist', inValue: '26"', cmValue: '66 cm' },
          { label: 'Shoulder', inValue: '13.5"', cmValue: '34 cm' },
          { label: 'Length', inValue: isTrad ? '26"' : '23"', cmValue: isTrad ? '66 cm' : '58 cm' },
        ],
      },
      {
        size: 'S',
        shortIn: '34"',
        shortCm: '86cm',
        fields: [
          { label: 'Bust', inValue: '34"', cmValue: '86 cm' },
          { label: 'Waist', inValue: '28"', cmValue: '71 cm' },
          { label: 'Shoulder', inValue: '14"', cmValue: '36 cm' },
          { label: 'Length', inValue: isTrad ? '27"' : '24"', cmValue: isTrad ? '69 cm' : '61 cm' },
        ],
      },
      {
        size: 'M',
        shortIn: '36"',
        shortCm: '91cm',
        fields: [
          { label: 'Bust', inValue: '36"', cmValue: '91 cm' },
          { label: 'Waist', inValue: '30"', cmValue: '76 cm' },
          { label: 'Shoulder', inValue: '14.5"', cmValue: '37 cm' },
          { label: 'Length', inValue: isTrad ? '28"' : '25"', cmValue: isTrad ? '71 cm' : '64 cm' },
        ],
      },
      {
        size: 'L',
        shortIn: '38–40"',
        shortCm: '97–102cm',
        fields: [
          { label: 'Bust', inValue: '38–40"', cmValue: '97–102 cm' },
          { label: 'Waist', inValue: '32–34"', cmValue: '81–86 cm' },
          { label: 'Shoulder', inValue: '15.5"', cmValue: '39 cm' },
          { label: 'Length', inValue: isTrad ? '29"' : '26"', cmValue: isTrad ? '74 cm' : '66 cm' },
        ],
      },
      {
        size: 'XL',
        shortIn: '42"',
        shortCm: '107cm',
        fields: [
          { label: 'Bust', inValue: '42"', cmValue: '107 cm' },
          { label: 'Waist', inValue: '36"', cmValue: '91 cm' },
          { label: 'Shoulder', inValue: '16"', cmValue: '41 cm' },
          { label: 'Length', inValue: isTrad ? '30"' : '27"', cmValue: isTrad ? '76 cm' : '69 cm' },
        ],
      },
    ];
  }

  // Default: Kurtis
  return [
    {
      size: 'XS',
      shortIn: '32"',
      shortCm: '81cm',
      fields: [
        { label: 'Bust', inValue: '32"', cmValue: '81 cm' },
        { label: 'Waist', inValue: '26"', cmValue: '66 cm' },
        { label: 'Hip', inValue: '35"', cmValue: '89 cm' },
        { label: 'Length', inValue: '41"', cmValue: '104 cm' },
      ],
    },
    {
      size: 'S',
      shortIn: '34"',
      shortCm: '86cm',
      fields: [
        { label: 'Bust', inValue: '34"', cmValue: '86 cm' },
        { label: 'Waist', inValue: '28"', cmValue: '71 cm' },
        { label: 'Hip', inValue: '37"', cmValue: '94 cm' },
        { label: 'Length', inValue: '42"', cmValue: '107 cm' },
      ],
    },
    {
      size: 'M',
      shortIn: '36"',
      shortCm: '91cm',
      fields: [
        { label: 'Bust', inValue: '36"', cmValue: '91 cm' },
        { label: 'Waist', inValue: '30"', cmValue: '76 cm' },
        { label: 'Hip', inValue: '39"', cmValue: '99 cm' },
        { label: 'Length', inValue: '43"', cmValue: '109 cm' },
      ],
    },
    {
      size: 'L',
      shortIn: '38–40"',
      shortCm: '97–102cm',
      fields: [
        { label: 'Bust', inValue: '38–40"', cmValue: '97–102 cm' },
        { label: 'Waist', inValue: '32–34"', cmValue: '81–86 cm' },
        { label: 'Hip', inValue: '41–43"', cmValue: '104–109 cm' },
        { label: 'Length', inValue: '44"', cmValue: '112 cm' },
      ],
    },
    {
      size: 'XL',
      shortIn: '42"',
      shortCm: '107cm',
      fields: [
        { label: 'Bust', inValue: '42"', cmValue: '107 cm' },
        { label: 'Waist', inValue: '36"', cmValue: '91 cm' },
        { label: 'Hip', inValue: '45"', cmValue: '114 cm' },
        { label: 'Length', inValue: '45"', cmValue: '114 cm' },
      ],
    },
  ];
}

export function getSizeMeasurementSpec(
  category: GarmentCategory,
  size: GarmentSize
): SizeMeasurementSpec {
  const chart = getCategorySizeChart(category);
  return chart.find((row) => row.size === size) || chart[2];
}

export function getCompactSizeSummary(category: GarmentCategory, size: GarmentSize): string {
  const spec = getSizeMeasurementSpec(category, size);
  const parts = spec.fields.map((f, idx) =>
    idx === 0 ? `${f.label} ${f.inValue} (${f.cmValue})` : `${f.label} ${f.inValue}`
  );
  return `Size ${size}: ${parts.join(' · ')}`;
}

export const HERO_CAMPAIGN_IMAGE = heroBengaliMannequinsImg;

export const ALLOWED_CATEGORIES: GarmentCategory[] = [
  'Western Tops',
  'Traditional Tops',
  'Kurtis',
  'Long Skirts',
  'Trousers',
  'Scarves',
];

export const FREE_SHIPPING_THRESHOLD_POISHA = 400000; // ৳4,000
export const STANDARD_SHIPPING_POISHA = 12000; // ৳120 nationwide courier

export function normalizeBangladeshiCategory(raw: unknown): GarmentCategory {
  if (typeof raw === 'string' && (ALLOWED_CATEGORIES as string[]).includes(raw)) {
    return raw as GarmentCategory;
  }
  return 'Kurtis';
}

export const STARTER_CATALOG: GarmentItem[] = [
  {
    id: 'bd_kurti_jamdani_01',
    name: 'Sonargaon Terracotta Jamdani Kurti',
    category: 'Kurtis',
    colorTone: 'warm',
    colorName: 'Terracotta Coral & Marigold Gold',
    swatchClass: 'bg-[#C4553A]',
    priceCents: 485000, // ৳4,850
    fabric: 'Handwoven Sonargaon Jamdani Cotton-Muslin',
    description:
      'Straight-cut mid-length Bangladeshi Kurti featuring authentic geometric Jamdani buti motifs in marigold gold over warm terracotta-coral cotton-muslin.',
    imageDataUrl: kurtiTerracottaJamdaniImg,
  },
  {
    id: 'bd_tradtop_silk_02',
    name: 'Padma Indigo Rajshahi Silk Tunic Top',
    category: 'Traditional Tops',
    colorTone: 'cool',
    colorName: 'Padma Indigo & Silver Alpona',
    swatchClass: 'bg-[#2B4C7E]',
    priceCents: 420000, // ৳4,200
    fabric: '100% Pure Rajshahi Mulberry Silk',
    description:
      'Lustrous cool-toned Rajshahi silk traditional top woven with silver-ivory Bengali nakshi and alpona border motifs at the mandarin neckline and cuffs.',
    imageDataUrl: tradtopIndigoSilkImg,
  },
  {
    id: 'bd_westtop_linen_03',
    name: 'Surma Honey-Ochre Kantha Linen Blouse',
    category: 'Western Tops',
    colorTone: 'warm',
    colorName: 'Marigold Ochre & Warm Coral',
    swatchClass: 'bg-[#D48C2A]',
    priceCents: 245000, // ৳2,450
    fabric: '100% Woven Bengali Linen with Kantha Stitch',
    description:
      'Contemporary Western wrap blouse in sunlit honey-ochre linen accented with artisanal Bengali floral kantha embroidery along the lapels and bishop cuffs.',
    imageDataUrl: westtopOchreLinenImg,
  },
  {
    id: 'bd_skirt_cotton_04',
    name: 'Rupsha Peacock-Teal Tangail Cotton Skirt',
    category: 'Long Skirts',
    colorTone: 'cool',
    colorName: 'Peacock Teal & Silver Temple-Weave',
    swatchClass: 'bg-[#1F6E75]',
    priceCents: 335000, // ৳3,350
    fabric: '100% Tangail Handloom Combed Cotton',
    description:
      'Ankle-grazing pleated long skirt in cool peacock-teal Tangail handloom cotton finished with a traditional silver-ivory Bengali temple-weave border.',
    imageDataUrl: skirtTealTangailImg,
  },
  {
    id: 'bd_trouser_linen_05',
    name: 'Nirala Periwinkle Woven Linen Trousers',
    category: 'Trousers',
    colorTone: 'cool',
    colorName: 'Slate Periwinkle & Indigo Trim',
    swatchClass: 'bg-[#5B6FA3]',
    priceCents: 285000, // ৳2,850
    fabric: '75% Pure Flax Linen, 25% Combed Cotton',
    description:
      'High-waist wide-leg tailored trousers in breathable cool slate-periwinkle linen detailed with a subtle woven Bengali geometric waistband trim.',
    imageDataUrl: trousersPeriwinkleLinenImg,
  },
  {
    id: 'bd_scarf_muslin_06',
    name: 'Dhakai Sindoor-Coral Muslin Jamdani Scarf',
    category: 'Scarves',
    colorTone: 'warm',
    colorName: 'Sindoor Coral & Saffron Gold',
    swatchClass: 'bg-[#C84339]',
    priceCents: 145000, // ৳1,450
    fabric: '85% Fine Dhakai Muslin, 15% Spun Silk',
    description:
      'Featherlight Dhakai muslin-silk stole in warm sindoor-coral and saffron-gold woven with fine Jamdani floral vine borders and hand-knotted tassels.',
    imageDataUrl: scarfCrimsonMuslinImg,
  },
];

export const PALETTE_SWATCH_GUIDE: Record<
  GarmentTone,
  Array<{ label: string; bgClass: string; note: string }>
> = {
  warm: [
    { label: 'Terracotta Jamdani', bgClass: 'bg-[#C4553A]', note: 'Warm coral-clay weave' },
    { label: 'Marigold Ochre', bgClass: 'bg-[#D48C2A]', note: 'Sunlit kantha linen' },
    { label: 'Sindoor Muslin', bgClass: 'bg-[#C84339]', note: 'Festive crimson-coral' },
    { label: 'Saffron Silk', bgClass: 'bg-[#DF9E38]', note: 'Golden Bengali motif' },
  ],
  cool: [
    { label: 'Padma Indigo', bgClass: 'bg-[#2B4C7E]', note: 'Deep Rajshahi silk' },
    { label: 'Peacock Teal', bgClass: 'bg-[#1F6E75]', note: 'Tangail cotton weave' },
    { label: 'Slate Periwinkle', bgClass: 'bg-[#5B6FA3]', note: 'Cool tailored linen' },
    { label: 'Jamun Plum', bgClass: 'bg-[#6E3B62]', note: 'Cool berry accent' },
  ],
};

export const STARTER_CATALOG_IDS: string[] = STARTER_CATALOG.map((item) => item.id);

export function formatTaka(poisha: number): string {
  const taka = Math.round(poisha / 100);
  return `৳${taka.toLocaleString('en-IN')}`;
}

export async function compressImageFileToDataUrl(file: File, maxDimension = 760): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read selected image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Selected file is not a valid image.'));
      img.onload = () => {
        const dimensionSteps = [maxDimension, Math.min(maxDimension, 640), 520];

        for (const targetDim of dimensionSteps) {
          const scale = Math.min(1, targetDim / Math.max(img.width, img.height));
          const width = Math.max(1, Math.round(img.width * scale));
          const height = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Browser canvas unavailable for image compression.'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);

          let quality = 0.8;
          let dataUrl = canvas.toDataURL('image/jpeg', quality);
          while (dataUrl.length > BLUEPRINT_CONSTRAINTS.IMAGE_DATA_URL_MAX && quality > 0.35) {
            quality -= 0.1;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }

          if (dataUrl.length <= BLUEPRINT_CONSTRAINTS.IMAGE_DATA_URL_MAX) {
            resolve(dataUrl);
            return;
          }
        }

        reject(
          new Error('Image exceeds storage limit even after compression. Choose a smaller photo.')
        );
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export type AppPage =
  | 'home'
  | 'collection'
  | 'stylist'
  | 'fitting'
  | 'profile'
  | 'bag';
export type PaletteMode = 'neutral' | 'warm' | 'cool';
export type GarmentTone = 'warm' | 'cool';
export type GarmentCategory =
  | 'Western Tops'
  | 'Traditional Tops'
  | 'Kurtis'
  | 'Long Skirts'
  | 'Trousers'
  | 'Scarves';
export type FitPreference = 'tailored' | 'regular' | 'relaxed';
export type GarmentSize = 'XS' | 'S' | 'M' | 'L' | 'XL';
export type LightingPreset = 'warm' | 'daylight' | 'cool';

// Verbatim volumetric and pattern constants synced with firebase-blueprint.json & firestore.rules
export const BLUEPRINT_CONSTRAINTS = {
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  ID_MAX: 128,
  DISPLAY_NAME_MAX: 80,
  GARMENT_NAME_MIN: 2,
  GARMENT_NAME_MAX: 120,
  COLOR_NAME_MIN: 2,
  COLOR_NAME_MAX: 60,
  FABRIC_MIN: 2,
  FABRIC_MAX: 120,
  DESCRIPTION_MIN: 2,
  DESCRIPTION_MAX: 600,
  IMAGE_DATA_URL_MAX: 350000,
  STYLIST_NOTE_MAX: 600,
  ITEMS_SUMMARY_MAX: 300,
  RECIPIENT_NAME_MAX: 100,
  ADDRESS_MAX: 240,
  POSTAL_CODE_MAX: 20,
  PHONE_MAX: 30,
  HEIGHT_MIN: 120,
  HEIGHT_MAX: 230,
  PRICE_CENTS_MIN: 100000, // ৳1,000
  PRICE_CENTS_MAX: 500000, // ৳5,000
} as const;

export interface GarmentItem {
  id: string;
  ownerId?: string;
  isCustom?: boolean;
  name: string;
  category: GarmentCategory;
  colorTone: GarmentTone;
  colorName: string;
  swatchClass: string;
  priceCents: number; // Stored in Bangladeshi Taka poisha (1 BDT = 100 poisha)
  fabric: string;
  description: string;
  imageDataUrl: string;
  visibility?: 'public' | 'private';
}

export interface UserStyleProfile {
  uid: string;
  displayName: string;
  colorTone: PaletteMode;
  preferredFit: FitPreference;
  heightCm: number;
}

export interface SavedLookRecord {
  id: string;
  userId: string;
  garmentId: string;
  garmentName: string;
  colorTone: GarmentTone;
  recommendedSize: GarmentSize;
  lightingPreset: LightingPreset;
  stylistNote: string;
  createdAtMillis: number;
}

export interface WishlistItemRecord {
  id: string;
  userId: string;
  garmentId: string;
  garmentName: string;
  category: GarmentCategory;
  colorTone: GarmentTone;
  colorName: string;
  priceCents: number;
  createdAtMillis: number;
}

export interface OrderRecordItem {
  id: string;
  userId: string;
  orderNumber: string;
  itemCount: number;
  itemsSummary: string;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  paymentMethod: 'card' | 'cod';
  paymentRef: string;
  recipientName: string;
  shippingAddress: string;
  postalCode: string;
  phone: string;
  status: 'confirmed' | 'shipped' | 'delivered';
  createdAtMillis: number;
}

export interface CartItem {
  garment: GarmentItem;
  size: GarmentSize;
  quantity: number;
}

export interface OutfitAdvisorChoices {
  categories: GarmentCategory[]; // Empty array means any category / full outfit
  undertone: PaletteMode;
  preferredColor: string;
  preferredFabric: string;
  maxBudgetTaka: number;
  occasion: string;
}

export interface OutfitAdvisorResponse {
  outfitTitle: string;
  advisorSummary: string;
  recommendations: Array<{
    garmentId: string;
    matchReason: string;
    stylingTip: string;
  }>;
  colorHarmonyNote: string;
}

export interface StorefrontConfig {
  heroImageDataUrl: string;
  deletedStarterIds: string[];
}

import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  BLUEPRINT_CONSTRAINTS,
  OperationType,
  type FitPreference,
  type GarmentCategory,
  type GarmentSize,
  type GarmentTone,
  type LightingPreset,
  type PaletteMode,
  type UserStyleProfile,
} from './types';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const DEVELOPER_ADMIN_EMAIL = 'lindsayprachi@gmail.com';

export function isDeveloperAdminUser(user: User | null | undefined): boolean {
  return Boolean(
    user &&
      user.emailVerified &&
      user.email &&
      user.email.trim().toLowerCase() === DEVELOPER_ADMIN_EMAIL
  );
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, BLUEPRINT_CONSTRAINTS.ID_MAX);
  return cleaned.length > 0 ? cleaned : `id_${Date.now()}`;
}

function clampString(value: string, minLen: number, maxLen: number, fallback: string): string {
  const trimmed = value.trim();
  if (trimmed.length < minLen) {
    return fallback.slice(0, maxLen);
  }
  return trimmed.slice(0, maxLen);
}

export async function signInWithGooglePopup(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

export async function ensureUserStyleProfile(
  user: User,
  defaults?: Partial<Pick<UserStyleProfile, 'colorTone' | 'preferredFit' | 'heightCm'>>
): Promise<UserStyleProfile> {
  const uid = sanitizeId(user.uid);
  const path = `users/${uid}`;
  const profileRef = doc(db, 'users', uid);

  try {
    const snap = await getDoc(profileRef);
    if (snap.exists()) {
      const data = snap.data();
      return {
        uid: data.uid,
        displayName: data.displayName,
        colorTone: data.colorTone,
        preferredFit: data.preferredFit,
        heightCm: data.heightCm,
      };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  const displayName = clampString(
    user.displayName || 'Atelier Member',
    1,
    BLUEPRINT_CONSTRAINTS.DISPLAY_NAME_MAX,
    'Atelier Member'
  );
  const colorTone: PaletteMode = defaults?.colorTone || 'neutral';
  const preferredFit: FitPreference = defaults?.preferredFit || 'tailored';
  const heightCm = Math.max(
    BLUEPRINT_CONSTRAINTS.HEIGHT_MIN,
    Math.min(BLUEPRINT_CONSTRAINTS.HEIGHT_MAX, Math.round(defaults?.heightCm || 170))
  );

  try {
    await setDoc(profileRef, {
      uid,
      displayName,
      colorTone,
      preferredFit,
      heightCm,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  return { uid, displayName, colorTone, preferredFit, heightCm };
}

export async function updateStyleProfileInFirestore(
  uid: string,
  updates: {
    displayName: string;
    colorTone: PaletteMode;
    preferredFit: FitPreference;
    heightCm: number;
  }
): Promise<void> {
  const safeUid = sanitizeId(uid);
  const path = `users/${safeUid}`;
  const displayName = clampString(
    updates.displayName,
    1,
    BLUEPRINT_CONSTRAINTS.DISPLAY_NAME_MAX,
    'Atelier Member'
  );
  const heightCm = Math.max(
    BLUEPRINT_CONSTRAINTS.HEIGHT_MIN,
    Math.min(BLUEPRINT_CONSTRAINTS.HEIGHT_MAX, Math.round(updates.heightCm))
  );

  try {
    await updateDoc(doc(db, 'users', safeUid), {
      displayName,
      colorTone: updates.colorTone,
      preferredFit: updates.preferredFit,
      heightCm,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createCustomCatalogPiece(
  uid: string,
  input: {
    name: string;
    category: GarmentCategory;
    colorTone: GarmentTone;
    colorName: string;
    priceCents: number;
    fabric: string;
    description: string;
    imageDataUrl: string;
    visibility?: 'public' | 'private';
  }
): Promise<string> {
  const ownerId = sanitizeId(uid);
  const itemId = sanitizeId(`piece_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const path = `catalogItems/${itemId}`;

  const payload = {
    ownerId,
    name: clampString(
      input.name,
      BLUEPRINT_CONSTRAINTS.GARMENT_NAME_MIN,
      BLUEPRINT_CONSTRAINTS.GARMENT_NAME_MAX,
      'Untitled Piece'
    ),
    category: input.category,
    colorTone: input.colorTone,
    colorName: clampString(
      input.colorName,
      BLUEPRINT_CONSTRAINTS.COLOR_NAME_MIN,
      BLUEPRINT_CONSTRAINTS.COLOR_NAME_MAX,
      input.colorTone === 'warm' ? 'Terracotta Coral' : 'Padma Indigo'
    ),
    priceCents: Math.max(
      BLUEPRINT_CONSTRAINTS.PRICE_CENTS_MIN,
      Math.min(BLUEPRINT_CONSTRAINTS.PRICE_CENTS_MAX, Math.round(input.priceCents))
    ),
    fabric: clampString(
      input.fabric,
      BLUEPRINT_CONSTRAINTS.FABRIC_MIN,
      BLUEPRINT_CONSTRAINTS.FABRIC_MAX,
      'Atelier Blend'
    ),
    description: clampString(
      input.description,
      BLUEPRINT_CONSTRAINTS.DESCRIPTION_MIN,
      BLUEPRINT_CONSTRAINTS.DESCRIPTION_MAX,
      'Tailored silhouette crafted for balanced undertone harmony.'
    ),
    imageDataUrl: (input.imageDataUrl || '').slice(0, BLUEPRINT_CONSTRAINTS.IMAGE_DATA_URL_MAX),
    visibility: input.visibility || 'public',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'catalogItems', itemId), payload);
    return itemId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function upsertCatalogPieceInFirestore(
  uid: string,
  itemId: string,
  input: {
    name: string;
    category: GarmentCategory;
    colorTone: GarmentTone;
    colorName: string;
    priceCents: number;
    fabric: string;
    description: string;
    imageDataUrl: string;
    visibility?: 'public' | 'private';
  }
): Promise<void> {
  const ownerId = sanitizeId(uid);
  const safeId = sanitizeId(itemId);
  const path = `catalogItems/${safeId}`;
  const itemRef = doc(db, 'catalogItems', safeId);

  const normalizedFields = {
    name: clampString(
      input.name,
      BLUEPRINT_CONSTRAINTS.GARMENT_NAME_MIN,
      BLUEPRINT_CONSTRAINTS.GARMENT_NAME_MAX,
      'Untitled Piece'
    ),
    category: input.category,
    colorTone: input.colorTone,
    colorName: clampString(
      input.colorName,
      BLUEPRINT_CONSTRAINTS.COLOR_NAME_MIN,
      BLUEPRINT_CONSTRAINTS.COLOR_NAME_MAX,
      input.colorTone === 'warm' ? 'Warm Terracotta' : 'Cool Indigo'
    ),
    priceCents: Math.max(
      BLUEPRINT_CONSTRAINTS.PRICE_CENTS_MIN,
      Math.min(BLUEPRINT_CONSTRAINTS.PRICE_CENTS_MAX, Math.round(input.priceCents))
    ),
    fabric: clampString(
      input.fabric,
      BLUEPRINT_CONSTRAINTS.FABRIC_MIN,
      BLUEPRINT_CONSTRAINTS.FABRIC_MAX,
      'Handwoven Cotton'
    ),
    description: clampString(
      input.description,
      BLUEPRINT_CONSTRAINTS.DESCRIPTION_MIN,
      BLUEPRINT_CONSTRAINTS.DESCRIPTION_MAX,
      'Tailored silhouette crafted for everyday comfort.'
    ),
    imageDataUrl: (input.imageDataUrl || '').slice(0, BLUEPRINT_CONSTRAINTS.IMAGE_DATA_URL_MAX),
    visibility: input.visibility || 'public',
  };

  let existsAlready = false;
  try {
    const snap = await getDoc(itemRef);
    existsAlready = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }

  if (existsAlready) {
    try {
      await updateDoc(itemRef, {
        ...normalizedFields,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  } else {
    try {
      await setDoc(itemRef, {
        ownerId,
        ...normalizedFields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }
}

export async function updateCatalogPiecePhotoInFirestore(
  itemId: string,
  imageDataUrl: string
): Promise<void> {
  const safeId = sanitizeId(itemId);
  const path = `catalogItems/${safeId}`;
  const trimmedDataUrl = imageDataUrl.slice(0, BLUEPRINT_CONSTRAINTS.IMAGE_DATA_URL_MAX);

  try {
    await updateDoc(doc(db, 'catalogItems', safeId), {
      imageDataUrl: trimmedDataUrl,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCustomCatalogPiece(itemId: string): Promise<void> {
  const safeId = sanitizeId(itemId);
  const path = `catalogItems/${safeId}`;
  try {
    await deleteDoc(doc(db, 'catalogItems', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

const ALLOWED_STARTER_IDS = new Set([
  'bd_kurti_jamdani_01',
  'bd_tradtop_silk_02',
  'bd_westtop_linen_03',
  'bd_skirt_cotton_04',
  'bd_trouser_linen_05',
  'bd_scarf_muslin_06',
]);

export async function deleteCatalogPieceEverywhereInFirestore(
  uid: string,
  itemId: string
): Promise<void> {
  const updatedBy = sanitizeId(uid);
  const safeId = sanitizeId(itemId);

  if (ALLOWED_STARTER_IDS.has(safeId)) {
    const configPath = 'storefrontConfig/main';
    const configRef = doc(db, 'storefrontConfig', 'main');
    let existingHero = '';
    let existingDeleted: string[] = [];
    let configExists = false;

    try {
      const snap = await getDoc(configRef);
      if (snap.exists()) {
        configExists = true;
        const data = snap.data();
        existingHero = typeof data.heroImageDataUrl === 'string' ? data.heroImageDataUrl : '';
        existingDeleted = Array.isArray(data.deletedStarterIds)
          ? data.deletedStarterIds.filter(
              (id): id is string => typeof id === 'string' && ALLOWED_STARTER_IDS.has(id)
            )
          : [];
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, configPath);
    }

    const nextDeleted = Array.from(new Set([...existingDeleted, safeId])).slice(0, 6);

    if (configExists) {
      try {
        await updateDoc(configRef, {
          updatedBy,
          deletedStarterIds: nextDeleted,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, configPath);
      }
    } else {
      try {
        await setDoc(configRef, {
          updatedBy,
          heroImageDataUrl: existingHero.slice(0, BLUEPRINT_CONSTRAINTS.IMAGE_DATA_URL_MAX),
          deletedStarterIds: nextDeleted,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, configPath);
      }
    }

    // Also remove any custom override doc for this starter item if one exists
    const itemPath = `catalogItems/${safeId}`;
    const itemRef = doc(db, 'catalogItems', safeId);
    try {
      const itemSnap = await getDoc(itemRef);
      if (itemSnap.exists()) {
        await deleteDoc(itemRef);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, itemPath);
    }
    return;
  }

  await deleteCustomCatalogPiece(safeId);
}

export async function updateStorefrontHeroImageInFirestore(
  uid: string,
  heroImageDataUrl: string
): Promise<void> {
  const updatedBy = sanitizeId(uid);
  const configPath = 'storefrontConfig/main';
  const configRef = doc(db, 'storefrontConfig', 'main');
  const trimmedHero = (heroImageDataUrl || '').slice(0, BLUEPRINT_CONSTRAINTS.IMAGE_DATA_URL_MAX);

  let configExists = false;
  let existingDeleted: string[] = [];

  try {
    const snap = await getDoc(configRef);
    if (snap.exists()) {
      configExists = true;
      const data = snap.data();
      existingDeleted = Array.isArray(data.deletedStarterIds)
        ? data.deletedStarterIds.filter(
            (id): id is string => typeof id === 'string' && ALLOWED_STARTER_IDS.has(id)
          )
        : [];
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, configPath);
  }

  if (configExists) {
    try {
      await updateDoc(configRef, {
        updatedBy,
        heroImageDataUrl: trimmedHero,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, configPath);
    }
  } else {
    try {
      await setDoc(configRef, {
        updatedBy,
        heroImageDataUrl: trimmedHero,
        deletedStarterIds: existingDeleted,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, configPath);
    }
  }
}

export async function saveLookToFirestore(
  uid: string,
  input: {
    garmentId: string;
    garmentName: string;
    colorTone: GarmentTone;
    recommendedSize: GarmentSize;
    lightingPreset: LightingPreset;
    stylistNote: string;
  }
): Promise<string> {
  const userId = sanitizeId(uid);
  const lookId = sanitizeId(`look_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const path = `users/${userId}/savedLooks/${lookId}`;

  try {
    await setDoc(doc(db, 'users', userId, 'savedLooks', lookId), {
      userId,
      garmentId: sanitizeId(input.garmentId),
      garmentName: clampString(input.garmentName, 1, BLUEPRINT_CONSTRAINTS.GARMENT_NAME_MAX, 'Atelier Look'),
      colorTone: input.colorTone,
      recommendedSize: input.recommendedSize,
      lightingPreset: input.lightingPreset,
      stylistNote: (input.stylistNote || '').trim().slice(0, BLUEPRINT_CONSTRAINTS.STYLIST_NOTE_MAX),
      createdAt: serverTimestamp(),
    });
    return lookId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteSavedLookFromFirestore(uid: string, lookId: string): Promise<void> {
  const userId = sanitizeId(uid);
  const safeLookId = sanitizeId(lookId);
  const path = `users/${userId}/savedLooks/${safeLookId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'savedLooks', safeLookId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function addWishlistItemToFirestore(
  uid: string,
  garment: {
    id: string;
    name: string;
    category: GarmentCategory;
    colorTone: GarmentTone;
    colorName: string;
    priceCents: number;
  }
): Promise<void> {
  const userId = sanitizeId(uid);
  const garmentId = sanitizeId(garment.id);
  const path = `users/${userId}/wishlist/${garmentId}`;

  try {
    await setDoc(doc(db, 'users', userId, 'wishlist', garmentId), {
      userId,
      garmentId,
      garmentName: clampString(
        garment.name,
        BLUEPRINT_CONSTRAINTS.GARMENT_NAME_MIN,
        BLUEPRINT_CONSTRAINTS.GARMENT_NAME_MAX,
        'Atelier Piece'
      ),
      category: garment.category,
      colorTone: garment.colorTone,
      colorName: clampString(
        garment.colorName,
        BLUEPRINT_CONSTRAINTS.COLOR_NAME_MIN,
        BLUEPRINT_CONSTRAINTS.COLOR_NAME_MAX,
        garment.colorTone === 'warm' ? 'Terracotta Coral' : 'Padma Indigo'
      ),
      priceCents: Math.max(
        BLUEPRINT_CONSTRAINTS.PRICE_CENTS_MIN,
        Math.min(BLUEPRINT_CONSTRAINTS.PRICE_CENTS_MAX, Math.round(garment.priceCents))
      ),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function removeWishlistItemFromFirestore(
  uid: string,
  rawGarmentId: string
): Promise<void> {
  const userId = sanitizeId(uid);
  const garmentId = sanitizeId(rawGarmentId);
  const path = `users/${userId}/wishlist/${garmentId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'wishlist', garmentId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveVerifiedOrderToFirestore(
  uid: string,
  order: {
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
  }
): Promise<string> {
  const userId = sanitizeId(uid);
  const orderId = sanitizeId(`ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  const path = `users/${userId}/orders/${orderId}`;

  const subtotalCents = Math.max(100000, Math.min(25000000, Math.round(order.subtotalCents)));
  const shippingCents = Math.max(0, Math.min(500000, Math.round(order.shippingCents)));
  const totalCents = subtotalCents + shippingCents;

  try {
    await setDoc(doc(db, 'users', userId, 'orders', orderId), {
      userId,
      orderNumber: sanitizeId(order.orderNumber).slice(0, 32),
      itemCount: Math.max(1, Math.min(50, Math.round(order.itemCount))),
      itemsSummary: clampString(order.itemsSummary, 2, BLUEPRINT_CONSTRAINTS.ITEMS_SUMMARY_MAX, 'RADIANCE Dhaka Order'),
      subtotalCents,
      shippingCents,
      totalCents,
      paymentMethod: order.paymentMethod,
      paymentRef: sanitizeId(order.paymentRef).slice(0, 128),
      recipientName: clampString(order.recipientName, 2, BLUEPRINT_CONSTRAINTS.RECIPIENT_NAME_MAX, 'Valued Client'),
      shippingAddress: clampString(order.shippingAddress, 4, BLUEPRINT_CONSTRAINTS.ADDRESS_MAX, 'Dhaka Atelier Pickup'),
      postalCode: clampString(order.postalCode, 2, BLUEPRINT_CONSTRAINTS.POSTAL_CODE_MAX, '1212'),
      phone: clampString(order.phone, 5, BLUEPRINT_CONSTRAINTS.PHONE_MAX, '+8801700000000'),
      status: 'confirmed',
      createdAt: serverTimestamp(),
    });
    return orderId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function timestampToMillis(ts: unknown): number {
  if (ts instanceof Timestamp) {
    return ts.toMillis();
  }
  return Date.now();
}

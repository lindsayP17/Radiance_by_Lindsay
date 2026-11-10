import { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import {
  ArrowLeft,
  Compass,
  Ruler,
  ShoppingBag,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import {
  STARTER_CATALOG,
  STARTER_CATALOG_IDS,
  normalizeBangladeshiCategory,
} from './data/catalog';
import {
  addWishlistItemToFirestore,
  auth,
  createCustomCatalogPiece,
  db,
  deleteCatalogPieceEverywhereInFirestore,
  deleteSavedLookFromFirestore,
  ensureUserStyleProfile,
  handleFirestoreError,
  isDeveloperAdminUser,
  removeWishlistItemFromFirestore,
  saveLookToFirestore,
  signInWithGooglePopup,
  signOutUser,
  timestampToMillis,
  updateStorefrontHeroImageInFirestore,
  updateStyleProfileInFirestore,
  upsertCatalogPieceInFirestore,
} from './firebase';
import {
  OperationType,
  type AppPage,
  type CartItem,
  type FitPreference,
  type GarmentCategory,
  type GarmentItem,
  type GarmentSize,
  type GarmentTone,
  type OrderRecordItem,
  type PaletteMode,
  type SavedLookRecord,
  type StorefrontConfig,
  type UserStyleProfile,
  type WishlistItemRecord,
} from './types';
import { HomePage } from './components/HomePage';
import { CollectionPage } from './components/CollectionPage';
import { VirtualFittingRoom } from './components/VirtualFittingRoom';
import { StylistPage } from './components/StylistPage';
import { ProfilePage } from './components/ProfilePage';
import { CheckoutPage } from './components/CheckoutPage';
import { CatalogManagerModal } from './components/CatalogManagerModal';
import { ProductDetailModal } from './components/ProductDetailModal';

const VALID_PAGES: AppPage[] = [
  'home',
  'collection',
  'stylist',
  'fitting',
  'profile',
  'bag',
];

const STARTER_IDS_SET = new Set(STARTER_CATALOG_IDS);

function parseHashPage(): AppPage {
  if (typeof window === 'undefined') return 'home';
  const raw = window.location.hash.replace(/^#/, '').trim();
  if (raw === 'studio') return 'stylist';
  return VALID_PAGES.includes(raw as AppPage) ? (raw as AppPage) : 'home';
}

export default function App() {
  const [activePage, setActivePage] = useState<AppPage>(parseHashPage);

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [userProfile, setUserProfile] = useState<UserStyleProfile | null>(null);

  const [activePalette, setActivePalette] = useState<PaletteMode>('neutral');
  const [categoryFilter, setCategoryFilter] = useState<'All' | GarmentCategory>('All');

  const [storefrontConfig, setStorefrontConfig] = useState<StorefrontConfig>({
    heroImageDataUrl: '',
    deletedStarterIds: [],
  });
  const [publicCustomItems, setPublicCustomItems] = useState<GarmentItem[]>([]);
  const [ownCustomItems, setOwnCustomItems] = useState<GarmentItem[]>([]);
  const [savedLooks, setSavedLooks] = useState<SavedLookRecord[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItemRecord[]>([]);
  const [orders, setOrders] = useState<OrderRecordItem[]>([]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [bagNotice, setBagNotice] = useState<string | null>(null);
  const [activePdpItem, setActivePdpItem] = useState<GarmentItem | null>(null);
  const [fittingRoomGarmentId, setFittingRoomGarmentId] = useState<string>(STARTER_CATALOG[0].id);

  const [catalogModalOpen, setCatalogModalOpen] = useState(false);
  const [editingCatalogItem, setEditingCatalogItem] = useState<GarmentItem | null>(null);

  const [authBannerError, setAuthBannerError] = useState<string | null>(null);
  const isDeveloperAdmin = isDeveloperAdminUser(currentUser);

  // Sync URL hash for clean multi-page back/forward support
  useEffect(() => {
    const onHashChange = () => {
      setActivePage(parseHashPage());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigateTo = (page: AppPage) => {
    setActivePage(page);
    if (typeof window !== 'undefined') {
      const nextHash = `#${page}`;
      if (window.location.hash !== nextHash) {
        window.history.pushState(null, '', nextHash);
      }
      window.scrollTo({ top: 0 });
    }
  };

  // Auto-dismiss bag confirmation banner
  useEffect(() => {
    if (!bagNotice) return;
    const timer = window.setTimeout(() => setBagNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [bagNotice]);

  // 1. Firebase Auth Listener + Profile Bootstrap
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setAuthReady(true);
      if (user) {
        try {
          const profile = await ensureUserStyleProfile(user, {
            colorTone: activePalette,
            preferredFit: 'tailored',
            heightCm: 164,
          });
          setUserProfile(profile);
          setActivePalette(profile.colorTone);
          setProfileReady(true);
        } catch (err) {
          console.error(err);
          setProfileReady(false);
        }
      } else {
        setUserProfile(null);
        setProfileReady(false);
        setSavedLooks([]);
        setWishlist([]);
        setOrders([]);
        setOwnCustomItems([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Public Storefront Configuration (Home Hero Image & Deleted Starter IDs) + Public Catalog Items
  useEffect(() => {
    if (!authReady) return;

    const configPath = 'storefrontConfig/main';
    const unsubConfig = onSnapshot(
      doc(db, 'storefrontConfig', 'main'),
      (snap) => {
        if (!snap.exists()) {
          setStorefrontConfig({ heroImageDataUrl: '', deletedStarterIds: [] });
          return;
        }
        const data = snap.data();
        setStorefrontConfig({
          heroImageDataUrl: typeof data.heroImageDataUrl === 'string' ? data.heroImageDataUrl : '',
          deletedStarterIds: Array.isArray(data.deletedStarterIds)
            ? data.deletedStarterIds.filter((id): id is string => typeof id === 'string')
            : [],
        });
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, configPath);
      }
    );

    const catalogPath = 'catalogItems';
    const q = query(collection(db, catalogPath), where('visibility', '==', 'public'));
    const unsubCatalog = onSnapshot(
      q,
      (snap) => {
        const items: GarmentItem[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ownerId: data.ownerId,
            isCustom: true,
            name: data.name,
            category: normalizeBangladeshiCategory(data.category),
            colorTone: data.colorTone as GarmentTone,
            colorName: data.colorName,
            swatchClass: data.colorTone === 'warm' ? 'bg-[#C4553A]' : 'bg-[#2B4C7E]',
            priceCents: data.priceCents,
            fabric: data.fabric,
            description: data.description,
            imageDataUrl: data.imageDataUrl || '',
            visibility: data.visibility,
          };
        });
        setPublicCustomItems(items);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, catalogPath);
      }
    );

    return () => {
      unsubConfig();
      unsubCatalog();
    };
  }, [authReady]);

  // 3. Authenticated User's Saved Looks, Wishlist, Orders, and (Developer-Only) Private Catalog Drafts
  useEffect(() => {
    if (!authReady || !currentUser || !profileReady) return;

    const uid = currentUser.uid;
    let unsubOwnCatalog: () => void = () => {};

    if (isDeveloperAdmin) {
      const ownCatalogQuery = query(collection(db, 'catalogItems'), where('ownerId', '==', uid));
      unsubOwnCatalog = onSnapshot(
        ownCatalogQuery,
        (snap) => {
          const items: GarmentItem[] = snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              ownerId: data.ownerId,
              isCustom: true,
              name: data.name,
              category: normalizeBangladeshiCategory(data.category),
              colorTone: data.colorTone as GarmentTone,
              colorName: data.colorName,
              swatchClass: data.colorTone === 'warm' ? 'bg-[#C4553A]' : 'bg-[#2B4C7E]',
              priceCents: data.priceCents,
              fabric: data.fabric,
              description: data.description,
              imageDataUrl: data.imageDataUrl || '',
              visibility: data.visibility,
            };
          });
          setOwnCustomItems(items);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'catalogItems')
      );
    } else {
      setOwnCustomItems([]);
    }

    const looksPath = `users/${uid}/savedLooks`;
    const looksQuery = query(collection(db, 'users', uid, 'savedLooks'), where('userId', '==', uid));
    const unsubLooks = onSnapshot(
      looksQuery,
      (snap) => {
        const list: SavedLookRecord[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              userId: data.userId,
              garmentId: data.garmentId,
              garmentName: data.garmentName,
              colorTone: data.colorTone,
              recommendedSize: data.recommendedSize,
              lightingPreset: data.lightingPreset,
              stylistNote: data.stylistNote,
              createdAtMillis: timestampToMillis(data.createdAt),
            };
          })
          .sort((a, b) => b.createdAtMillis - a.createdAtMillis);
        setSavedLooks(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, looksPath)
    );

    const wishlistPath = `users/${uid}/wishlist`;
    const wishlistQuery = query(
      collection(db, 'users', uid, 'wishlist'),
      where('userId', '==', uid)
    );
    const unsubWishlist = onSnapshot(
      wishlistQuery,
      (snap) => {
        const list: WishlistItemRecord[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              userId: data.userId,
              garmentId: data.garmentId,
              garmentName: data.garmentName,
              category: normalizeBangladeshiCategory(data.category),
              colorTone: data.colorTone,
              colorName: data.colorName,
              priceCents: data.priceCents,
              createdAtMillis: timestampToMillis(data.createdAt),
            };
          })
          .sort((a, b) => b.createdAtMillis - a.createdAtMillis);
        setWishlist(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, wishlistPath)
    );

    const ordersPath = `users/${uid}/orders`;
    const ordersQuery = query(collection(db, 'users', uid, 'orders'), where('userId', '==', uid));
    const unsubOrders = onSnapshot(
      ordersQuery,
      (snap) => {
        const list: OrderRecordItem[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              userId: data.userId,
              orderNumber: data.orderNumber,
              itemCount: data.itemCount,
              itemsSummary: data.itemsSummary,
              subtotalCents: data.subtotalCents,
              shippingCents: data.shippingCents,
              totalCents: data.totalCents,
              paymentMethod: data.paymentMethod,
              paymentRef: data.paymentRef,
              recipientName: data.recipientName,
              shippingAddress: data.shippingAddress,
              postalCode: data.postalCode,
              phone: data.phone,
              status: data.status,
              createdAtMillis: timestampToMillis(data.createdAt),
            };
          })
          .sort((a, b) => b.createdAtMillis - a.createdAtMillis);
        setOrders(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, ordersPath)
    );

    return () => {
      unsubOwnCatalog();
      unsubLooks();
      unsubWishlist();
      unsubOrders();
    };
  }, [authReady, currentUser, profileReady, isDeveloperAdmin]);

  // Combined Catalog: Custom items + Starter items (with Firestore edits merged and deleted starter items filtered out)
  const fullCatalog = useMemo(() => {
    const customMap = new Map<string, GarmentItem>();
    for (const item of publicCustomItems) customMap.set(item.id, item);
    for (const item of ownCustomItems) customMap.set(item.id, item);

    const deletedSet = new Set(storefrontConfig.deletedStarterIds);

    const brandNewItems = Array.from(customMap.values()).filter(
      (item) => !STARTER_IDS_SET.has(item.id)
    );

    const activeStarterItems = STARTER_CATALOG.filter(
      (starter) => !deletedSet.has(starter.id)
    )
      .map((starter) => customMap.get(starter.id) ?? starter)
      .filter((item) => isDeveloperAdmin || item.visibility !== 'private');

    return [...brandNewItems, ...activeStarterItems];
  }, [publicCustomItems, ownCustomItems, storefrontConfig.deletedStarterIds, isDeveloperAdmin]);

  const wishlistedIds = useMemo(
    () => new Set(wishlist.map((entry) => entry.garmentId)),
    [wishlist]
  );

  const filteredCatalog = useMemo(() => {
    return fullCatalog.filter((item) => {
      const matchesTone = activePalette === 'neutral' || item.colorTone === activePalette;
      const matchesCat = categoryFilter === 'All' || item.category === categoryFilter;
      return matchesTone && matchesCat;
    });
  }, [fullCatalog, activePalette, categoryFilter]);

  const selectedFittingGarment = useMemo(() => {
    return fullCatalog.find((g) => g.id === fittingRoomGarmentId) || fullCatalog[0];
  }, [fullCatalog, fittingRoomGarmentId]);

  const bagCount = useMemo(
    () => cart.reduce((acc, item) => acc + item.quantity, 0),
    [cart]
  );

  // 60-30-10 App UI Theme: Off-White Canvas, Warm-Stone Surfaces, Olive Green & Brown Accents
  const pageCanvasClass = 'bg-[#F7F4EC] text-[#2C1E16]';
  const primaryCtaClass = 'bg-[#435334] hover:bg-[#344227] text-[#FCFBF7]';

  const handleGoogleSignIn = async () => {
    setAuthBannerError(null);
    try {
      await signInWithGooglePopup();
    } catch (err) {
      setAuthBannerError(
        err instanceof Error ? err.message : 'Google Sign-In was cancelled or blocked.'
      );
    }
  };

  const handleToggleFavorite = async (item: GarmentItem) => {
    setAuthBannerError(null);
    if (!currentUser) {
      try {
        const signedInUser = await signInWithGooglePopup();
        const profile = await ensureUserStyleProfile(signedInUser, {
          colorTone: activePalette,
          preferredFit: 'tailored',
          heightCm: 164,
        });
        setUserProfile(profile);
        setProfileReady(true);
        await addWishlistItemToFirestore(signedInUser.uid, item);
      } catch (err) {
        setAuthBannerError(
          err instanceof Error
            ? err.message
            : 'Please sign in with Google to bookmark favorites.'
        );
      }
      return;
    }

    if (wishlistedIds.has(item.id)) {
      await removeWishlistItemFromFirestore(currentUser.uid, item.id);
    } else {
      await addWishlistItemToFirestore(currentUser.uid, item);
    }
  };

  const handlePaletteChange = async (nextPalette: PaletteMode) => {
    setActivePalette(nextPalette);
    if (currentUser && userProfile) {
      const updated = { ...userProfile, colorTone: nextPalette };
      setUserProfile(updated);
      try {
        await updateStyleProfileInFirestore(currentUser.uid, {
          displayName: updated.displayName,
          colorTone: nextPalette,
          preferredFit: updated.preferredFit,
          heightCm: updated.heightCm,
        });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleUpdateFullProfile = async (updates: {
    displayName: string;
    colorTone: PaletteMode;
    preferredFit: FitPreference;
    heightCm: number;
  }) => {
    if (!currentUser) return;
    await updateStyleProfileInFirestore(currentUser.uid, updates);
    setUserProfile({
      uid: currentUser.uid,
      ...updates,
    });
    setActivePalette(updates.colorTone);
  };

  const handleAddToBag = (garment: GarmentItem, size: GarmentSize) => {
    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (entry) => entry.garment.id === garment.id && entry.size === size
      );
      if (existingIdx >= 0) {
        return prev.map((entry, idx) =>
          idx === existingIdx
            ? { ...entry, quantity: Math.min(10, entry.quantity + 1) }
            : entry
        );
      }
      return [...prev, { garment, size, quantity: 1 }];
    });
    setBagNotice(`Added ${garment.name} (Size ${size}) to Shopping Bag.`);
  };

  const handleUpdateBagQuantity = (garmentId: string, size: GarmentSize, delta: number) => {
    setCart((prev) =>
      prev
        .map((entry) =>
          entry.garment.id === garmentId && entry.size === size
            ? { ...entry, quantity: Math.min(10, entry.quantity + delta) }
            : entry
        )
        .filter((entry) => entry.quantity > 0)
    );
  };

  const handleRemoveBagItem = (garmentId: string, size: GarmentSize) => {
    setCart((prev) =>
      prev.filter((entry) => !(entry.garment.id === garmentId && entry.size === size))
    );
  };

  const handleDeleteAnyPiece = async (itemId: string) => {
    if (!currentUser || !isDeveloperAdmin) return;
    await deleteCatalogPieceEverywhereInFirestore(currentUser.uid, itemId);
    setCart((prev) => prev.filter((entry) => entry.garment.id !== itemId));
    if (activePdpItem?.id === itemId) {
      setActivePdpItem(null);
    }
  };

  const desktopNavItems: Array<{ id: AppPage; label: string }> = [
    { id: 'collection', label: 'Collection' },
    { id: 'stylist', label: 'Outfit Advisor' },
    { id: 'fitting', label: 'Fitting Room' },
    {
      id: 'profile',
      label: wishlist.length > 0 ? `Profile (${wishlist.length})` : 'Profile',
    },
  ];

  const mobileNavItems: Array<{
    id: AppPage;
    label: string;
    icon: typeof Compass;
  }> = [
    { id: 'collection', label: 'Collection', icon: Compass },
    { id: 'stylist', label: 'Advisor', icon: Sparkles },
    { id: 'fitting', label: 'Fitting', icon: Ruler },
    {
      id: 'profile',
      label: wishlist.length > 0 ? `Profile (${wishlist.length})` : 'Profile',
      icon: UserIcon,
    },
  ];

  return (
    <div className={`min-h-screen flex flex-col transition-colors duration-200 ${pageCanvasClass}`}>
      {/* Exhaustive 3-Zone Top Bar Contract (Compact 52px on Mobile) */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-4 sm:px-6 md:px-10 py-2.5 md:py-4 border-b border-[#DED7C6] bg-[#FCFBF7]/95 backdrop-blur-xs">
        {activePage === 'home' ? (
          <button
            type="button"
            onClick={() => navigateTo('home')}
            className="font-editorial text-xl md:text-2xl font-semibold tracking-[0.18em] text-[#2C1E16] whitespace-nowrap shrink-0 cursor-pointer"
          >
            RADIANCE
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigateTo('home')}
            className="inline-flex items-center gap-2 min-h-[40px] text-[#2C1E16] hover:text-[#435334] transition-colors whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4 md:hidden" />
            <span className="md:hidden text-xs font-medium">Home</span>
            <span className="hidden md:inline font-editorial text-2xl font-semibold tracking-[0.18em]">
              RADIANCE
            </span>
          </button>
        )}

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#5A4332]">
          {desktopNavItems.map((navItem) => {
            const isActive = activePage === navItem.id;
            return (
              <button
                key={navItem.id}
                type="button"
                onClick={() => navigateTo(navItem.id)}
                className={`transition-colors whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'text-[#2C1E16] underline underline-offset-8 decoration-[#435334] decoration-2'
                    : 'hover:text-[#2C1E16] hover:underline underline-offset-8'
                }`}
              >
                {navItem.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => navigateTo('bag')}
            className={`min-h-[40px] inline-flex items-center gap-2 px-3.5 md:px-4 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${primaryCtaClass}`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Shopping Bag ({bagCount})</span>
            <span className="sm:hidden">Bag ({bagCount})</span>
          </button>
        </div>
      </header>

      {/* Active Page Content */}
      <main className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-6 md:px-10 pb-20 md:pb-12">
        {authBannerError && (
          <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-xs text-red-800">
            {authBannerError}
          </div>
        )}

        {bagNotice && (
          <div
            role="status"
            className="mt-4 rounded-lg bg-[#EFEBE0] border border-[#435334]/35 px-4 py-2.5 text-xs font-medium text-[#2C1E16]"
          >
            {bagNotice}
          </div>
        )}

        {activePage === 'home' && (
          <HomePage
            activePalette={activePalette}
            customHeroImageUrl={storefrontConfig.heroImageDataUrl}
            isDeveloperAdmin={isDeveloperAdmin}
            onPaletteChange={(next) => void handlePaletteChange(next)}
            onUpdateHeroImage={
              isDeveloperAdmin
                ? async (dataUrl) => {
                    if (!currentUser) return;
                    await updateStorefrontHeroImageInFirestore(currentUser.uid, dataUrl);
                  }
                : undefined
            }
          />
        )}

        {activePage === 'collection' && (
          <CollectionPage
            filteredCatalog={filteredCatalog}
            activePalette={activePalette}
            categoryFilter={categoryFilter}
            isDeveloperAdmin={isDeveloperAdmin}
            wishlistedIds={wishlistedIds}
            primaryCtaClass={primaryCtaClass}
            onPaletteChange={(next) => void handlePaletteChange(next)}
            onCategoryChange={setCategoryFilter}
            onOpenAddPieceModal={() => {
              if (!isDeveloperAdmin) return;
              setEditingCatalogItem(null);
              setCatalogModalOpen(true);
            }}
            onEditPiece={(item) => {
              if (!isDeveloperAdmin) return;
              setEditingCatalogItem(item);
              setCatalogModalOpen(true);
            }}
            onDeletePiece={async (item) => {
              await handleDeleteAnyPiece(item.id);
            }}
            onOpenProductDetail={(item) => setActivePdpItem(item)}
            onTryInFittingRoom={(item) => {
              setFittingRoomGarmentId(item.id);
              navigateTo('fitting');
            }}
            onToggleFavorite={handleToggleFavorite}
          />
        )}

        {activePage === 'stylist' && (
          <StylistPage
            activePalette={activePalette}
            preferredFit={(userProfile?.preferredFit as FitPreference) || 'tailored'}
            catalog={fullCatalog}
            onPaletteChange={(next) => void handlePaletteChange(next)}
            onOpenProductDetail={(item) => setActivePdpItem(item)}
            onTryInFittingRoom={(item) => {
              setFittingRoomGarmentId(item.id);
              navigateTo('fitting');
            }}
            onAddToBag={handleAddToBag}
          />
        )}

        {activePage === 'fitting' && (
          <VirtualFittingRoom
            catalog={fullCatalog}
            selectedGarment={selectedFittingGarment}
            activePalette={activePalette}
            defaultFit={(userProfile?.preferredFit as FitPreference) || 'tailored'}
            defaultHeightCm={userProfile?.heightCm || 164}
            isSignedIn={Boolean(currentUser)}
            savedLooks={savedLooks}
            onSelectGarment={(piece) => setFittingRoomGarmentId(piece.id)}
            onAddToBag={handleAddToBag}
            onSaveLook={async (lookInput) => {
              if (!currentUser) return;
              await saveLookToFirestore(currentUser.uid, lookInput);
            }}
            onDeleteLook={async (lookId) => {
              if (!currentUser) return;
              await deleteSavedLookFromFirestore(currentUser.uid, lookId);
            }}
            onSignInRequest={handleGoogleSignIn}
          />
        )}

        {activePage === 'profile' && (
          <ProfilePage
            initialTab="favorites"
            isSignedIn={Boolean(currentUser)}
            userEmail={currentUser?.email || null}
            profile={userProfile}
            wishlist={wishlist}
            catalog={fullCatalog}
            savedLooksCount={savedLooks.length}
            ordersCount={orders.length}
            onSignInRequest={handleGoogleSignIn}
            onSignOutRequest={signOutUser}
            onRemoveFavorite={async (garmentId) => {
              if (!currentUser) return;
              await removeWishlistItemFromFirestore(currentUser.uid, garmentId);
            }}
            onOpenProduct={(item) => setActivePdpItem(item)}
            onTryInFittingRoom={(item) => {
              setFittingRoomGarmentId(item.id);
              navigateTo('fitting');
            }}
            onAddToBag={handleAddToBag}
            onUpdateProfile={handleUpdateFullProfile}
          />
        )}

        {activePage === 'bag' && (
          <CheckoutPage
            cart={cart}
            orders={orders}
            userUid={currentUser?.uid || null}
            defaultRecipientName={userProfile?.displayName || currentUser?.displayName || ''}
            onUpdateQuantity={handleUpdateBagQuantity}
            onRemoveItem={handleRemoveBagItem}
            onClearCart={() => setCart([])}
            onSignInRequest={handleGoogleSignIn}
          />
        )}
      </main>

      {/* Quiet Editorial Footer Without Duplicate Navigation Links */}
      <footer className="pb-20 md:pb-0 border-t border-[#DED7C6] bg-[#EFEBE0]">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 md:px-10 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-[#6E5846]">
          <p className="font-editorial text-sm font-semibold tracking-[0.16em] text-[#2C1E16]">
            RADIANCE
          </p>
          <p>© 2026 RADIANCE · Dhaka, Bangladesh</p>
        </div>
      </footer>

      {/* Mobile Bottom Tab Bar (Single Entry Per Feature on Small Screens) */}
      <nav
        aria-label="Mobile feature navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 h-14 bg-[#FCFBF7]/95 backdrop-blur-xs border-t border-[#DED7C6] grid grid-cols-4 items-center"
      >
        {mobileNavItems.map((tab) => {
          const Icon = tab.icon;
          const isActive = activePage === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => navigateTo(tab.id)}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                isActive ? 'text-[#435334] font-semibold' : 'text-[#6E5846] hover:text-[#2C1E16]'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-[10px] leading-tight whitespace-nowrap truncate max-w-[78px]">
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Modals for Item Details & Developer-Only Piece Upload / Edit */}
      {isDeveloperAdmin && catalogModalOpen && (
        <CatalogManagerModal
          isOpen={catalogModalOpen}
          editingItem={editingCatalogItem}
          isDeveloperAdmin={isDeveloperAdmin}
          onClose={() => {
            setCatalogModalOpen(false);
            setEditingCatalogItem(null);
          }}
          onCreatePiece={async (pieceInput) => {
            if (!currentUser || !isDeveloperAdmin) return;
            await createCustomCatalogPiece(currentUser.uid, pieceInput);
          }}
          onSaveEditedPiece={async (itemId, pieceInput) => {
            if (!currentUser || !isDeveloperAdmin) return;
            await upsertCatalogPieceInFirestore(currentUser.uid, itemId, pieceInput);
          }}
          onDeletePiece={async (itemId) => {
            await handleDeleteAnyPiece(itemId);
          }}
        />
      )}

      <ProductDetailModal
        key={activePdpItem?.id ?? 'closed'}
        item={activePdpItem}
        canEditPhoto={isDeveloperAdmin}
        isFavorite={Boolean(activePdpItem && wishlistedIds.has(activePdpItem.id))}
        onClose={() => setActivePdpItem(null)}
        onAddToBag={handleAddToBag}
        onTryInFittingRoom={(item) => {
          setFittingRoomGarmentId(item.id);
          navigateTo('fitting');
        }}
        onToggleFavorite={handleToggleFavorite}
        onEditPhoto={(item) => {
          if (!isDeveloperAdmin) return;
          setEditingCatalogItem(item);
          setCatalogModalOpen(true);
        }}
      />
    </div>
  );
}

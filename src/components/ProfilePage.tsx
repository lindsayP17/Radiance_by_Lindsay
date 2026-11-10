import { useEffect, useState, type FormEvent } from 'react';
import { Heart, LogIn, LogOut, Ruler, ShoppingBag, Trash2, User as UserIcon } from 'lucide-react';
import { formatTaka, getCompactSizeSummary } from '../data/catalog';
import {
  BLUEPRINT_CONSTRAINTS,
  type FitPreference,
  type GarmentItem,
  type GarmentSize,
  type PaletteMode,
  type UserStyleProfile,
  type WishlistItemRecord,
} from '../types';
import { GarmentVisual } from './GarmentVisual';

interface ProfilePageProps {
  initialTab?: 'favorites' | 'profile';
  isSignedIn: boolean;
  userEmail: string | null;
  profile: UserStyleProfile | null;
  wishlist: WishlistItemRecord[];
  catalog: GarmentItem[];
  savedLooksCount: number;
  ordersCount: number;
  onSignInRequest: () => Promise<void>;
  onSignOutRequest: () => Promise<void>;
  onRemoveFavorite: (garmentId: string) => Promise<void>;
  onOpenProduct: (item: GarmentItem) => void;
  onTryInFittingRoom: (item: GarmentItem) => void;
  onAddToBag: (item: GarmentItem, size: GarmentSize) => void;
  onUpdateProfile: (updates: {
    displayName: string;
    colorTone: PaletteMode;
    preferredFit: FitPreference;
    heightCm: number;
  }) => Promise<void>;
}

const SIZES: GarmentSize[] = ['XS', 'S', 'M', 'L', 'XL'];

export function ProfilePage({
  initialTab = 'favorites',
  isSignedIn,
  userEmail,
  profile,
  wishlist,
  catalog,
  savedLooksCount,
  ordersCount,
  onSignInRequest,
  onSignOutRequest,
  onRemoveFavorite,
  onOpenProduct,
  onTryInFittingRoom,
  onAddToBag,
  onUpdateProfile,
}: ProfilePageProps) {
  const [activeTab, setActiveTab] = useState<'favorites' | 'profile'>(initialTab);
  const [selectedSizes, setSelectedSizes] = useState<Record<string, GarmentSize>>({});

  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [colorTone, setColorTone] = useState<PaletteMode>(profile?.colorTone || 'neutral');
  const [preferredFit, setPreferredFit] = useState<FitPreference>(
    profile?.preferredFit || 'tailored'
  );
  const [heightCm, setHeightCm] = useState<number>(profile?.heightCm || 164);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSavedMsg, setProfileSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setColorTone(profile.colorTone);
      setPreferredFit(profile.preferredFit);
      setHeightCm(profile.heightCm);
    }
  }, [profile]);

  const getSizeForFavorite = (garmentId: string): GarmentSize => selectedSizes[garmentId] || 'M';

  const resolveGarment = (fav: WishlistItemRecord): GarmentItem => {
    const found = catalog.find((item) => item.id === fav.garmentId);
    if (found) return found;
    return {
      id: fav.garmentId,
      name: fav.garmentName,
      category: fav.category,
      colorTone: fav.colorTone,
      colorName: fav.colorName,
      swatchClass: fav.colorTone === 'warm' ? 'bg-[#C4553A]' : 'bg-[#2B4C7E]',
      priceCents: fav.priceCents,
      fabric: 'Dhaka Atelier Archive',
      description: 'Saved favorite from the RADIANCE Bangladesh collection.',
      imageDataUrl: '',
    };
  };

  const handleSaveProfileSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSavedMsg(null);
    try {
      await onUpdateProfile({
        displayName: displayName.trim() || 'Atelier Member',
        colorTone,
        preferredFit,
        heightCm,
      });
      setProfileSavedMsg('Style profile preferences saved.');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="py-6 md:py-10 max-w-4xl mx-auto space-y-6">
      {/* Profile Menu Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[#DED7C6]">
        <div>
          <p className="text-xs text-[#7A6350] mb-1.5">RADIANCE Dhaka Profile Menu</p>
          <h1 className="text-3xl md:text-4xl font-semibold text-[#2C1E16] text-balance">
            {isSignedIn ? profile?.displayName || 'Atelier Member' : 'Member Profile & Favorites'}
          </h1>
          {isSignedIn && userEmail && (
            <p className="text-xs text-[#7A6350] mt-1">{userEmail}</p>
          )}
        </div>

        {isSignedIn && (
          <button
            type="button"
            onClick={() => void onSignOutRequest()}
            className="min-h-[42px] self-start sm:self-auto inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-[#5A4332] hover:text-[#2C1E16] border border-[#D4CCB8] bg-[#FCFBF7] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        )}
      </div>

      {/* Dedicated Profile Menu Navigation: My Favorites & Style Profile */}
      <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#EFEBE0] rounded-lg">
        <button
          type="button"
          onClick={() => setActiveTab('favorites')}
          className={`min-h-[42px] inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
            activeTab === 'favorites'
              ? 'bg-[#FCFBF7] text-[#2C1E16] shadow-xs'
              : 'text-[#6E5846] hover:text-[#2C1E16]'
          }`}
        >
          <Heart
            className={`w-3.5 h-3.5 ${wishlist.length > 0 ? 'fill-current text-[#5C3D28]' : ''}`}
          />
          <span>My Favorites ({wishlist.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`min-h-[42px] inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
            activeTab === 'profile'
              ? 'bg-[#FCFBF7] text-[#2C1E16] shadow-xs'
              : 'text-[#6E5846] hover:text-[#2C1E16]'
          }`}
        >
          <UserIcon className="w-3.5 h-3.5" />
          <span>Style Profile</span>
        </button>
      </div>

      {!isSignedIn ? (
        <div className="rounded-xl border border-[#DED7C6] bg-[#FCFBF7] p-8 md:p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#EFEBE0] text-[#435334] flex items-center justify-center mx-auto">
            <Heart className="w-5 h-5" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="text-xl font-semibold text-[#2C1E16]">
              Sign in to Access My Favorites &amp; Style Profile
            </h2>
            <p className="text-sm text-[#5A4332] leading-relaxed">
              Bookmark Kurtis, Western &amp; traditional tops, long skirts, trousers, and scarves from the Collection and keep your personal wishlist synced across devices.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onSignInRequest()}
            className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 text-xs font-medium bg-[#435334] text-[#FCFBF7] hover:bg-[#344227] rounded-lg transition-colors whitespace-nowrap"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign in with Google</span>
          </button>
        </div>
      ) : activeTab === 'favorites' ? (
        wishlist.length === 0 ? (
          <div className="rounded-xl border border-[#DED7C6] bg-[#FCFBF7] p-8 md:p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#EFEBE0] text-[#5A4332] flex items-center justify-center mx-auto">
              <Heart className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-semibold text-[#2C1E16]">No Saved Favorites Yet</h2>
            <p className="text-sm text-[#5A4332] max-w-md mx-auto leading-relaxed">
              Tap the heart icon on any garment in the Collection page to bookmark your favorite pieces here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-[#7A6350]">
              <span>
                {wishlist.length} {wishlist.length === 1 ? 'Saved Piece' : 'Saved Pieces'}
              </span>
              <span>Synced to your account</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {wishlist.map((fav) => {
                const garment = resolveGarment(fav);
                const chosenSize = getSizeForFavorite(fav.garmentId);

                return (
                  <div
                    key={fav.id}
                    className="rounded-xl border border-[#DED7C6] bg-[#FCFBF7] p-4 flex gap-4"
                  >
                    <div
                      onClick={() => onOpenProduct(garment)}
                      className="w-24 sm:w-28 aspect-[3/4] rounded-lg overflow-hidden border border-[#DED7C6] bg-[#EFEBE0] cursor-pointer shrink-0"
                    >
                      <GarmentVisual
                        src={garment.imageDataUrl}
                        alt={garment.name}
                        tone={garment.colorTone}
                        category={garment.category}
                        className="w-full h-full"
                      />
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[11px] text-[#7A6350]">
                              {garment.category} ·{' '}
                              {garment.colorTone === 'warm' ? 'Warm Tone' : 'Cool Tone'}
                            </p>
                            <button
                              type="button"
                              onClick={() => onOpenProduct(garment)}
                              className="text-sm font-semibold text-[#2C1E16] hover:underline underline-offset-4 text-left truncate block max-w-full mt-0.5"
                            >
                              {garment.name}
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => void onRemoveFavorite(fav.garmentId)}
                            className="min-h-[36px] min-w-[36px] flex items-center justify-center text-[#7A6350] hover:text-red-800 rounded-md shrink-0"
                            aria-label={`Remove ${garment.name} from My Favorites`}
                            title="Remove from My Favorites"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <p className="text-xs font-mono tabular-nums font-medium text-[#435334] mt-1">
                          {formatTaka(garment.priceCents)}
                        </p>
                      </div>

                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-1">
                          {SIZES.map((sz) => (
                            <button
                              key={sz}
                              type="button"
                              onClick={() =>
                                setSelectedSizes((prev) => ({
                                  ...prev,
                                  [fav.garmentId]: sz,
                                }))
                              }
                              className={`min-h-[34px] px-2.5 py-1 text-[11px] font-medium rounded border transition-colors ${
                                chosenSize === sz
                                  ? 'bg-[#435334] text-[#FCFBF7] border-[#435334]'
                                  : 'bg-white text-[#5A4332] border-[#D4CCB8] hover:border-[#435334]'
                              }`}
                            >
                              {sz}
                            </button>
                          ))}
                        </div>

                        <p className="text-[11px] font-mono tabular-nums text-[#5A4332]">
                          {getCompactSizeSummary(garment.category, chosenSize)}
                        </p>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onAddToBag(garment, chosenSize)}
                            className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium bg-[#435334] text-[#FCFBF7] hover:bg-[#344227] rounded-lg transition-colors whitespace-nowrap"
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>Add Size {chosenSize}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onTryInFittingRoom(garment)}
                            className="min-h-[40px] inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium text-[#2C1E16] bg-[#F7F4EC] hover:bg-[#EFEBE0] border border-[#D4CCB8] hover:border-[#435334] rounded-lg transition-colors whitespace-nowrap shrink-0"
                            title="Try in Virtual Fitting Room"
                          >
                            <Ruler className="w-3.5 h-3.5 text-[#435334]" />
                            <span>Try On</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      ) : (
        <div className="rounded-xl border border-[#DED7C6] bg-[#FCFBF7] p-6 md:p-8 space-y-6">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3.5 rounded-lg border border-[#DED7C6] bg-[#F7F4EC]">
              <p className="text-xl font-mono tabular-nums font-semibold text-[#2C1E16]">
                {wishlist.length}
              </p>
              <p className="text-xs text-[#7A6350] mt-0.5">Favorites</p>
            </div>
            <div className="p-3.5 rounded-lg border border-[#DED7C6] bg-[#F7F4EC]">
              <p className="text-xl font-mono tabular-nums font-semibold text-[#2C1E16]">
                {savedLooksCount}
              </p>
              <p className="text-xs text-[#7A6350] mt-0.5">Saved Looks</p>
            </div>
            <div className="p-3.5 rounded-lg border border-[#DED7C6] bg-[#F7F4EC]">
              <p className="text-xl font-mono tabular-nums font-semibold text-[#2C1E16]">
                {ordersCount}
              </p>
              <p className="text-xs text-[#7A6350] mt-0.5">Orders</p>
            </div>
          </div>

          <form onSubmit={handleSaveProfileSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#5A4332] mb-1">Display Name</label>
              <input
                type="text"
                required
                maxLength={BLUEPRINT_CONSTRAINTS.DISPLAY_NAME_MAX}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white rounded-lg border border-[#D4CCB8] text-[#2C1E16] focus:border-[#435334] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#5A4332] mb-1">
                Default Undertone Palette
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#EFEBE0] rounded-lg">
                {(['neutral', 'warm', 'cool'] as PaletteMode[]).map((tone) => (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => setColorTone(tone)}
                    className={`min-h-[40px] py-2 px-2.5 text-xs font-medium capitalize rounded-md transition-colors whitespace-nowrap ${
                      colorTone === tone
                        ? 'bg-[#FCFBF7] text-[#2C1E16] shadow-xs'
                        : 'text-[#6E5846] hover:text-[#2C1E16]'
                    }`}
                  >
                    {tone === 'neutral' ? 'All Tones' : `${tone} Tone`}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#5A4332] mb-1">
                Preferred Silhouette Fit
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#EFEBE0] rounded-lg">
                {(['tailored', 'regular', 'relaxed'] as FitPreference[]).map((fit) => (
                  <button
                    key={fit}
                    type="button"
                    onClick={() => setPreferredFit(fit)}
                    className={`min-h-[40px] py-2 px-2.5 text-xs font-medium capitalize rounded-md transition-colors whitespace-nowrap ${
                      preferredFit === fit
                        ? 'bg-[#FCFBF7] text-[#2C1E16] shadow-xs'
                        : 'text-[#6E5846] hover:text-[#2C1E16]'
                    }`}
                  >
                    {fit}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="flex justify-between text-xs font-medium text-[#5A4332] mb-1">
                <span>Height</span>
                <span className="font-mono tabular-nums">{heightCm} cm</span>
              </label>
              <input
                type="range"
                min={BLUEPRINT_CONSTRAINTS.HEIGHT_MIN}
                max={BLUEPRINT_CONSTRAINTS.HEIGHT_MAX}
                value={heightCm}
                onChange={(e) => setHeightCm(Number(e.target.value))}
                className="w-full accent-[#435334]"
              />
            </div>

            {profileSavedMsg && (
              <p className="text-xs text-[#2C1E16] bg-[#EFEBE0] border border-[#DED7C6] rounded-lg px-3.5 py-2.5">
                {profileSavedMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={savingProfile}
              className="w-full min-h-[44px] py-2.5 px-4 text-xs font-medium bg-[#435334] text-[#FCFBF7] hover:bg-[#344227] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
            >
              {savingProfile ? 'Saving Preferences...' : 'Save Style Profile'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

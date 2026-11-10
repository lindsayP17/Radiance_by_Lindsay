import { useState, type ChangeEvent } from 'react';
import { Camera, RotateCcw } from 'lucide-react';
import { HERO_CAMPAIGN_IMAGE, compressImageFileToDataUrl } from '../data/catalog';
import type { PaletteMode } from '../types';

interface HomePageProps {
  activePalette: PaletteMode;
  customHeroImageUrl: string;
  isDeveloperAdmin: boolean;
  onPaletteChange: (next: PaletteMode) => void;
  onUpdateHeroImage?: (dataUrl: string) => Promise<void>;
}

export function HomePage({
  activePalette,
  customHeroImageUrl,
  isDeveloperAdmin,
  onPaletteChange,
  onUpdateHeroImage,
}: HomePageProps) {
  const [uploadingHero, setUploadingHero] = useState(false);
  const [heroError, setHeroError] = useState<string | null>(null);
  const [imgLoadFailed, setImgLoadFailed] = useState(false);

  const hasCustomHero = Boolean(customHeroImageUrl && customHeroImageUrl.trim().length > 0);
  const displayHeroSrc = !imgLoadFailed && hasCustomHero ? customHeroImageUrl : HERO_CAMPAIGN_IMAGE;

  const handleHeroFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpdateHeroImage || !isDeveloperAdmin) return;
    setHeroError(null);
    setUploadingHero(true);
    try {
      const compressed = await compressImageFileToDataUrl(file, 1080);
      setImgLoadFailed(false);
      await onUpdateHeroImage(compressed);
    } catch (err) {
      setHeroError(err instanceof Error ? err.message : 'Unable to update home picture.');
    } finally {
      setUploadingHero(false);
      e.target.value = '';
    }
  };

  const handleResetHero = async () => {
    if (!onUpdateHeroImage || !isDeveloperAdmin) return;
    setHeroError(null);
    setUploadingHero(true);
    try {
      setImgLoadFailed(false);
      await onUpdateHeroImage('');
    } catch (err) {
      setHeroError(err instanceof Error ? err.message : 'Unable to reset home picture.');
    } finally {
      setUploadingHero(false);
    }
  };

  return (
    <div className="py-6 md:py-12 space-y-10 md:space-y-14">
      {/* Split Welcome Showcase */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
        <div className="lg:col-span-5 flex flex-col justify-between">
          <div>
            <p className="text-xs text-[#7A6350] mb-3">Dhaka, Bangladesh</p>
            <h1 className="text-[clamp(2rem,4vw,3.5rem)] leading-[1.08] font-semibold text-[#2C1E16] text-balance">
              Modern &amp; Traditional Wear for Every Day.
            </h1>
            <p className="mt-4 text-sm md:text-base text-[#5A4332] leading-relaxed max-w-[54ch]">
              Discover thoughtfully tailored Kurtis, Western and traditional tops, long skirts, wide-leg trousers, and lightweight scarves crafted for effortless everyday and festive styling.
            </p>
          </div>

          {/* Tone Filter Preference */}
          <div className="mt-6 p-4 md:p-5 rounded-xl bg-[#FCFBF7] border border-[#DED7C6]">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className="text-xs font-medium text-[#2C1E16]">Browse by Color Tone</span>
              <span className="text-[11px] text-[#7A6350]">
                {activePalette === 'neutral'
                  ? 'Showing All Shades'
                  : activePalette === 'warm'
                    ? 'Warm Shades Selected'
                    : 'Cool Shades Selected'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#EFEBE0] rounded-lg">
              {(
                [
                  { id: 'neutral', label: 'All Tones' },
                  { id: 'warm', label: 'Warm Tones' },
                  { id: 'cool', label: 'Cool Tones' },
                ] as Array<{ id: PaletteMode; label: string }>
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onPaletteChange(opt.id)}
                  className={`min-h-[40px] py-2 px-2.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    activePalette === opt.id
                      ? 'bg-[#FCFBF7] text-[#2C1E16] shadow-xs'
                      : 'text-[#6E5846] hover:text-[#2C1E16]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <p className="mt-3 text-xs text-[#7A6350] leading-relaxed">
              Select a color tone above to filter matching pieces when browsing the Collection.
            </p>
          </div>
        </div>

        <div className="lg:col-span-7 flex flex-col">
          <div className="relative flex-1 min-h-[260px] sm:min-h-[340px] lg:min-h-[480px] rounded-xl overflow-hidden border border-[#DED7C6] bg-[#EFEBE0]">
            <img
              src={displayHeroSrc}
              alt="RADIANCE seasonal women's clothing showcase"
              referrerPolicy="no-referrer"
              onError={() => setImgLoadFailed(true)}
              className="w-full h-full object-cover"
            />

            {isDeveloperAdmin && onUpdateHeroImage && (
              <div className="absolute top-3.5 right-3.5 z-10 flex flex-wrap items-center gap-2">
                <label className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#2C1E16] bg-[#FCFBF7]/95 hover:bg-[#FCFBF7] border border-[#DED7C6] rounded-lg cursor-pointer shadow-xs transition-colors whitespace-nowrap shrink-0">
                  <Camera className="w-3.5 h-3.5 text-[#435334]" />
                  <span>{uploadingHero ? 'Saving Photo...' : 'Change Home Picture'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingHero}
                    onChange={(e) => void handleHeroFileSelect(e)}
                    className="sr-only"
                  />
                </label>

                {hasCustomHero && (
                  <button
                    type="button"
                    disabled={uploadingHero}
                    onClick={() => void handleResetHero()}
                    className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#2C1E16] bg-[#FCFBF7]/95 hover:bg-[#FCFBF7] border border-[#DED7C6] rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#5A4332]" />
                    <span>Reset Default</span>
                  </button>
                )}
              </div>
            )}

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#231710]/80 via-[#231710]/35 to-transparent p-5 md:p-6 text-[#FCFBF7]">
              <p className="text-xs opacity-90">RADIANCE · Dhaka</p>
              <p className="text-base md:text-lg font-editorial mt-0.5">
                Everyday &amp; Festive Contemporary Collection
              </p>
            </div>
          </div>

          {heroError && (
            <p className="mt-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {heroError}
            </p>
          )}
        </div>
      </section>

      {/* Store Highlights Strip (Outfit-Neutral Service Information) */}
      <section className="pt-8 border-t border-[#DED7C6] grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
        <div>
          <h2 className="font-semibold text-[#2C1E16]">01. Nationwide Delivery</h2>
          <p className="mt-1.5 text-xs text-[#5A4332] leading-relaxed">
            Doorstep courier delivery across Dhaka and all districts in Bangladesh, with complimentary shipping on orders of ৳4,000 and above.
          </p>
        </div>
        <div>
          <h2 className="font-semibold text-[#2C1E16]">02. Cash on Delivery &amp; Card</h2>
          <p className="mt-1.5 text-xs text-[#5A4332] leading-relaxed">
            Pay comfortably in cash when your parcel arrives at your address, or complete payment online by card at checkout.
          </p>
        </div>
        <div>
          <h2 className="font-semibold text-[#2C1E16]">03. Personal Size &amp; Style Help</h2>
          <p className="mt-1.5 text-xs text-[#5A4332] leading-relaxed">
            Find your recommended size in the Virtual Fitting Room or answer a few quick questions in the Outfit Advisor for personalized picks.
          </p>
        </div>
      </section>
    </div>
  );
}

import { useMemo, useState, type ChangeEvent } from 'react';
import { Bookmark, ShoppingBag, Trash2, Upload } from 'lucide-react';
import { compressImageFileToDataUrl, formatTaka } from '../data/catalog';
import type {
  FitPreference,
  GarmentItem,
  GarmentSize,
  LightingPreset,
  PaletteMode,
  SavedLookRecord,
} from '../types';
import { GarmentVisual } from './GarmentVisual';

interface VirtualFittingRoomProps {
  catalog: GarmentItem[];
  selectedGarment: GarmentItem | undefined;
  activePalette: PaletteMode;
  defaultFit: FitPreference;
  defaultHeightCm: number;
  isSignedIn: boolean;
  savedLooks: SavedLookRecord[];
  onSelectGarment: (item: GarmentItem) => void;
  onAddToBag: (item: GarmentItem, size: GarmentSize) => void;
  onSaveLook: (input: {
    garmentId: string;
    garmentName: string;
    colorTone: 'warm' | 'cool';
    recommendedSize: GarmentSize;
    lightingPreset: LightingPreset;
    stylistNote: string;
  }) => Promise<void>;
  onDeleteLook: (lookId: string) => Promise<void>;
  onSignInRequest: () => Promise<void>;
}

function calculateRecommendedSize(
  bustCm: number,
  waistCm: number,
  hipCm: number,
  fit: FitPreference
): GarmentSize {
  const composite = bustCm * 0.45 + waistCm * 0.3 + hipCm * 0.25;
  const fitOffset = fit === 'tailored' ? -2.5 : fit === 'relaxed' ? 3 : 0;
  const adjusted = composite + fitOffset;

  if (adjusted < 81) return 'XS';
  if (adjusted < 87) return 'S';
  if (adjusted < 94) return 'M';
  if (adjusted < 102) return 'L';
  return 'XL';
}

export function VirtualFittingRoom({
  catalog,
  selectedGarment,
  activePalette,
  defaultFit,
  defaultHeightCm,
  isSignedIn,
  savedLooks,
  onSelectGarment,
  onAddToBag,
  onSaveLook,
  onDeleteLook,
  onSignInRequest,
}: VirtualFittingRoomProps) {
  const [lightingPreset, setLightingPreset] = useState<LightingPreset>(
    activePalette === 'warm' ? 'warm' : activePalette === 'cool' ? 'cool' : 'daylight'
  );
  const [skinUndertone, setSkinUndertone] = useState<'warm' | 'neutral' | 'cool'>(
    activePalette === 'neutral' ? 'neutral' : activePalette
  );
  const [heightCm, setHeightCm] = useState<number>(defaultHeightCm || 164);
  const [bustCm, setBustCm] = useState<number>(88);
  const [waistCm, setWaistCm] = useState<number>(72);
  const [hipCm, setHipCm] = useState<number>(96);
  const [preferredFit, setPreferredFit] = useState<FitPreference>(defaultFit || 'tailored');

  const [userPhotoDataUrl, setUserPhotoDataUrl] = useState<string>('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [savingLook, setSavingLook] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const recommendedSize = useMemo(
    () => calculateRecommendedSize(bustCm, waistCm, hipCm, preferredFit),
    [bustCm, waistCm, hipCm, preferredFit]
  );

  const activeFabric = selectedGarment?.fabric || 'Cotton';
  const activeColorTone = selectedGarment?.colorTone || 'warm';

  const lightingOverlayClass =
    lightingPreset === 'warm'
      ? 'bg-amber-600/10'
      : lightingPreset === 'cool'
        ? 'bg-sky-700/10'
        : 'bg-transparent';

  const undertoneSwatchClass =
    skinUndertone === 'warm'
      ? 'bg-[#C89B6E]'
      : skinUndertone === 'cool'
        ? 'bg-[#C7AC9B]'
        : 'bg-[#C4A383]';

  const toneMatchLabel =
    skinUndertone === 'neutral' || skinUndertone === activeColorTone
      ? 'Harmonious Undertone Pairing'
      : 'High-Contrast Statement Pairing';

  const drapeNote = useMemo(() => {
    const easeLabel =
      preferredFit === 'tailored'
        ? 'close architectural shoulder and waist line'
        : preferredFit === 'relaxed'
          ? 'airy, generous ease for warm Dhaka afternoons'
          : 'balanced classic atelier ease';
    return `Size ${recommendedSize} provides a ${easeLabel} in ${activeFabric} (${heightCm} cm frame).`;
  }, [recommendedSize, preferredFit, activeFabric, heightCm]);

  if (!selectedGarment || catalog.length === 0) {
    return (
      <div className="py-6 md:py-10 space-y-8">
        <div className="pb-6 border-b border-[#DED7C6]">
          <h1 className="text-3xl md:text-4xl font-semibold text-[#2C1E16] text-balance">
            Virtual Fitting Room
          </h1>
        </div>
        <div className="rounded-xl border border-[#DED7C6] bg-[#FCFBF7] p-12 text-center">
          <p className="text-base font-medium text-[#2C1E16]">
            No outfits are currently available in the catalog.
          </p>
          <p className="text-xs text-[#5A4332] mt-1.5">
            Once outfits are added to the Collection, they will appear here for lighting preview and size calculation.
          </p>
        </div>
      </div>
    );
  }

  const handleUserPhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    setFeedbackMsg(null);
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 640);
      setUserPhotoDataUrl(dataUrl);
    } catch (err) {
      setFeedbackMsg(err instanceof Error ? err.message : 'Unable to load reference image.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveCurrentLook = async () => {
    if (!isSignedIn) {
      await onSignInRequest();
      return;
    }
    setSavingLook(true);
    setFeedbackMsg(null);
    try {
      await onSaveLook({
        garmentId: selectedGarment.id,
        garmentName: selectedGarment.name,
        colorTone: selectedGarment.colorTone,
        recommendedSize,
        lightingPreset,
        stylistNote: `${toneMatchLabel} · ${drapeNote}`,
      });
      setFeedbackMsg('Look saved to your personal RADIANCE Dhaka lookbook.');
    } catch (err) {
      setFeedbackMsg(err instanceof Error ? err.message : 'Could not save look.');
    } finally {
      setSavingLook(false);
    }
  };

  return (
    <div className="py-6 md:py-10 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[#DED7C6]">
        <div>
          <p className="text-xs text-[#7A6350] mb-1.5">
            Faceless Mannequin Drape &amp; Size Calculator
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold text-[#2C1E16] text-balance">
            Virtual Fitting Room
          </h1>
        </div>
        <p className="text-sm text-[#5A4332] max-w-xl">
          Inspect mannequin drape across Kurtis, tops, long skirts, trousers, and scarves under warm evening or daylight illumination and calculate your exact tailored size.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 7 Columns: Mannequin Mirror Stage & Garment Strip */}
        <div className="lg:col-span-7 space-y-5">
          <div className="rounded-xl border border-[#DED7C6] bg-[#FCFBF7] p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-[#DED7C6]">
              <div className="flex items-center gap-1 p-1 bg-[#EFEBE0] rounded-lg overflow-x-auto max-w-full">
                {(['warm', 'daylight', 'cool'] as LightingPreset[]).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setLightingPreset(preset)}
                    className={`min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      lightingPreset === preset
                        ? 'bg-[#FCFBF7] text-[#2C1E16] shadow-xs'
                        : 'text-[#6E5846] hover:text-[#2C1E16]'
                    }`}
                  >
                    {preset === 'warm'
                      ? '3000K Warm Evening'
                      : preset === 'daylight'
                        ? '5000K Dhaka Daylight'
                        : '6500K Cool Studio'}
                  </button>
                ))}
              </div>

              <label className="min-h-[40px] inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-[#2C1E16] bg-[#EFEBE0] hover:bg-[#E4DEC9] rounded-lg cursor-pointer transition-colors whitespace-nowrap shrink-0">
                <Upload className="w-3.5 h-3.5 text-[#435334]" />
                <span>
                  {uploadingPhoto
                    ? 'Loading Image...'
                    : userPhotoDataUrl
                      ? 'Change Drape Photo'
                      : 'Optional Drape / Swatch Photo'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUserPhotoUpload}
                  className="sr-only"
                />
              </label>
            </div>

            {/* Dual Mannequin & Swatch Canvas */}
            <div
              className={`grid grid-cols-1 ${
                userPhotoDataUrl ? 'sm:grid-cols-2' : 'sm:grid-cols-12'
              } gap-5 items-stretch`}
            >
              {userPhotoDataUrl ? (
                <div className="relative aspect-[3/4] rounded-lg overflow-hidden border border-[#DED7C6] bg-[#EFEBE0]">
                  <img
                    src={userPhotoDataUrl}
                    alt="Uploaded drape or fabric swatch reference"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  <div className={`pointer-events-none absolute inset-0 ${lightingOverlayClass}`} />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent p-4 flex items-center justify-between text-white">
                    <span className="text-xs font-medium">Reference Swatch / Drape</span>
                    <button
                      type="button"
                      onClick={() => setUserPhotoDataUrl('')}
                      className="text-xs underline underline-offset-2 opacity-90 hover:opacity-100"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="sm:col-span-4 rounded-lg border border-[#DED7C6] bg-[#F7F4EC] p-4 flex flex-col justify-between">
                  <div>
                    <p className="text-xs font-medium text-[#2C1E16]">Undertone Swatch Match</p>
                    <p className="text-xs text-[#7A6350] mt-1">
                      Compare Jamdani, muslin, silk, cotton &amp; linen pigments against South Asian undertone swatches.
                    </p>
                    <div className="mt-4 space-y-2">
                      {(['warm', 'neutral', 'cool'] as const).map((tone) => (
                        <button
                          key={tone}
                          type="button"
                          onClick={() => setSkinUndertone(tone)}
                          className={`min-h-[40px] w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                            skinUndertone === tone
                              ? 'border-[#435334] bg-[#FCFBF7] text-[#2C1E16]'
                              : 'border-[#DED7C6] text-[#6E5846] hover:text-[#2C1E16]'
                          }`}
                        >
                          <span className="capitalize">{tone} Undertone</span>
                          <span
                            className={`w-4 h-4 rounded-sm border border-black/10 ${
                              tone === 'warm'
                                ? 'bg-[#C89B6E]'
                                : tone === 'cool'
                                  ? 'bg-[#C7AC9B]'
                                  : 'bg-[#C4A383]'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-[#DED7C6]">
                    <p className="text-[11px] text-[#7A6350]">Adjacent Pigment Preview</p>
                    <div className="mt-2 grid grid-cols-2 h-14 rounded-lg overflow-hidden border border-[#DED7C6]">
                      <div className={`${undertoneSwatchClass} flex items-end p-2`}>
                        <span className="text-[10px] font-medium text-[#2C1E16]">Tone</span>
                      </div>
                      <div className={`${selectedGarment.swatchClass} flex items-end p-2`}>
                        <span className="text-[10px] font-medium text-white mix-blend-difference">
                          Weave
                        </span>
                      </div>
                    </div>
                    <p className="mt-2 text-xs font-medium text-[#435334]">{toneMatchLabel}</p>
                  </div>
                </div>
              )}

              <div
                className={`${
                  userPhotoDataUrl ? '' : 'sm:col-span-8'
                } relative aspect-[3/4] rounded-lg overflow-hidden border border-[#DED7C6] bg-[#EFEBE0]`}
              >
                <GarmentVisual
                  src={selectedGarment.imageDataUrl}
                  alt={selectedGarment.name}
                  tone={selectedGarment.colorTone}
                  category={selectedGarment.category}
                  className="w-full h-full"
                />
                <div className={`pointer-events-none absolute inset-0 ${lightingOverlayClass}`} />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 text-white">
                  <p className="text-xs opacity-85">
                    {selectedGarment.colorName} ·{' '}
                    {selectedGarment.colorTone === 'warm' ? 'Warm Palette' : 'Cool Palette'}
                  </p>
                  <p className="text-base font-medium mt-0.5">{selectedGarment.name}</p>
                </div>
              </div>
            </div>

            {/* Catalog Selector Strip */}
            <div className="mt-5 pt-5 border-t border-[#DED7C6]">
              <p className="text-xs font-medium text-[#5A4332] mb-3">
                Switch Mannequin Piece ({catalog.length} available)
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
                {catalog.map((piece) => {
                  const active = piece.id === selectedGarment.id;
                  return (
                    <button
                      key={piece.id}
                      type="button"
                      onClick={() => onSelectGarment(piece)}
                      className={`group text-left rounded-lg overflow-hidden border transition-colors ${
                        active
                          ? 'border-[#435334] ring-1 ring-[#435334]'
                          : 'border-[#DED7C6] hover:border-[#7A6350]'
                      }`}
                    >
                      <div className="aspect-[3/4] w-full bg-[#EFEBE0]">
                        <GarmentVisual
                          src={piece.imageDataUrl}
                          alt={piece.name}
                          tone={piece.colorTone}
                          category={piece.category}
                          className="w-full h-full"
                        />
                      </div>
                      <p className="px-2 py-1.5 text-[11px] font-medium text-[#2C1E16] truncate bg-[#FCFBF7]">
                        {piece.name}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right 5 Columns: Size Calculator & Lookbook */}
        <div className="lg:col-span-5 space-y-5">
          <div className="rounded-xl border border-[#DED7C6] bg-[#FCFBF7] p-6">
            <div className="flex items-baseline justify-between pb-4 border-b border-[#DED7C6]">
              <div>
                <h2 className="text-xl font-semibold text-[#2C1E16]">
                  Tailored Measurements &amp; Drape
                </h2>
                <p className="text-xs text-[#7A6350] mt-0.5">All figures in centimeters</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-[#7A6350] block">Recommended Size</span>
                <span className="text-2xl font-mono font-medium tabular-nums text-[#435334]">
                  {recommendedSize}
                </span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4">
              <div>
                <label className="flex justify-between text-xs text-[#5A4332] mb-1">
                  <span>Height</span>
                  <span className="font-mono tabular-nums">{heightCm} cm</span>
                </label>
                <input
                  type="range"
                  min={145}
                  max={200}
                  value={heightCm}
                  onChange={(e) => setHeightCm(Number(e.target.value))}
                  className="w-full accent-[#435334]"
                />
              </div>

              <div>
                <label className="flex justify-between text-xs text-[#5A4332] mb-1">
                  <span>Bust / Chest</span>
                  <span className="font-mono tabular-nums">{bustCm} cm</span>
                </label>
                <input
                  type="range"
                  min={74}
                  max={122}
                  value={bustCm}
                  onChange={(e) => setBustCm(Number(e.target.value))}
                  className="w-full accent-[#435334]"
                />
              </div>

              <div>
                <label className="flex justify-between text-xs text-[#5A4332] mb-1">
                  <span>Natural Waist</span>
                  <span className="font-mono tabular-nums">{waistCm} cm</span>
                </label>
                <input
                  type="range"
                  min={58}
                  max={108}
                  value={waistCm}
                  onChange={(e) => setWaistCm(Number(e.target.value))}
                  className="w-full accent-[#435334]"
                />
              </div>

              <div>
                <label className="flex justify-between text-xs text-[#5A4332] mb-1">
                  <span>Full Hip</span>
                  <span className="font-mono tabular-nums">{hipCm} cm</span>
                </label>
                <input
                  type="range"
                  min={80}
                  max={128}
                  value={hipCm}
                  onChange={(e) => setHipCm(Number(e.target.value))}
                  className="w-full accent-[#435334]"
                />
              </div>
            </div>

            <div className="mt-5">
              <span className="block text-xs font-medium text-[#5A4332] mb-2">
                Silhouette Drape Preference
              </span>
              <div className="grid grid-cols-3 gap-1 p-1 bg-[#EFEBE0] rounded-lg">
                {(['tailored', 'regular', 'relaxed'] as FitPreference[]).map((fit) => (
                  <button
                    key={fit}
                    type="button"
                    onClick={() => setPreferredFit(fit)}
                    className={`min-h-[40px] py-1.5 px-3 text-xs font-medium capitalize rounded-md transition-colors whitespace-nowrap ${
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

            {/* Instant Tailor Fit Summary */}
            <div className="mt-5 p-3.5 rounded-lg bg-[#F7F4EC] border border-[#DED7C6] space-y-1 text-xs">
              <p className="font-medium text-[#2C1E16]">{toneMatchLabel}</p>
              <p className="text-[#5A4332] leading-relaxed">{drapeNote}</p>
            </div>

            <div className="mt-5 pt-5 border-t border-[#DED7C6] space-y-3">
              <button
                type="button"
                onClick={() => onAddToBag(selectedGarment, recommendedSize)}
                className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 py-3 px-5 text-sm font-medium text-[#FCFBF7] bg-[#435334] hover:bg-[#344227] rounded-lg transition-colors whitespace-nowrap"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>
                  Add Size {recommendedSize} to Bag — {formatTaka(selectedGarment.priceCents)}
                </span>
              </button>

              <button
                type="button"
                onClick={() => void handleSaveCurrentLook()}
                disabled={savingLook}
                className="w-full min-h-[42px] inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-xs font-medium text-[#2C1E16] border border-[#D4CCB8] hover:border-[#435334] rounded-lg transition-colors whitespace-nowrap"
              >
                <Bookmark className="w-3.5 h-3.5 text-[#435334]" />
                <span>{savingLook ? 'Saving...' : 'Save Look to Lookbook'}</span>
              </button>
            </div>

            {feedbackMsg && (
              <p className="mt-4 text-xs text-[#2C1E16] bg-[#F7F4EC] border border-[#DED7C6] rounded-lg px-3 py-2">
                {feedbackMsg}
              </p>
            )}
          </div>

          {/* Saved Fitting Room Looks */}
          {savedLooks.length > 0 && (
            <div className="rounded-xl border border-[#DED7C6] bg-[#FCFBF7] p-5">
              <h3 className="text-sm font-semibold text-[#2C1E16] mb-3">
                Your Saved Fitting Room Looks ({savedLooks.length})
              </h3>
              <div className="space-y-2.5 max-h-56 overflow-y-auto">
                {savedLooks.map((look) => (
                  <div
                    key={look.id}
                    className="flex items-start justify-between gap-3 py-2.5 border-b border-[#EFEBE0] last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[#2C1E16] truncate">
                        {look.garmentName} · Size {look.recommendedSize}
                      </p>
                      <p className="text-[11px] text-[#7A6350] mt-0.5 line-clamp-2">
                        {look.stylistNote}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onDeleteLook(look.id)}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center text-[#7A6350] hover:text-red-800 shrink-0"
                      aria-label="Delete saved look"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

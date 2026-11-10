import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Upload, X, Trash2 } from 'lucide-react';
import { ALLOWED_CATEGORIES, compressImageFileToDataUrl } from '../data/catalog';
import {
  BLUEPRINT_CONSTRAINTS,
  type GarmentCategory,
  type GarmentItem,
  type GarmentTone,
} from '../types';
import { GarmentVisual } from './GarmentVisual';

export interface CatalogPieceFormInput {
  name: string;
  category: GarmentCategory;
  colorTone: GarmentTone;
  colorName: string;
  priceCents: number;
  fabric: string;
  description: string;
  imageDataUrl: string;
  visibility: 'public' | 'private';
}

interface CatalogManagerModalProps {
  isOpen: boolean;
  editingItem: GarmentItem | null;
  isDeveloperAdmin: boolean;
  onClose: () => void;
  onCreatePiece: (input: CatalogPieceFormInput) => Promise<void>;
  onSaveEditedPiece: (itemId: string, input: CatalogPieceFormInput) => Promise<void>;
  onDeletePiece?: (itemId: string) => Promise<void>;
}

const DISALLOWED_GARMENT_TERMS = /\b(sari|saris|saree|sarees|shalwar|salwar|kameez)\b/i;

export function CatalogManagerModal({
  isOpen,
  editingItem,
  isDeveloperAdmin,
  onClose,
  onCreatePiece,
  onSaveEditedPiece,
  onDeletePiece,
}: CatalogManagerModalProps) {
  const [name, setName] = useState(editingItem?.name || '');
  const [category, setCategory] = useState<GarmentCategory>(editingItem?.category || 'Kurtis');
  const [colorTone, setColorTone] = useState<GarmentTone>(editingItem?.colorTone || 'warm');
  const [colorName, setColorName] = useState(editingItem?.colorName || '');
  const [priceTaka, setPriceTaka] = useState(
    editingItem ? String(Math.round(editingItem.priceCents / 100)) : '2850'
  );
  const [fabric, setFabric] = useState(editingItem?.fabric || 'Handwoven Cotton');
  const [description, setDescription] = useState(
    editingItem?.description || 'Tailored silhouette designed for comfortable everyday styling.'
  );
  const [visibility, setVisibility] = useState<'public' | 'private'>(
    editingItem?.visibility || 'public'
  );
  const [imageDataUrl, setImageDataUrl] = useState(editingItem?.imageDataUrl || '');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !isDeveloperAdmin) return null;

  const isEditing = Boolean(editingItem);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setUploadingImage(true);
    try {
      const compressed = await compressImageFileToDataUrl(file, 760);
      setImageDataUrl(compressed);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to process image.');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!isDeveloperAdmin) {
      setErrorMsg('Only the store developer can manage catalog items.');
      return;
    }

    setSubmitting(true);
    try {
      const parsedTaka = Number(priceTaka);
      if (!Number.isFinite(parsedTaka) || parsedTaka < 1000 || parsedTaka > 5000) {
        throw new Error('Enter a valid price between ৳1,000 and ৳5,000.');
      }
      if (name.trim().length < BLUEPRINT_CONSTRAINTS.GARMENT_NAME_MIN) {
        throw new Error('Garment title must be at least 2 characters.');
      }
      if (DISALLOWED_GARMENT_TERMS.test(name) || DISALLOWED_GARMENT_TERMS.test(description)) {
        throw new Error(
          'RADIANCE curates Western & traditional tops, Kurtis, long skirts, trousers, and scarves only (shalwar kameez and saris are excluded).'
        );
      }

      const payload: CatalogPieceFormInput = {
        name: name.trim(),
        category,
        colorTone,
        colorName: colorName.trim() || (colorTone === 'warm' ? 'Warm Shade' : 'Cool Shade'),
        priceCents: Math.round(parsedTaka * 100),
        fabric: fabric.trim(),
        description: description.trim(),
        imageDataUrl,
        visibility,
      };

      if (isEditing && editingItem) {
        await onSaveEditedPiece(editingItem.id, payload);
      } else {
        await onCreatePiece(payload);
      }
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not save garment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C1E16]/55 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="catalog-modal-title"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-[#FCFBF7] border border-[#DED7C6] p-6 md:p-8 shadow-xl">
        <div className="flex items-start justify-between gap-4 pb-5 border-b border-[#DED7C6]">
          <div>
            <h2 id="catalog-modal-title" className="text-2xl font-semibold text-[#2C1E16]">
              {isEditing ? `Edit Outfit — ${editingItem?.name}` : 'Add Outfit to Collection'}
            </h2>
            <p className="text-sm text-[#5A4332] mt-1">
              {isEditing
                ? 'Replace or remove the picture, update details, or delete this outfit from your store.'
                : 'Upload an outfit photo from your device and set its category, tone, fabric, and Taka price (৳1,000 – ৳5,000).'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#7A6350] hover:text-[#2C1E16] rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#435334]"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            <div className="md:col-span-5">
              <div className="aspect-[3/4] w-full rounded-lg overflow-hidden border border-[#DED7C6]">
                <GarmentVisual
                  src={imageDataUrl}
                  alt={name || editingItem?.name || 'Outfit Preview'}
                  tone={colorTone}
                  category={category}
                  className="w-full h-full"
                />
              </div>
              <label className="mt-3 min-h-[40px] flex items-center justify-center gap-2 w-full py-2.5 px-4 text-xs font-medium text-[#2C1E16] bg-[#EFEBE0] hover:bg-[#E4DEC9] rounded-lg cursor-pointer transition-colors whitespace-nowrap">
                <Upload className="w-4 h-4 text-[#435334]" />
                <span>
                  {uploadingImage
                    ? 'Optimizing Photo...'
                    : imageDataUrl
                      ? 'Replace Photo'
                      : 'Upload Photo'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>
              {imageDataUrl && (
                <button
                  type="button"
                  onClick={() => setImageDataUrl('')}
                  className="mt-2 w-full py-1.5 text-xs text-[#7A6350] hover:text-[#2C1E16]"
                >
                  Remove current photo
                </button>
              )}
            </div>

            <div className="md:col-span-7 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#5A4332] mb-1">
                  Outfit Name
                </label>
                <input
                  type="text"
                  required
                  maxLength={BLUEPRINT_CONSTRAINTS.GARMENT_NAME_MAX}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Olive Cotton Kurti"
                  className="w-full px-3.5 py-2 text-sm bg-white rounded-lg border border-[#D4CCB8] focus:border-[#435334] focus:outline-none text-[#2C1E16]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#5A4332] mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as GarmentCategory)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#D4CCB8] bg-white text-[#2C1E16] focus:border-[#435334] focus:outline-none"
                  >
                    {ALLOWED_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5A4332] mb-1">
                    Price (৳1,000 – ৳5,000)
                  </label>
                  <input
                    type="number"
                    min={1000}
                    max={5000}
                    required
                    value={priceTaka}
                    onChange={(e) => setPriceTaka(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm font-mono tabular-nums bg-white rounded-lg border border-[#D4CCB8] text-[#2C1E16] focus:border-[#435334] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5A4332] mb-1">
                  Color Tone
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-[#EFEBE0] rounded-lg">
                  <button
                    type="button"
                    onClick={() => setColorTone('warm')}
                    className={`min-h-[38px] py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      colorTone === 'warm'
                        ? 'bg-[#FCFBF7] text-[#2C1E16] shadow-xs'
                        : 'text-[#6E5846] hover:text-[#2C1E16]'
                    }`}
                  >
                    Warm Tone
                  </button>
                  <button
                    type="button"
                    onClick={() => setColorTone('cool')}
                    className={`min-h-[38px] py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      colorTone === 'cool'
                        ? 'bg-[#FCFBF7] text-[#2C1E16] shadow-xs'
                        : 'text-[#6E5846] hover:text-[#2C1E16]'
                    }`}
                  >
                    Cool Tone
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#5A4332] mb-1">
                    Color / Shade Name
                  </label>
                  <input
                    type="text"
                    maxLength={BLUEPRINT_CONSTRAINTS.COLOR_NAME_MAX}
                    value={colorName}
                    onChange={(e) => setColorName(e.target.value)}
                    placeholder={colorTone === 'warm' ? 'e.g., Terracotta' : 'e.g., Indigo'}
                    className="w-full px-3.5 py-2 text-sm bg-white rounded-lg border border-[#D4CCB8] text-[#2C1E16] focus:border-[#435334] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#5A4332] mb-1">
                    Visibility
                  </label>
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#D4CCB8] bg-white text-[#2C1E16] focus:border-[#435334] focus:outline-none"
                  >
                    <option value="public">Public Storefront</option>
                    <option value="private">Private Draft</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5A4332] mb-1">Fabric</label>
                <input
                  type="text"
                  required
                  maxLength={BLUEPRINT_CONSTRAINTS.FABRIC_MAX}
                  value={fabric}
                  onChange={(e) => setFabric(e.target.value)}
                  placeholder="e.g., Jamdani, Muslin, Silk, Cotton, Linen"
                  className="w-full px-3.5 py-2 text-sm bg-white rounded-lg border border-[#D4CCB8] text-[#2C1E16] focus:border-[#435334] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#5A4332] mb-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  required
                  maxLength={BLUEPRINT_CONSTRAINTS.DESCRIPTION_MAX}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white rounded-lg border border-[#D4CCB8] text-[#2C1E16] focus:border-[#435334] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs font-medium text-red-800 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
              {errorMsg}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#DED7C6]">
            <div>
              {isEditing && editingItem && onDeletePiece && (
                !confirmDelete ? (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setConfirmDelete(true)}
                    className="min-h-[40px] inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-red-800 bg-red-50 hover:bg-red-100 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Outfit</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={async () => {
                        setSubmitting(true);
                        try {
                          await onDeletePiece(editingItem.id);
                          onClose();
                        } catch (err) {
                          setErrorMsg(
                            err instanceof Error ? err.message : 'Unable to delete outfit.'
                          );
                        } finally {
                          setSubmitting(false);
                        }
                      }}
                      className="min-h-[40px] px-3.5 py-2 text-xs font-medium text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors whitespace-nowrap"
                    >
                      {submitting ? 'Deleting...' : 'Confirm Delete'}
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setConfirmDelete(false)}
                      className="min-h-[40px] px-3 py-2 text-xs font-medium text-[#5A4332] hover:text-[#2C1E16] rounded-lg whitespace-nowrap"
                    >
                      Keep
                    </button>
                  </div>
                )
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[40px] px-4 py-2 text-xs font-medium text-[#5A4332] hover:text-[#2C1E16] rounded-lg whitespace-nowrap"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || uploadingImage || !isDeveloperAdmin}
                className="min-h-[42px] px-5 py-2.5 text-xs font-medium text-[#FCFBF7] bg-[#435334] hover:bg-[#344227] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
              >
                {submitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Save Piece to Catalog'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

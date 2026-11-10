import { useState } from 'react';
import { Camera, Heart, Pencil, Ruler, Trash2 } from 'lucide-react';
import { ALLOWED_CATEGORIES, formatTaka } from '../data/catalog';
import type { GarmentCategory, GarmentItem, PaletteMode } from '../types';
import { GarmentVisual } from './GarmentVisual';

const CATEGORY_FILTERS: Array<'All' | GarmentCategory> = ['All', ...ALLOWED_CATEGORIES];

interface CollectionPageProps {
  filteredCatalog: GarmentItem[];
  activePalette: PaletteMode;
  categoryFilter: 'All' | GarmentCategory;
  isDeveloperAdmin: boolean;
  wishlistedIds: Set<string>;
  primaryCtaClass: string;
  onPaletteChange: (next: PaletteMode) => void;
  onCategoryChange: (cat: 'All' | GarmentCategory) => void;
  onOpenAddPieceModal: () => void;
  onEditPiece: (item: GarmentItem) => void;
  onDeletePiece: (item: GarmentItem) => Promise<void>;
  onOpenProductDetail: (item: GarmentItem) => void;
  onTryInFittingRoom: (item: GarmentItem) => void;
  onToggleFavorite: (item: GarmentItem) => Promise<void>;
}

export function CollectionPage({
  filteredCatalog,
  activePalette,
  categoryFilter,
  isDeveloperAdmin,
  wishlistedIds,
  primaryCtaClass,
  onPaletteChange,
  onCategoryChange,
  onOpenAddPieceModal,
  onEditPiece,
  onDeletePiece,
  onOpenProductDetail,
  onTryInFittingRoom,
  onToggleFavorite,
}: CollectionPageProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleConfirmDelete = async (item: GarmentItem) => {
    setDeletingId(item.id);
    try {
      await onDeletePiece(item);
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="py-6 md:py-10 space-y-8">
      {/* Page Header & Developer-Only Add Piece Action */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 pb-6 border-b border-[#DED7C6]">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold text-[#2C1E16] text-balance">
            {activePalette === 'warm'
              ? 'Warm Tone Collection'
              : activePalette === 'cool'
                ? 'Cool Tone Collection'
                : 'Collection'}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Palette Filter Switcher */}
          <div className="inline-flex items-center gap-1 p-1 bg-[#EFEBE0] rounded-lg">
            {(
              [
                { id: 'neutral', label: 'All Tones' },
                { id: 'warm', label: 'Warm' },
                { id: 'cool', label: 'Cool' },
              ] as Array<{ id: PaletteMode; label: string }>
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onPaletteChange(opt.id)}
                className={`min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activePalette === opt.id
                    ? 'bg-[#FCFBF7] text-[#2C1E16] shadow-xs'
                    : 'text-[#6E5846] hover:text-[#2C1E16]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {isDeveloperAdmin && (
            <button
              type="button"
              onClick={onOpenAddPieceModal}
              className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-[#2C1E16] bg-[#FCFBF7] border border-[#D4CCB8] hover:border-[#435334] rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Camera className="w-3.5 h-3.5 text-[#435334]" />
              <span>Add Piece / Upload Pictures</span>
            </button>
          )}
        </div>
      </div>

      {/* Horizontal Category Filter Bar */}
      <div className="flex items-center gap-1.5 p-1 bg-[#EFEBE0] rounded-lg overflow-x-auto max-w-full">
        {CATEGORY_FILTERS.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => onCategoryChange(cat)}
            className={`min-h-[40px] px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              categoryFilter === cat
                ? 'bg-[#FCFBF7] text-[#2C1E16] shadow-xs'
                : 'text-[#6E5846] hover:text-[#2C1E16]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      {filteredCatalog.length === 0 ? (
        <div className="rounded-xl border border-[#DED7C6] bg-[#FCFBF7] p-12 text-center space-y-3">
          <p className="text-lg font-medium text-[#2C1E16]">
            No outfits currently shown for this selection.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {(categoryFilter !== 'All' || activePalette !== 'neutral') && (
              <button
                type="button"
                onClick={() => {
                  onCategoryChange('All');
                  onPaletteChange('neutral');
                }}
                className="min-h-[42px] px-5 py-2 text-xs font-medium bg-[#435334] text-[#FCFBF7] rounded-lg whitespace-nowrap"
              >
                Reset Filters
              </button>
            )}
            {isDeveloperAdmin && (
              <button
                type="button"
                onClick={onOpenAddPieceModal}
                className="min-h-[42px] inline-flex items-center gap-2 px-5 py-2 text-xs font-medium text-[#2C1E16] bg-[#EFEBE0] hover:bg-[#E4DEC9] rounded-lg whitespace-nowrap"
              >
                <Camera className="w-3.5 h-3.5 text-[#435334]" />
                <span>Add New Outfit</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
          {filteredCatalog.map((item) => {
            const isWishlisted = wishlistedIds.has(item.id);
            const isConfirmingDelete = confirmDeleteId === item.id;
            const isDeletingThis = deletingId === item.id;

            return (
              <article
                key={item.id}
                className="group rounded-xl border border-[#DED7C6] bg-[#FCFBF7] overflow-hidden flex flex-col transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div
                  onClick={() => onOpenProductDetail(item)}
                  className="aspect-[3/4] w-full bg-[#EFEBE0] cursor-pointer overflow-hidden relative"
                >
                  <GarmentVisual
                    src={item.imageDataUrl}
                    alt={item.name}
                    tone={item.colorTone}
                    category={item.category}
                    className="w-full h-full transition-transform duration-300 group-hover:scale-[1.02]"
                    onUploadClick={isDeveloperAdmin ? () => onEditPiece(item) : undefined}
                  />

                  {/* Wishlist Bookmark Toggle */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void onToggleFavorite(item);
                    }}
                    aria-pressed={isWishlisted}
                    aria-label={
                      isWishlisted
                        ? `Remove ${item.name} from My Favorites`
                        : `Save ${item.name} to My Favorites`
                    }
                    title={isWishlisted ? 'Saved in My Favorites' : 'Save to My Favorites'}
                    className={`absolute top-3 right-3 w-11 h-11 rounded-full flex items-center justify-center border transition-colors ${
                      isWishlisted
                        ? 'bg-[#5C3D28] text-[#FCFBF7] border-[#5C3D28]'
                        : 'bg-[#FCFBF7]/90 hover:bg-[#FCFBF7] text-[#2C1E16] border-[#DED7C6]'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`} />
                  </button>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Zero-Pill Unboxed Metadata */}
                    <div className="flex items-center gap-2 text-xs text-[#7A6350]">
                      <span>{item.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.colorTone === 'warm' ? 'Warm Tone' : 'Cool Tone'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{item.colorName}</span>
                    </div>

                    <div className="mt-1.5 flex items-baseline justify-between gap-3">
                      <h2
                        onClick={() => onOpenProductDetail(item)}
                        className="text-lg font-semibold text-[#2C1E16] cursor-pointer hover:underline underline-offset-4"
                      >
                        {item.name}
                      </h2>
                      <span className="text-[15px] font-mono tabular-nums font-medium text-[#435334] shrink-0">
                        {formatTaka(item.priceCents)}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-[#5A4332] line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <div className="mt-5 pt-4 border-t border-[#EFEBE0] space-y-2.5">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenProductDetail(item)}
                        className={`flex-1 min-h-[42px] py-2 px-3.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${primaryCtaClass}`}
                      >
                        Select Size &amp; Details
                      </button>

                      <button
                        type="button"
                        onClick={() => onTryInFittingRoom(item)}
                        className="min-h-[42px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-[#2C1E16] bg-[#F7F4EC] hover:bg-[#EFEBE0] border border-[#DED7C6] hover:border-[#435334] rounded-lg shrink-0 transition-colors whitespace-nowrap"
                        aria-label={`Try ${item.name} in Virtual Fitting Room`}
                        title="Try in Virtual Fitting Room"
                      >
                        <Ruler className="w-3.5 h-3.5 text-[#435334]" />
                        {!isDeveloperAdmin && <span>Try On</span>}
                      </button>

                      {isDeveloperAdmin && !isConfirmingDelete && (
                        <>
                          <button
                            type="button"
                            onClick={() => onEditPiece(item)}
                            className="min-h-[42px] min-w-[40px] flex items-center justify-center text-[#5A4332] hover:text-[#2C1E16] border border-[#DED7C6] hover:border-[#435334] rounded-lg shrink-0 transition-colors"
                            aria-label={`Edit ${item.name} or replace photo`}
                            title="Edit outfit & photo"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(item.id)}
                            className="min-h-[42px] min-w-[40px] flex items-center justify-center text-[#7A6350] hover:text-red-800 border border-[#DED7C6] hover:border-red-300 rounded-lg shrink-0 transition-colors"
                            aria-label={`Delete ${item.name}`}
                            title="Delete outfit"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>

                    {isDeveloperAdmin && isConfirmingDelete && (
                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#EFEBE0]">
                        <span className="text-xs font-medium text-red-900 truncate">
                          Delete this outfit?
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={isDeletingThis}
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[36px] px-3 py-1 text-xs font-medium text-[#5A4332] hover:text-[#2C1E16] rounded-md whitespace-nowrap"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={isDeletingThis}
                            onClick={() => void handleConfirmDelete(item)}
                            className="min-h-[36px] px-3 py-1 text-xs font-medium text-white bg-red-700 hover:bg-red-800 disabled:opacity-50 rounded-md whitespace-nowrap"
                          >
                            {isDeletingThis ? 'Deleting...' : 'Confirm Delete'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

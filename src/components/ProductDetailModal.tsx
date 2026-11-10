import { useState } from 'react';
import { Camera, Heart, Ruler, X } from 'lucide-react';
import {
  formatTaka,
  getCategorySizeChart,
  getSizeMeasurementSpec,
  type MeasurementUnit,
} from '../data/catalog';
import type { GarmentItem, GarmentSize } from '../types';
import { GarmentVisual } from './GarmentVisual';

interface ProductDetailModalProps {
  item: GarmentItem | null;
  canEditPhoto: boolean;
  isFavorite: boolean;
  onClose: () => void;
  onAddToBag: (item: GarmentItem, size: GarmentSize) => void;
  onTryInFittingRoom: (item: GarmentItem) => void;
  onToggleFavorite: (item: GarmentItem) => Promise<void>;
  onEditPhoto: (item: GarmentItem) => void;
}

export function ProductDetailModal({
  item,
  canEditPhoto,
  isFavorite,
  onClose,
  onAddToBag,
  onTryInFittingRoom,
  onToggleFavorite,
  onEditPhoto,
}: ProductDetailModalProps) {
  const [selectedSize, setSelectedSize] = useState<GarmentSize>('M');
  const [unit, setUnit] = useState<MeasurementUnit>('in');
  const [showFullChart, setShowFullChart] = useState(false);

  if (!item) return null;

  const sizeChart = getCategorySizeChart(item.category);
  const activeSpec = getSizeMeasurementSpec(item.category, selectedSize);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C1E16]/55 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdp-modal-title"
    >
      <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-xl bg-[#FCFBF7] border border-[#DED7C6] shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-12 items-stretch">
          <div className="md:col-span-5 bg-[#EFEBE0] relative">
            <div className="aspect-[3/4] w-full h-full">
              <GarmentVisual
                src={item.imageDataUrl}
                alt={item.name}
                tone={item.colorTone}
                category={item.category}
                className="w-full h-full"
                onUploadClick={canEditPhoto ? () => onEditPhoto(item) : undefined}
              />
            </div>
          </div>

          <div className="md:col-span-7 p-6 md:p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 text-xs text-[#7A6350]">
                  <span>{item.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>{item.colorTone === 'warm' ? 'Warm Undertone' : 'Cool Undertone'}</span>
                  <span aria-hidden="true">·</span>
                  <span>In Stock</span>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#7A6350] hover:text-[#2C1E16] rounded-lg"
                  aria-label="Close product view"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <h2 id="pdp-modal-title" className="mt-2 text-2xl md:text-3xl font-semibold text-[#2C1E16]">
                {item.name}
              </h2>

              <p className="mt-2 text-xl font-mono tabular-nums font-medium text-[#435334]">
                {formatTaka(item.priceCents)}
              </p>

              <div className="mt-4 pt-4 border-t border-[#DED7C6] space-y-2 text-sm text-[#5A4332] leading-relaxed">
                <p>{item.description}</p>
                <p className="text-xs text-[#7A6350] pt-0.5">
                  Shade: <strong className="font-medium text-[#2C1E16]">{item.colorName}</strong> · Fabric:{' '}
                  <strong className="font-medium text-[#2C1E16]">{item.fabric}</strong>
                </p>
              </div>

              {/* Size Selection Zone with Exact Garment Measurements + Unit Toggle + Size Chart */}
              <div className="mt-5 pt-5 border-t border-[#DED7C6] space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#2C1E16]">
                    Select Size &amp; Measurements
                  </span>

                  <div className="flex items-center gap-3">
                    <div className="inline-flex items-center p-0.5 bg-[#EFEBE0] rounded-md">
                      {(['in', 'cm'] as MeasurementUnit[]).map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setUnit(u)}
                          className={`min-h-[28px] px-2.5 py-0.5 text-[11px] font-medium rounded transition-colors ${
                            unit === u
                              ? 'bg-[#FCFBF7] text-[#2C1E16] shadow-2xs'
                              : 'text-[#6E5846] hover:text-[#2C1E16]'
                          }`}
                        >
                          {u === 'in' ? 'Inches' : 'CM'}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowFullChart((prev) => !prev)}
                      className="text-xs font-medium text-[#435334] hover:text-[#2C1E16] underline underline-offset-4 whitespace-nowrap"
                    >
                      {showFullChart ? 'Hide Size Chart' : 'Full Size Chart'}
                    </button>
                  </div>
                </div>

                {/* Interactive Size Buttons Showing Key Measurement */}
                <div className="grid grid-cols-5 gap-2">
                  {sizeChart.map((row) => {
                    const isSelected = selectedSize === row.size;
                    return (
                      <button
                        key={row.size}
                        type="button"
                        onClick={() => setSelectedSize(row.size)}
                        className={`min-h-[50px] py-2 px-1.5 rounded-lg border transition-colors flex flex-col items-center justify-center ${
                          isSelected
                            ? 'bg-[#435334] text-[#FCFBF7] border-[#435334]'
                            : 'bg-white text-[#2C1E16] border-[#D4CCB8] hover:border-[#435334]'
                        }`}
                      >
                        <span className="text-xs font-semibold">{row.size}</span>
                        <span
                          className={`text-[10px] font-mono tabular-nums mt-0.5 ${
                            isSelected ? 'text-[#FCFBF7]/90' : 'text-[#7A6350]'
                          }`}
                        >
                          {unit === 'in' ? row.shortIn : row.shortCm}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Live Measurement Breakdown for Selected Size */}
                <div className="rounded-lg bg-[#F7F4EC] border border-[#DED7C6] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-xs">
                  <span className="font-semibold text-[#2C1E16]">
                    Size {selectedSize} Fit:
                  </span>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[#5A4332]">
                    {activeSpec.fields.map((field, idx) => (
                      <span key={field.label} className="inline-flex items-center gap-1.5">
                        {idx > 0 && <span aria-hidden="true" className="text-[#B5A995]">·</span>}
                        <span>{field.label}:</span>
                        <strong className="font-mono tabular-nums font-medium text-[#2C1E16]">
                          {unit === 'in' ? field.inValue : field.cmValue}
                        </strong>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Expandable Full Size Comparison Table */}
                {showFullChart && (
                  <div className="rounded-lg border border-[#DED7C6] overflow-x-auto bg-white">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-[#DED7C6] bg-[#F7F4EC] text-[#5A4332]">
                          <th className="py-2 px-3 font-medium">Size</th>
                          {sizeChart[0].fields.map((col) => (
                            <th key={col.label} className="py-2 px-3 font-medium whitespace-nowrap">
                              {col.label} ({unit})
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sizeChart.map((row) => {
                          const isCurrent = row.size === selectedSize;
                          return (
                            <tr
                              key={row.size}
                              onClick={() => setSelectedSize(row.size)}
                              className={`border-b border-[#EFEBE0] last:border-b-0 cursor-pointer transition-colors ${
                                isCurrent
                                  ? 'bg-[#435334]/10 font-medium text-[#2C1E16]'
                                  : 'hover:bg-[#F7F4EC] text-[#5A4332]'
                              }`}
                            >
                              <td className="py-2 px-3 font-semibold text-[#2C1E16]">
                                {row.size}
                              </td>
                              {row.fields.map((cell) => (
                                <td
                                  key={cell.label}
                                  className="py-2 px-3 font-mono tabular-nums whitespace-nowrap"
                                >
                                  {unit === 'in' ? cell.inValue : cell.cmValue}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-[#DED7C6] space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  onAddToBag(item, selectedSize);
                  onClose();
                }}
                className="w-full min-h-[46px] py-3 px-5 text-sm font-medium text-[#FCFBF7] bg-[#435334] hover:bg-[#344227] rounded-lg transition-colors whitespace-nowrap"
              >
                Add Size {selectedSize} to Shopping Bag — {formatTaka(item.priceCents)}
              </button>

              {/* Direct Virtual Fitting Room Trial Action */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onTryInFittingRoom(item);
                }}
                className="w-full min-h-[42px] inline-flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-medium text-[#2C1E16] bg-[#EFEBE0] hover:bg-[#E4DEC9] border border-[#D4CCB8] rounded-lg transition-colors whitespace-nowrap"
              >
                <Ruler className="w-3.5 h-3.5 text-[#435334]" />
                <span>Try in Virtual Fitting Room (Calculate My Exact Size)</span>
              </button>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => void onToggleFavorite(item)}
                  aria-pressed={isFavorite}
                  className={`flex-1 min-h-[42px] inline-flex items-center justify-center gap-1.5 py-2.5 px-4 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                    isFavorite
                      ? 'border-[#5C3D28] bg-[#5C3D28] text-[#FCFBF7]'
                      : 'border-[#D4CCB8] text-[#2C1E16] hover:border-[#435334]'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
                  <span>{isFavorite ? 'Saved in Favorites' : 'Save to Favorites'}</span>
                </button>

                {canEditPhoto && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onEditPhoto(item);
                    }}
                    className="min-h-[42px] inline-flex items-center gap-1.5 py-2.5 px-4 text-xs font-medium text-[#5A4332] border border-[#D4CCB8] hover:border-[#435334] rounded-lg transition-colors whitespace-nowrap"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Edit Outfit &amp; Photo</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

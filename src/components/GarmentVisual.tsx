import { useState } from 'react';
import { Camera } from 'lucide-react';
import type { GarmentTone } from '../types';

interface GarmentVisualProps {
  src: string;
  alt: string;
  tone: GarmentTone;
  category: string;
  className?: string;
  onUploadClick?: () => void;
}

export function GarmentVisual({
  src,
  alt,
  tone,
  category,
  className = '',
  onUploadClick,
}: GarmentVisualProps) {
  const [hasError, setHasError] = useState(false);
  const showFallback = !src || src.trim().length === 0 || hasError;

  if (showFallback) {
    const surfaceBg =
      tone === 'warm'
        ? 'bg-gradient-to-b from-[#F6F2E7] to-[#EAE2CF] text-[#4A3525]'
        : 'bg-gradient-to-b from-[#F1F3EC] to-[#E3E8DC] text-[#3B4A32]';

    return (
      <div
        className={`relative flex flex-col items-center justify-center p-6 text-center select-none ${surfaceBg} ${className}`}
      >
        {/* Sculptural Headless Tailor Mannequin Form on Wooden Stand (No Face) */}
        <svg
          viewBox="0 0 120 180"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.35"
          className="w-20 h-32 opacity-70 mb-3"
          aria-hidden="true"
        >
          {/* Neck cap */}
          <rect x="52" y="14" width="16" height="8" rx="2" />
          {/* Torso / Dressmaker Form */}
          <path d="M52 22 C44 26, 34 30, 32 42 C30 56, 38 68, 40 82 C41 94, 35 108, 36 122 L84 122 C85 108, 79 94, 80 82 C82 68, 90 56, 88 42 C86 30, 76 26, 68 22 Z" />
          {/* Center Tailor Seam & Waist Tape */}
          <line x1="60" y1="22" x2="60" y2="122" strokeDasharray="3 3" />
          <path d="M40 80 Q60 84 80 80" strokeDasharray="2 2" />
          {/* Wooden Pedestal Pole & Base */}
          <line x1="60" y1="122" x2="60" y2="158" strokeWidth="2.2" />
          <path d="M42 164 L78 164 M48 158 L72 158 L78 164 L42 164 Z" />
        </svg>
        <p className="text-xs font-medium tracking-wide text-[#2C1E16]">{alt}</p>
        <p className="text-[11px] text-[#6E5846] mt-0.5">
          {category} · {tone === 'warm' ? 'Warm Palette' : 'Cool Palette'} · Mannequin Form
        </p>
        {onUploadClick && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onUploadClick();
            }}
            className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#FCFBF7] text-[#2C1E16] rounded-md border border-[#DED7C6] hover:border-[#435334] transition-colors whitespace-nowrap shrink-0"
          >
            <Camera className="w-3.5 h-3.5 text-[#435334]" />
            Add Mannequin Picture
          </button>
        )}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={`object-cover ${className}`}
    />
  );
}

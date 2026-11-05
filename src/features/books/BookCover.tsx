import { useState } from 'react';
import { cn } from '@/lib/cn';
import { coverTone, isArabic, PAPER_TONE } from './logic';

export interface CoverProps {
  title: string;
  author: string;
  url: string | null;
  mode?: 'image' | 'text';
  color?: string | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * A book's cover: the image when the book is set to show one, otherwise a typeset cover
 * laid out like a cloth-bound edition: a blind-stamped frame, the title set in the reading
 * face, a short rule and the author at the foot.
 */
export function BookCover({ title, author, url, mode, color, className, size = 'md' }: CoverProps) {
  const [failed, setFailed] = useState(false);
  const showImage = (mode ?? (url ? 'image' : 'text')) === 'image' && url && !failed;
  if (showImage)
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn('aspect-[2/3] w-full rounded-[4px] border border-border object-cover shadow-card', className)}
      />
    );
  const tone = coverTone(title, color);
  const paper = tone === PAPER_TONE;
  const ar = isArabic(title);
  const sm = size === 'sm';
  return (
    <div
      aria-hidden
      dir={ar ? 'rtl' : 'ltr'}
      lang={ar ? 'ar' : 'en'}
      className={cn('relative aspect-[2/3] w-full overflow-hidden rounded-[4px] border shadow-card', paper ? 'border-black/10 text-[#1f2a44]' : 'border-black/25 text-white', className)}
      style={{ background: tone }}
    >
      {/* Spine shadow and a stamped frame */}
      <span className={cn('absolute inset-y-0 start-0 w-[5%]', paper ? 'bg-black/[0.06]' : 'bg-black/20')} />
      <span className={cn('absolute inset-[7%] start-[11%] rounded-[2px] border', paper ? 'border-[#1f2a44]/25' : 'border-white/25')} />
      <div className="absolute inset-[7%] start-[11%] flex flex-col items-center justify-between px-[9%] py-[14%] text-center">
        <div className="flex w-full flex-col items-center gap-[0.5em]">
          <p
            className={cn(
              'w-full font-reading leading-snug font-semibold [overflow-wrap:anywhere]',
              sm ? 'line-clamp-4 text-[9px]' : size === 'lg' ? 'line-clamp-5 text-2xl' : 'line-clamp-4 text-base',
            )}
          >
            {title}
          </p>
          <span className={cn('h-px w-1/4', paper ? 'bg-[#1f2a44]/40' : 'bg-white/45')} />
        </div>
        {author && !sm && <p className={cn('line-clamp-2 w-full text-xs', paper ? 'text-[#1f2a44]/75' : 'text-white/75')}>{author}</p>}
      </div>
    </div>
  );
}

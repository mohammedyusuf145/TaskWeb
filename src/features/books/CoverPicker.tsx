import { useRef } from 'react';
import { Check, ImagePlus, Trash2 } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { Button, Segmented, toast } from '@/components/ui';
import { BookCover } from './BookCover';
import { coverFromFile } from './data';
import { COVER_TONES, coverTone } from './logic';

export interface CoverValue {
  mode: 'image' | 'text';
  url: string | null;
  color: string | null;
}

/**
 * Cover choice in one place: an image (your photo or the one found online) or a text cover
 * in a chosen colour. Switching to text keeps the image, so switching back restores it.
 */
export function CoverPicker({ title, author, value, onChange, layout = 'stack' }: { title: string; author: string; value: CoverValue; onChange: (v: CoverValue) => void; layout?: 'stack' | 'row' }) {
  const t = useT();
  const picker = useRef<HTMLInputElement>(null);
  const tone = coverTone(title || '—', value.color);

  const upload = async (f: File) => {
    try {
      onChange({ ...value, mode: 'image', url: await coverFromFile(f) });
    } catch {
      toast(t('tutor.err.unsupported'), { tone: 'danger' });
    }
  };

  return (
    <div className={cn('flex gap-4', layout === 'stack' ? 'flex-col' : 'items-start')}>
      <div className={cn('shrink-0', layout === 'stack' ? 'w-28 self-center' : 'w-24 sm:w-28')}>
        <BookCover title={title || t('books.title')} author={author} url={value.url} mode={value.mode} color={value.color} size="sm" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <Segmented
          label={t('books.cover')}
          value={value.mode}
          onValueChange={(mode) => (mode === 'image' && !value.url ? picker.current?.click() : onChange({ ...value, mode }))}
          className="[&>*]:h-8 [&>*]:px-3 [&>*]:text-sm"
          options={[
            { value: 'text', label: t('books.cover.text') },
            { value: 'image', label: t('books.cover.image') },
          ]}
        />
        {value.mode === 'text' ? (
          <div role="radiogroup" aria-label={t('books.cover.color')} className="flex flex-wrap gap-1.5">
            {COVER_TONES.map((c) => {
              const on = tone === c;
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={`${t('books.cover.color')} ${c}`}
                  onClick={() => onChange({ ...value, color: c })}
                  className={cn('press relative inline-flex size-8 items-center justify-center rounded-full border', on ? 'border-text' : 'border-border-strong')}
                >
                  <span className="size-6 rounded-full border border-black/10" style={{ background: c }} />
                  {on && <Check size={12} strokeWidth={3} className={cn('absolute', c === '#ece4d4' ? 'text-[#1f2a44]' : 'text-white')} />}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" iconStart={<ImagePlus size={14} />} onClick={() => picker.current?.click()}>
              {value.url ? t('books.cover.replace') : t('books.cover.upload')}
            </Button>
            {value.url && (
              <Button size="sm" variant="ghost" iconStart={<Trash2 size={14} />} onClick={() => onChange({ mode: 'text', url: null, color: value.color })}>
                {t('books.cover.remove')}
              </Button>
            )}
          </div>
        )}
        <p className="text-xs text-text-3">{value.mode === 'text' ? t('books.cover.textHint') : t('books.cover.imageHint')}</p>
      </div>
      <input
        ref={picker}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void upload(f);
        }}
      />
    </div>
  );
}

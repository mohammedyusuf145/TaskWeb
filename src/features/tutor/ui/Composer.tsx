import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUp, FileText, Paperclip, Square, X } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { IconButton, Select, toast } from '@/components/ui';
import { playUi } from '@/lib/uiSound';
import type { AttachmentMeta, Style, UserBlock } from '../protocol';
import { ACCEPT, FileError, prepareFile } from '../files';
import { errorKey } from './Conversation';

export type Attached = { block: UserBlock; meta: AttachmentMeta };

const STYLES: Style[] = ['simple', 'steps', 'analogy', 'exam'];
const MAX_FILES = 4;

export function Composer({
  busy,
  disabled,
  style,
  onStyle,
  onSend,
  onStop,
  draft,
  onDraftConsumed,
}: {
  busy: boolean;
  disabled?: boolean;
  style: Style;
  onStyle: (s: Style) => void;
  onSend: (text: string, files: Attached[]) => void;
  onStop: () => void;
  /** Text to place in the box (a suggestion or a restored message after an error). */
  draft?: { text: string; n: number } | null;
  onDraftConsumed?: () => void;
}) {
  const t = useT();
  const [text, setText] = useState('');
  const [files, setFiles] = useState<Attached[]>([]);
  const [drag, setDrag] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!draft) return;
    setText(draft.text);
    onDraftConsumed?.();
    requestAnimationFrame(() => {
      area.current?.focus();
      const n = draft.text.length;
      area.current?.setSelectionRange(n, n);
    });
  }, [draft?.n]);

  // Grow with the text, up to a third of the screen.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, Math.round(window.innerHeight / 3))}px`;
  }, [text]);

  async function add(list: FileList | File[]) {
    const incoming = Array.from(list).slice(0, MAX_FILES - files.length);
    if (list.length > incoming.length) toast(t('tutor.err.too_many_uploads'), { tone: 'danger' });
    for (const f of incoming) {
      try {
        const a = await prepareFile(f);
        setFiles((s) => (s.length < MAX_FILES ? [...s, a] : s));
      } catch (e) {
        playUi('error');
        toast(t(errorKey(e instanceof FileError ? e.message : 'unsupported')), { tone: 'danger' });
      }
    }
  }

  const canSend = !busy && !disabled && (text.trim().length > 0 || files.length > 0);
  const send = () => {
    if (!canSend) return;
    onSend(text, files);
    setText('');
    setFiles([]);
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends on keyboards; phones keep Enter for new lines.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && matchMedia('(pointer: fine)').matches) {
      e.preventDefault();
      send();
    }
  };
  const onPaste = (e: ClipboardEvent) => {
    const imgs = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'));
    if (imgs.length) {
      e.preventDefault();
      void add(imgs);
    }
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (e.dataTransfer.files.length) void add(e.dataTransfer.files);
  };

  return (
    <div className="px-3 pt-2 pb-3 md:px-8 md:pb-5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={cn(
          'mx-auto w-full max-w-[760px] rounded-[22px] border bg-surface-2 shadow-pop transition-[border-color,box-shadow] duration-[var(--dur-base)]',
          'focus-within:border-[color-mix(in_oklab,var(--accent),transparent_50%)]',
          drag ? 'border-accent' : 'border-border-strong',
        )}
      >
        <AnimatePresence initial={false}>
          {files.length > 0 && (
            <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="flex flex-wrap gap-2 overflow-hidden px-3 pt-3">
              {files.map((f, i) => (
                <li key={i} className="relative">
                  {f.meta.thumb ? (
                    <img src={f.meta.thumb} alt={f.meta.name} className="size-14 rounded-[12px] border border-border object-cover" />
                  ) : (
                    <span className="inline-flex h-14 max-w-[180px] items-center gap-2 rounded-[12px] border border-border bg-surface-1 px-3 text-sm text-text-2">
                      <FileText size={15} className="shrink-0" />
                      <span className="truncate" dir="auto">
                        {f.meta.name}
                      </span>
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={t('tutor.removeFile', { name: f.meta.name })}
                    onClick={() => setFiles((s) => s.filter((_, j) => j !== i))}
                    className="absolute -end-1.5 -top-1.5 inline-flex size-6 items-center justify-center rounded-full border border-border-strong bg-surface-3 text-text-2 hover:text-text"
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
        <label className="sr-only" htmlFor="tutor-input">
          {t('tutor.composer')}
        </label>
        <textarea
          id="tutor-input"
          ref={area}
          rows={1}
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          onPaste={onPaste}
          dir="auto"
          placeholder={t('tutor.composer.placeholder')}
          className="block max-h-[33vh] min-h-[52px] w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-[15px] text-text placeholder:text-text-3 focus:outline-none disabled:opacity-60"
        />
        <div className="flex items-center gap-1.5 px-2 pb-2">
          <IconButton label={t('tutor.attach')} icon={<Paperclip size={18} />} onClick={() => picker.current?.click()} disabled={disabled || files.length >= MAX_FILES} />
          <input
            ref={picker}
            type="file"
            accept={ACCEPT}
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) void add(e.target.files);
              e.target.value = '';
            }}
          />
          <div className="w-[140px]">
            <Select aria-label={t('tutor.style')} value={style} onChange={(e) => onStyle(e.target.value as Style)} className="!h-8 !rounded-full !text-sm">
              {STYLES.map((s) => (
                <option key={s} value={s}>
                  {t(`tutor.style.${s}`)}
                </option>
              ))}
            </Select>
          </div>
          <span className="flex-1" />
          {busy ? (
            <button
              type="button"
              onClick={onStop}
              aria-label={t('tutor.stop')}
              className="press inline-flex size-10 items-center justify-center rounded-full border border-border-strong bg-surface-3 text-text"
            >
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              onClick={send}
              disabled={!canSend}
              aria-label={t('tutor.send')}
              className="press inline-flex size-10 items-center justify-center rounded-full bg-accent text-accent-ink transition-opacity hover:bg-accent-hover disabled:opacity-35"
            >
              <ArrowUp size={19} strokeWidth={2.4} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

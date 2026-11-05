import { useEffect, useRef, useState } from 'react';
import { CloudUpload, File, FileImage, FileSpreadsheet, FileText, Presentation, Trash2, Upload } from 'lucide-react';
import type { Attachment } from '@/types/database';
import { useAttachments } from '@/lib/db/hooks';
import { useI18n, useT } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { Badge, IconButton, toast } from '@/components/ui';
import { ACCEPT, addAttachment, attachmentUrl, formatBytes, openAttachment, removeAttachment } from './attachments';

function iconFor(mime: string) {
  if (mime.startsWith('image/')) return FileImage;
  if (mime.includes('spreadsheet') || mime.includes('excel')) return FileSpreadsheet;
  if (mime.includes('presentation') || mime.includes('powerpoint')) return Presentation;
  if (mime === 'application/pdf' || mime.startsWith('text/') || mime.includes('word')) return FileText;
  return File;
}

export function AttachmentsField({ cardId }: { cardId: string }) {
  const t = useT();
  const lang = useI18n((s) => s.lang);
  const list = useAttachments(cardId) ?? [];
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  async function addFiles(files: FileList | File[]) {
    for (const file of Array.from(files).slice(0, 10)) {
      const res = await addAttachment(cardId, file);
      if (typeof res === 'string') toast(t(`att.err.${res}`, { name: file.name }), { tone: 'danger' });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {list.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {list.map((a) => (
            <AttachmentRow key={a.id} att={a} pending={a.pending} lang={lang} />
          ))}
        </ul>
      )}
      <div
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes('Files')) return;
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
        }}
        className={cn(
          'flex items-center gap-3 rounded-card border border-dashed px-3 py-3 transition-colors',
          over ? 'border-accent bg-accent-soft' : 'border-border-strong',
        )}
      >
        <Upload size={18} className="shrink-0 text-text-3" aria-hidden />
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => input.current?.click()} className="text-base text-text underline-offset-4 hover:underline">
            {t('card.dropFiles')}
          </button>
          <p className="text-xs text-text-3">{t('card.attachHint')}</p>
        </div>
        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            if (e.target.files?.length) void addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}

function AttachmentRow({ att, pending, lang }: { att: Attachment; pending: boolean; lang: 'ar' | 'en' }) {
  const t = useT();
  const Icon = iconFor(att.mime);
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    if (!att.mime.startsWith('image/') || att.mime.includes('heic') || att.mime.includes('heif')) return;
    let url: string | null = null;
    let alive = true;
    void attachmentUrl(att).then((u) => {
      url = u;
      if (alive) setThumb(u);
    });
    return () => {
      alive = false;
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
    };
  }, [att]);

  return (
    <li className="group/att flex items-center gap-3 rounded-card border border-border bg-surface-1 p-2">
      <button
        type="button"
        onClick={() => openAttachment(att)}
        className="flex min-w-0 flex-1 items-center gap-3 text-start"
      >
        <span className="inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-control bg-surface-3 text-text-2">
          {thumb ? <img src={thumb} alt="" className="size-full object-cover" /> : <Icon size={18} aria-hidden />}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-base text-text" dir="auto">
            {att.name}
          </span>
          <span className="flex items-center gap-2 text-xs text-text-3 tabular">
            {formatBytes(att.size_bytes, lang)}
            {pending && (
              <Badge className="!h-4">
                <CloudUpload size={10} aria-hidden />
                {t('att.pending')}
              </Badge>
            )}
          </span>
        </span>
      </button>
      <IconButton
        size="sm"
        label={t('att.remove', { name: att.name })}
        icon={<Trash2 size={14} />}
        onClick={() => removeAttachment(att)}
        className="opacity-0 group-hover/att:opacity-100 focus-visible:opacity-100 max-md:opacity-100"
      />
    </li>
  );
}

/** Turns a picked file into a tutor content block: photos are downscaled, PDFs and text are read as-is. */
import type { AttachmentMeta, UserBlock } from './protocol';

export const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/markdown,text/csv,.md,.txt,.csv';
const MAX_PDF = 10 * 1024 * 1024;
const MAX_IMAGE_IN = 25 * 1024 * 1024;
const MAX_TEXT = 120_000;

export class FileError extends Error {}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function scaled(file: File, max: number, quality: number): Promise<string> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * k);
  canvas.height = Math.round(bmp.height * k);
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#fff'; // transparent PNGs read better on white
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return canvas.toDataURL('image/jpeg', quality);
}

export async function prepareFile(file: File): Promise<{ block: UserBlock; meta: AttachmentMeta }> {
  const name = file.name.slice(0, 120) || 'file';
  const type = file.type || (/\.(md|txt|csv)$/i.test(name) ? 'text/plain' : '');
  if (type.startsWith('image/')) {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(type)) throw new FileError('unsupported');
    if (file.size > MAX_IMAGE_IN) throw new FileError('too_large');
    const full = await scaled(file, 1600, 0.85);
    const thumb = await scaled(file, 160, 0.7);
    return {
      block: { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: full.split(',')[1]! } },
      meta: { kind: 'image', name, thumb },
    };
  }
  if (type === 'application/pdf') {
    if (file.size > MAX_PDF) throw new FileError('too_large');
    return {
      block: { type: 'document', title: name, source: { type: 'base64', media_type: 'application/pdf', data: toBase64(await file.arrayBuffer()) } },
      meta: { kind: 'pdf', name },
    };
  }
  if (type.startsWith('text/')) {
    const text = await file.text();
    if (text.length > MAX_TEXT) throw new FileError('too_large');
    if (!text.trim()) throw new FileError('empty');
    return { block: { type: 'document', title: name, source: { type: 'text', media_type: 'text/plain', data: text } }, meta: { kind: 'text', name } };
  }
  throw new FileError('unsupported');
}

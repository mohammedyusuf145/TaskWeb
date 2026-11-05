import { describe, expect, it } from 'vitest';
import { safeName, validateFile, MAX_ATTACHMENT_BYTES } from './attachments';

describe('validateFile', () => {
  it('accepts PDFs, images and Office docs', () => {
    expect(validateFile({ name: 'notes.pdf', type: 'application/pdf', size: 1000 })).toEqual({ mime: 'application/pdf' });
    expect(validateFile({ name: 'page.JPG', type: 'image/jpeg', size: 1000 })).toEqual({ mime: 'image/jpeg' });
    expect(validateFile({ name: 'essay.docx', type: '', size: 1000 })).toEqual({
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  });
  it('rejects executables, mismatches, empty and oversized files', () => {
    expect(validateFile({ name: 'setup.exe', type: 'application/x-msdownload', size: 1000 })).toEqual({ error: 'type' });
    expect(validateFile({ name: 'trick.pdf', type: 'image/png', size: 1000 })).toEqual({ error: 'type' });
    expect(validateFile({ name: 'page.html', type: 'text/html', size: 1000 })).toEqual({ error: 'type' });
    expect(validateFile({ name: 'a.pdf', type: 'application/pdf', size: 0 })).toEqual({ error: 'empty' });
    expect(validateFile({ name: 'a.pdf', type: 'application/pdf', size: MAX_ATTACHMENT_BYTES + 1 })).toEqual({ error: 'size' });
  });
});

describe('safeName', () => {
  it('produces an ASCII storage key and keeps the extension', () => {
    expect(safeName('ملخص الوحدة 2.pdf')).toBe('2.pdf');
    expect(safeName('My notes (final).PDF')).toBe('My_notes_final.pdf');
    expect(safeName('../../etc/passwd')).not.toMatch(/\/|\.\./);
    expect(safeName('صورة.jpg')).toBe('file.jpg');
  });
});

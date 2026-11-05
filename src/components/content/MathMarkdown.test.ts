import { describe, expect, it } from 'vitest';
import { normalizeMath } from './MathMarkdown';

describe('normalizeMath', () => {
  it('turns one-line $$…$$ and \\[…\\] into display blocks', () => {
    expect(normalizeMath("So:\n$$f'(x) = 2x$$\nDone")).toBe("So:\n$$\nf'(x) = 2x\n$$\nDone");
    expect(normalizeMath('Area \\[A = \\pi r^2\\] here')).toBe('Area \n$$\nA = \\pi r^2\n$$\n here');
  });
  it('turns \\(…\\) into inline math and leaves code alone', () => {
    expect(normalizeMath('Let \\(x = 2\\).')).toBe('Let $x = 2$.');
    expect(normalizeMath('`\\(x\\)` and ```\n$$a$$\n```')).toBe('`\\(x\\)` and ```\n$$a$$\n```');
  });
  it('keeps inline $$ inside a sentence', () => {
    expect(normalizeMath('Value $$x$$ inline')).toBe('Value $$x$$ inline');
  });
});

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { cn } from '@/lib/cn';

/**
 * Markdown with LaTeX math ($…$ and $$…$$), used by the tutor. Kept separate from <Markdown>
 * so KaTeX only loads with the tutor. Same safety rules: no raw HTML, safe links,
 * per-block direction; math itself is always laid out left-to-right.
 */
/**
 * Normalises the math delimiters models commonly write: \[…\] and one-line $$…$$ become display
 * blocks, \(…\) becomes inline. Code spans and fences are left untouched.
 */
export function normalizeMath(src: string): string {
  return src
    .split(/(```[\s\S]*?```|`[^`\n]*`)/g)
    .map((part, i) => {
      if (i % 2 === 1) return part;
      return part
        .replace(/\\\[([\s\S]+?)\\\]/g, (_, m: string) => `\n$$\n${m.trim()}\n$$\n`)
        .replace(/\\\((.+?)\\\)/g, (_, m: string) => `$${m.trim()}$`)
        .replace(/^[ \t]*\$\$([^\n$]+?)\$\$[ \t]*$/gm, (_, m: string) => `$$\n${m.trim()}\n$$`);
    })
    .join('');
}

export function MathMarkdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn('prose-mizan prose-math', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: true }]]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: 'ignore', trust: false, output: 'htmlAndMathml' }]]}
        skipHtml
        components={{
          a: ({ href, children: c }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {c}
            </a>
          ),
          p: ({ children: c }) => <p dir="auto">{c}</p>,
          li: ({ children: c, className: cls }) => (
            <li dir="auto" className={cls}>
              {c}
            </li>
          ),
          h1: ({ children: c }) => <h3 dir="auto">{c}</h3>,
          h2: ({ children: c }) => <h3 dir="auto">{c}</h3>,
          h3: ({ children: c }) => <h3 dir="auto">{c}</h3>,
          img: ({ alt }) => <span className="text-text-3">[{alt}]</span>,
        }}
      >
        {normalizeMath(children)}
      </ReactMarkdown>
    </div>
  );
}

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/cn';

/**
 * Safe Markdown: raw HTML is never rendered (skipHtml), links open in a new tab without
 * access to this page, and each block picks its own direction for mixed Arabic/English text.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn('prose-mizan', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
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
          h1: ({ children: c }) => <h1 dir="auto">{c}</h1>,
          h2: ({ children: c }) => <h2 dir="auto">{c}</h2>,
          h3: ({ children: c }) => <h3 dir="auto">{c}</h3>,
          img: ({ alt }) => <span className="text-text-3">[{alt}]</span>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

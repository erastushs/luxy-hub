import fs from 'fs'
import path from 'path'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

const markdownComponents: Partial<Components> = {
  h1: ({ children, ...props }) => (
    <h1 className="text-3xl font-bold text-white mt-10 mb-4 pb-2 border-b border-gray-800" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="text-2xl font-bold text-white mt-8 mb-3 pb-1 border-b border-gray-800" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-xl font-semibold text-gray-200 mt-6 mb-2" {...props}>{children}</h3>
  ),
  p: ({ children, ...props }) => (
    <p className="text-gray-300 my-3 leading-relaxed" {...props}>{children}</p>
  ),
  a: ({ children, href, ...props }) => (
    <a href={href} className="text-gray-300 hover:text-white underline" target="_blank" rel="noopener noreferrer" {...props}>{children}</a>
  ),
  code: ({ className, children, ...props }: React.ComponentProps<'code'> & { className?: string }) => {
    const isInline = !className
    if (isInline) {
      return <code className="bg-gray-800 text-gray-200 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>{children}</code>
    }
    return (
      <code className="block bg-gray-900 text-gray-200 p-4 rounded-lg overflow-x-auto text-sm font-mono leading-relaxed border border-gray-800" {...props}>
        {children}
      </code>
    )
  },
  pre: ({ children, ...props }) => (
    <pre className="!bg-transparent !p-0 !m-0 my-4" {...props}>{children}</pre>
  ),
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto my-5">
      <table className="min-w-full border-collapse" {...props}>{children}</table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-gray-900" {...props}>{children}</thead>
  ),
  th: ({ children, ...props }) => (
    <th className="border border-gray-700 px-4 py-2.5 text-left text-sm font-semibold text-gray-200" {...props}>{children}</th>
  ),
  td: ({ children, ...props }) => (
    <td className="border border-gray-700 px-4 py-2.5 text-sm text-gray-300" {...props}>{children}</td>
  ),
  tr: ({ children, ...props }) => (
    <tr className="even:bg-gray-900/50" {...props}>{children}</tr>
  ),
  ul: ({ children, ...props }) => (
    <ul className="list-disc list-inside my-3 space-y-1 text-gray-300" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="list-decimal list-inside my-3 space-y-1 text-gray-300" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }) => (
    <li className="ml-4" {...props}>{children}</li>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote className="border-l-4 border-gray-600 pl-4 my-4 text-gray-400" {...props}>{children}</blockquote>
  ),
  hr: (props) => (
    <hr className="border-gray-800 my-8" {...props} />
  ),
  strong: ({ children, ...props }) => (
    <strong className="text-white font-semibold" {...props}>{children}</strong>
  ),
}

export default function ApiDocsPage() {
  const filePath = path.join(process.cwd(), 'API_INTEGRATION.md')
  const content = fs.readFileSync(filePath, 'utf-8')

  return (
    <div className="min-h-screen bg-[#0d0d0d]">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-300 text-sm mb-12 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to LuxyHub
        </Link>
        <article>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {content}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  )
}

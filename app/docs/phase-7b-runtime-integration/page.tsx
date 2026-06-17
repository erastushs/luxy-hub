import fs from 'fs'
import Link from 'next/link'
import { DOC_PATHS } from '@/app/lib/docs/document-paths'
import { DocsMarkdownContent } from '@/app/lib/docs/docs-markdown-content'

export default function Phase7BRuntimeIntegrationDocsPage() {
  const content = fs.readFileSync(DOC_PATHS.phase7bRuntimeIntegration, 'utf-8')

  return (
    <div className="min-h-screen bg-[#0d0d0d]">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <Link
          href="/docs"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-300 text-sm mb-12 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Docs
        </Link>
        <DocsMarkdownContent content={content} />
      </div>
    </div>
  )
}

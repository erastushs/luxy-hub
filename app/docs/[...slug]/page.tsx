import fs from 'fs'
import path from 'path'
import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { DocsMarkdownContent } from '@/app/lib/docs/docs-markdown-content'
import { resolveDocLinks } from '@/app/lib/docs/doc-link-resolver'
import { DocsShell } from '../docs-shell'
import { docsSections, getDocsSection } from '../docs-data'

type DocsSectionPageProps = {
  params: Promise<{ slug: string[] }>
}

export function generateStaticParams() {
  return docsSections
    .filter((s) => s.href !== '/docs')
    .map((section) => ({
      slug: section.href.replace('/docs/', '').split('/'),
    }))
}

export async function generateMetadata({ params }: DocsSectionPageProps): Promise<Metadata> {
  const { slug } = await params
  const slugStr = slug.join('/')
  if (slugStr === 'api') {
    redirect('/docs/reference/api')
  }
  const section = getDocsSection(slugStr)

  if (!section) {
    return { title: 'Documentation | LuxyHub' }
  }

  return {
    title: `${section.title} Docs | LuxyHub`,
    description: section.description,
  }
}

export default async function DocsSectionPage({ params }: DocsSectionPageProps) {
  const { slug } = await params
  const slugStr = slug.join('/')
  const section = getDocsSection(slugStr)

  if (!section) {
    notFound()
  }

  const contents = section.sourcePaths
    .filter((sourcePath) => fs.existsSync(sourcePath))
    .map((sourcePath) => {
      const raw = fs.readFileSync(sourcePath, 'utf-8')
      return resolveDocLinks(raw, path.dirname(sourcePath))
    })

  if (contents.length === 0) {
    notFound()
  }

  const content = contents.join('\n\n---\n\n')

  return (
    <DocsShell activeSection={section}>
      <DocsMarkdownContent content={content} />
    </DocsShell>
  )
}

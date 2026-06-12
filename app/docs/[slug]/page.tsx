import fs from 'fs'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { DocsMarkdownContent } from '@/app/lib/docs/docs-markdown-content'
import { DocsShell } from '../docs-shell'
import { docsSections, getDocsSection } from '../docs-data'

type DocsSectionPageProps = {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return docsSections.map((section) => ({ slug: section.href.replace('/docs/', '') }))
}

export async function generateMetadata({ params }: DocsSectionPageProps): Promise<Metadata> {
  const { slug } = await params
  const section = getDocsSection(slug)

  if (!section) {
    return {
      title: 'Documentation | LuxyHub',
    }
  }

  return {
    title: `${section.title} Docs | LuxyHub`,
    description: section.description,
  }
}

export default async function DocsSectionPage({ params }: DocsSectionPageProps) {
  const { slug } = await params
  const section = getDocsSection(slug)

  if (!section) {
    notFound()
  }

  const content = section.sourcePaths
    .filter((sourcePath) => fs.existsSync(sourcePath))
    .map((sourcePath) => fs.readFileSync(sourcePath, 'utf-8'))
    .join('\n\n---\n\n')

  return (
    <DocsShell activeSection={section}>
      <DocsMarkdownContent content={content} />
    </DocsShell>
  )
}

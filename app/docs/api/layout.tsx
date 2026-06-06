import type { Metadata } from 'next'
import DocsCursorReset from './docs-cursor-reset'

export const metadata: Metadata = {
  title: 'API Integration | LuxyHub',
  description: 'LuxyHub API key validation integration guide for Roblox Luau, Python, Node.js, and more.',
}

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <DocsCursorReset />
      <div className="docs-layout">{children}</div>
    </>
  )
}

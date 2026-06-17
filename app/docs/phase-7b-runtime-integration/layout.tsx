import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Phase 7B Runtime Integration | LuxyHub',
  description: 'Phase 7B.6 runtime popup validation integration guide for Roblox runtime developers.',
}

export default function RuntimeIntegrationDocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="docs-layout">{children}</div>
}

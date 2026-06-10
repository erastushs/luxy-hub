import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Event Platform Quickstart | LuxyHub',
  description: '5-minute guide to sending your first telemetry event through the LuxyHub Event Platform.',
}

export default function QuickstartLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="docs-layout">{children}</div>
}

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Event Platform Documentation | LuxyHub',
  description: 'Integrate LuxyHub Event Platform into your script runtime. Learn delivery sessions, event reporting, HMAC signatures, and webhook delivery.',
}

export default function EventPlatformLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <div className="docs-layout">{children}</div>
}

import { getCurrentUser } from '@/app/lib/auth/session-auth'
import { getWebhookConfigSafe } from '@/app/lib/services/dashboard-webhook-service'
import { redirect, notFound } from 'next/navigation'
import WebhookSettings from './webhooks-client'

export default async function WebhooksPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const { slug } = await params

  const result = await getWebhookConfigSafe(slug, user.id)

  if (!result.success) {
    notFound()
  }

  return (
    <WebhookSettings
      slug={slug}
      config={result.config}
    />
  )
}

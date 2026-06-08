import { getCurrentUser } from '@/app/lib/auth/session-auth'
import { getVisibleScript } from '@/app/lib/services/script-service'
import { redirect, notFound } from 'next/navigation'
import EditScriptClient from './edit-client'

export default async function EditScriptPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  const { slug } = await params

  const result = await getVisibleScript(slug, user.id)

  if (!result.success || !result.script) {
    notFound()
  }

  return <EditScriptClient script={result.script} />
}

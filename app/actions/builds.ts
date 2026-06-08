'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/app/lib/auth/session-auth'
import { rebuildLatestVersion } from '@/app/lib/services/build-operations-service'

type ActionResult = {
  success: boolean
  message?: string
}

export async function rebuildLatestBuildAction(
  slug: string,
  _prevState: ActionResult,
  _formData: FormData
): Promise<ActionResult> {
  void _prevState
  void _formData

  const user = await requireAuth()
  const result = await rebuildLatestVersion(user.id, slug)

  revalidatePath('/dashboard/scripts')
  revalidatePath(`/dashboard/scripts/${slug}/edit`)
  revalidatePath(`/dashboard/scripts/${slug}/builds`)
  revalidatePath(`/dashboard/versions/${slug}`)

  if (result.success || result.build) {
    redirect(`/dashboard/scripts/${slug}/builds`)
  }

  return { success: false, message: result.message }
}

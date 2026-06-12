'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/app/lib/auth/session-auth'
import { createScript, updateScript, deleteScript } from '@/app/lib/services/script-service'

type ActionResult = {
  success: boolean
  message?: string
  script?: { slug: string }
}

export async function createScriptAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const user = await requireAuth()

  const result = await createScript({
    slug: formData.get('slug'),
    name: formData.get('name'),
    description: formData.get('description'),
    visibility: formData.get('visibility'),
    access_mode: formData.get('access_mode'),
    content: formData.get('content') || '--',
    sourceFilename: formData.get('source_filename'),
    creatorId: user.id,
    creatorRole: user.role,
  })

  if (!result.success) {
    return { success: false, message: result.message }
  }

  revalidatePath('/dashboard/scripts')
  redirect('/dashboard/scripts')
}

export async function updateScriptAction(
  slug: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const user = await requireAuth()

  const result = await updateScript(
    slug,
    user.id,
    {
      name: formData.get('name'),
      description: formData.get('description'),
      visibility: formData.get('visibility'),
      access_mode: formData.get('access_mode'),
      content: formData.get('content') || undefined,
      sourceFilename: formData.get('source_filename'),
    },
    user.role
  )

  if (!result.success) {
    return { success: false, message: result.message }
  }

  revalidatePath('/dashboard/scripts')
  redirect('/dashboard/scripts')
}

export async function deleteScriptAction(slug: string): Promise<ActionResult> {
  const user = await requireAuth()

  const result = await deleteScript(slug, user.id, user.role)

  if (!result.success) {
    return { success: false, message: result.message }
  }

  revalidatePath('/dashboard/scripts')
  return { success: true, message: 'Script deleted' }
}

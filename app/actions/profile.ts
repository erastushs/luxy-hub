'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/app/lib/auth/session-auth'
import { ensureProfile } from '@/app/lib/services/profile-service'

type ProfileActionResult = {
  success: boolean
  message?: string
}

export async function updateProfileAction(
  _prevState: ProfileActionResult,
  formData: FormData
): Promise<ProfileActionResult> {
  const user = await requireAuth()

  const displayName = formData.get('display_name')
  const username = formData.get('username')

  const result = await ensureProfile({
    id: user.id,
    email: user.email,
    displayName:
      typeof displayName === 'string' && displayName.trim()
        ? displayName.trim()
        : user.profile.display_name,
    username:
      typeof username === 'string' && username.trim()
        ? username.trim()
        : null,
  })

  if (!result.success) {
    return { success: false, message: result.message }
  }

  revalidatePath('/dashboard/profile')
  return { success: true, message: 'Profile updated' }
}

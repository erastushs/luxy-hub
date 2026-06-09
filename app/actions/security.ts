'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/app/lib/supabase/server'

type SecurityActionResult = {
  success: boolean
  message?: string
}

export async function changePasswordAction(
  _prevState: SecurityActionResult,
  formData: FormData
): Promise<SecurityActionResult> {
  const supabase = await createSupabaseServerClient()
  const { data, error: userError } = await supabase.auth.getUser()

  if (userError || !data.user) {
    return { success: false, message: 'Sign in again to change your password.' }
  }

  const newPassword = formData.get('new_password')
  const confirmPassword = formData.get('confirm_password')

  if (typeof newPassword !== 'string' || newPassword.length === 0) {
    return { success: false, message: 'Enter a new password.' }
  }

  if (newPassword.length < 8) {
    return { success: false, message: 'Password must be at least 8 characters.' }
  }

  if (typeof confirmPassword !== 'string' || confirmPassword.length === 0) {
    return { success: false, message: 'Confirm your new password.' }
  }

  if (newPassword !== confirmPassword) {
    return { success: false, message: 'Passwords do not match.' }
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })

  if (error) {
    return { success: false, message: error.message || 'Unable to update password.' }
  }

  revalidatePath('/dashboard/profile')
  return { success: true, message: 'Password updated.' }
}

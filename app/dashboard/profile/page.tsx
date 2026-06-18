import { getCurrentUser } from '@/app/lib/auth/session-auth'
import { redirect } from 'next/navigation'
import { ProfileClient } from './profile-client'

export default async function ProfilePage() {
  const user = await getCurrentUser()

  if (!user) redirect('/login')

  return <ProfileClient user={user} />
}

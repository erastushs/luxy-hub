import { getCurrentUser } from '@/app/lib/auth/session-auth'
import { ProfileClient } from './profile-client'

export default async function ProfilePage() {
  const user = await getCurrentUser()

  return <ProfileClient user={user!} />
}

import { Globe, EyeOff, Eye, type LucideIcon } from 'lucide-react'

export type VisibilityKind = 'public' | 'private' | 'unlisted'

export const visibilityConfig: Record<VisibilityKind, { label: string; icon: LucideIcon; className: string }> = {
  public: { label: 'Public', icon: Globe, className: 'text-emerald-400 bg-emerald-400/10' },
  private: { label: 'Private', icon: EyeOff, className: 'text-zinc-400 bg-zinc-400/10' },
  unlisted: { label: 'Unlisted', icon: Eye, className: 'text-amber-400 bg-amber-400/10' },
}

export function getVisibilityBadge(visibility: string) {
  return visibilityConfig[visibility as VisibilityKind] ?? visibilityConfig.private
}

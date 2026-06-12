import { Globe, KeyRound, ShieldCheck, type LucideIcon } from 'lucide-react'

export type AccessModeKind = 'public' | 'key_required' | 'license_required'

export const accessModeConfig: Record<AccessModeKind, { label: string; icon: LucideIcon; className: string }> = {
  public: {
    label: 'PUBLIC',
    icon: Globe,
    className: 'text-emerald-300 bg-emerald-400/10 ring-1 ring-emerald-400/20',
  },
  key_required: {
    label: 'KEY REQUIRED',
    icon: KeyRound,
    className: 'text-sky-300 bg-sky-400/10 ring-1 ring-sky-400/20',
  },
  license_required: {
    label: 'LICENSE REQUIRED',
    icon: ShieldCheck,
    className: 'text-violet-300 bg-violet-400/10 ring-1 ring-violet-400/20',
  },
}

export function getAccessModeBadge(accessMode: string) {
  return accessModeConfig[accessMode as AccessModeKind] ?? accessModeConfig.public
}

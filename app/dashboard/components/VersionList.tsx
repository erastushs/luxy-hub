'use client'

import { VersionCard } from './VersionCard'

type VersionRow = {
  id: string
  script_id: string
  version: string
  changelog: string | null
  created_at: string
}

type VersionListProps = {
  versions: VersionRow[]
  selectedId?: string
  onSelect?: (version: VersionRow) => void
}

export function VersionList({ versions, selectedId, onSelect }: VersionListProps) {
  if (versions.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
        <p className="text-sm text-zinc-500">No versions found for this script.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {versions.map((v) => (
        <VersionCard
          key={v.id}
          version={v}
          active={v.id === selectedId}
          onClick={() => onSelect?.(v)}
        />
      ))}
    </div>
  )
}

type TrendPoint = {
  day: string
  downloads: number
}

type DownloadsChartProps = {
  points: TrendPoint[]
  title: string
}

function formatDayLabel(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function DownloadsChart({ points, title }: DownloadsChartProps) {
  const maxDownloads = Math.max(...points.map((p) => p.downloads), 1)
  const chartHeight = 160
  const barWidth = Math.max(4, Math.floor(400 / points.length) - 2)

  if (points.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h3 className="text-sm font-medium text-zinc-300">{title}</h3>
        <div className="mt-4 flex h-40 items-center justify-center text-xs text-zinc-500">
          No download data for this period
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h3 className="text-sm font-medium text-zinc-300">{title}</h3>
      <div className="mt-4">
        <svg
          viewBox={`0 0 ${Math.max(points.length * (barWidth + 4), 300)} ${chartHeight + 30}`}
          className="h-48 w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {points.map((point, i) => {
            const barH = maxDownloads > 0 ? (point.downloads / maxDownloads) * chartHeight : 0
            const x = i * (barWidth + 4) + (barWidth + 4) / 2
            const y = chartHeight - barH

            return (
              <g key={point.day}>
                <rect
                  x={i * (barWidth + 4) + 2}
                  y={y}
                  width={barWidth}
                  height={Math.max(barH, 0.5)}
                  rx={2}
                  className="fill-red-600/70"
                />
                <text
                  x={x}
                  y={chartHeight + 20}
                  textAnchor="middle"
                  className="fill-zinc-500"
                  fontSize="10"
                >
                  {points.length <= 14 ? formatDayLabel(point.day) : ''}
                </text>
                {point.downloads > 0 && (
                  <text
                    x={x}
                    y={y - 4}
                    textAnchor="middle"
                    className="fill-zinc-400"
                    fontSize="9"
                  >
                    {point.downloads}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

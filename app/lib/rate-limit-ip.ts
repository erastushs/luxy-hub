export function getClientIP(request: Request): string {
  return getClientIPFromHeaders(request.headers)
}

export function getClientIPFromHeaders(headers: Headers): string {
  const vercelForwardedFor = normalizeForwardedValue(headers.get('x-vercel-forwarded-for'))
  if (vercelForwardedFor) {
    return vercelForwardedFor
  }

  if (headers.has('x-forwarded-for') || headers.has('forwarded')) {
    return 'untrusted-forwarded-chain'
  }

  const realIp = normalizeIp(headers.get('x-real-ip'))
  if (realIp) return realIp

  return '127.0.0.1'
}

function normalizeForwardedValue(value: string | null): string | null {
  if (!value) return null
  const ips = value.split(',').map((s) => normalizeIp(s)).filter((ip): ip is string => Boolean(ip))
  return ips.length === 1 ? ips[0] : 'untrusted-forwarded-chain'
}

function normalizeIp(value: string | null): string | null {
  const ip = value?.trim()
  if (!ip || ip.length > 128 || /[\r\n]/.test(ip)) return null
  return ip
}

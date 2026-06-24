import { describe, expect, it } from 'vitest'
import { MonitorAuthError, requireMonitorAuth } from '@/app/lib/monitor/auth'

describe('requireMonitorAuth', () => {
  it('rejects when the monitor token is not configured', async () => {
    await expect(
      requireMonitorAuth({
        headers: new Headers({ authorization: 'Bearer secret-token' }),
        env: {},
      })
    ).rejects.toMatchObject({
      name: 'MonitorAuthError',
      status: 401,
      message: 'Unauthorized',
    })
  })

  it('accepts the Authorization bearer header', async () => {
    await expect(
      requireMonitorAuth({
        headers: new Headers({ authorization: 'Bearer monitor-secret' }),
        env: { LUXY_MONITOR_TOKEN: 'monitor-secret' },
      })
    ).resolves.toBeUndefined()
  })

  it('accepts the monitoring token header', async () => {
    await expect(
      requireMonitorAuth({
        headers: new Headers({ 'x-luxy-monitor-token': 'monitor-secret' }),
        env: { LUXY_MONITOR_TOKEN: 'monitor-secret' },
      })
    ).resolves.toBeUndefined()
  })

  it('rejects invalid tokens', async () => {
    await expect(
      requireMonitorAuth({
        headers: new Headers({ authorization: 'Bearer wrong-token' }),
        env: { LUXY_MONITOR_TOKEN: 'monitor-secret' },
      })
    ).rejects.toBeInstanceOf(MonitorAuthError)
  })

  it('prefers a valid bearer token over an invalid fallback header', async () => {
    await expect(
      requireMonitorAuth({
        headers: new Headers({
          authorization: 'Bearer monitor-secret',
          'x-luxy-monitor-token': 'wrong-token',
        }),
        env: { LUXY_MONITOR_TOKEN: 'monitor-secret' },
      })
    ).resolves.toBeUndefined()
  })
})

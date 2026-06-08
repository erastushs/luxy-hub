import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { useActionState } from 'react'
import LoginPage from '@/app/login/page'
import { resetTurnstileWidget } from '@/app/login/TurnstileWidget'

const turnstileProps = vi.hoisted(() => ({
  latest: null as { siteKey: string; resetSignal?: unknown } | null,
}))

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    useActionState: vi.fn(),
  }
})

vi.mock('@/app/actions/auth', () => ({
  login: vi.fn(),
}))

vi.mock('@/app/login/TurnstileWidget', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/login/TurnstileWidget')>()

  return {
    ...actual,
    default: (props: { siteKey: string; resetSignal?: unknown }) => {
      turnstileProps.latest = props
      return <div data-testid="turnstile-widget" />
    },
  }
})

const mockedUseActionState = vi.mocked(useActionState)

describe('Turnstile widget token lifecycle', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'site-key'
    turnstileProps.latest = null
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  })

  it('clears stale tokens and resets the rendered Turnstile widget', () => {
    const reset = vi.fn()
    const clearToken = vi.fn()

    resetTurnstileWidget({ reset }, 'widget-id', clearToken)

    expect(clearToken).toHaveBeenCalledOnce()
    expect(reset).toHaveBeenCalledWith('widget-id')
  })

  it('clears stale tokens even before Turnstile has rendered', () => {
    const clearToken = vi.fn()

    resetTurnstileWidget(undefined, null, clearToken)

    expect(clearToken).toHaveBeenCalledOnce()
  })

  it('passes a reset signal to Turnstile after a failed login state', () => {
    const state = { error: 'Invalid login credentials' }
    mockedUseActionState.mockReturnValue([state, vi.fn(), false])

    renderToStaticMarkup(<LoginPage />)

    expect(turnstileProps.latest?.siteKey).toBe('site-key')
    expect(turnstileProps.latest?.resetSignal).toBe(state)
  })

  it('does not reset Turnstile on the initial login state', () => {
    mockedUseActionState.mockReturnValue([{}, vi.fn(), false])

    renderToStaticMarkup(<LoginPage />)

    expect(turnstileProps.latest?.siteKey).toBe('site-key')
    expect(turnstileProps.latest?.resetSignal).toBeNull()
  })
})

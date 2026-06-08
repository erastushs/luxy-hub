'use client'

import Script from 'next/script'
import { useCallback, useEffect, useRef, useState } from 'react'

type TurnstileWidgetProps = {
  siteKey: string
  resetSignal?: unknown
}

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string
      action: string
      theme: 'dark'
      callback: (token: string) => void
      'expired-callback': () => void
      'error-callback': () => void
    }
  ) => string
  reset: (widgetId?: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

export function resetTurnstileWidget(
  turnstile: Pick<TurnstileApi, 'reset'> | undefined,
  widgetId: string | null,
  clearToken: () => void
) {
  clearToken()

  if (turnstile && widgetId) {
    turnstile.reset(widgetId)
  }
}

export default function TurnstileWidget({ siteKey, resetSignal }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [token, setToken] = useState('')

  const renderTurnstile = useCallback(() => {
    if (!window.turnstile || !containerRef.current || widgetIdRef.current) {
      return
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      action: 'login',
      theme: 'dark',
      callback: setToken,
      'expired-callback': () => setToken(''),
      'error-callback': () => setToken(''),
    })
  }, [siteKey])

  const resetTurnstile = useCallback(() => {
    resetTurnstileWidget(window.turnstile, widgetIdRef.current, () => setToken(''))
  }, [])

  useEffect(() => {
    renderTurnstile()
  }, [renderTurnstile])

  useEffect(() => {
    if (resetSignal) {
      resetTurnstile()
    }
  }, [resetSignal, resetTurnstile])

  return (
    <div className="flex justify-center">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        async
        defer
        onLoad={renderTurnstile}
      />
      <input type="hidden" name="cf-turnstile-response" value={token} />
      <div ref={containerRef} />
    </div>
  )
}

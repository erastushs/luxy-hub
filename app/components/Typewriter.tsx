'use client'

import { useEffect, useRef, useState } from 'react'
import { config } from '../data/config'

const messages = config.typewriterMessages

export default function Typewriter() {
  const [displayText, setDisplayText] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const msgIdxRef = useRef(0)
  const charIdxRef = useRef(0)
  const deletingRef = useRef(false)

  useEffect(() => {
    function tick() {
      const msg = messages[msgIdxRef.current]

      if (!deletingRef.current) {
        if (charIdxRef.current < msg.length) {
          setDisplayText(msg.slice(0, charIdxRef.current + 1))
          charIdxRef.current++
          timerRef.current = setTimeout(tick, 50)
        } else {
          deletingRef.current = true
          timerRef.current = setTimeout(tick, 2500)
        }
      } else {
        if (charIdxRef.current > 0) {
          charIdxRef.current--
          setDisplayText(msg.slice(0, charIdxRef.current))
          timerRef.current = setTimeout(tick, 25)
        } else {
          deletingRef.current = false
          msgIdxRef.current = (msgIdxRef.current + 1) % messages.length
          timerRef.current = setTimeout(tick, 300)
        }
      }
    }

    timerRef.current = setTimeout(tick, 300)

    return () => clearTimeout(timerRef.current)
  }, [])

  return (
    <div className="h-8">
      <p className="text-zinc-400">
        {displayText}
        <span className="animate-pulse text-red-500">|</span>
      </p>
    </div>
  )
}

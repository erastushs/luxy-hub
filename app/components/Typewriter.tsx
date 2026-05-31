'use client'

import { useEffect, useState } from 'react'
import { config } from '../data/config'

const messages = config.typewriterMessages
export default function Typewriter() {
  const [text, setText] = useState('')
  const [messageIndex, setMessageIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)

  useEffect(() => {
    const currentMessage = messages[messageIndex]

    if (charIndex < currentMessage.length) {
      const timeout = setTimeout(() => {
        setText(currentMessage.slice(0, charIndex + 1))
        setCharIndex(charIndex + 1)
      }, 50)

      return () => clearTimeout(timeout)
    }

    const timeout = setTimeout(() => {
      setText('')
      setCharIndex(0)
      setMessageIndex((prev) => (prev + 1) % messages.length)
    }, 2500)

    return () => clearTimeout(timeout)
  }, [charIndex, messageIndex])

  return (
    <div className="h-8">
      <p className="text-zinc-400">
        {text}
        <span className="animate-pulse text-red-500">|</span>
      </p>
    </div>
  )
}

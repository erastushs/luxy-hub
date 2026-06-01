'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'

export default function CustomCursor() {
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [hovering, setHovering] = useState(false)

  useEffect(() => {
    const moveCursor = (e: MouseEvent) => {
      setPosition({
        x: e.clientX,
        y: e.clientY,
      })
    }

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement

      if (target.closest('button') || target.closest('a')) {
        setHovering(true)
      } else {
        setHovering(false)
      }
    }

    window.addEventListener('mousemove', moveCursor)
    window.addEventListener('mouseover', handleMouseOver)

    return () => {
      window.removeEventListener('mousemove', moveCursor)
      window.removeEventListener('mouseover', handleMouseOver)
    }
  }, [])

  return (
    <div
      className="
      pointer-events-none
      fixed
      z-[9999]
      hidden
      md:block
    "
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, -50%)',
        filter: hovering
          ? 'drop-shadow(0 0 12px rgba(239,68,68,0.9)) drop-shadow(0 0 24px rgba(239,68,68,0.6))'
          : 'drop-shadow(0 0 8px rgba(239,68,68,0.6))',
      }}
    >
      <Image src={hovering ? '/LH2.webp' : '/LH.webp'} alt="Cursor" width={32} height={32} priority />
    </div>
  )
}

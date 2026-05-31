'use client'

import { useEffect, useState } from 'react'
import { ChevronUp } from 'lucide-react'

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const toggleVisibility = () => {
      setVisible(window.scrollY > 300)
    }

    window.addEventListener('scroll', toggleVisibility)

    return () => window.removeEventListener('scroll', toggleVisibility)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  return (
    <button
      onClick={scrollToTop}
      className={`
        fixed bottom-6 right-6 z-50
        rounded-xl border border-red-500/30
        bg-red-500/10 p-3
        text-red-400
        backdrop-blur
        transition-all duration-300

        hover:bg-red-500/20
        hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]

        ${visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'}
      `}
    >
      <ChevronUp size={22} />
    </button>
  )
}

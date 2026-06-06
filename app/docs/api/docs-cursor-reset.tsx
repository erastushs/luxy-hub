'use client'

import { useEffect } from 'react'

export default function DocsCursorReset() {
  useEffect(() => {
    const cursor = document.getElementById('custom-cursor')
    if (cursor) {
      cursor.style.display = 'none'
    }
    document.documentElement.setAttribute('data-hide-cursor', 'true')
    return () => {
      if (cursor) {
        cursor.style.display = ''
      }
      document.documentElement.removeAttribute('data-hide-cursor')
    }
  }, [])

  return null
}

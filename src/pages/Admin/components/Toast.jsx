import { useEffect } from 'react'

export function Toast({ message, type = 'success', onClear }) {
  useEffect(() => {
    if (!message) return undefined
    const t = setTimeout(onClear, 3200)
    return () => clearTimeout(t)
  }, [message, onClear])

  if (!message) return null

  return (
    <div id="admin-toast" className={`admin-toast show ${type}`} role="status" aria-live="polite">
      {message}
    </div>
  )
}

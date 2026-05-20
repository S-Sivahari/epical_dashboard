import { useEffect, useState } from 'react'

export function useMediaQuery(query: string) {
  const [match, setMatch] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatch(mq.matches)
    mq.addEventListener('change', onChange)
    setMatch(mq.matches)
    return () => mq.removeEventListener('change', onChange)
  }, [query])
  return match
}

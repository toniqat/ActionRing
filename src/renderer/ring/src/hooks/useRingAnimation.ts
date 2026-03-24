import { useState, useEffect, useRef } from 'react'

export type AnimationPhase = 'entering' | 'visible' | 'exiting' | 'gone'

const SPEED_MS: Record<string, { expand: number; fade: number }> = {
  slow: { expand: 320, fade: 240 },
  normal: { expand: 200, fade: 150 },
  fast: { expand: 110, fade: 85 }
}

export function useRingAnimation(
  visible: boolean,
  speed: 'slow' | 'normal' | 'fast' = 'normal',
  onGone?: () => void
): { phase: AnimationPhase; expandMs: number; fadeMs: number } {
  const [phase, setPhase] = useState<AnimationPhase>('gone')
  const { expand, fade } = SPEED_MS[speed]
  // Track whether we are already mid-entry so a second `visible=true` signal
  // (e.g. from a double-fired IPC event) does not restart the animation.
  const phaseRef = useRef<AnimationPhase>('gone')
  // Keep onGone stable across renders without re-running the effect
  const onGoneRef = useRef(onGone)
  onGoneRef.current = onGone

  useEffect(() => {
    if (visible) {
      // Only start entering animation if we are not already entering or visible
      if (phaseRef.current === 'entering' || phaseRef.current === 'visible') return
      phaseRef.current = 'entering'
      setPhase('entering')
      const t = setTimeout(() => {
        phaseRef.current = 'visible'
        setPhase('visible')
      }, expand)
      return () => clearTimeout(t)
    } else {
      if (phaseRef.current === 'gone') return
      phaseRef.current = 'exiting'
      setPhase('exiting')
      // Exit mirrors enter: same duration as expand
      const t = setTimeout(() => {
        phaseRef.current = 'gone'
        setPhase('gone')
        onGoneRef.current?.()
      }, expand)
      return () => clearTimeout(t)
    }
  }, [visible, expand, fade])

  return { phase, expandMs: expand, fadeMs: fade }
}

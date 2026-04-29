import { useState, useEffect, useRef } from 'react'

export type AnimationPhase = 'entering' | 'visible' | 'exiting' | 'gone'

const SPEED_MS: Record<string, { expand: number }> = {
  slow: { expand: 320 },
  normal: { expand: 200 },
  fast: { expand: 110 },
}

export function useRingAnimation(
  visible: boolean,
  speed: 'slow' | 'normal' | 'fast' = 'normal',
  onGone?: () => void
): { phase: AnimationPhase; expandMs: number } {
  const [phase, setPhase] = useState<AnimationPhase>('gone')
  const { expand } = SPEED_MS[speed]
  // Track whether we are already mid-entry so a second `visible=true` signal
  // (e.g. from a double-fired IPC event) does not restart the animation.
  const phaseRef = useRef<AnimationPhase>('gone')
  // Keep onGone stable across renders without re-running the effect
  const onGoneRef = useRef(onGone)
  onGoneRef.current = onGone

  useEffect(() => {
    if (visible) {
      // Only start entering animation if we are not already entering, visible, or mid-exit.
      // Guarding 'exiting' prevents the animation from restarting if a second IPC_RING_SHOW
      // somehow arrives while the exit animation is still in progress.
      if (phaseRef.current === 'entering' || phaseRef.current === 'visible' || phaseRef.current === 'exiting') return
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
  }, [visible, expand])

  return { phase, expandMs: expand }
}

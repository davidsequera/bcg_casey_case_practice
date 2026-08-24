import { useEffect, useRef, useState } from 'react'

export interface Countdown {
  /** whole seconds left; clamped at 0 */
  remaining: number
  /** seconds elapsed since the clock started, keeps counting past the limit */
  elapsed: number
  expired: boolean
}

/** Ticks four times a second while `running`, so clocks read from the wall clock. */
function useNow(running: boolean, restartKey: string): number {
  const [now, setNow] = useState<number>(() => Date.now())

  useEffect(() => {
    setNow(Date.now())
  }, [restartKey])

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [running, restartKey])

  return now
}

/**
 * The case-level clock. It is anchored to an absolute start time rather than to
 * mount, so a refresh mid-case resumes on the same deadline and a backgrounded
 * tab cannot drift.
 */
export function useDeadline(
  startedAtMs: number,
  totalSeconds: number,
  running: boolean,
): Countdown {
  const now = useNow(running, String(startedAtMs))
  const elapsed = Math.max(0, Math.floor((now - startedAtMs) / 1000))
  const remaining = Math.max(0, totalSeconds - elapsed)
  return { remaining, elapsed, expired: remaining === 0 }
}

/**
 * Wall-clock countdown re-keyed on `key`, used for the per-question pacing budget.
 * Advisory only: nothing locks when it hits zero.
 */
export function useCountdown(limitSeconds: number, key: string, running: boolean): Countdown {
  const startRef = useRef<number>(Date.now())
  const now = useNow(running, key)

  useEffect(() => {
    startRef.current = Date.now()
  }, [key])

  const elapsed = Math.max(0, Math.floor((now - startRef.current) / 1000))
  const remaining = Math.max(0, limitSeconds - elapsed)
  return { remaining, elapsed, expired: remaining === 0 }
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const m = Math.floor(s / 60)
  const rest = s % 60
  return `${m}:${String(rest).padStart(2, '0')}`
}

/** 24-hour HH:MM, the stamp Casey puts beside each message. */
export function formatStamp(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

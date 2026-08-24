import type { Case, Session } from '../types/case'

const CASES_KEY = 'casey.uploadedCases.v1'
const SESSION_KEY = 'casey.session.v1'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // quota exceeded or storage blocked -- uploads simply do not persist
  }
}

export function loadUploadedCases(): Case[] {
  return read<Case[]>(CASES_KEY, [])
}

/** Adds a case, replacing any existing upload with the same id. */
export function saveUploadedCase(c: Case): Case[] {
  const next = [...loadUploadedCases().filter((x) => x.id !== c.id), c]
  write(CASES_KEY, next)
  return next
}

export function deleteUploadedCase(id: string): Case[] {
  const next = loadUploadedCases().filter((x) => x.id !== id)
  write(CASES_KEY, next)
  return next
}

export function loadSession(): Session | null {
  return read<Session | null>(SESSION_KEY, null)
}

export function saveSession(s: Session | null): void {
  if (s === null) {
    try {
      localStorage.removeItem(SESSION_KEY)
    } catch {
      // ignore
    }
    return
  }
  write(SESSION_KEY, s)
}

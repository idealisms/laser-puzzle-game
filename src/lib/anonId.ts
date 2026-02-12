const ANON_ID_KEY = 'laser-puzzle-anon-id'

export function getOrCreateAnonId(): string {
  if (typeof window === 'undefined') return ''

  let id = localStorage.getItem(ANON_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(ANON_ID_KEY, id)
  }
  return id
}

export function getAnonId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ANON_ID_KEY)
}

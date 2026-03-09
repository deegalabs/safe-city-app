export async function getAnonymousFingerprint(): Promise<string> {
  const stored = sessionStorage.getItem('shield_fp')
  if (stored) return stored
  const raw = [navigator.language, navigator.hardwareConcurrency, screen.width, screen.height, screen.colorDepth, Intl.DateTimeFormat().resolvedOptions().timeZone].join('|')
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  const fp = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
  sessionStorage.setItem('shield_fp', fp)
  return fp
}

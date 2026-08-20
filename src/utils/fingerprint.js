// ????????????????SHA-256 ??? 32 ??
export async function computeFingerprint(shareData) {
  try {
    if (!globalThis.crypto || !globalThis.crypto.subtle) return ''
    const data = new TextEncoder().encode(JSON.stringify(shareData))
    const digest = await globalThis.crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 32)
  } catch {
    return ''
  }
}

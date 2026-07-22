import LZString from 'lz-string'

export function compressData(data) {
  const json = JSON.stringify(data)
  return LZString.compressToEncodedURIComponent(json)
}

export function decompressData(encoded) {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded)
    if (!json) return null
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function estimateUrlLength(data) {
  const compressed = compressData(data)
  return compressed.length
}

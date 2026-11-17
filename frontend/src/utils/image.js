// image.js — prepare a ticket photo in the browser: shrink it and re-encode as JPEG so uploads stay small.
// The image only lives in memory for this request; it is never written to storage.

export const MAX_SIDE = 1600
export const MAX_BASE64_CHARS = 5_300_000 // backend limit is ~4 MB of image data

/** Size to scale (w, h) down to so the longer side is at most `maxSide` (never scales up). */
export function targetSize(w, h, maxSide = MAX_SIDE) {
  const scale = Math.min(1, maxSide / Math.max(w, h))
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) }
}

async function decode(file) {
  if (typeof createImageBitmap === 'function') return createImageBitmap(file)
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')) }
    img.src = url
  })
}

export async function prepareImage(file) {
  if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('unsupported type')
  const bmp = await decode(file)
  const { width, height } = targetSize(bmp.width, bmp.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d').drawImage(bmp, 0, 0, width, height)
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
  const base64 = dataUrl.split(',')[1] || ''
  if (!base64 || base64.length > MAX_BASE64_CHARS) throw new Error('image too large')
  return { base64, mime: 'image/jpeg', previewUrl: dataUrl }
}

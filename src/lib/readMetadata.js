const JPEG_MARKER = 0xff
const MARKER_SOI = 0xd8
const MARKER_APP1 = 0xe1
const MARKER_APP11 = 0xeb
const MARKER_SOS = 0xda

const EXIF_IDENTIFIER = 'Exif\x00\x00'
const XMP_IDENTIFIER = 'http://ns.adobe.com/xap/1.0/\x00'
const JUMBF_IDENTIFIER_SIG = 0x4a554d42 // 'JUMB' in big-endian

// ── JUMBF helpers ──

function parseJUMBFBoxes(data, maxBoxes = 20) {
  const boxes = []
  let offset = 8 // skip outer LBox + TBox ('jumb')
  while (offset < data.length - 8 && boxes.length < maxBoxes) {
    const boxLen = new DataView(data.buffer, data.byteOffset + offset, 4).getUint32(0, false)
    if (boxLen < 8 || offset + boxLen > data.length) break
    const boxType = String.fromCharCode(...data.subarray(offset + 4, offset + 8))
    const box = { type: boxType, size: boxLen }

    if (boxType === 'jumd' && boxLen > 16) {
      const jsonPart = data.subarray(offset + 16, offset + boxLen)
      try { box.json = JSON.parse(new TextDecoder().decode(jsonPart)) } catch { /* not JSON */ }
    }
    if (boxType === 'jumb') {
      const childLen = new DataView(data.buffer, data.byteOffset + offset + 8, 4).getUint32(0, false)
      const childType = String.fromCharCode(...data.subarray(offset + 12, offset + 16))
      if (childType === 'c2pa' || childType === 'c2pm') {
        box.contains = childType
        box.containsSize = childLen
      }
    }

    boxes.push(box)
    offset += boxLen
  }
  return boxes
}

// ── EXIF ──

const EXIF_TAGS = {
  0x010f: 'Make',
  0x0110: 'Model',
  0x0112: 'Orientation',
  0x0131: 'Software',
  0x0132: 'DateTime',
  0x013b: 'Artist',
  0x829a: 'ExposureTime',
  0x829d: 'FNumber',
  0x8827: 'ISO',
  0x9003: 'DateTimeOriginal',
  0x920a: 'FocalLength',
  0xa405: 'FocalLengthIn35mm',
}

const ORIENTATIONS = {
  1: 'Normal',
  3: 'Rotated 180°',
  6: 'Rotated 90° CW',
  8: 'Rotated 90° CCW',
}

function parseEXIF(view, start, length) {
  const end = start + length
  const results = []
  try {
    const byteOrder = view.getUint16(start, false)
    const isLE = byteOrder === 0x4949
    if (byteOrder !== 0x4d4d && !isLE) return results

    const tagMark = view.getUint16(start + 2, isLE)
    if (tagMark !== 0x002a) return results

    const ifd0Offset = view.getUint32(start + 4, isLE)
    if (start + ifd0Offset >= end) return results

    const entries = view.getUint16(start + ifd0Offset, isLE)
    const entrySize = 12

    for (let i = 0; i < entries && i < 100; i++) {
      const eo = start + ifd0Offset + 2 + i * entrySize
      if (eo + entrySize > end) break
      const tag = view.getUint16(eo, isLE)
      const count = view.getUint32(eo + 4, isLE)
      const vo = eo + 8

      const label = EXIF_TAGS[tag]
      if (!label) continue

      let value
      if (tag === 0x0112) {
        const num = count <= 4 ? view.getUint16(vo, isLE) : view.getUint16(view.getUint32(vo, isLE) + start, isLE)
        value = ORIENTATIONS[num] || String(num)
      } else if (tag === 0x829a) {
        const num = count <= 4 ? view.getUint32(vo, isLE) : view.getUint32(view.getUint32(vo, isLE) + start, isLE)
        const den = count <= 4 ? view.getUint32(vo + 4, isLE) : view.getUint32(view.getUint32(vo, isLE) + start + 4, isLE)
        value = den ? `1/${Math.round(den / num)}s` : `${num}/${den}s`
      } else if (tag === 0x829d) {
        const num = count <= 4 ? view.getUint32(vo, isLE) : view.getUint32(view.getUint32(vo, isLE) + start, isLE)
        const den = count <= 4 ? view.getUint32(vo + 4, isLE) : view.getUint32(view.getUint32(vo, isLE) + start + 4, isLE)
        value = den ? `f/${(num / den).toFixed(1)}` : `f/${num}/${den}`
      } else if (tag === 0x920a || tag === 0xa405) {
        const num = count <= 4 ? view.getUint32(vo, isLE) : view.getUint32(view.getUint32(vo, isLE) + start, isLE)
        const den = count <= 4 ? view.getUint32(vo + 4, isLE) : view.getUint32(view.getUint32(vo, isLE) + start + 4, isLE)
        value = den ? `${(num / den).toFixed(0)}mm` : `${num}mm`
      } else {
        value = readAscii(view, vo, isLE, count)
      }

      if (value) results.push({ type: 'EXIF', label, value, category: 'exif', tag })
    }
  } catch { /* malformed */ }
  return results
}

// ── String helpers ──

function readString(view, offset, maxLen) {
  let str = ''
  const end = Math.min(offset + maxLen, view.byteLength)
  for (let i = offset; i < end; i++) {
    const byte = view.getUint8(i)
    if (byte === 0) break
    if (byte >= 0x20 && byte < 0x7f) str += String.fromCharCode(byte)
  }
  return str
}

function readAscii(view, offset, isLE, count) {
  const valOffset = count <= 4 ? offset : view.getUint32(offset, isLE)
  return readString(view, valOffset, count)
}

// ── JPEG ──

function readJPEGMetadata(buffer) {
  const view = new DataView(buffer)
  const size = buffer.byteLength
  const found = []
  let offset = 2

  while (offset < size - 2) {
    if (view.getUint8(offset) !== JPEG_MARKER) break
    const marker = view.getUint8(offset + 1)
    if (marker === MARKER_SOS) break
    const length = view.getUint16(offset + 2, false)
    if (length < 2 || offset + 2 + length > size) break

    if (marker === MARKER_APP1) {
      const identifier = readString(view, offset + 4, Math.min(length - 2, 30))
      if (identifier.startsWith(EXIF_IDENTIFIER)) {
        const exifItems = parseEXIF(view, offset + 4 + EXIF_IDENTIFIER.length, length - 2 - EXIF_IDENTIFIER.length)
        found.push(...exifItems)
        if (exifItems.length > 0) {
          found.push({ type: 'EXIF', label: 'EXIF metadata', category: 'exif', details: { itemCount: exifItems.length } })
        }
      } else if (identifier.startsWith(XMP_IDENTIFIER)) {
        found.push({ type: 'XMP', label: 'XMP metadata', category: 'xmp' })
      }
    }

    if (marker === MARKER_APP11) {
      const magic = view.getUint32(offset + 4, false)
      if (magic === JUMBF_IDENTIFIER_SIG) {
        const jumbfData = new Uint8Array(buffer, offset + 2, length)
        const boxes = parseJUMBFBoxes(jumbfData)
        const totalSize = length
        found.push({
          type: 'C2PA',
          label: 'C2PA manifest (JUMBF)',
          category: 'c2pa',
          details: { totalSize, boxes },
        })
      }
    }

    offset += 2 + length
  }

  return found
}

// ── PNG ──

function readPNGMetadata(buffer) {
  const view = new DataView(buffer)
  const found = []
  let offset = 8

  while (offset < buffer.byteLength - 12) {
    const length = view.getUint32(offset, false)
    const type = readString(view, offset + 4, 4)
    if (type === 'IEND') break

    if (type === 'eXIf') {
      const exifItems = parseEXIF(view, offset + 8, length)
      found.push(...exifItems)
      if (exifItems.length > 0) {
        found.push({ type: 'EXIF', label: 'EXIF metadata (eXIf)', category: 'exif', details: { itemCount: exifItems.length } })
      } else {
        found.push({ type: 'EXIF', label: 'EXIF metadata (eXIf)', category: 'exif' })
      }
    }

    if (type === 'iTXt' || type === 'tEXt' || type === 'zTXt') {
      const content = readString(view, offset + 8, Math.min(length, 200))
      if (content.startsWith('XML:com.adobe.xmp') || content.includes('xap/1.0/')) {
        found.push({ type: 'XMP', label: 'XMP metadata', category: 'xmp' })
      }
      if (content.toLowerCase().includes('c2pa') || content.toLowerCase().includes('jumbf')) {
        found.push({ type: 'C2PA', label: 'C2PA manifest', category: 'c2pa' })
      }
    }

    if (type === 'caBX') {
      const cabxData = new Uint8Array(buffer, offset + 8, length)
      const boxes = parseJUMBFBoxes(cabxData)
      found.push({
        type: 'C2PA',
        label: 'C2PA Content Credentials',
        category: 'c2pa',
        details: { totalSize: length, boxes },
      })
    }

    if (type === 'iCCP') found.push({ type: 'ICC', label: 'ICC color profile', category: 'other' })

    offset += 12 + length
  }

  return found
}

// ── WebP ──

function readWebPHeader(buffer) {
  const v = new Uint8Array(buffer, 0, 4)
  return v[0] === 0x52 && v[1] === 0x49 && v[2] === 0x46 && v[3] === 0x46
}

function readWebPMetadata(buffer) {
  const found = []
  const view8 = new Uint8Array(buffer)
  const view = new DataView(buffer)
  let offset = 12
  while (offset < buffer.byteLength - 8) {
    const fourcc = String.fromCharCode(...view8.slice(offset, offset + 4))
    const size = view.getUint32(offset + 4, true)
    if (fourcc === 'EXIF') found.push({ type: 'EXIF', label: 'EXIF metadata', category: 'exif' })
    if (fourcc === 'XMP ') found.push({ type: 'XMP', label: 'XMP metadata', category: 'xmp' })
    if (fourcc === 'ICCP') found.push({ type: 'ICC', label: 'ICC color profile', category: 'other' })
    offset += 8 + (size % 2 === 1 ? size + 1 : size)
  }
  return found
}

// ── Public API ──

/**
 * Reads metadata markers from an ArrayBuffer (JPEG, PNG, or WebP).
 * Returns an array of { type, label, category, value?, tag?, details? } objects.
 */
export function readMetadataFromBuffer(buffer) {
  const header = new Uint8Array(buffer, 0, 8)

  const isJPEG = header[0] === 0xff && header[1] === 0xd8
  const isPNG =
    header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47
  const isWebP = buffer.byteLength > 12 && readWebPHeader(buffer)

  if (isJPEG) return readJPEGMetadata(buffer)
  if (isPNG) return readPNGMetadata(buffer)
  if (isWebP) return readWebPMetadata(buffer)
  return []
}

/**
 * Reads metadata markers from a File object (browser API).
 * Returns a Promise of an array of { type, label, category, value?, tag?, details? } objects.
 */
export function readMetadata(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(readMetadataFromBuffer(reader.result))
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * EXIF read/write utilities using piexifjs.
 * Only JPEG is supported for editing — piexifjs can only modify JPEG EXIF.
 */

import piexif from 'piexifjs'

const EDITABLE_TAGS = {
  '0th': {
    0x010e: 'title',        // ImageDescription
    0x010f: 'make',         // Make
    0x0110: 'model',        // Model
    0x0131: 'software',     // Software
    0x0132: 'dateTime',     // DateTime
    0x013b: 'author',       // Artist
    0x8298: 'copyright',    // Copyright
  },
  'Exif': {
    0x9003: 'dateTaken',    // DateTimeOriginal
  },
}

const READONLY_TAGS = {
  '0th': {
    0x0112: 'orientation',
  },
  'Exif': {
    0x829a: 'exposureTime',
    0x829d: 'fNumber',
    0x8827: 'iso',
    0x920a: 'focalLength',
    0xa405: 'focalLength35mm',
  },
}

function bufToStr(buffer) {
  const bytes = new Uint8Array(buffer)
  let str = ''
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i])
  }
  return str
}

function strToBuf(str) {
  const buf = new ArrayBuffer(str.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < str.length; i++) {
    view[i] = str.charCodeAt(i)
  }
  return buf
}

function formatRational(value) {
  if (value == null) return null
  if (Array.isArray(value)) {
    if (value.length === 2) {
      return value[1] ? (value[0] / value[1]).toFixed(2) : String(value[0])
    }
  }
  return String(value)
}

function formatExposureTime(value) {
  if (value == null) return null
  if (Array.isArray(value) && value.length === 2) {
    const [num, den] = value
    if (den && num) {
      return den / num >= 1 ? `${num}/${den}s` : `1/${Math.round(den / num)}s`
    }
  }
  return String(value)
}

function formatFNumber(value) {
  if (value == null) return null
  if (Array.isArray(value) && value.length === 2) {
    const [num, den] = value
    return den ? `f/${(num / den).toFixed(1)}` : `f/${num}`
  }
  return String(value)
}

function formatFocalLength(value) {
  if (value == null) return null
  if (Array.isArray(value) && value.length === 2) {
    const [num, den] = value
    return den ? `${(num / den).toFixed(0)}mm` : `${num}mm`
  }
  return String(value)
}

function formatOrientation(value) {
  const MAP = { 1: 'Normal', 3: 'Rotated 180°', 6: 'Rotated 90° CW', 8: 'Rotated 90° CCW' }
  return MAP[value] || String(value)
}

function extractFields(exifDict, ifdName, tagMap) {
  const result = {}
  const ifd = exifDict[ifdName] || {}
  for (const [tag, key] of Object.entries(tagMap)) {
    if (ifd[tag] != null) {
      result[key] = { value: ifd[tag], ifd: ifdName, tag: Number(tag) }
    }
  }
  return result
}

function parseGps(gpsIfd) {
  if (!gpsIfd || Object.keys(gpsIfd).length === 0) return null

  const toDecimal = (rational, ref) => {
    if (!rational || !Array.isArray(rational) || rational.length !== 3) return null
    const deg = rational[0][1] ? rational[0][0] / rational[0][1] : 0
    const min = rational[1][1] ? rational[1][0] / rational[1][1] : 0
    const sec = rational[2][1] ? rational[2][0] / rational[2][1] : 0
    let decimal = deg + min / 60 + sec / 3600
    if (ref === 'S' || ref === 'W') decimal = -decimal
    return decimal
  }

  const lat = toDecimal(gpsIfd[2], gpsIfd[1])
  const lon = toDecimal(gpsIfd[4], gpsIfd[3])

  if (lat == null && lon == null) return null

  return {
    latitude: lat,
    longitude: lon,
    latitudeRef: gpsIfd[1] || null,
    longitudeRef: gpsIfd[3] || null,
  }
}

function formatGps(gps) {
  if (!gps || (gps.latitude == null && gps.longitude == null)) return null
  const latDir = (gps.latitude || 0) >= 0 ? 'N' : 'S'
  const lonDir = (gps.longitude || 0) >= 0 ? 'E' : 'W'
  const lat = Math.abs(gps.latitude || 0).toFixed(5)
  const lon = Math.abs(gps.longitude || 0).toFixed(5)
  return `${lat}° ${latDir}, ${lon}° ${lonDir}`
}

/**
 * Read EXIF data from a JPEG File.
 * Returns structured data or null if no EXIF found or file is not JPEG.
 */
export async function readExifFromJpeg(file) {
  if (!file.type.includes('jpeg') && !file.type.includes('jpg')) {
    return null
  }

  const buffer = await file.arrayBuffer()
  const jpegStr = bufToStr(buffer)

  let exifDict
  try {
    exifDict = piexif.load(jpegStr)
  } catch {
    return null
  }

  if (!exifDict) return null

  const hasData = Object.values(exifDict).some(
    (ifd) => typeof ifd === 'object' && ifd !== null && Object.keys(ifd).length > 0
  )
  if (!hasData) return null

  // Extract editable fields
  const editableRaw = {}
  for (const [ifdName, tags] of Object.entries(EDITABLE_TAGS)) {
    Object.assign(editableRaw, extractFields(exifDict, ifdName, tags))
  }

  const editable = {}
  for (const [key, meta] of Object.entries(editableRaw)) {
    editable[key] = typeof meta.value === 'string' ? meta.value : String(meta.value)
  }

  // Extract read-only fields
  const readOnlyRaw = {}
  for (const [ifdName, tags] of Object.entries(READONLY_TAGS)) {
    Object.assign(readOnlyRaw, extractFields(exifDict, ifdName, tags))
  }

  const readOnly = {}
  for (const [key, meta] of Object.entries(readOnlyRaw)) {
    const v = meta.value
    switch (key) {
      case 'exposureTime': readOnly[key] = formatExposureTime(v); break
      case 'fNumber': readOnly[key] = formatFNumber(v); break
      case 'focalLength': case 'focalLength35mm': readOnly[key] = formatFocalLength(v); break
      case 'orientation': readOnly[key] = formatOrientation(v); break
      case 'iso': readOnly[key] = String(v); break
      default: readOnly[key] = formatRational(v)
    }
  }

  const gpsRaw = parseGps(exifDict.GPS)
  const gps = gpsRaw ? { ...gpsRaw, formatted: formatGps(gpsRaw) } : null

  return { editable, readOnly, gps, raw: exifDict }
}

/**
 * Write modified EXIF data to a JPEG file and return a new Blob.
 * @param {File} file - Original JPEG file
 * @param {Object} updates - { editable: { title?, author?, copyright?, make?, model?, dateTaken?, software?, dateTime? }, gps: { latitude, longitude, latitudeRef, longitudeRef } | null }
 * @returns {Promise<Blob>} New JPEG blob with updated EXIF
 */
export async function writeExifToJpeg(file, updates) {
  const buffer = await file.arrayBuffer()
  const jpegStr = bufToStr(buffer)

  let exifDict
  try {
    exifDict = piexif.load(jpegStr)
  } catch {
    exifDict = { '0th': {}, 'Exif': {}, 'GPS': {}, 'Interop': {}, '1st': {}, thumbnail: null }
  }

  // Apply editable field updates
  const editableUpdates = updates.editable || {}
  for (const [ifdName, tags] of Object.entries(EDITABLE_TAGS)) {
    const ifd = exifDict[ifdName] || (exifDict[ifdName] = {})
    for (const [tag, key] of Object.entries(tags)) {
      if (editableUpdates[key] !== undefined) {
        ifd[Number(tag)] = editableUpdates[key]
      }
    }
  }

  // Apply GPS updates
  if (updates.gps !== undefined) {
    if (updates.gps === null) {
      // Remove GPS
      exifDict.GPS = {}
      delete exifDict['0th'][34853]
    } else if (updates.gps.latitude != null && updates.gps.longitude != null) {
      const toRational = (decimal) => {
        const abs = Math.abs(decimal)
        const deg = Math.floor(abs)
        const minFloat = (abs - deg) * 60
        const min = Math.floor(minFloat)
        const sec = (minFloat - min) * 60
        return [[deg, 1], [min, 1], [Math.round(sec * 100), 100]]
      }

      const lat = updates.gps.latitude
      const lon = updates.gps.longitude
      exifDict.GPS = exifDict.GPS || {}
      exifDict.GPS[1] = lat >= 0 ? 'N' : 'S'
      exifDict.GPS[2] = toRational(lat)
      exifDict.GPS[3] = lon >= 0 ? 'E' : 'W'
      exifDict.GPS[4] = toRational(lon)
      exifDict['0th'][34853] = 0 // pointer placeholder, piexifjs fills it
    }
  }

  const exifBytes = piexif.dump(exifDict)
  const newJpegStr = piexif.insert(exifBytes, jpegStr)
  return new Blob([strToBuf(newJpegStr)], { type: file.type || 'image/jpeg' })
}

/**
 * Check if a file is a JPEG and can be edited.
 */
export function isJpeg(file) {
  return file.type.includes('jpeg') || file.type.includes('jpg')
}

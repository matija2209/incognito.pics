import { describe, it, expect } from 'vitest'
import { execFileSync } from 'child_process'
import { readFileSync, writeFileSync, mkdtempSync, unlinkSync, rmdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { readMetadataFromBuffer } from '../src/lib/readMetadata.js'
import sharp from 'sharp'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Paths
const C2PATOOL = '/tmp/c2patool-dl/c2patool/c2patool'
const ORIGINAL_PATH = join(__dirname, 'linkedin-pm-post.png')

function bufferToArrayBuffer(buf) {
  return buf.buffer.slice(buf.byteOffset, buf.byteLength + buf.byteOffset)
}

/**
 * Run c2patool on a file path and return parsed JSON.
 * Returns null if no manifest is found (c2patool exits with error).
 */
function c2paInspect(filePath) {
  try {
    const stdout = execFileSync(C2PATOOL, [filePath], {
      encoding: 'utf8',
      timeout: 30000,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return JSON.parse(stdout)
  } catch (err) {
    // c2patool exits non-zero when no manifest is found
    if (err.stderr && err.stderr.includes('No claim found')) return null
    // If stdout has JSON even on error, try to parse it
    if (err.stdout) {
      try { return JSON.parse(err.stdout) } catch { /* fall through */ }
    }
    return null
  }
}

function tempDir(prefix) {
  return mkdtempSync(join(tmpdir(), `${prefix}-`))
}

describe('C2PA stripping pipeline', () => {
  it('strips C2PA manifest verified by c2patool', async () => {
    // ════ Step 1: Verify original has C2PA via c2patool (ground truth) ════
    const originalReport = c2paInspect(ORIGINAL_PATH)
    expect(originalReport, 'c2patool should find a manifest in the original').not.toBeNull()
    expect(originalReport.manifests, 'should have manifests object').toBeTruthy()
    expect(
      Object.keys(originalReport.manifests).length,
      'should have at least one manifest',
    ).toBeGreaterThan(0)

    // Verify the specific content the user provided
    const manifest = Object.values(originalReport.manifests)[0]
    expect(manifest.label, 'manifest should have a label').toBeTruthy()
    expect(
      manifest.assertions.some((a) => a.label === 'c2pa.actions.v2'),
      'should contain c2pa.actions assertion',
    ).toBe(true)

    console.log('\nOriginal C2PA manifest:')
    console.log(`  Label: ${manifest.label}`)
    console.log(`  Generator: ${manifest.claim_generator_info?.[0]?.name || 'unknown'}`)
    for (const a of manifest.assertions) {
      console.log(`  Assertion: ${a.label}`)
    }

    // ════ Step 2: Also check with our custom binary reader ════
    const originalBuf = readFileSync(ORIGINAL_PATH)
    const original = bufferToArrayBuffer(originalBuf)
    const originalMeta = readMetadataFromBuffer(original)
    const c2paFromOurReader = originalMeta.filter((m) => m.category === 'c2pa')
    expect(c2paFromOurReader.length, 'our reader should also detect C2PA').toBeGreaterThan(0)
    console.log(`\nCustom reader found: ${c2paFromOurReader.map((m) => m.label).join(', ')}`)

    // ════ Step 3: Get original dimensions ════
    const { width, height, format } = await sharp(originalBuf).metadata()
    expect(format, 'original should be PNG').toBe('png')
    expect(width, 'should have a width').toBeGreaterThan(0)
    expect(height, 'should have a height').toBeGreaterThan(0)
    console.log(`\nImage: ${width}x${height} ${format}, ${(originalBuf.length / 1024).toFixed(1)}KB`)

    // ════ Step 4: Strip via sharp re-encode (equivalent to Canvas API) ════
    const strippedBuf = await sharp(originalBuf).png().toBuffer()

    // Write to temp file so c2patool can inspect it
    const tmpDir = tempDir('c2pa-test-stripped')
    const strippedOutPath = join(tmpDir, 'stripped.png')
    writeFileSync(strippedOutPath, strippedBuf)

    // ════ Step 5: c2patool should find NO manifest in the stripped file ════
    const strippedReport = c2paInspect(strippedOutPath)
    expect(strippedReport, 'c2patool should find NO manifest after stripping').toBeNull()

    // ════ Step 6: Our custom reader should also find nothing ════
    const stripped = bufferToArrayBuffer(strippedBuf)
    const strippedMeta = readMetadataFromBuffer(stripped)
    expect(strippedMeta.length, 'custom reader should find no metadata').toBe(0)

    // ════ Step 7: Dimensions preserved ════
    const { width: sWidth, height: sHeight } = await sharp(strippedBuf).metadata()
    expect(sWidth, 'width should be preserved').toBe(width)
    expect(sHeight, 'height should be preserved').toBe(height)

    // ════ Step 8: Output is valid PNG ════
    const strippedBytes = new Uint8Array(stripped)
    const pngSig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
    expect(Array.from(strippedBytes.slice(0, 8)), 'should be valid PNG').toEqual(pngSig)

    // Size comparison
    const removed = originalBuf.length - strippedBuf.length
    const pct = ((removed / originalBuf.length) * 100).toFixed(1)
    console.log(
      `\nStrip result: ${(strippedBuf.length / 1024).toFixed(1)}KB ` +
      `(-${(removed / 1024).toFixed(1)}KB / -${pct}%)`,
    )

    // Cleanup
    unlinkSync(strippedOutPath)
    rmdirSync(tmpDir)
  })
})

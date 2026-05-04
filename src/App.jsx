import { useState, useCallback, useEffect } from 'react'
import { RefreshCcw, Shield } from 'lucide-react'
import { DropZone } from '@/components/DropZone'
import { ImagePreview } from '@/components/ImagePreview'
import { MetadataDiff } from '@/components/MetadataDiff'
import { DownloadButton } from '@/components/DownloadButton'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent } from '@/components/ui/card'
import { readMetadata } from '@/lib/readMetadata'
import { stripMetadata } from '@/lib/stripMetadata'

function FeatureCard({ title, desc }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 p-6">
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  )
}

export default function App() {
  const [file, setFile] = useState(null)
  const [originalUrl, setOriginalUrl] = useState(null)
  const [cleanedBlob, setCleanedBlob] = useState(null)
  const [cleanedUrl, setCleanedUrl] = useState(null)
  const [metadata, setMetadata] = useState([])
  const [strippedSize, setStrippedSize] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    return () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl)
      if (cleanedUrl) URL.revokeObjectURL(cleanedUrl)
    }
  }, [originalUrl, cleanedUrl])

  const handleFileSelect = useCallback(async (selectedFile) => {
    setError(null)
    setFile(selectedFile)
    setOriginalUrl(URL.createObjectURL(selectedFile))
    setIsProcessing(true)
    setCleanedBlob(null)
    setCleanedUrl(null)
    setMetadata([])
    setStrippedSize(0)

    // Read metadata before stripping
    let meta = []
    try {
      meta = await readMetadata(selectedFile)
    } catch {
      // non-critical
    }
    setMetadata(meta)

    // Strip metadata via canvas re-encode
    try {
      const blob = await stripMetadata(selectedFile, selectedFile.type)
      setCleanedBlob(blob)
      setStrippedSize(blob.size)
      setCleanedUrl(URL.createObjectURL(blob))
    } catch (err) {
      console.error(err)
      setError('Failed to process image. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }, [])

  const reset = useCallback(() => {
    if (originalUrl) URL.revokeObjectURL(originalUrl)
    if (cleanedUrl) URL.revokeObjectURL(cleanedUrl)
    setFile(null)
    setOriginalUrl(null)
    setCleanedBlob(null)
    setCleanedUrl(null)
    setMetadata([])
    setStrippedSize(0)
    setError(null)
  }, [originalUrl, cleanedUrl])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
              <Shield className="size-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold tracking-tight">C2PA Stripper</span>
          </div>

          {file && (
            <Button variant="ghost" size="sm" onClick={reset}>
              <RefreshCcw data-icon="inline-start" />
              Start Over
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-12 px-4 py-12">
        {!file ? (
          <>
            <div className="flex flex-col items-center gap-4 text-center">
              <h1 className="text-4xl font-extrabold tracking-tight text-balance md:text-5xl">
                Remove hidden metadata{' '}
                <span className="text-primary">with 100% privacy.</span>
              </h1>
              <p className="max-w-lg text-xl text-muted-foreground text-balance">
                Instantly strip C2PA manifests, EXIF, and XMP data from your images.
                Everything stays in your browser.
              </p>
            </div>

            <DropZone onFileSelect={handleFileSelect} />

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <FeatureCard
                title="Privacy First"
                desc="Processed entirely on your device. Zero server uploads."
              />
              <FeatureCard
                title="C2PA Removal"
                desc="Cleanly strips all provenance and authenticity metadata."
              />
              <FeatureCard
                title="Lossless PNG"
                desc="Pixel data preserved exactly as in the original file."
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-12">
            {isProcessing ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-3 p-12">
                  <Spinner />
                  <p className="text-sm font-medium">Processing image...</p>
                  <p className="text-xs text-muted-foreground">
                    Reading metadata, re-encoding via Canvas API
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="flex flex-col items-center gap-4 text-center">
                  <h2 className="text-3xl font-bold tracking-tight">Processing Result</h2>
                  <p className="text-muted-foreground">
                    Original metadata has been stripped. Preview the result below.
                  </p>
                </div>

                <ImagePreview originalUrl={originalUrl} cleanedUrl={cleanedUrl} />

                <MetadataDiff
                  metadata={metadata}
                  originalSize={file.size}
                  strippedSize={strippedSize}
                />

                <div className="flex justify-center">
                  <DownloadButton blob={cleanedBlob} filename={file.name} />
                </div>
              </>
            )}

            {error && (
              <Card className="border-destructive">
                <CardContent className="p-4">
                  <p className="text-center text-sm text-destructive">{error}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>

      <footer className="border-t py-12">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <p className="text-sm text-muted-foreground">
            Built with React 19 + Vite + Tailwind v4 — all processing is client-side
          </p>
        </div>
      </footer>
    </div>
  )
}

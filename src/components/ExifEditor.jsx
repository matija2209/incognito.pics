import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Upload, ImageIcon, Download, MapPin, MapPinOff, Camera,
  Calendar, User, Shield, Info,
} from 'lucide-react'
import { readExifFromJpeg, writeExifToJpeg, isJpeg, convertToJpeg } from '@/lib/exif'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function FieldRow({ label, value, icon: Icon }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
        {Icon && <Icon className="size-3" />}
        {label}
      </span>
      <span className="text-xs font-medium font-mono text-foreground/80">{value || '—'}</span>
    </div>
  )
}

export function ExifEditor({ className }) {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [exifData, setExifData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  const [editedFields, setEditedFields] = useState({})
  const [gpsRemoved, setGpsRemoved] = useState(false)
  const [imageDimensions, setImageDimensions] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [originalFile, setOriginalFile] = useState(null)
  const imgRef = useRef(null)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const processFile = useCallback(async (selectedFile) => {
    setError(null)
    setExifData(null)
    setEditedFields({})
    setGpsRemoved(false)
    setImageDimensions(null)
    setOriginalFile(selectedFile)

    if (previewUrl) URL.revokeObjectURL(previewUrl)

    let fileToProcess = selectedFile
    setIsLoading(true)

    if (!isJpeg(selectedFile)) {
      setIsConverting(true)
      try {
        fileToProcess = await convertToJpeg(selectedFile)
      } catch (err) {
        console.error('Conversion error:', err)
        setError('Failed to convert image to JPEG for editing.')
        setIsLoading(false)
        setIsConverting(false)
        return
      }
      setIsConverting(false)
    }

    setFile(fileToProcess)
    const url = URL.createObjectURL(fileToProcess)
    setPreviewUrl(url)

    // Read image dimensions
    const img = new window.Image()
    img.onload = () => {
      setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.src = url

    // Read EXIF
    try {
      const data = await readExifFromJpeg(fileToProcess)
      if (data) {
        setExifData(data)
        // Pre-populate editable fields from EXIF
        const fields = {}
        for (const [key, value] of Object.entries(data.editable)) {
          if (value) fields[key] = value
        }
        setEditedFields(fields)
      }
    } catch (err) {
      console.error('EXIF read error:', err)
    }

    setIsLoading(false)
  }, [previewUrl])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      processFile(files[0])
    }
  }, [processFile])

  const handleFileInput = useCallback((e) => {
    const files = e.target.files
    if (files && files.length > 0) {
      processFile(files[0])
    }
  }, [processFile])

  const handleFieldChange = useCallback((key, value) => {
    setEditedFields((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handleRemoveGps = useCallback(() => {
    setGpsRemoved(true)
  }, [])

  const handleRestoreGps = useCallback(() => {
    if (exifData?.gps) {
      setGpsRemoved(false)
    }
  }, [exifData])

  const handleSaveDownload = useCallback(async () => {
    if (!file) return
    setIsSaving(true)
    setError(null)

    try {
      const updates = { editable: editedFields }
      if (gpsRemoved) {
        updates.gps = null
      }
      const blob = await writeExifToJpeg(file, updates)

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const base = file.name.replace(/\.(jpe?g)$/i, '')
      a.download = `${base}-edited.jpg`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 100)
    } catch (err) {
      console.error('Save error:', err)
      setError('Failed to save EXIF data.')
    } finally {
      setIsSaving(false)
    }
  }, [file, editedFields, gpsRemoved])

  const editableFields = [
    { key: 'title', label: 'Title / Description', icon: Info },
    { key: 'author', label: 'Author / Artist', icon: User },
    { key: 'copyright', label: 'Copyright', icon: Shield },
    { key: 'make', label: 'Camera Make', icon: Camera },
    { key: 'model', label: 'Camera Model', icon: Camera },
    { key: 'dateTaken', label: 'Date Taken', icon: Calendar },
  ]

  const readOnlyFields = exifData ? [
    { key: 'iso', label: 'ISO' },
    { key: 'exposureTime', label: 'Exposure Time' },
    { key: 'fNumber', label: 'Aperture' },
    { key: 'focalLength', label: 'Focal Length' },
    { key: 'focalLength35mm', label: 'Focal Length (35mm)' },
    { key: 'orientation', label: 'Orientation' },
  ].filter((f) => exifData.readOnly[f.key]) : []

  const hasAnyData = exifData && (
    Object.values(exifData.editable).some(Boolean) ||
    Object.values(exifData.readOnly).some(Boolean) ||
    exifData.gps
  )

  // Landing state: no file selected
  if (!file) {
    return (
      <div className={cn('flex flex-col gap-8', className)}>
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight">EXIF Metadata Editor</h2>
          <p className="max-w-lg text-muted-foreground text-balance">
            View and edit EXIF metadata in your images.
            Non-JPEG images are automatically converted for editing.
            Everything processed locally in your browser.
          </p>
        </div>

        <div
          className={cn(
            "relative cursor-pointer border-2 border-dashed rounded-xl transition-all duration-200 p-12 flex flex-col items-center justify-center text-center w-full max-w-lg mx-auto",
            isDragging
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById('exif-file-input')?.click()}
        >
          <input
            id="exif-file-input"
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleFileInput}
          />
          <div className="bg-primary/10 p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
            <Upload className="size-8 text-primary" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Drop your image here</h3>
          <p className="text-muted-foreground max-w-xs text-sm">
            JPEG, PNG, WebP and more supported.
          </p>
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground/60">
            <ImageIcon className="size-4" />
            <span>No uploads — 100% private</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 max-w-2xl mx-auto">
          <Card>
            <CardContent className="flex flex-col gap-1 p-6">
              <h3 className="font-semibold">View & Edit</h3>
              <p className="text-sm text-muted-foreground">
                Edit titles, author, copyright, and camera info.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-1 p-6">
              <h3 className="font-semibold">Privacy Controls</h3>
              <p className="text-sm text-muted-foreground">
                Remove GPS location data with one click.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-1 p-6">
              <h3 className="font-semibold">Local Processing</h3>
              <p className="text-sm text-muted-foreground">
                Everything stays in your browser, never uploaded.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-8', className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">EXIF Editor</h2>
        <Button variant="ghost" size="sm" onClick={() => {
          if (previewUrl) URL.revokeObjectURL(previewUrl)
          setFile(null)
          setOriginalFile(null)
          setPreviewUrl(null)
          setExifData(null)
          setEditedFields({})
          setGpsRemoved(false)
          setImageDimensions(null)
          setError(null)
        }}>
          Start Over
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12">
            <Spinner />
            <p className="text-sm font-medium">
              {isConverting ? 'Converting to JPEG...' : 'Reading EXIF data...'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* Left: Image Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Image Preview</CardTitle>
              {originalFile && !isJpeg(originalFile) && (
                <CardDescription className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                  <Info className="size-3.5" />
                  Converted from {originalFile.type ? originalFile.type.split('/')[1].toUpperCase() : 'IMAGE'} to JPEG
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="relative overflow-hidden rounded-lg border bg-muted/20">
                <img
                  ref={imgRef}
                  src={previewUrl}
                  alt="Preview"
                  className="w-full object-contain max-h-80"
                />
              </div>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">File name</span>
                  <span className="font-mono font-medium truncate max-w-48">{file.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Size</span>
                  <span className="font-mono">{formatSize(file.size)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <Badge variant="default" className="font-mono">
                    image/jpeg
                  </Badge>
                </div>
                {imageDimensions && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Dimensions</span>
                    <span className="font-mono">
                      {imageDimensions.width} × {imageDimensions.height}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Right: EXIF Fields */}
          <div className="flex flex-col gap-6">
            {originalFile && !isJpeg(originalFile) && (
              <Card className="border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20">
                <CardContent className="flex items-start gap-3 p-4">
                  <Info className="size-5 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <p className="font-medium">Image converted to JPEG</p>
                    <p className="mt-1 text-blue-600/80 dark:text-blue-300/80">
                      We've converted your {originalFile.type ? originalFile.type.split('/')[1].toUpperCase() : 'IMAGE'} image to JPEG so you can edit its EXIF metadata.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {!hasAnyData && !isLoading && (
              <Card>
                <CardContent className="flex items-start gap-3 p-6">
                  <Info className="size-5 mt-0.5 shrink-0 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No EXIF metadata found in this image.
                  </p>
                </CardContent>
              </Card>
            )}

            {hasAnyData && (
              <>
                {/* Editable Fields */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      Editable Fields
                    </CardTitle>
                    <CardDescription>
                      Modify these common EXIF fields
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-80">
                      <div className="flex flex-col gap-4 pr-2">
                        {editableFields.map(({ key, label, icon: Icon }) => (
                          <div key={key} className="flex flex-col gap-1.5">
                            <Label htmlFor={`exif-${key}`} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              {Icon && <Icon className="size-3" />}
                              {label}
                            </Label>
                            <Input
                              id={`exif-${key}`}
                              value={editedFields[key] || ''}
                              onChange={(e) => handleFieldChange(key, e.target.value)}
                              placeholder={`Enter ${label.toLowerCase()}`}
                              className="h-8 text-sm"
                            />
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Read-only Fields */}
                {readOnlyFields.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        Technical Details
                      </CardTitle>
                      <CardDescription>
                        Camera settings — read only
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-2">
                        {readOnlyFields.map(({ key, label }) => (
                          <FieldRow
                            key={key}
                            label={label}
                            value={exifData.readOnly[key]}
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* GPS / Privacy */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <MapPin className="size-4" />
                      Location & Privacy
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {exifData.gps && !gpsRemoved ? (
                      <div className="flex flex-col gap-3">
                        <div className="rounded-lg bg-muted/40 p-3">
                          <p className="text-sm font-mono">
                            {exifData.gps.formatted || 'Location data present'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            GPS coordinates are embedded in this image.
                          </p>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleRemoveGps}
                          className="self-start"
                        >
                          <MapPinOff data-icon="inline-start" />
                          Remove Location Data
                        </Button>
                      </div>
                    ) : gpsRemoved ? (
                      <div className="flex flex-col gap-3">
                        <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3">
                          <p className="text-sm text-destructive font-medium">
                            Location data will be removed
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            GPS coordinates will be stripped when you save.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRestoreGps}
                          className="self-start"
                        >
                          Restore Location
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No GPS location data found in this image.
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Actions */}
                <Card>
                  <CardContent className="p-4">
                    <Button
                      size="lg"
                      onClick={handleSaveDownload}
                      disabled={isSaving}
                      className="w-full gap-2 font-semibold"
                    >
                      {isSaving ? (
                        <>
                          <Spinner />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Download className="size-5" />
                          Save & Download Edited Image
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-center text-muted-foreground mt-3">
                      A new JPEG file will be generated with your changes. Original file is never modified.
                    </p>
                  </CardContent>
                </Card>
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
        </div>
      )}
    </div>
  )
}

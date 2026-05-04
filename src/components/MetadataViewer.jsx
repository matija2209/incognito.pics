import { useState } from 'react'
import {
  ShieldCheck,
  Shield,
  Info,
  CheckCircle2,
  Box,
  FileDigit,
  Scale,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'

const CATEGORY_META = {
  c2pa: { label: 'C2PA', icon: Shield, variant: 'destructive', description: 'Content Credentials & provenance' },
  exif: { label: 'EXIF', icon: FileDigit, variant: 'secondary', description: 'Camera settings & capture data' },
  xmp: { label: 'XMP', icon: Info, variant: 'secondary', description: 'Adobe metadata & keywords' },
  other: { label: 'Other', icon: Box, variant: 'outline', description: 'ICC profiles & other chunks' },
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function JUMBFBoxRow({ box, depth = 0 }) {
  const [open, setOpen] = useState(false)
  const hasChildren = box.type === 'jumb'

  return (
    <>
      <div
        className="flex items-center gap-1.5 py-1 text-xs font-mono"
        style={{ paddingLeft: depth * 16 }}
      >
        {hasChildren && (
          <button onClick={() => setOpen(!open)} className="text-muted-foreground hover:text-foreground">
            {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          </button>
        )}
        {!hasChildren && <span className="w-3 shrink-0" />}
        <span className="font-semibold text-foreground/80">{box.type}</span>
        <span className="text-muted-foreground">{formatSize(box.size)}</span>
        {box.contains && (
          <Badge variant="outline" className="font-mono text-[10px] px-1 py-0">
            {box.contains} {formatSize(box.containsSize)}
          </Badge>
        )}
        {box.json?.label && (
          <span className="text-muted-foreground truncate max-w-40">
            &mdash; {box.json.label}
          </span>
        )}
      </div>
      {open && hasChildren && (
        <div className="text-xs text-muted-foreground" style={{ paddingLeft: (depth + 1) * 16 }}>
          Contains nested C2PA manifest (CBOR-encoded).
        </div>
      )}
    </>
  )
}

function CategoryTab({ items, category }) {
  const meta = CATEGORY_META[category] || CATEGORY_META.other
  const summaryItems = items.filter((m) => m !== undefined)

  // Separate the "header" item (the one with details.boxes) from detail items
  const headerItem = summaryItems.find((m) => m.details?.boxes)
  const detailItems = summaryItems.filter((m) => m.type !== 'C2PA' || !m.details?.boxes)
  const exifFields = summaryItems.filter((m) => m.value)

  if (category === 'c2pa' && headerItem) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <meta.icon className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">{meta.description}</span>
          <Badge variant={meta.variant} className="ml-auto">Removed</Badge>
        </div>
        <div className="rounded-lg bg-muted/30 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium">JUMBF Box Structure</span>
            <span className="text-xs text-muted-foreground">
              Total: {formatSize(headerItem.details.totalSize)}
            </span>
          </div>
          <div className="rounded-md bg-background border p-2">
            {headerItem.details.boxes.map((box, i) => (
              <JUMBFBoxRow key={i} box={box} />
            ))}
          </div>
        </div>
        {detailItems.length > 0 && (
          <div className="rounded-lg bg-muted/30 p-3">
            <span className="text-xs font-medium">Additional Chunks</span>
            <div className="flex flex-col gap-1 mt-2">
              {detailItems.map((m, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{m.type}</span>
                  <span>{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (category === 'exif' && exifFields.length > 0) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <meta.icon className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">{meta.description}</span>
          <Badge variant={meta.variant} className="ml-auto">Removed</Badge>
        </div>
        <div className="rounded-lg bg-muted/30 p-3">
          <div className="grid grid-cols-2 gap-2">
            {exifFields.map((m, i) => (
              <div key={i} className="flex items-center justify-between rounded bg-background px-2.5 py-1.5">
                <span className="text-xs text-muted-foreground">{m.label || m.type}</span>
                <span className="text-xs font-medium font-mono">{m.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <meta.icon className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">{meta.description}</span>
        <Badge variant={meta.variant} className="ml-auto">Removed</Badge>
      </div>
      {summaryItems.filter((m) => m.type !== category.toUpperCase()).map((m, i) => (
        <div key={i} className="rounded-lg bg-muted/30 p-3">
          <p className="text-sm">{m.label || m.type}</p>
          {m.value && <p className="text-xs text-muted-foreground mt-1">{m.type}: {m.value}</p>}
        </div>
      ))}
      {summaryItems.length === 0 && (
        <p className="text-xs text-muted-foreground">No {meta.label} data detected.</p>
      )}
    </div>
  )
}

export function MetadataViewer({ metadata, originalSize, strippedSize }) {
  const hasMetadata = metadata && metadata.length > 0
  const sizeReduction = originalSize && strippedSize ? originalSize - strippedSize : 0

  // Group by category and sort: c2pa first, then exif, xmp, other
  const grouped = (metadata || []).reduce((acc, m) => {
    const cat = m.category || 'other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(m)
    return acc
  }, {})

  const categoryOrder = ['c2pa', 'exif', 'xmp', 'other'].filter((c) => grouped[c])
  const defaultTab = categoryOrder[0] || 'c2pa'

  if (!hasMetadata) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="size-4" />
            No metadata found
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3">
            <Info className="size-5 mt-0.5 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No EXIF, XMP, or C2PA metadata was detected in this image.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Shield className="size-4 text-destructive" />
          {metadata.length} metadata item{metadata.length > 1 ? 's' : ''} detected &mdash; stripped below
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Tabs defaultValue={defaultTab}>
          <TabsList>
            {categoryOrder.map((cat) => {
              const meta = CATEGORY_META[cat] || CATEGORY_META.other
              const Icon = meta.icon
              return (
                <TabsTrigger key={cat} value={cat}>
                  <Icon data-icon="inline-start" />
                  {meta.label}
                  <Badge variant={meta.variant} className="ml-1 px-1 py-0 text-[10px]">
                    {grouped[cat].length}
                  </Badge>
                </TabsTrigger>
              )
            })}
          </TabsList>
          <ScrollArea className="max-h-64 mt-3">
            {categoryOrder.map((cat) => (
              <TabsContent key={cat} value={cat}>
                <CategoryTab items={grouped[cat]} category={cat} />
              </TabsContent>
            ))}
          </ScrollArea>
        </Tabs>

        {sizeReduction > 0 && (
          <>
            <Separator />
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-chart-2" />
              <span>
                Size reduced from {formatSize(originalSize)} to{' '}
                {formatSize(strippedSize)} (
                {((sizeReduction / originalSize) * 100).toFixed(1)}% smaller)
              </span>
            </div>
          </>
        )}

        <div className="flex items-start gap-3 rounded-lg bg-primary/5 p-4 border border-primary/10">
          <Info className="size-5 mt-0.5 shrink-0 text-primary/70" />
          <p className="text-xs leading-relaxed text-primary/80">
            The cleaned version is generated by extracting raw pixel data and re-encoding it
            via Canvas API. This process naturally discards all non-pixel data chunks,
            ensuring 100% metadata removal.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

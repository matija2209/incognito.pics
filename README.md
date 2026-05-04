![incognito.pics Header](https://img.buildwithmatija.com/api/images/8sezdj36/file/social)

# incognito.pics

A client-side React application to remove C2PA and other metadata from images by re-encoding them using the browser's Canvas API. Processed entirely locally for maximum privacy.

## Features

- **Metadata Stripping:** Remove C2PA manifests, EXIF, and XMP data from JPEG, PNG, and WebP images via Canvas re-encoding.
- **EXIF Editor:** Read and modify EXIF metadata on JPEG images — edit title, author, copyright, camera info, date taken, and remove GPS location data. All client-side with piexifjs.
- **Local Processing:** No images are ever uploaded to a server. All processing happens in your browser.
- **Drag & Drop:** Easy-to-use drop zone for image uploads.
- **Side-by-Side Preview:** Compare the original image with the cleaned version.
- **Metadata Viewer:** Tabbed interface showing C2PA, EXIF, and XMP details detected in the original.
- **One-Click Download:** Save your metadata-free or EXIF-edited image instantly.

## Tech Stack

- **Framework:** [React 19](https://react.dev/)
- **Build Tool:** [Vite 8](https://vitejs.dev/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **UI Components:** [shadcn/ui](https://ui.shadcn.com/)
- **Image Processing:** HTML5 Canvas API (browser), [piexifjs](https://github.com/hMatoba/piexifjs) (EXIF read/write), [sharp](https://sharp.pixelplumbing.com/) (tests)
- **Testing:** [Vitest](https://vitest.dev/), [c2patool](https://github.com/contentauth/c2pa-rs/tree/main/cli)

## How it Works

### Metadata Stripper (Canvas Re-encoding)

The application uses the HTML5 Canvas API to perform a "clean" re-encode of the image data:

1. The selected image is loaded into an `HTMLImageElement`.
2. The image is drawn onto an `HTMLCanvasElement`.
3. The canvas content is exported using `canvas.toBlob()`.

This process effectively extracts only the raw pixel data and encodes it into a new file format container, naturally dropping all non-pixel metadata chunks like C2PA manifests, EXIF data, and XMP tags.

- **PNG:** Lossless re-encoding.
- **JPEG:** High-quality (95%) re-encoding.

### EXIF Editor (piexifjs)

The EXIF Editor reads and modifies EXIF metadata directly in JPEG files without re-encoding the image:

1. Upload a JPEG image via drag-and-drop.
2. `piexifjs` parses the raw EXIF binary data and extracts editable fields (title, author, copyright, camera make/model, date taken), read-only technical details (ISO, exposure, aperture, focal length, orientation), and GPS coordinates.
3. Edit any field or remove GPS location data with one click.
4. Click "Save & Download" — `piexifjs` writes the updated EXIF data back into the JPEG and a new file is downloaded. The pixel data is never re-encoded, preserving original quality.

## Getting Started

### Prerequisites

- Node.js (Latest LTS recommended)

### Installation

```bash
git clone <repository-url>
cd c2pa-removal
npm install
npm run dev
```

## Testing

The test suite verifies the full metadata-stripping pipeline end-to-end, using [c2patool](https://github.com/contentauth/c2pa-rs/releases) as the ground-truth verifier.

### Prerequisites

Install `c2patool` (Linux example):

```bash
gh release download c2patool-v<VERSION> --repo contentauth/c2pa-rs \
  --pattern '*linux*' --dir /tmp/c2patool-dl
tar xzf /tmp/c2patool-dl/*linux*.tar.gz -C /tmp/c2patool-dl/
```

The test expects the binary at `/tmp/c2patool-dl/c2patool/c2patool`.

### Running

```bash
npx vitest run
```

### What the test covers

1. **Original image verification** — `c2patool` confirms the original file carries a C2PA manifest with expected assertions (`c2pa.actions.v2`, etc.)
2. **Browser-reader parity** — the custom binary reader in `src/lib/readMetadata.js` detects the same C2PA metadata `c2patool` reports, plus any EXIF/XMP chunks
3. **Stripping via sharp** — `sharp` re-encodes the image (equivalent to the Canvas API path used in the browser)
4. **Stripped verification** — `c2patool` confirms zero manifests remain in the stripped output
5. **Integrity checks** — dimensions match the original, output is a valid PNG, and the custom reader also finds nothing

### Test image

`tests/linkedin-pm-post.png` — an AI-generated image with a C2PA Content Credential signed by OpenAI.

## Project Structure

```text
src/
├── components/
│   ├── ui/                  # shadcn/ui components (button, card, tabs, input, label, etc.)
│   ├── DropZone.jsx         # File upload handling
│   ├── ImagePreview.jsx     # Side-by-side comparison
│   ├── MetadataViewer.jsx   # Tabbed metadata breakdown (C2PA, EXIF, XMP)
│   ├── ExifEditor.jsx       # EXIF editor with GPS removal, field editing, and download
│   └── DownloadButton.jsx   # File saving logic
├── lib/
│   ├── exif.js              # EXIF read/write utilities using piexifjs
│   ├── readMetadata.js      # Binary metadata parser (PNG, JPEG, WebP)
│   ├── stripMetadata.js     # Canvas re-encode logic
│   └── utils.js             # Helper functions
├── App.jsx                  # Main application entry with mode switcher (Stripper / EXIF Editor)
├── index.css                # Tailwind entry
└── main.jsx                 # React mounting
tests/
├── pipeline.test.js         # End-to-end strip verification with c2patool
└── linkedin-pm-post.png     # Test fixture (C2PA-signed image)
```

## Out of Scope

- Batch processing of multiple images.
- Video or audio file support.
- Server-side processing.
- Removal of steganographic watermarks (e.g., SynthID) embedded directly in pixel data.

## License

MIT

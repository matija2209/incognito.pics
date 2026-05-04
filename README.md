![incognito.pics Header](https://img.buildwithmatija.com/api/images/8sezdj36/file/social)

# incognito.pics

A client-side React application to remove C2PA and other metadata from images by re-encoding them using the browser's Canvas API. Processed entirely locally for maximum privacy.

## Features

- **Local Processing:** No images are ever uploaded to a server. All stripping happens in your browser.
- **Drag & Drop:** Easy-to-use drop zone for JPEG, PNG, and WebP images.
- **Side-by-Side Preview:** Compare the original image with the cleaned version.
- **Metadata Diff:** See exactly what was removed (C2PA, EXIF, XMP).
- **One-Click Download:** Save your metadata-free image instantly.

## Tech Stack

- **Framework:** [React 19](https://react.dev/)
- **Build Tool:** [Vite 7](https://vitejs.dev/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/)
- **UI Components:** [shadcn/ui](https://ui.shadcn.com/)
- **Image Processing:** HTML5 Canvas API

## How it Works

The application uses the HTML5 Canvas API to perform a "clean" re-encode of the image data:

1. The selected image is loaded into an `HTMLImageElement`.
2. The image is drawn onto an `HTMLCanvasElement`.
3. The canvas content is exported using `canvas.toBlob()`.

This process effectively extracts only the raw pixel data and encodes it into a new file format container, naturally dropping all non-pixel metadata chunks like C2PA manifests, EXIF data, and XMP tags.

- **PNG:** Lossless re-encoding.
- **JPEG:** High-quality (95%) re-encoding.

## Getting Started

### Prerequisites

- Node.js (Latest LTS recommended)
- npm or pnpm

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd c2pa-removal
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## Project Structure

```text
src/
├── components/
│   ├── ui/               # shadcn/ui components
│   ├── DropZone.jsx      # File upload handling
│   ├── ImagePreview.jsx  # Side-by-side comparison
│   ├── MetadataDiff.jsx  # Metadata analysis display
│   └── DownloadButton.jsx # File saving logic
├── lib/
│   ├── stripMetadata.js  # Canvas re-encode logic
│   ├── readC2pa.js       # (Optional) Metadata extraction
│   └── utils.js          # Helper functions
├── App.jsx               # Main application entry
└── main.jsx              # React mounting
```

## Out of Scope

- Batch processing of multiple images.
- Video or audio file support.
- Server-side processing.
- Removal of steganographic watermarks (e.g., SynthID) embedded directly in pixel data.

## License

MIT

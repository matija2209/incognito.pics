/**
 * Strips metadata from an image file by re-encoding it using the Canvas API.
 * 
 * @param {File} file - The original image file.
 * @param {string} format - The output format ('image/jpeg', 'image/png', 'image/webp').
 * @param {number} quality - The quality for JPEG/WebP (0 to 1).
 * @returns {Promise<Blob>} - The stripped image as a Blob.
 */
export async function stripMetadata(file, format = 'image/jpeg', quality = 0.95) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        
        // Draw the image onto the canvas
        ctx.drawImage(img, 0, 0);
        
        // Export the canvas as a Blob, which re-encodes it without metadata
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas toBlob failed'));
          }
        }, format, quality);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = event.target.result;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Downscales an image using native HTML5 Canvas to max dimension 1600px.
 * Encodes as image/webp at 0.85 quality.
 * Falls back gracefully to original file if processing fails or produces no size reduction.
 */
export async function compressImage(
  file: File,
  maxDimension = 1600,
  quality = 0.85
): Promise<File> {
  // Pass non-image or zero-byte files through unmodified
  if (!file.type.startsWith('image/') || file.size === 0) {
    return file;
  }

  // Graceful fallback for non-DOM / test environments without 2D canvas context support
  if (typeof window === 'undefined' || typeof document === 'undefined' || !window.HTMLCanvasElement) {
    return file;
  }

  // ponytail: HTML5 2D Canvas with bicubic interpolation. Ceiling: main-thread synchronous compression. Upgrade to OffscreenCanvas / Web Worker only if UI thread frame drop (>16ms) is measured on low-end mobile devices.
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const targetType = 'image/webp';
        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              // Return original if compression did not yield size savings
              resolve(file);
              return;
            }
            const extension = 'webp';
            const baseName = file.name.replace(/\.[^/.]+$/, '');
            const compressedFile = new File([blob], `${baseName}.${extension}`, {
              type: targetType,
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          },
          targetType,
          quality
        );
      } catch {
        resolve(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { compressImage } from '../utils/imageCompression';

describe('imageCompression utility', () => {
  let originalCreateObjectURL: any;
  let originalRevokeObjectURL: any;

  beforeEach(() => {
    originalCreateObjectURL = window.URL.createObjectURL;
    originalRevokeObjectURL = window.URL.revokeObjectURL;
    window.URL.createObjectURL = vi.fn(() => 'blob:mock-preview-url');
    window.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    window.URL.createObjectURL = originalCreateObjectURL;
    window.URL.revokeObjectURL = originalRevokeObjectURL;
    vi.restoreAllMocks();
  });

  it('returns original file unmodified for non-image MIME types', async () => {
    const pdfFile = new File(['%PDF-1.4 dummy'], 'document.pdf', { type: 'application/pdf' });
    const result = await compressImage(pdfFile);
    expect(result).toBe(pdfFile);
  });

  it('returns original file unmodified for 0-byte image files', async () => {
    const emptyFile = new File([], 'empty.jpg', { type: 'image/jpeg' });
    const result = await compressImage(emptyFile);
    expect(result).toBe(emptyFile);
  });

  it('returns original file if canvas 2D context is unsupported or unavailable', async () => {
    const file = new File(['dummy_image_data'], 'test.png', { type: 'image/png' });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    class MockImage {
      width = 800;
      height = 600;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = '';
      set src(val: string) {
        this._src = val;
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
      get src() {
        return this._src;
      }
    }
    vi.stubGlobal('Image', MockImage);

    const result = await compressImage(file);
    expect(result).toBe(file);
  });

  it('downscales landscape images larger than 1600px maintaining aspect ratio', async () => {
    const originalFile = new File([new ArrayBuffer(100000)], 'huge_landscape.jpg', { type: 'image/jpeg' });

    let drawnWidth = 0;
    let drawnHeight = 0;

    const mockCtx = {
      drawImage: vi.fn((_img, _dx, _dy, dWidth, dHeight) => {
        drawnWidth = dWidth;
        drawnHeight = dHeight;
      }),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx as any);

    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback, type) => {
      const smallerBlob = new Blob([new ArrayBuffer(20000)], { type: type || 'image/webp' });
      callback(smallerBlob);
    });

    class MockImage {
      width = 3200;
      height = 1800;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = '';
      set src(val: string) {
        this._src = val;
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
      get src() {
        return this._src;
      }
    }
    vi.stubGlobal('Image', MockImage);

    const compressed = await compressImage(originalFile, 1600, 0.85);

    expect(drawnWidth).toBe(1600);
    expect(drawnHeight).toBe(900);
    expect(compressed.name).toBe('huge_landscape.webp');
    expect(compressed.type).toBe('image/webp');
    expect(compressed.size).toBe(20000);
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-preview-url');
  });

  it('downscales portrait images larger than 1600px maintaining aspect ratio', async () => {
    const originalFile = new File([new ArrayBuffer(120000)], 'tall_receipt.png', { type: 'image/png' });

    let drawnWidth = 0;
    let drawnHeight = 0;

    const mockCtx = {
      drawImage: vi.fn((_img, _dx, _dy, dWidth, dHeight) => {
        drawnWidth = dWidth;
        drawnHeight = dHeight;
      }),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx as any);

    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback, type) => {
      const smallerBlob = new Blob([new ArrayBuffer(30000)], { type: type || 'image/webp' });
      callback(smallerBlob);
    });

    class MockImage {
      width = 1800;
      height = 3600;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = '';
      set src(val: string) {
        this._src = val;
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
      get src() {
        return this._src;
      }
    }
    vi.stubGlobal('Image', MockImage);

    const compressed = await compressImage(originalFile, 1600, 0.85);

    expect(drawnWidth).toBe(800);
    expect(drawnHeight).toBe(1600);
    expect(compressed.name).toBe('tall_receipt.webp');
    expect(compressed.type).toBe('image/webp');
  });

  it('returns original file if compression does not produce size savings', async () => {
    const smallFile = new File([new ArrayBuffer(1000)], 'already_compressed.jpg', { type: 'image/jpeg' });

    const mockCtx = {
      drawImage: vi.fn(),
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx as any);

    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback, type) => {
      // Blobs larger than original
      const largerBlob = new Blob([new ArrayBuffer(2500)], { type: type || 'image/webp' });
      callback(largerBlob);
    });

    class MockImage {
      width = 400;
      height = 300;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = '';
      set src(val: string) {
        this._src = val;
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
      get src() {
        return this._src;
      }
    }
    vi.stubGlobal('Image', MockImage);

    const result = await compressImage(smallFile);
    expect(result).toBe(smallFile);
  });

  it('falls back to original file gracefully when Image fails to load', async () => {
    const brokenFile = new File(['not an image content'], 'corrupted.jpg', { type: 'image/jpeg' });

    class MockBrokenImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = '';
      set src(val: string) {
        this._src = val;
        setTimeout(() => {
          if (this.onerror) this.onerror();
        }, 0);
      }
      get src() {
        return this._src;
      }
    }
    vi.stubGlobal('Image', MockBrokenImage);

    const result = await compressImage(brokenFile);
    expect(result).toBe(brokenFile);
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-preview-url');
  });
});

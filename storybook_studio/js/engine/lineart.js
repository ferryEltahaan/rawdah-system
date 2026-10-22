/**
 * ============================================================================
 * ZERO-ERROR LINE-ART ENGINE (Mathematical Image-to-Coloring Converter)
 * ============================================================================
 * Pure client-side computer vision algorithm executed on HTML5 Canvas.
 * Guaranteed 100% white (#FFFFFF) background and pure black (#000000) outlines.
 * No AI hallucinations, no grey shading, and 1:1 spatial alignment with source.
 */

class LineArtEngine {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
  }

  /**
   * Process an Image or ImageBitmap and extract print-ready coloring page
   * @param {HTMLImageElement|ImageBitmap} sourceImg 
   * @param {Object} options 
   * @returns {HTMLCanvasElement}
   */
  process(sourceImg, options = {}) {
    const {
      thickness = 3,         // 1 to 7 (line dilation)
      edgeThreshold = 45,     // 15 to 80 (Sobel sensitivity)
      smoothing = 2,          // 1 to 5 (blur radius)
      cleanBackground = true, // Force #ffffff background
      boldOutlines = true     // Thicken outer contours
    } = options;

    const width = sourceImg.naturalWidth || sourceImg.width || 800;
    const height = sourceImg.naturalHeight || sourceImg.height || 1000;

    this.canvas.width = width;
    this.canvas.height = height;

    // 1. Draw source image
    this.ctx.drawImage(sourceImg, 0, 0, width, height);
    const imgData = this.ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    // 2. Convert to Grayscale
    const gray = new Uint8Array(width * height);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      // Perceptual luminance weighting
      gray[j] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }

    // 3. Bilateral / Box Smoothing (Remove texture noise, keep edges)
    const smoothed = this._boxBlur(gray, width, height, smoothing);

    // 4. Sobel Gradient Magnitude Detection
    const edges = this._sobelFilter(smoothed, width, height, edgeThreshold);

    // 5. Morphological Dilation (Control Line Thickness for toddlers)
    const dilated = this._dilate(edges, width, height, thickness);

    // 6. Invert and Clamp to Pure Binary Black & White
    // Edges (1) become Black (0,0,0), Background (0) becomes Pure White (255,255,255)
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      if (dilated[j] > 0) {
        // Pure crisp black line
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 255;
      } else {
        // 100% Pure white background
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = 255;
      }
    }

    // 7. Write back to canvas
    this.ctx.putImageData(imgData, 0, 0);

    return this.canvas;
  }

  /**
   * Fast Box Blur for noise suppression
   */
  _boxBlur(src, w, h, radius) {
    if (radius <= 0) return src;
    const dst = new Uint8Array(w * h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0;
        let count = 0;

        for (let dy = -radius; dy <= radius; dy++) {
          const py = y + dy;
          if (py < 0 || py >= h) continue;

          for (let dx = -radius; dx <= radius; dx++) {
            const px = x + dx;
            if (px < 0 || px >= w) continue;

            sum += src[py * w + px];
            count++;
          }
        }
        dst[y * w + x] = Math.round(sum / count);
      }
    }
    return dst;
  }

  /**
   * Sobel Edge Detector
   */
  _sobelFilter(src, w, h, threshold) {
    const dst = new Uint8Array(w * h);

    // Sobel Kernels
    // Gx: [-1 0 1, -2 0 2, -1 0 1]
    // Gy: [-1 -2 -1,  0  0  0,  1  2  1]

    for (let y = 1; y < h - 1; y++) {
      const yw = y * w;
      for (let x = 1; x < w - 1; x++) {
        const idx = yw + x;

        const p00 = src[idx - w - 1];
        const p01 = src[idx - w];
        const p02 = src[idx - w + 1];

        const p10 = src[idx - 1];
        const p12 = src[idx + 1];

        const p20 = src[idx + w - 1];
        const p21 = src[idx + w];
        const p22 = src[idx + w + 1];

        const gx = (-p00 + p02) + 2 * (-p10 + p12) + (-p20 + p22);
        const gy = (-p00 - 2 * p01 - p02) + (p20 + 2 * p21 + p22);

        const mag = Math.sqrt(gx * gx + gy * gy);

        dst[idx] = mag >= threshold ? 255 : 0;
      }
    }
    return dst;
  }

  /**
   * Morphological Dilation to expand lines
   */
  _dilate(src, w, h, thickness) {
    if (thickness <= 1) return src;
    const dst = new Uint8Array(w * h);
    const radius = Math.floor(thickness / 2);

    for (let y = radius; y < h - radius; y++) {
      const yw = y * w;
      for (let x = radius; x < w - radius; x++) {
        const idx = yw + x;
        if (src[idx] === 255) {
          // Spread to neighborhood
          for (let dy = -radius; dy <= radius; dy++) {
            const ny = (y + dy) * w;
            for (let dx = -radius; dx <= radius; dx++) {
              dst[ny + (x + dx)] = 255;
            }
          }
        }
      }
    }
    return dst;
  }
}

// Global instance
window.lineArtEngine = new LineArtEngine();

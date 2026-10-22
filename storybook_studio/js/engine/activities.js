/**
 * ============================================================================
 * ALGORITHMIC ACTIVITIES ENGINE (Connect the Dots & Puzzle Generator)
 * ============================================================================
 */

class ActivitiesEngine {
  constructor() {
    this.shapes = {
      crown: [
        { x: 0.15, y: 0.75 }, // 1: bottom left
        { x: 0.10, y: 0.35 }, // 2: left peak
        { x: 0.28, y: 0.50 }, // 3: valley 1
        { x: 0.50, y: 0.20 }, // 4: center high peak
        { x: 0.72, y: 0.50 }, // 5: valley 2
        { x: 0.90, y: 0.35 }, // 6: right peak
        { x: 0.85, y: 0.75 }, // 7: bottom right
        { x: 0.70, y: 0.80 }, // 8
        { x: 0.50, y: 0.82 }, // 9
        { x: 0.30, y: 0.80 }, // 10
        { x: 0.15, y: 0.75 }  // 11: close
      ],
      castle: [
        { x: 0.25, y: 0.85 }, // 1
        { x: 0.25, y: 0.40 }, // 2
        { x: 0.20, y: 0.40 }, // 3
        { x: 0.20, y: 0.30 }, // 4
        { x: 0.35, y: 0.15 }, // 5 roof peak left
        { x: 0.50, y: 0.30 }, // 6
        { x: 0.50, y: 0.20 }, // 7
        { x: 0.65, y: 0.15 }, // 8 roof peak right
        { x: 0.80, y: 0.30 }, // 9
        { x: 0.80, y: 0.40 }, // 10
        { x: 0.75, y: 0.40 }, // 11
        { x: 0.75, y: 0.85 }, // 12
        { x: 0.55, y: 0.85 }, // 13 gate right
        { x: 0.55, y: 0.65 }, // 14 gate top
        { x: 0.45, y: 0.65 }, // 15
        { x: 0.45, y: 0.85 }, // 16 gate left
        { x: 0.25, y: 0.85 }  // 17
      ],
      star: [
        { x: 0.50, y: 0.12 }, // 1
        { x: 0.61, y: 0.35 }, // 2
        { x: 0.86, y: 0.38 }, // 3
        { x: 0.68, y: 0.54 }, // 4
        { x: 0.73, y: 0.79 }, // 5
        { x: 0.50, y: 0.67 }, // 6
        { x: 0.27, y: 0.79 }, // 7
        { x: 0.32, y: 0.54 }, // 8
        { x: 0.14, y: 0.38 }, // 9
        { x: 0.39, y: 0.35 }, // 10
        { x: 0.50, y: 0.12 }  // 11
      ]
    };
  }

  /**
   * Render Connect-the-Dots on Canvas
   * @param {HTMLCanvasElement} canvas 
   * @param {string} shapeType - 'crown' | 'castle' | 'star'
   */
  renderDots(canvas, shapeType = 'crown') {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const pts = this.shapes[shapeType] || this.shapes.crown;

    // Clear White
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // Draw faint guide outline (dashed)
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    pts.forEach((pt, idx) => {
      const px = pt.x * w;
      const py = pt.y * h;
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.setLineDash([]); // reset

    // Draw dots & numbers
    pts.forEach((pt, idx) => {
      // Skip closing point duplication for number
      if (idx === pts.length - 1 && pt.x === pts[0].x && pt.y === pts[0].y) return;

      const px = pt.x * w;
      const py = pt.y * h;
      const num = idx + 1;

      // Outer black circle
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fill();

      // Number text
      ctx.fillStyle = '#1e1b4b';
      ctx.font = 'bold 16px "Outfit", "Cairo", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Offset label slightly outside
      const angle = (idx / pts.length) * Math.PI * 2;
      const ox = px + Math.cos(angle) * 18;
      const oy = py + Math.sin(angle) * 18;

      ctx.fillText(num.toString(), ox, oy);
    });

    // Add Instructions Header on top of canvas
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 16px "Cairo", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('صِلِ النِّقَاطَ بِالتَّرْتِيبِ مِنْ 1 إِلَى ' + (pts.length - 1) + ' لِتَكْتَشِفَ الشَّكْلَ ثُمَّ لَوِّنْهُ!', w / 2, 35);
  }

  /**
   * Update Certificate text with child name, book title, and date
   */
  updateCertificate(childName, bookTitle) {
    const today = new Date().toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const certChildEls = document.querySelectorAll('#certChildNameDisplay, #printCertChildName');
    certChildEls.forEach(el => el.textContent = `الأميرة ${childName}`);

    const certBookEls = document.querySelectorAll('#certBookTitleDisplay, #printCertBookTitle');
    certBookEls.forEach(el => el.textContent = `«${bookTitle}»`);

    const certDateEl = document.getElementById('certDateDisplay');
    if (certDateEl) certDateEl.textContent = today;
  }
}

// Global instance
window.activitiesEngine = new ActivitiesEngine();

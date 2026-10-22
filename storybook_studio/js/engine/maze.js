/**
 * ============================================================================
 * ZERO-ERROR ALGORITHMIC MAZE ENGINE
 * ============================================================================
 * Generates mathematically guaranteed solvable mazes using randomized
 * Depth-First Search with Backtracking.
 * Renders print-ready A4 activity pages with clear start/end anchors.
 */

class MazeEngine {
  constructor() {
    this.grid = [];
    this.cols = 15;
    this.rows = 15;
    this.solutionPath = [];
    this.showSolution = false;
  }

  /**
   * Generate a new solvable maze
   * @param {number} size - number of cells per dimension (e.g., 10, 15, 20)
   */
  generate(size = 15) {
    this.cols = size;
    this.rows = size;
    this.grid = [];
    this.solutionPath = [];

    // Initialize cells
    for (let r = 0; r < this.rows; r++) {
      this.grid[r] = [];
      for (let c = 0; c < this.cols; c++) {
        this.grid[r][c] = {
          r, c,
          visited: false,
          top: true,
          right: true,
          bottom: true,
          left: true
        };
      }
    }

    // Depth-First Search with backtracking
    const stack = [];
    let current = this.grid[0][0];
    current.visited = true;

    // Track path for solution from (0,0) to (rows-1, cols-1)
    const parentMap = new Map();

    while (true) {
      const neighbors = this._getUnvisitedNeighbors(current);
      if (neighbors.length > 0) {
        // Pick random neighbor
        const next = neighbors[Math.floor(Math.random() * neighbors.length)];
        this._removeWalls(current, next);
        stack.push(current);
        parentMap.set(`${next.r},${next.c}`, current);
        current = next;
        current.visited = true;
      } else if (stack.length > 0) {
        current = stack.pop();
      } else {
        break;
      }
    }

    // Solve path from (0,0) to (rows-1, cols-1)
    this.solutionPath = [];
    let currKey = `${this.rows - 1},${this.cols - 1}`;
    while (currKey) {
      const [r, c] = currKey.split(',').map(Number);
      this.solutionPath.push({ r, c });
      if (r === 0 && c === 0) break;
      const parent = parentMap.get(currKey);
      currKey = parent ? `${parent.r},${parent.c}` : null;
    }
    this.solutionPath.reverse();

    return this;
  }

  _getUnvisitedNeighbors(cell) {
    const { r, c } = cell;
    const neighbors = [];
    if (r > 0 && !this.grid[r - 1][c].visited) neighbors.push(this.grid[r - 1][c]);
    if (c < this.cols - 1 && !this.grid[r][c + 1].visited) neighbors.push(this.grid[r][c + 1]);
    if (r < this.rows - 1 && !this.grid[r + 1][c].visited) neighbors.push(this.grid[r + 1][c]);
    if (c > 0 && !this.grid[r][c - 1].visited) neighbors.push(this.grid[r][c - 1]);
    return neighbors;
  }

  _removeWalls(a, b) {
    const dr = a.r - b.r;
    const dc = a.c - b.c;

    if (dr === 1) { a.top = false; b.bottom = false; }
    else if (dr === -1) { a.bottom = false; b.top = false; }
    else if (dc === 1) { a.left = false; b.right = false; }
    else if (dc === -1) { a.right = false; b.left = false; }
  }

  /**
   * Render the maze to an HTML5 Canvas
   * @param {HTMLCanvasElement} canvas 
   * @param {Object} options 
   */
  render(canvas, options = {}) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const margin = 20;

    const cellW = (w - margin * 2) / this.cols;
    const cellH = (h - margin * 2) / this.rows;

    // Clear with Pure White
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // Wall Styling
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(3, Math.floor(cellW * 0.1));
    ctx.lineCap = 'round';

    // Draw Walls
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        const x = margin + c * cellW;
        const y = margin + r * cellH;

        ctx.beginPath();
        // Top Wall
        if (cell.top && !(r === 0 && c === 0)) { // Opening for start
          ctx.moveTo(x, y);
          ctx.lineTo(x + cellW, y);
        }
        // Right Wall
        if (cell.right && !(r === this.rows - 1 && c === this.cols - 1)) { // Opening for end
          ctx.moveTo(x + cellW, y);
          ctx.lineTo(x + cellW, y + cellH);
        }
        // Bottom Wall
        if (cell.bottom && !(r === this.rows - 1 && c === this.cols - 1)) {
          ctx.moveTo(x + cellW, y + cellH);
          ctx.lineTo(x, y + cellH);
        }
        // Left Wall
        if (cell.left && !(r === 0 && c === 0)) {
          ctx.moveTo(x, y + cellH);
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    // Draw Solution Path if enabled
    if (this.showSolution && this.solutionPath.length > 0) {
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = Math.max(4, Math.floor(cellW * 0.25));
      ctx.beginPath();
      for (let i = 0; i < this.solutionPath.length; i++) {
        const { r, c } = this.solutionPath[i];
        const cx = margin + c * cellW + cellW / 2;
        const cy = margin + r * cellH + cellH / 2;
        if (i === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }

    // Draw Start & Goal Icons
    ctx.font = `${Math.floor(cellW * 0.8)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Start (Top-Left)
    ctx.fillText('👧', margin + cellW / 2, margin + cellH / 2);

    // Goal (Bottom-Right)
    ctx.fillText('🏰', margin + (this.cols - 1) * cellW + cellW / 2, margin + (this.rows - 1) * cellH + cellH / 2);
  }
}

// Global instance
window.mazeEngine = new MazeEngine();

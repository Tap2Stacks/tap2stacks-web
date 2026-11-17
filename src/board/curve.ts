export interface Pt {
  x: number;
  y: number;
}

export interface Bezier {
  x0: number;
  y0: number;
  c1x: number;
  c1y: number;
  c2x: number;
  c2y: number;
  x1: number;
  y1: number;
}

/**
 * Fritsch-Carlson monotone cubic interpolation converted to cubic Bezier segments.
 * Guarantees each segment stays within [min(y0, y1), max(y0, y1)] with no overshoot.
 */
export function monotoneSegments(points: Pt[]): Bezier[] {
  const n = points.length;
  if (n < 2) return [];

  const dx = new Array<number>(n - 1);
  const d = new Array<number>(n - 1);
  for (let k = 0; k < n - 1; k++) {
    const h = points[k + 1].x - points[k].x;
    dx[k] = h;
    d[k] = h !== 0 ? (points[k + 1].y - points[k].y) / h : 0;
  }

  const m = new Array<number>(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];

  for (let k = 1; k < n - 1; k++) {
    if (d[k - 1] * d[k] <= 0 || dx[k - 1] <= 0 || dx[k] <= 0) {
      m[k] = 0;
    } else {
      const w1 = 2 * dx[k] + dx[k - 1];
      const w2 = dx[k] + 2 * dx[k - 1];
      m[k] = (w1 + w2) / (w1 / d[k - 1] + w2 / d[k]);
    }
  }

  // Clamp tangents so alpha^2 + beta^2 <= 9 (monotonicity condition)
  for (let k = 0; k < n - 1; k++) {
    if (d[k] === 0) {
      m[k] = 0;
      m[k + 1] = 0;
      continue;
    }
    const alpha = m[k] / d[k];
    const beta = m[k + 1] / d[k];
    const sq = alpha * alpha + beta * beta;
    if (sq > 9) {
      const tau = 3 / Math.sqrt(sq);
      m[k] = tau * alpha * d[k];
      m[k + 1] = tau * beta * d[k];
    }
  }

  const segs: Bezier[] = new Array(n - 1);
  for (let k = 0; k < n - 1; k++) {
    const p0 = points[k];
    const p1 = points[k + 1];
    const h = dx[k];
    segs[k] = {
      x0: p0.x,
      y0: p0.y,
      c1x: p0.x + h / 3,
      c1y: p0.y + (m[k] * h) / 3,
      c2x: p1.x - h / 3,
      c2y: p1.y - (m[k + 1] * h) / 3,
      x1: p1.x,
      y1: p1.y,
    };
  }
  return segs;
}

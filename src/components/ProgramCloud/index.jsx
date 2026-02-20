import React, { useRef, useEffect } from 'react';
import styles from './styles.module.css';

const CATEGORY_COLORS = {
  reach: '#e05040',
  target: '#e8a830',
  safety: '#45b060',
};

function buildCloudItems(report) {
  const items = [];
  for (const category of ['reach', 'target', 'safety']) {
    const programs = report[category] || [];
    for (const p of programs) {
      items.push({
        text: p.school,
        fullLabel: p.program,
        category,
        count: p.totalApplicants,
        rate: p.admissionRate,
        color: CATEGORY_COLORS[category],
      });
    }
  }
  // Sort by count descending — bigger words placed first (center)
  items.sort((a, b) => b.count - a.count);
  return items;
}

/**
 * Simple spiral word cloud renderer on canvas.
 * Places words from center outward using an Archimedean spiral.
 */
function renderWordCloud(canvas, items) {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.parentElement.clientWidth;
  const height = 300;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);
  ctx.textBaseline = 'middle';

  if (items.length === 0) return;

  const counts = items.map((i) => i.count);
  const minCount = Math.min(...counts);
  const maxCount = Math.max(...counts);
  const range = maxCount - minCount || 1;

  // Prepare words with font sizes
  const words = items.map((item, idx) => {
    const normalized = (item.count - minCount) / range;
    const fontSize = 16 + normalized * 28; // 16px to 44px
    // Some words vertical, most horizontal
    const rotate = idx % 4 === 0 ? 90 : (idx % 7 === 0 ? -90 : 0);
    return { ...item, fontSize, rotate };
  });

  const placed = []; // bounding boxes of placed words

  const cx = width / 2;
  const cy = height / 2;

  for (const word of words) {
    ctx.font = `bold ${word.fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    const metrics = ctx.measureText(word.text);
    const tw = metrics.width + 6;
    const th = word.fontSize + 4;
    // Effective bbox after rotation
    const bw = word.rotate ? th : tw;
    const bh = word.rotate ? tw : th;

    let found = false;
    // Spiral outward from center
    for (let t = 0; t < 600; t += 0.3) {
      const r = 3 * t;
      const x = cx + r * Math.cos(t) - bw / 2;
      const y = cy + r * Math.sin(t) - bh / 2;

      // Check bounds
      if (x < 0 || y < 0 || x + bw > width || y + bh > height) continue;

      // Check overlap with placed words
      const overlaps = placed.some(
        (p) => x < p.x + p.w && x + bw > p.x && y < p.y + p.h && y + bh > p.y
      );
      if (overlaps) continue;

      // Place the word
      placed.push({ x, y, w: bw, h: bh });

      ctx.save();
      ctx.translate(x + bw / 2, y + bh / 2);
      if (word.rotate) ctx.rotate((word.rotate * Math.PI) / 180);
      ctx.fillStyle = word.color;
      ctx.font = `bold ${word.fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(word.text, 0, 0);
      ctx.restore();

      found = true;
      break;
    }

    // If spiral exhausted, skip this word
    if (!found) continue;
  }
}

export default function ProgramCloud({ report }) {
  const canvasRef = useRef(null);
  const items = buildCloudItems(report);

  useEffect(() => {
    if (!canvasRef.current || items.length === 0) return;
    renderWordCloud(canvasRef.current, items);

    const handleResize = () => renderWordCloud(canvasRef.current, items);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [report]);

  if (items.length === 0) return null;

  return (
    <div className={styles.cloudContainer}>
      <canvas ref={canvasRef} className={styles.canvas} />
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.dot} style={{ background: CATEGORY_COLORS.reach }} />
          冲刺 Reach
        </span>
        <span className={styles.legendItem}>
          <span className={styles.dot} style={{ background: CATEGORY_COLORS.target }} />
          主申 Target
        </span>
        <span className={styles.legendItem}>
          <span className={styles.dot} style={{ background: CATEGORY_COLORS.safety }} />
          保底 Safety
        </span>
      </div>
    </div>
  );
}

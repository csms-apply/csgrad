import React, { useState, useEffect } from 'react';
import { useColorMode } from '@docusaurus/theme-common';
import styles from './styles.module.css';

const LIGHT_COLORS = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];
const DARK_COLORS  = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];

const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
const DAY_LABELS = ['周一', '', '周三', '', '周五', '', ''];

function getLevel(count) {
  if (count === 0)   return 0;
  if (count < 20)    return 1;
  if (count < 100)   return 2;
  if (count < 300)   return 3;
  return 4;
}

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildWeeks() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(today);
  start.setDate(today.getDate() - 364);

  // Pad to nearest Monday (Mon = 0 in our system, JS Sun = 0)
  const padStart = (start.getDay() + 6) % 7;

  const weeks = [];
  let week = Array(padStart).fill(null);

  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    week.push(new Date(d));
    if (week.length === 7) {
      weeks.push([...week]);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

export default function VisitorHeatmap() {
  const { colorMode } = useColorMode();
  const isDark = colorMode === 'dark';
  const COLORS = isDark ? DARK_COLORS : LIGHT_COLORS;

  const [data, setData] = useState({});
  const [lastUpdated, setLastUpdated] = useState('');
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    fetch('/data/visitor-heatmap.json')
      .then(r => r.json())
      .then(json => {
        setData(json.data || {});
        setLastUpdated(json.lastUpdated || '');
      })
      .catch(() => {});
  }, []);

  const weeks = buildWeeks();

  // Month label: show at the first week that contains the 1st of a month
  const monthLabels = {};
  weeks.forEach((week, weekIdx) => {
    week.forEach(date => {
      if (date && date.getDate() === 1) {
        monthLabels[weekIdx] = MONTHS[date.getMonth()];
      }
    });
  });

  const total = Object.values(data).reduce((sum, v) => sum + v, 0);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span>
          近一年共 <strong>{total.toLocaleString()}</strong> 次访问
        </span>
        {lastUpdated && (
          <span className={styles.updated}>数据更新于 {lastUpdated}</span>
        )}
      </div>

      <div className={styles.heatmapWrapper}>
        {/* Day-of-week labels */}
        <div className={styles.dayLabels}>
          <div className={styles.monthSpacer} />
          {DAY_LABELS.map((label, i) => (
            <span key={i} className={styles.dayLabel}>{label}</span>
          ))}
        </div>

        {/* Grid area (scrollable on small screens) */}
        <div className={styles.gridWrapper}>
          {/* Month labels row */}
          <div className={styles.monthRow}>
            {weeks.map((_, weekIdx) => (
              <div key={weekIdx} className={styles.monthCell}>
                {monthLabels[weekIdx] && (
                  <span className={styles.monthLabel}>
                    {monthLabels[weekIdx]}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Week columns */}
          <div className={styles.grid}>
            {weeks.map((week, weekIdx) => (
              <div key={weekIdx} className={styles.weekCol}>
                {week.map((date, dayIdx) => {
                  if (!date) {
                    return <div key={dayIdx} className={styles.emptyCell} />;
                  }
                  const key = toDateStr(date);
                  const count = data[key] || 0;
                  const level = getLevel(count);
                  const label = `${date.getMonth() + 1}月${date.getDate()}日: ${count} 次访问`;
                  return (
                    <div
                      key={dayIdx}
                      className={styles.cell}
                      style={{ backgroundColor: COLORS[level] }}
                      onMouseEnter={e =>
                        setTooltip({ text: label, x: e.clientX, y: e.clientY })
                      }
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {tooltip && (
        <div
          className={styles.tooltip}
          style={{ left: tooltip.x + 12, top: tooltip.y - 40 }}
        >
          {tooltip.text}
        </div>
      )}

      <div className={styles.legend}>
        <span>少</span>
        {COLORS.map((color, i) => (
          <div key={i} className={styles.legendCell} style={{ backgroundColor: color }} />
        ))}
        <span>多</span>
      </div>
    </div>
  );
}

import React, { useState, useEffect, memo } from 'react';
import Translate, { translate } from '@docusaurus/Translate';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from 'react-simple-maps';
import styles from './styles.module.css';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

const CATEGORY_COLORS = {
  reach: '#e05040',
  target: '#e8a830',
  safety: '#45b060',
  insufficient: '#999',
};

const CATEGORY_LABELS = {
  reach: () => translate({ id: 'report.map.reach', message: 'Reach' }),
  target: () => translate({ id: 'report.map.target', message: 'Target' }),
  safety: () => translate({ id: 'report.map.safety', message: 'Safety' }),
  insufficient: () => translate({ id: 'report.map.insufficient', message: '数据不足' }),
};

/**
 * Merge report data with school coordinates to create map markers.
 */
function buildMarkers(report, coordinates) {
  const schoolMap = {};

  function addPrograms(programs, category) {
    for (const p of programs) {
      const key = p.school;
      if (!coordinates[key]) continue;
      if (!schoolMap[key]) {
        schoolMap[key] = {
          school: key,
          coords: [coordinates[key].lng, coordinates[key].lat],
          programs: [],
          // Track the "best" category for this school's marker color
          categories: new Set(),
        };
      }
      schoolMap[key].programs.push({
        name: p.program,
        category,
        rate: p.admissionRate,
      });
      schoolMap[key].categories.add(category);
    }
  }

  addPrograms(report.safety || [], 'safety');
  addPrograms(report.target || [], 'target');
  addPrograms(report.reach || [], 'reach');
  addPrograms(report.insufficient || [], 'insufficient');

  // Determine dominant color: priority safety > target > reach > insufficient
  return Object.values(schoolMap).map((s) => {
    let dominantCategory = 'insufficient';
    if (s.categories.has('safety')) dominantCategory = 'safety';
    else if (s.categories.has('target')) dominantCategory = 'target';
    else if (s.categories.has('reach')) dominantCategory = 'reach';
    return {
      ...s,
      dominantCategory,
      color: CATEGORY_COLORS[dominantCategory],
    };
  });
}

const SchoolMarker = memo(function SchoolMarker({ marker, onHover, onLeave }) {
  return (
    <Marker coordinates={marker.coords}>
      <circle
        r={6}
        fill={marker.color}
        stroke="#fff"
        strokeWidth={1.5}
        style={{ cursor: 'pointer' }}
        onMouseEnter={(e) => onHover(marker, e)}
        onMouseLeave={onLeave}
      />
    </Marker>
  );
});

export default function SchoolMap({ report }) {
  const [coordinates, setCoordinates] = useState(null);
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    fetch('/data/school-coordinates.json')
      .then((r) => r.json())
      .then(setCoordinates)
      .catch(() => setCoordinates({}));
  }, []);

  if (!coordinates) {
    return <div className={styles.loading}><Translate id="report.map.loading">加载地图中...</Translate></div>;
  }

  const markers = buildMarkers(report, coordinates);

  function handleHover(marker, e) {
    const rect = e.target.getBoundingClientRect();
    setTooltip({
      marker,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  }

  function handleLeave() {
    setTooltip(null);
  }

  return (
    <div className={styles.mapContainer}>
      <h3 className={styles.mapTitle}>
        <Translate id="report.map.title">选校分布地图</Translate>
      </h3>

      <div className={styles.mapWrapper}>
        <ComposableMap
          projection="geoAlbersUsa"
          projectionConfig={{ scale: 900 }}
          width={800}
          height={500}
          style={{ width: '100%', height: 'auto' }}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#e8e0d4"
                  stroke="#d0c4b0"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: 'none' },
                    hover: { fill: '#ddd4c6', outline: 'none' },
                    pressed: { outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>
          {markers.map((m) => (
            <SchoolMarker
              key={m.school}
              marker={m}
              onHover={handleHover}
              onLeave={handleLeave}
            />
          ))}
        </ComposableMap>

        {/* Dark mode map overlay */}
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className={styles.tooltip}
          style={{
            left: tooltip.x,
            top: tooltip.y,
          }}
        >
          <div className={styles.tooltipSchool}>{tooltip.marker.school}</div>
          {tooltip.marker.programs.map((p, i) => (
            <div key={i} className={styles.tooltipProgram}>
              <span
                className={styles.tooltipDot}
                style={{ background: CATEGORY_COLORS[p.category] }}
              />
              {p.name}
              {p.rate !== undefined && ` (${p.rate}%)`}
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className={styles.legend}>
        {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
          <div key={cat} className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: color }} />
            <span>{CATEGORY_LABELS[cat]()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

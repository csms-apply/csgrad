import React, { useState, useEffect, useCallback, useRef } from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';
import Translate, { translate } from '@docusaurus/Translate';
import styles from './styles.module.css';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// Color scale: light -> dark blue
const COLOR_SCALE = ['#dbeafe', '#93c5fd', '#3b82f6', '#1d4ed8', '#1e3a8a'];

// ISO alpha-2 -> numeric code mapping (GA4 uses alpha-2, TopoJSON uses numeric)
const ALPHA2_TO_NUMERIC = {
  AF:'004',AL:'008',DZ:'012',AS:'016',AD:'020',AO:'024',AG:'028',AR:'032',
  AM:'051',AU:'036',AT:'040',AZ:'031',BS:'044',BH:'048',BD:'050',BB:'052',
  BY:'112',BE:'056',BZ:'084',BJ:'204',BT:'064',BO:'068',BA:'070',BW:'072',
  BR:'076',BN:'096',BG:'100',BF:'854',BI:'108',KH:'116',CM:'120',CA:'124',
  CV:'132',CF:'140',TD:'148',CL:'152',CN:'156',CO:'170',KM:'174',CG:'178',
  CD:'180',CR:'188',CI:'384',HR:'191',CU:'192',CY:'196',CZ:'203',DK:'208',
  DJ:'262',DM:'212',DO:'214',EC:'218',EG:'818',SV:'222',GQ:'226',ER:'232',
  EE:'233',ET:'231',FJ:'242',FI:'246',FR:'250',GA:'266',GM:'270',GE:'268',
  DE:'276',GH:'288',GR:'300',GD:'308',GT:'320',GN:'324',GW:'624',GY:'328',
  HT:'332',HN:'340',HU:'348',IS:'352',IN:'356',ID:'360',IR:'364',IQ:'368',
  IE:'372',IL:'376',IT:'380',JM:'388',JP:'392',JO:'400',KZ:'398',KE:'404',
  KI:'296',KP:'408',KR:'410',KW:'414',KG:'417',LA:'418',LV:'428',LB:'422',
  LS:'426',LR:'430',LY:'434',LI:'438',LT:'440',LU:'442',MK:'807',MG:'450',
  MW:'454',MY:'458',MV:'462',ML:'466',MT:'470',MH:'584',MR:'478',MU:'480',
  MX:'484',FM:'583',MD:'498',MC:'492',MN:'496',ME:'499',MA:'504',MZ:'508',
  MM:'104',NA:'516',NR:'520',NP:'524',NL:'528',NZ:'554',NI:'558',NE:'562',
  NG:'566',NO:'578',OM:'512',PK:'586',PW:'585',PA:'591',PG:'598',PY:'600',
  PE:'604',PH:'608',PL:'616',PT:'620',QA:'634',RO:'642',RU:'643',RW:'646',
  KN:'659',LC:'662',VC:'670',WS:'882',SM:'674',ST:'678',SA:'682',SN:'686',
  RS:'688',SC:'690',SL:'694',SG:'702',SK:'703',SI:'705',SB:'090',SO:'706',
  ZA:'710',SS:'728',ES:'724',LK:'144',SD:'729',SR:'740',SZ:'748',SE:'752',
  CH:'756',SY:'760',TW:'158',TJ:'762',TZ:'834',TH:'764',TL:'626',TG:'768',
  TO:'776',TT:'780',TN:'788',TR:'792',TM:'795',TV:'798',UG:'800',UA:'804',
  AE:'784',GB:'826',US:'840',UY:'858',UZ:'860',VU:'548',VE:'862',VN:'704',
  YE:'887',ZM:'894',ZW:'716',HK:'344',MO:'446',PS:'275',XK:'983',
};

function getColor(count, thresholds) {
  if (!count) return '#e8e0d4';
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (count >= thresholds[i]) return COLOR_SCALE[i];
  }
  return COLOR_SCALE[0];
}

function computeThresholds(counts) {
  if (counts.length === 0) return [1, 5, 20, 100, 500];
  const max = Math.max(...counts);
  if (max <= 5) return [1, 2, 3, 4, 5];
  const logMax = Math.log10(max);
  return COLOR_SCALE.map((_, i) =>
    Math.max(1, Math.round(Math.pow(10, (logMax * (i + 1)) / COLOR_SCALE.length)))
  );
}

// Convert TopoJSON to GeoJSON features (inline to avoid topojson-client dependency)
function topoFeatures(topology, objectName) {
  const obj = topology.objects[objectName];
  const arcs = topology.arcs;
  const transform = topology.transform;

  function decodeArc(arcIndex) {
    const reverse = arcIndex < 0;
    const index = reverse ? ~arcIndex : arcIndex;
    const arc = arcs[index];
    const coords = [];
    let x = 0, y = 0;
    for (const point of arc) {
      x += point[0];
      y += point[1];
      coords.push([
        transform ? x * transform.scale[0] + transform.translate[0] : x,
        transform ? y * transform.scale[1] + transform.translate[1] : y,
      ]);
    }
    if (reverse) coords.reverse();
    return coords;
  }

  function decodeRing(ring) {
    const coords = [];
    for (const arcIndex of ring) {
      const arcCoords = decodeArc(arcIndex);
      // skip first point of subsequent arcs to avoid duplicates
      const start = coords.length > 0 ? 1 : 0;
      for (let i = start; i < arcCoords.length; i++) {
        coords.push(arcCoords[i]);
      }
    }
    return coords;
  }

  function decodeGeometry(geom) {
    switch (geom.type) {
      case 'Polygon':
        return { type: 'Polygon', coordinates: geom.arcs.map(decodeRing) };
      case 'MultiPolygon':
        return {
          type: 'MultiPolygon',
          coordinates: geom.arcs.map(poly => poly.map(decodeRing)),
        };
      default:
        return geom;
    }
  }

  if (obj.type === 'GeometryCollection') {
    return obj.geometries.map(geom => ({
      type: 'Feature',
      id: geom.id,
      properties: geom.properties || {},
      geometry: decodeGeometry(geom),
    }));
  }
  return [];
}

function GeoMapInner() {
  const [geoData, setGeoData] = useState(null);
  const [visitorData, setVisitorData] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [pathGenerator, setPathGenerator] = useState(null);
  const svgRef = useRef(null);

  // Dynamically import d3-geo (client-side only)
  useEffect(() => {
    import('d3-geo').then((d3Geo) => {
      const projection = d3Geo.geoNaturalEarth1()
        .scale(147)
        .translate([400, 200]);
      setPathGenerator(() => d3Geo.geoPath(projection));
    });
  }, []);

  useEffect(() => {
    fetch(GEO_URL)
      .then(r => r.json())
      .then(topo => {
        const features = topoFeatures(topo, 'countries');
        setGeoData(features);
      })
      .catch(() => setGeoData([]));
  }, []);

  useEffect(() => {
    fetch('/data/visitor-geo.json')
      .then(r => r.json())
      .then(setVisitorData)
      .catch(() => setVisitorData({ countries: {}, regions: {} }));
  }, []);

  const handleHover = useCallback((name, count, e) => {
    const rect = e.target.getBoundingClientRect();
    setTooltip({
      name,
      count,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  }, []);

  const handleLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  if (!geoData || !visitorData || !pathGenerator) {
    return (
      <div className={styles.loading}>
        <Translate id="visitorGeo.loading">加载地图中...</Translate>
      </div>
    );
  }

  const countries = visitorData.countries || {};
  const regions = visitorData.regions || {};
  const countryCount = Object.keys(countries).length;
  const regionCount = Object.keys(regions).length;

  const numericLookup = {};
  for (const [alpha2, count] of Object.entries(countries)) {
    const num = ALPHA2_TO_NUMERIC[alpha2];
    if (num) numericLookup[num] = count;
  }

  const counts = Object.values(countries).filter(v => v > 0);
  const thresholds = computeThresholds(counts);
  const hasData = countryCount > 0;

  return (
    <div className={styles.mapContainer}>
      <h3 className={styles.mapTitle}>
        <Translate id="visitorGeo.title">访客地理分布</Translate>
      </h3>

      {hasData && (
        <p className={styles.statsLine}>
          <Translate
            id="visitorGeo.stats"
            values={{ countries: countryCount, regions: regionCount }}
          >
            {'来自 {countries} 个国家, {regions} 个地区的人们访问了 csgrad'}
          </Translate>
        </p>
      )}

      <div className={styles.mapWrapper}>
        <svg
          ref={svgRef}
          viewBox="0 0 800 400"
          style={{ width: '100%', height: 'auto', display: 'block' }}
        >
          {geoData.map((feature, i) => {
            const numId = feature.id;
            const count = numericLookup[numId] || 0;
            const fill = getColor(count, thresholds);
            const countryName = feature.properties.name || `Country ${numId}`;
            const d = pathGenerator(feature.geometry);
            if (!d) return null;
            return (
              <path
                key={numId || i}
                d={d}
                fill={fill}
                stroke="#d0c4b0"
                strokeWidth={0.5}
                onMouseEnter={(e) => handleHover(countryName, count, e)}
                onMouseLeave={handleLeave}
                style={{ cursor: 'pointer' }}
              />
            );
          })}
        </svg>
      </div>

      {tooltip && (
        <div
          className={styles.tooltip}
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className={styles.tooltipCountry}>{tooltip.name}</div>
          <div className={styles.tooltipCount}>
            {tooltip.count > 0
              ? translate(
                  { id: 'visitorGeo.visitors', message: '{count} 位访客' },
                  { count: tooltip.count }
                )
              : translate({ id: 'visitorGeo.noVisitors', message: '暂无访客' })}
          </div>
        </div>
      )}

      {hasData && (
        <div className={styles.legend}>
          <span>
            <Translate id="visitorGeo.legendFew">少</Translate>
          </span>
          <div className={styles.legendBar}>
            {COLOR_SCALE.map((color, i) => (
              <div
                key={i}
                className={styles.legendSegment}
                style={{ background: color }}
              />
            ))}
          </div>
          <span>
            <Translate id="visitorGeo.legendMany">多</Translate>
          </span>
        </div>
      )}
    </div>
  );
}

export default function VisitorGeoMap() {
  return (
    <BrowserOnly fallback={<div className={styles.loading}>加载地图中...</div>}>
      {() => <GeoMapInner />}
    </BrowserOnly>
  );
}

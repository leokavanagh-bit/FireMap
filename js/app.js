'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────

const MAPBOX_TOKEN = 'pk.eyJ1IjoibGthdmFuYWdoIiwiYSI6ImNtbW84Zm5wajBhOTQycXBzYWRnZ2lpZWMifQ.GeE2rQyJehYkAkibVLn7JA';

// CWFIS — Canadian Wildland Fire Information System (NRCan)
// Fetches active fires (Out of Control + Being Held) for the current fire season
function cwfisUrl() {
  const year = new Date().getFullYear();
  const filter = encodeURIComponent(`stage_of_control IN ('OC','BH','UC') AND last_rep_date >= '${year}-01-01'`);
  return `https://cwfis.cfs.nrcan.gc.ca/geoserver/public/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=public:activefires&outputFormat=application/json&CQL_FILTER=${filter}`;
}

const REFRESH_MS = 5 * 60 * 1000; // auto-refresh every 5 minutes

// ── Province bounding boxes [west, south, east, north] ──────────────────────

const PROVINCE_BOUNDS = {
  BC:  [-139.1, 48.3, -114.0, 60.0],
  AB:  [-120.0, 49.0, -110.0, 60.0],
  SK:  [-110.0, 49.0, -101.4, 60.0],
  MB:  [-102.1, 49.0,  -89.0, 60.0],
  ON:  [ -95.2, 41.7,  -74.3, 56.9],
  QC:  [ -79.8, 44.9,  -57.1, 62.6],
  NB:  [ -69.1, 44.5,  -63.8, 48.1],
  NS:  [ -66.4, 43.4,  -59.7, 47.0],
  PE:  [ -64.4, 45.9,  -62.0, 47.1],
  NL:  [ -67.8, 46.6,  -52.6, 60.4],
  YT:  [-141.0, 59.7, -124.0, 70.0],
  NT:  [-136.5, 59.9, -101.9, 78.8],
  NU:  [-120.6, 58.8,  -61.1, 83.1],
};

const PROVINCE_NAMES = {
  BC: 'British Columbia', AB: 'Alberta', SK: 'Saskatchewan',
  MB: 'Manitoba', ON: 'Ontario', QC: 'Quebec',
  NB: 'New Brunswick', NS: 'Nova Scotia', PE: 'Prince Edward Island',
  NL: 'Newfoundland & Labrador', YT: 'Yukon',
  NT: 'Northwest Territories', NU: 'Nunavut',
};

// CWFIS agency code → province code
const AGENCY_TO_PROVINCE = {
  bc: 'BC', ab: 'AB', sk: 'SK', mb: 'MB',
  on: 'ON', qc: 'QC', nb: 'NB', ns: 'NS',
  pei: 'PE', nl: 'NL', yt: 'YT', nt: 'NT', nu: 'NU',
};

const SOC_LABELS = {
  OC: 'Out of Control',
  BH: 'Being Held',
  UC: 'Under Control',
  PF: 'Prescribed Fire',
};

const CAUSE_LABELS = {
  H: 'Human',
  L: 'Lightning',
  N: 'Natural',
  U: 'Unknown',
};

// ── Wind grid points across Canada ───────────────────────────────────────────
// 4 rows × 6 columns = 24 sample points

const WIND_GRID = [];
for (const lat of [50, 56, 62, 68]) {
  for (const lon of [-134, -121, -108, -95, -82, -69]) {
    WIND_GRID.push([lat, lon]);
  }
}

// ── State ────────────────────────────────────────────────────────────────────

let map;
let allFires     = [];
let activeFilter = 'all';
let refreshTimer = null;
let windEnabled  = false;

// ── Map init ─────────────────────────────────────────────────────────────────

mapboxgl.accessToken = MAPBOX_TOKEN;

map = new mapboxgl.Map({
  container:  'map',
  style:      'mapbox://styles/mapbox/dark-v11',
  center:     [-96, 62],
  zoom:       3.5,
  minZoom:    2,
  maxZoom:    14,
  projection: 'mercator',
});

map.addControl(
  new mapboxgl.NavigationControl({ showCompass: false }),
  'top-left'
);

map.on('load', () => {
  map.addImage('wind-arrow', createArrowImage());
  addFireSource();
  addFireLayers();
  addWindSource();
  addWindLayer();
  fetchFires();
  startRefresh();
  setupFilters();
  setupPanel();
  setupRefreshBtn();
  setupWindToggle();
});

// ── Data fetching ────────────────────────────────────────────────────────────

async function fetchFires() {
  setSpinning(true);
  showLoading(true);
  try {
    const res = await fetch(cwfisUrl());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    allFires = processCWFIS(json);
    updateMap();
    updateStats();
    updateLastUpdated();
    hideError();
  } catch (e) {
    console.error('Fire data fetch failed:', e);
    showError();
  } finally {
    showLoading(false);
    setSpinning(false);
  }
}

function processCWFIS(geojson) {
  if (!geojson || !Array.isArray(geojson.features)) return [];

  return geojson.features.flatMap(f => {
    const p   = f.properties;
    const lat = parseFloat(p.lat);
    const lon = parseFloat(p.lon);
    if (isNaN(lat) || isNaN(lon)) return [];

    const province = AGENCY_TO_PROVINCE[(p.agency || '').toLowerCase()]
                  || detectProvince(lat, lon);

    return [{
      lat,
      lon,
      firename:  p.firename  || 'Unnamed Fire',
      hectares:  parseFloat(p.hectares) || 0,
      soc:       p.stage_of_control || 'UC',
      cause:     p.cause || 'U',
      startdate: p.startdate     || null,
      lastdate:  p.last_rep_date || null,
      agency:    p.agency || '',
      province,
    }];
  });
}

function detectProvince(lat, lon) {
  for (const [code, [w, s, e, n]] of Object.entries(PROVINCE_BOUNDS)) {
    if (lon >= w && lon <= e && lat >= s && lat <= n) return code;
  }
  return null;
}

function filteredFires() {
  if (activeFilter === 'all') return allFires;
  return allFires.filter(f => f.province === activeFilter);
}

function toGeoJSON(fires) {
  return {
    type: 'FeatureCollection',
    features: fires.map(f => ({
      type: 'Feature',
      geometry:   { type: 'Point', coordinates: [f.lon, f.lat] },
      properties: { ...f },
    })),
  };
}

// ── Map source & layers ──────────────────────────────────────────────────────

function addFireSource() {
  map.addSource('fires', {
    type:           'geojson',
    data:           { type: 'FeatureCollection', features: [] },
    cluster:        true,
    clusterMaxZoom: 8,
    clusterRadius:  40,
  });
}

function addFireLayers() {
  // Cluster circles
  map.addLayer({
    id:     'fire-clusters',
    type:   'circle',
    source: 'fires',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': [
        'step', ['get', 'point_count'],
        '#f97316', 10,
        '#ef2601', 50,
        '#c81000'
      ],
      'circle-radius': [
        'step', ['get', 'point_count'],
        20, 10, 28, 50, 38
      ],
      'circle-stroke-width': 2,
      'circle-stroke-color': 'rgba(239,38,1,0.3)',
    },
  });

  // Cluster count text
  map.addLayer({
    id:     'fire-cluster-count',
    type:   'symbol',
    source: 'fires',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': '{point_count_abbreviated}',
      'text-font':  ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
      'text-size':  14,
    },
    paint: { 'text-color': '#fff' },
  });

  // Individual fire circles — sized by hectares, coloured by stage of control
  map.addLayer({
    id:     'fire-points',
    type:   'circle',
    source: 'fires',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': [
        'match', ['get', 'soc'],
        'OC', '#ef2601',
        'BH', '#f97316',
        'UC', '#22c55e',
        '#818080',
      ],
      'circle-radius': [
        'interpolate', ['linear'], ['get', 'hectares'],
        0,       8,
        1000,   13,
        10000,  19,
        100000, 28,
      ],
      'circle-stroke-width': 2,
      'circle-stroke-color': 'rgba(255,255,255,0.2)',
      'circle-opacity': 0.88,
    },
  });

  // Fire name label beneath each point
  map.addLayer({
    id:     'fire-labels',
    type:   'symbol',
    source: 'fires',
    filter: ['!', ['has', 'point_count']],
    layout: {
      'text-field':          ['get', 'firename'],
      'text-size':           10,
      'text-font':           ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
      'text-offset':         [0, 1.8],
      'text-anchor':         'top',
      'text-allow-overlap':  false,
    },
    paint: {
      'text-color':      'rgba(255,255,255,0.75)',
      'text-halo-color': 'rgba(0,0,0,0.6)',
      'text-halo-width': 1,
    },
  });

  // Tap individual fire → show panel
  map.on('click', 'fire-points', e => {
    showPanel(e.features[0].properties);
  });

  // Tap cluster → zoom in
  map.on('click', 'fire-clusters', e => {
    const features  = map.queryRenderedFeatures(e.point, { layers: ['fire-clusters'] });
    const clusterId = features[0].properties.cluster_id;
    map.getSource('fires').getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err) return;
      map.easeTo({ center: features[0].geometry.coordinates, zoom });
    });
  });

  ['fire-points', 'fire-clusters'].forEach(layer => {
    map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
  });
}

function updateMap() {
  map.getSource('fires').setData(toGeoJSON(filteredFires()));
}

// ── Stats ────────────────────────────────────────────────────────────────────

function updateStats() {
  const fires   = filteredFires();
  const oc      = fires.filter(f => f.soc === 'OC').length;
  const provs   = new Set(fires.map(f => f.province).filter(Boolean)).size;
  const totalHa = fires.reduce((s, f) => s + f.hectares, 0);
  const haStr   = totalHa >= 1000
    ? (totalHa / 1000).toFixed(1) + 'k'
    : Math.round(totalHa).toLocaleString();

  document.getElementById('stat-total').textContent     = fires.length.toLocaleString();
  document.getElementById('stat-oc').textContent        = oc.toLocaleString();
  document.getElementById('stat-provinces').textContent = provs;
  document.getElementById('stat-ha').textContent        = totalHa > 0 ? haStr : '—';
}

function updateLastUpdated() {
  const el = document.getElementById('last-updated');
  if (el) el.textContent = 'Updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ── Province filter ──────────────────────────────────────────────────────────

function setupFilters() {
  document.querySelectorAll('.filter-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.province;
      updateMap();
      updateStats();
      hidePanel();

      if (activeFilter !== 'all' && PROVINCE_BOUNDS[activeFilter]) {
        const [w, s, e, n] = PROVINCE_BOUNDS[activeFilter];
        map.fitBounds([[w, s], [e, n]], { padding: 60, duration: 800 });
      } else {
        map.flyTo({ center: [-96, 62], zoom: 3.5, duration: 800 });
      }
    });
  });
}

// ── Fire detail panel ────────────────────────────────────────────────────────

function setupPanel() {
  document.getElementById('panel-close').addEventListener('click', hidePanel);
}

async function showPanel(props) {
  const prov = props.province
    ? `${PROVINCE_NAMES[props.province] || props.province} (${props.province})`
    : (props.agency ? props.agency.toUpperCase() : 'Location unknown');

  const haStr    = parseFloat(props.hectares) > 0
    ? parseFloat(props.hectares).toLocaleString(undefined, { maximumFractionDigits: 1 }) + ' ha'
    : '< 1 ha';
  const socLabel  = SOC_LABELS[props.soc]  || props.soc  || '—';
  const causeLabel = CAUSE_LABELS[props.cause] || props.cause || '—';
  const startStr  = props.startdate
    ? new Date(props.startdate).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
    : '—';

  document.getElementById('panel-firename').textContent  = props.firename || '—';
  document.getElementById('panel-province').textContent  = prov;
  document.getElementById('panel-hectares').textContent  = haStr;
  document.getElementById('panel-soc').textContent       = socLabel;
  document.getElementById('panel-cause').textContent     = causeLabel;
  document.getElementById('panel-startdate').textContent = startStr;
  document.getElementById('panel-coords').textContent    = `${parseFloat(props.lat).toFixed(4)}, ${parseFloat(props.lon).toFixed(4)}`;

  // Colour the stage-of-control value
  const socEl = document.getElementById('panel-soc');
  socEl.style.color = props.soc === 'OC' ? '#ef2601'
                    : props.soc === 'BH' ? '#f97316'
                    : props.soc === 'UC' ? '#22c55e'
                    : '';

  // Reset wind fields
  document.getElementById('panel-wind-speed').textContent = '…';
  document.getElementById('panel-wind-dir').textContent   = '…';
  document.getElementById('panel-smoke-dir').textContent  = '…';

  document.getElementById('fire-panel').classList.add('open');

  // Fetch live wind for this fire's location
  try {
    const wind     = await fetchFireWind(props.lat, props.lon);
    const fromComp = degreesToCompass(wind.direction);
    const toComp   = degreesToCompass((wind.direction + 180) % 360);
    document.getElementById('panel-wind-speed').textContent = `${wind.speed} km/h`;
    document.getElementById('panel-wind-dir').textContent   = `From ${fromComp} (${wind.direction}°)`;
    document.getElementById('panel-smoke-dir').textContent  = `Toward ${toComp}`;
  } catch {
    document.getElementById('panel-wind-speed').textContent = '—';
    document.getElementById('panel-wind-dir').textContent   = '—';
    document.getElementById('panel-smoke-dir').textContent  = '—';
  }
}

function hidePanel() {
  document.getElementById('fire-panel').classList.remove('open');
}

// ── Refresh ──────────────────────────────────────────────────────────────────

function setupRefreshBtn() {
  document.getElementById('refresh-btn').addEventListener('click', () => {
    clearInterval(refreshTimer);
    fetchFires();
    startRefresh();
  });
}

function startRefresh() {
  refreshTimer = setInterval(fetchFires, REFRESH_MS);
}

function setSpinning(on) {
  document.getElementById('refresh-btn').classList.toggle('spinning', on);
}

// ── Wind ─────────────────────────────────────────────────────────────────────

function createArrowImage() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx  = size / 2;

  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.fillStyle   = 'rgba(255,255,255,0.9)';
  ctx.lineWidth   = 3;
  ctx.lineCap     = 'round';

  // Shaft (pointing up = north by default)
  ctx.beginPath();
  ctx.moveTo(cx, size - 10);
  ctx.lineTo(cx, 20);
  ctx.stroke();

  // Arrowhead
  ctx.beginPath();
  ctx.moveTo(cx, 6);
  ctx.lineTo(cx - 9, 22);
  ctx.lineTo(cx + 9, 22);
  ctx.closePath();
  ctx.fill();

  // Return ImageData — what Mapbox addImage actually accepts
  return ctx.getImageData(0, 0, size, size);
}

function addWindSource() {
  map.addSource('wind', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });
}

function addWindLayer() {
  map.addLayer({
    id:     'wind-arrows',
    type:   'symbol',
    source: 'wind',
    layout: {
      'icon-image':              'wind-arrow',
      'icon-size':               0.65,
      'icon-rotate':             ['get', 'rotation'],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap':      true,
      'text-field':              ['concat', ['to-string', ['get', 'speed']], ' km/h'],
      'text-size':               11,
      'text-offset':             [0, 2],
      'text-font':               ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
      'visibility':              'none',
    },
    paint: {
      'icon-opacity': [
        'interpolate', ['linear'], ['get', 'speed'],
        0, 0.25, 20, 0.6, 60, 1.0
      ],
      'text-color':   'rgba(255,255,255,0.65)',
    },
  });
}

async function fetchWindGrid() {
  const lats = WIND_GRID.map(p => p[0]).join(',');
  const lons  = WIND_GRID.map(p => p[1]).join(',');
  const url   = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=windspeed_10m,winddirection_10m&wind_speed_unit=kmh`;

  const res  = await fetch(url);
  const data = await res.json();
  const arr  = Array.isArray(data) ? data : [data];

  const features = arr.map(d => ({
    type: 'Feature',
    geometry:   { type: 'Point', coordinates: [d.longitude, d.latitude] },
    properties: {
      speed:    Math.round(d.current?.windspeed_10m    ?? 0),
      rotation: Math.round((d.current?.winddirection_10m ?? 0) + 180) % 360,
    },
  }));

  map.getSource('wind').setData({ type: 'FeatureCollection', features });
}

async function fetchFireWind(lat, lon) {
  const url  = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=windspeed_10m,winddirection_10m&wind_speed_unit=kmh`;
  const res  = await fetch(url);
  const data = await res.json();
  return {
    speed:     Math.round(data.current?.windspeed_10m    ?? 0),
    direction: Math.round(data.current?.winddirection_10m ?? 0),
  };
}

function degreesToCompass(deg) {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

function setupWindToggle() {
  const btn = document.getElementById('wind-btn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    windEnabled = !windEnabled;
    btn.classList.toggle('active', windEnabled);
    map.setLayoutProperty('wind-arrows', 'visibility', windEnabled ? 'visible' : 'none');
    if (windEnabled) await fetchWindGrid();
  });
}

// ── Loading / error UI ───────────────────────────────────────────────────────

function showLoading(on) {
  document.getElementById('loading-overlay').classList.toggle('hidden', !on);
}

function showError() {
  document.getElementById('error-banner').style.display = 'block';
}

function hideError() {
  document.getElementById('error-banner').style.display = 'none';
}

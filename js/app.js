'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// Sign up at mapbox.com → Account → Tokens
// Sign up at firms.modaps.eosdis.nasa.gov/api/ for a free MAP_KEY
// ─────────────────────────────────────────────────────────────────────────────

const MAPBOX_TOKEN  = 'pk.eyJ1IjoibGthdmFuYWdoIiwiYSI6ImNtbW84Zm5wajBhOTQycXBzYWRnZ2lpZWMifQ.GeE2rQyJehYkAkibVLn7JA';
const FIRMS_MAP_KEY = 'eae26ae5e078792674f7cb1eac317a4b';

const FIRMS_URL = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_MAP_KEY}/VIIRS_SNPP_NRT/-141,41,-52,84/1`;

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
  PEI: [ -64.4, 45.9,  -62.0, 47.1],
  NL:  [ -67.8, 46.6,  -52.6, 60.4],
  YT:  [-141.0, 59.7, -124.0, 70.0],
  NT:  [-136.5, 59.9, -101.9, 78.8],
  NU:  [-120.6, 58.8,  -61.1, 83.1],
};

const PROVINCE_NAMES = {
  BC: 'British Columbia', AB: 'Alberta', SK: 'Saskatchewan',
  MB: 'Manitoba', ON: 'Ontario', QC: 'Quebec',
  NB: 'New Brunswick', NS: 'Nova Scotia', PEI: 'Prince Edward Island',
  NL: 'Newfoundland & Labrador', YT: 'Yukon',
  NT: 'Northwest Territories', NU: 'Nunavut',
};

// ── State ────────────────────────────────────────────────────────────────────

let map;
let allFires     = [];
let activeFilter = 'all';
let refreshTimer = null;

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

// Large zoom controls for touchscreen use
map.addControl(
  new mapboxgl.NavigationControl({ showCompass: false }),
  'top-left'
);

map.on('load', () => {
  addFireSource();
  addFireLayers();
  fetchFires();
  startRefresh();
  setupFilters();
  setupPanel();
  setupRefreshBtn();
});

// ── Data fetching ────────────────────────────────────────────────────────────

async function fetchFires() {
  setSpinning(true);
  showLoading(true);
  try {
    const res = await fetch(FIRMS_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    allFires = parseCSV(text);
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

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',');
  const idx     = h => headers.indexOf(h);

  const iLat  = idx('latitude');
  const iLon  = idx('longitude');
  const iDate = idx('acq_date');
  const iTime = idx('acq_time');
  const iConf = idx('confidence');
  const iFrp  = idx('frp');
  const iSat  = idx('satellite');
  const iDay  = idx('daynight');

  return lines.slice(1).flatMap(line => {
    const c   = line.split(',');
    const lat = parseFloat(c[iLat]);
    const lon = parseFloat(c[iLon]);
    if (isNaN(lat) || isNaN(lon)) return [];

    const rawTime = (c[iTime] || '').trim().padStart(4, '0');
    const time    = rawTime.slice(0, 2) + ':' + rawTime.slice(2);

    return [{
      lat,
      lon,
      frp:      parseFloat(c[iFrp]) || 0,
      conf:     (c[iConf] || '').trim().toLowerCase(),
      date:     (c[iDate] || '').trim(),
      time,
      satellite: (c[iSat] || '').trim(),
      daynight:  (c[iDay] || '').trim() === 'D' ? 'Daytime' : 'Nighttime',
      province:  detectProvince(lat, lon),
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
    clusterMaxZoom: 10,
    clusterRadius:  45,
  });
}

function addFireLayers() {
  // Cluster circles — colour shifts warmer as count grows
  map.addLayer({
    id:     'fire-clusters',
    type:   'circle',
    source: 'fires',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': [
        'step', ['get', 'point_count'],
        '#ef6201',  25,
        '#ef2601',  100,
        '#c81000'
      ],
      'circle-radius': [
        'step', ['get', 'point_count'],
        18, 25, 26, 100, 36
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
      'text-size':  13,
    },
    paint: { 'text-color': '#fff' },
  });

  // Individual fire points — size by FRP, colour by confidence
  map.addLayer({
    id:     'fire-points',
    type:   'circle',
    source: 'fires',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-radius': [
        'interpolate', ['linear'], ['get', 'frp'],
        0, 5,  50, 8,  200, 12,  1000, 18
      ],
      'circle-color': [
        'match', ['get', 'conf'],
        'high',    '#ff8c00',
        'nominal', '#ef2601',
        /* low */  '#818080'
      ],
      'circle-stroke-width': 1.5,
      'circle-stroke-color': 'rgba(255,255,255,0.2)',
      'circle-opacity': 0.9,
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

  // Touch/cursor feedback
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
  const fires  = filteredFires();
  const high   = fires.filter(f => f.conf === 'high').length;
  const provs  = new Set(fires.map(f => f.province).filter(Boolean)).size;
  const maxFrp = fires.reduce((m, f) => Math.max(m, f.frp), 0);

  document.getElementById('stat-total').textContent     = fires.length.toLocaleString();
  document.getElementById('stat-high').textContent      = high.toLocaleString();
  document.getElementById('stat-provinces').textContent = provs;
  document.getElementById('stat-frp').textContent       = maxFrp > 0 ? maxFrp.toFixed(0) : '—';
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

function showPanel(props) {
  const prov = props.province
    ? `${PROVINCE_NAMES[props.province] || props.province} (${props.province})`
    : 'Location unknown';

  const confLabel = { high: '🟠 High', nominal: '🟡 Nominal', low: '⚪ Low' }[props.conf] || props.conf;

  document.getElementById('panel-province').textContent   = prov;
  document.getElementById('panel-time').textContent       = `${props.date}  ·  ${props.time} UTC`;
  document.getElementById('panel-confidence').textContent = confLabel;
  document.getElementById('panel-frp').textContent        = props.frp > 0 ? `${parseFloat(props.frp).toFixed(1)} MW` : '—';
  document.getElementById('panel-satellite').textContent  = props.satellite || '—';
  document.getElementById('panel-daynight').textContent   = props.daynight || '—';
  document.getElementById('panel-coords').textContent     = `${parseFloat(props.lat).toFixed(4)}, ${parseFloat(props.lon).toFixed(4)}`;

  document.getElementById('fire-panel').classList.add('open');
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

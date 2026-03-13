'use strict';

const MAPBOX_TOKEN = 'pk.eyJ1IjoibGthdmFuYWdoIiwiYSI6ImNtbW84Zm5wajBhOTQycXBzYWRnZ2lpZWMifQ.GeE2rQyJehYkAkibVLn7JA';

// ── Sample data — replace with live API when available ───────────────────────
// Prices in ¢/L (regular unleaded)

const GAS_DATA = [
  // British Columbia
  { city: 'Vancouver',     province: 'BC', lat: 49.2827, lon: -123.1207, regular: 179.9, premium: 195.4, diesel: 192.3 },
  { city: 'Victoria',      province: 'BC', lat: 48.4284, lon: -123.3656, regular: 177.4, premium: 192.7, diesel: 189.8 },
  { city: 'Kelowna',       province: 'BC', lat: 49.8880, lon: -119.4960, regular: 174.2, premium: 189.6, diesel: 186.1 },
  { city: 'Prince George', province: 'BC', lat: 53.9171, lon: -122.7497, regular: 171.8, premium: 187.2, diesel: 183.5 },
  // Alberta
  { city: 'Calgary',       province: 'AB', lat: 51.0447, lon: -114.0719, regular: 155.2, premium: 170.6, diesel: 167.4 },
  { city: 'Edmonton',      province: 'AB', lat: 53.5461, lon: -113.4938, regular: 153.8, premium: 169.1, diesel: 165.9 },
  { city: 'Lethbridge',    province: 'AB', lat: 49.6956, lon: -112.8451, regular: 154.4, premium: 169.8, diesel: 166.3 },
  { city: 'Red Deer',      province: 'AB', lat: 52.2681, lon: -113.8112, regular: 154.1, premium: 169.4, diesel: 166.1 },
  // Saskatchewan
  { city: 'Saskatoon',     province: 'SK', lat: 52.1332, lon: -106.6700, regular: 158.3, premium: 173.7, diesel: 170.4 },
  { city: 'Regina',        province: 'SK', lat: 50.4452, lon: -104.6189, regular: 157.9, premium: 173.2, diesel: 169.8 },
  // Manitoba
  { city: 'Winnipeg',      province: 'MB', lat: 49.8951, lon:  -97.1384, regular: 162.4, premium: 177.8, diesel: 174.6 },
  // Ontario
  { city: 'Toronto',       province: 'ON', lat: 43.6532, lon:  -79.3832, regular: 161.8, premium: 177.1, diesel: 174.2 },
  { city: 'Ottawa',        province: 'ON', lat: 45.4215, lon:  -75.6972, regular: 163.2, premium: 178.5, diesel: 175.3 },
  { city: 'London',        province: 'ON', lat: 42.9849, lon:  -81.2453, regular: 160.4, premium: 175.8, diesel: 172.6 },
  { city: 'Thunder Bay',   province: 'ON', lat: 48.3809, lon:  -89.2477, regular: 165.1, premium: 180.4, diesel: 177.3 },
  { city: 'Sudbury',       province: 'ON', lat: 46.4917, lon:  -80.9930, regular: 163.7, premium: 179.1, diesel: 176.0 },
  // Quebec
  { city: 'Montreal',      province: 'QC', lat: 45.5017, lon:  -73.5673, regular: 165.7, premium: 181.0, diesel: 178.1 },
  { city: 'Quebec City',   province: 'QC', lat: 46.8139, lon:  -71.2082, regular: 163.4, premium: 178.7, diesel: 175.5 },
  { city: 'Sherbrooke',    province: 'QC', lat: 45.4042, lon:  -71.8929, regular: 161.9, premium: 177.2, diesel: 174.1 },
  // New Brunswick
  { city: 'Moncton',       province: 'NB', lat: 46.0878, lon:  -64.7782, regular: 166.4, premium: 181.7, diesel: 178.8 },
  { city: 'Fredericton',   province: 'NB', lat: 45.9636, lon:  -66.6431, regular: 164.8, premium: 180.1, diesel: 177.2 },
  { city: 'Saint John',    province: 'NB', lat: 45.2733, lon:  -66.0633, regular: 163.7, premium: 179.0, diesel: 176.1 },
  // Nova Scotia
  { city: 'Halifax',       province: 'NS', lat: 44.6488, lon:  -63.5752, regular: 168.9, premium: 184.2, diesel: 181.4 },
  { city: 'Sydney',        province: 'NS', lat: 46.1368, lon:  -60.1942, regular: 167.3, premium: 182.6, diesel: 179.8 },
  // PEI
  { city: 'Charlottetown', province: 'PE', lat: 46.2382, lon:  -63.1311, regular: 169.1, premium: 184.4, diesel: 181.7 },
  // Newfoundland
  { city: "St. John's",    province: 'NL', lat: 47.5615, lon:  -52.7126, regular: 171.4, premium: 186.7, diesel: 184.0 },
  // Yukon
  { city: 'Whitehorse',    province: 'YT', lat: 60.7212, lon: -135.0568, regular: 182.3, premium: 197.6, diesel: 194.9 },
  // NWT
  { city: 'Yellowknife',   province: 'NT', lat: 62.4540, lon: -114.3718, regular: 176.8, premium: 192.1, diesel: 189.4 },
];

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

// ── State ────────────────────────────────────────────────────────────────────

let map;
let activeFilter = 'all';

// ── Map init ─────────────────────────────────────────────────────────────────

mapboxgl.accessToken = MAPBOX_TOKEN;

map = new mapboxgl.Map({
  container:  'map',
  style:      'mapbox://styles/mapbox/light-v11',
  center:     [-96, 56],
  zoom:       3.5,
  minZoom:    2,
  maxZoom:    12,
  projection: 'mercator',
});

map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-left');

map.on('load', () => {
  addGasSource();
  addGasLayers();
  updateStats();
  setupFilters();
  setupPanel();
});

// ── Source & layers ──────────────────────────────────────────────────────────

function toGeoJSON(data) {
  return {
    type: 'FeatureCollection',
    features: data.map(d => ({
      type: 'Feature',
      geometry:   { type: 'Point', coordinates: [d.lon, d.lat] },
      properties: { ...d },
    })),
  };
}

function addGasSource() {
  map.addSource('gas', {
    type: 'geojson',
    data: toGeoJSON(filteredData()),
  });
}

function addGasLayers() {
  // Coloured circles
  map.addLayer({
    id:     'gas-circles',
    type:   'circle',
    source: 'gas',
    paint: {
      'circle-radius': 26,
      'circle-color': [
        'interpolate', ['linear'], ['get', 'regular'],
        150, '#22c55e',
        163, '#eab308',
        173, '#f97316',
        183, '#ef2601',
      ],
      'circle-stroke-width': 2,
      'circle-stroke-color': 'rgba(255,255,255,0.15)',
      'circle-opacity': 0.88,
    },
  });

  // Price label inside circle
  map.addLayer({
    id:     'gas-labels',
    type:   'symbol',
    source: 'gas',
    layout: {
      'text-field':          ['concat', ['to-string', ['get', 'regular']], '¢'],
      'text-size':           12,
      'text-font':           ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
      'text-allow-overlap':  true,
      'text-ignore-placement': true,
    },
    paint: { 'text-color': '#fff' },
  });

  // City name below circle
  map.addLayer({
    id:     'gas-city-labels',
    type:   'symbol',
    source: 'gas',
    layout: {
      'text-field':          ['get', 'city'],
      'text-size':           10,
      'text-font':           ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
      'text-offset':         [0, 2.4],
      'text-anchor':         'top',
      'text-allow-overlap':  false,
    },
    paint: {
      'text-color':      'rgba(30,30,30,0.85)',
      'text-halo-color': 'rgba(255,255,255,0.8)',
      'text-halo-width': 1,
    },
  });

  // Click to open panel
  map.on('click', 'gas-circles', e => {
    showPanel(e.features[0].properties);
  });

  map.on('mouseenter', 'gas-circles', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'gas-circles', () => { map.getCanvas().style.cursor = ''; });
}

function updateMap() {
  map.getSource('gas').setData(toGeoJSON(filteredData()));
}

// ── Stats ────────────────────────────────────────────────────────────────────

function filteredData() {
  if (activeFilter === 'all') return GAS_DATA;
  return GAS_DATA.filter(d => d.province === activeFilter);
}

function updateStats() {
  const data = filteredData();
  if (!data.length) return;

  const avgReg    = data.reduce((s, d) => s + d.regular, 0) / data.length;
  const avgDiesel = data.reduce((s, d) => s + d.diesel,  0) / data.length;
  const cheapest  = data.reduce((m, d) => d.regular < m.regular ? d : m, data[0]);
  const priciest  = data.reduce((m, d) => d.regular > m.regular ? d : m, data[0]);

  document.getElementById('stat-avg').textContent    = avgReg.toFixed(1);
  document.getElementById('stat-diesel').textContent = avgDiesel.toFixed(1);
  document.getElementById('stat-low').textContent    = `${cheapest.city}  ${cheapest.regular}¢`;
  document.getElementById('stat-high').textContent   = `${priciest.city}  ${priciest.regular}¢`;
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
        map.flyTo({ center: [-96, 56], zoom: 3.5, duration: 800 });
      }
    });
  });
}

// ── Detail panel ─────────────────────────────────────────────────────────────

function setupPanel() {
  document.getElementById('panel-close').addEventListener('click', hidePanel);
}

function showPanel(props) {
  const data    = filteredData();
  const avgReg  = data.reduce((s, d) => s + d.regular, 0) / data.length;
  const diff    = (props.regular - avgReg).toFixed(1);
  const diffStr = diff > 0 ? `+${diff}¢ above avg` : `${diff}¢ below avg`;
  const diffColor = diff > 0 ? '#ef2601' : '#22c55e';

  document.getElementById('panel-city').textContent    = props.city;
  document.getElementById('panel-province').textContent = props.province;
  document.getElementById('panel-regular').textContent  = `${props.regular}¢/L`;
  document.getElementById('panel-premium').textContent  = `${props.premium}¢/L`;
  document.getElementById('panel-diesel').textContent   = `${props.diesel}¢/L`;

  const vsEl = document.getElementById('panel-vs-avg');
  vsEl.textContent  = diffStr;
  vsEl.style.color  = diffColor;

  document.getElementById('gas-panel').classList.add('open');
}

function hidePanel() {
  document.getElementById('gas-panel').classList.remove('open');
}

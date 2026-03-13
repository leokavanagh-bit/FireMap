'use strict';

const MAPBOX_TOKEN = 'pk.eyJ1IjoibGthdmFuYWdoIiwiYSI6ImNtbW84Zm5wajBhOTQycXBzYWRnZ2lpZWMifQ.GeE2rQyJehYkAkibVLn7JA';

// ── Sample data — CREA MLS HPI benchmark prices (¢ in $000s) ────────────────
// benchmark = composite benchmark price ($)
// yoy       = year-over-year % change
// detached  = single-family detached benchmark ($)
// apartment = condo/apartment benchmark ($)

const HOUSING_DATA = [
  // British Columbia
  { city: 'Vancouver',     province: 'BC', lat: 49.2827, lon: -123.1207, benchmark: 1_168_000, yoy:  -3.2, detached: 1_892_000, apartment:  762_000 },
  { city: 'Victoria',      province: 'BC', lat: 48.4284, lon: -123.3656, benchmark:   877_000, yoy:  -1.8, detached: 1_124_000, apartment:  548_000 },
  { city: 'Kelowna',       province: 'BC', lat: 49.8880, lon: -119.4960, benchmark:   784_000, yoy:  -4.1, detached:   978_000, apartment:  472_000 },
  { city: 'Prince George', province: 'BC', lat: 53.9171, lon: -122.7497, benchmark:   412_000, yoy:   2.3, detached:   448_000, apartment:  248_000 },
  // Alberta
  { city: 'Calgary',       province: 'AB', lat: 51.0447, lon: -114.0719, benchmark:   594_000, yoy:   7.1, detached:   718_000, apartment:  330_000 },
  { city: 'Edmonton',      province: 'AB', lat: 53.5461, lon: -113.4938, benchmark:   432_000, yoy:   8.4, detached:   512_000, apartment:  206_000 },
  { city: 'Lethbridge',    province: 'AB', lat: 49.6956, lon: -112.8451, benchmark:   348_000, yoy:   5.9, detached:   392_000, apartment:  198_000 },
  { city: 'Red Deer',      province: 'AB', lat: 52.2681, lon: -113.8112, benchmark:   362_000, yoy:   6.2, detached:   408_000, apartment:  204_000 },
  // Saskatchewan
  { city: 'Saskatoon',     province: 'SK', lat: 52.1332, lon: -106.6700, benchmark:   382_000, yoy:   9.8, detached:   438_000, apartment:  218_000 },
  { city: 'Regina',        province: 'SK', lat: 50.4452, lon: -104.6189, benchmark:   328_000, yoy:   7.4, detached:   378_000, apartment:  186_000 },
  // Manitoba
  { city: 'Winnipeg',      province: 'MB', lat: 49.8951, lon:  -97.1384, benchmark:   372_000, yoy:   4.1, detached:   422_000, apartment:  224_000 },
  // Ontario
  { city: 'Toronto',       province: 'ON', lat: 43.6532, lon:  -79.3832, benchmark: 1_072_000, yoy:  -5.3, detached: 1_488_000, apartment:  672_000 },
  { city: 'Ottawa',        province: 'ON', lat: 45.4215, lon:  -75.6972, benchmark:   622_000, yoy:  -1.2, detached:   748_000, apartment:  388_000 },
  { city: 'Hamilton',      province: 'ON', lat: 43.2557, lon:  -79.8711, benchmark:   748_000, yoy:  -3.8, detached:   868_000, apartment:  458_000 },
  { city: 'London',        province: 'ON', lat: 42.9849, lon:  -81.2453, benchmark:   636_000, yoy:  -2.4, detached:   724_000, apartment:  382_000 },
  { city: 'Kitchener',     province: 'ON', lat: 43.4516, lon:  -80.4925, benchmark:   718_000, yoy:  -3.1, detached:   854_000, apartment:  432_000 },
  { city: 'Thunder Bay',   province: 'ON', lat: 48.3809, lon:  -89.2477, benchmark:   312_000, yoy:   6.8, detached:   348_000, apartment:  196_000 },
  // Quebec
  { city: 'Montreal',      province: 'QC', lat: 45.5017, lon:  -73.5673, benchmark:   528_000, yoy:   3.6, detached:   674_000, apartment:  388_000 },
  { city: 'Quebec City',   province: 'QC', lat: 46.8139, lon:  -71.2082, benchmark:   372_000, yoy:   4.8, detached:   448_000, apartment:  248_000 },
  { city: 'Sherbrooke',    province: 'QC', lat: 45.4042, lon:  -71.8929, benchmark:   318_000, yoy:   5.2, detached:   382_000, apartment:  212_000 },
  // New Brunswick
  { city: 'Moncton',       province: 'NB', lat: 46.0878, lon:  -64.7782, benchmark:   312_000, yoy:  11.4, detached:   348_000, apartment:  196_000 },
  { city: 'Fredericton',   province: 'NB', lat: 45.9636, lon:  -66.6431, benchmark:   286_000, yoy:   8.7, detached:   322_000, apartment:  182_000 },
  { city: 'Saint John',    province: 'NB', lat: 45.2733, lon:  -66.0633, benchmark:   268_000, yoy:   9.2, detached:   298_000, apartment:  172_000 },
  // Nova Scotia
  { city: 'Halifax',       province: 'NS', lat: 44.6488, lon:  -63.5752, benchmark:   488_000, yoy:   2.1, detached:   578_000, apartment:  328_000 },
  { city: 'Cape Breton',   province: 'NS', lat: 46.1368, lon:  -60.1942, benchmark:   228_000, yoy:  12.4, detached:   252_000, apartment:  148_000 },
  // Newfoundland
  { city: "St. John's",    province: 'NL', lat: 47.5615, lon:  -52.7126, benchmark:   332_000, yoy:   6.3, detached:   368_000, apartment:  212_000 },
  // Yukon
  { city: 'Whitehorse',    province: 'YT', lat: 60.7212, lon: -135.0568, benchmark:   568_000, yoy:   1.4, detached:   648_000, apartment:  342_000 },
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
  NL:  [ -67.8, 46.6,  -52.6, 60.4],
  YT:  [-141.0, 59.7, -124.0, 70.0],
};

// ── State ────────────────────────────────────────────────────────────────────

let map;
let activeFilter = 'all';

// ── Map init ─────────────────────────────────────────────────────────────────

mapboxgl.accessToken = MAPBOX_TOKEN;

map = new mapboxgl.Map({
  container:  'map',
  style:      'mapbox://styles/mapbox/dark-v11',
  center:     [-96, 56],
  zoom:       3.5,
  minZoom:    2,
  maxZoom:    12,
  projection: 'mercator',
});

map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-left');

map.on('load', () => {
  addHousingSource();
  addHousingLayers();
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

function addHousingSource() {
  map.addSource('housing', {
    type: 'geojson',
    data: toGeoJSON(filteredData()),
  });
}

function addHousingLayers() {
  // Coloured circles — price tiers
  map.addLayer({
    id:     'housing-circles',
    type:   'circle',
    source: 'housing',
    paint: {
      'circle-radius': 26,
      'circle-color': [
        'interpolate', ['linear'], ['get', 'benchmark'],
        300_000, '#22c55e',   // affordable
        550_000, '#eab308',   // moderate
        750_000, '#f97316',   // expensive
        1_000_000, '#ef2601', // very expensive
      ],
      'circle-stroke-width': 2,
      'circle-stroke-color': 'rgba(255,255,255,0.15)',
      'circle-opacity': 0.88,
    },
  });

  // Price label inside circle
  map.addLayer({
    id:     'housing-labels',
    type:   'symbol',
    source: 'housing',
    layout: {
      'text-field': [
        'case',
        ['>=', ['get', 'benchmark'], 1000000],
        ['concat', '$', ['number-format', ['/', ['get', 'benchmark'], 1000000], { 'max-fraction-digits': 1 }], 'M'],
        ['concat', '$', ['number-format', ['/', ['get', 'benchmark'], 1000],    { 'max-fraction-digits': 0 }], 'k'],
      ],
      'text-size':             12,
      'text-font':             ['DIN Offc Pro Bold', 'Arial Unicode MS Bold'],
      'text-allow-overlap':    true,
      'text-ignore-placement': true,
    },
    paint: { 'text-color': '#fff' },
  });

  // City name below circle
  map.addLayer({
    id:     'housing-city-labels',
    type:   'symbol',
    source: 'housing',
    layout: {
      'text-field':          ['get', 'city'],
      'text-size':           10,
      'text-font':           ['DIN Offc Pro Medium', 'Arial Unicode MS Regular'],
      'text-offset':         [0, 2.4],
      'text-anchor':         'top',
      'text-allow-overlap':  false,
    },
    paint: {
      'text-color':      'rgba(255,255,255,0.75)',
      'text-halo-color': 'rgba(0,0,0,0.5)',
      'text-halo-width': 1,
    },
  });

  map.on('click', 'housing-circles', e => {
    showPanel(e.features[0].properties);
  });

  map.on('mouseenter', 'housing-circles', () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', 'housing-circles', () => { map.getCanvas().style.cursor = ''; });
}

function updateMap() {
  map.getSource('housing').setData(toGeoJSON(filteredData()));
}

// ── Stats ────────────────────────────────────────────────────────────────────

function filteredData() {
  if (activeFilter === 'all') return HOUSING_DATA;
  return HOUSING_DATA.filter(d => d.province === activeFilter);
}

function formatPrice(n) {
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M';
  return '$' + Math.round(n / 1000) + 'k';
}

function updateStats() {
  const data = filteredData();
  if (!data.length) return;

  const avgBenchmark = data.reduce((s, d) => s + d.benchmark, 0) / data.length;
  const avgYoy       = data.reduce((s, d) => s + d.yoy, 0) / data.length;
  const cheapest     = data.reduce((m, d) => d.benchmark < m.benchmark ? d : m, data[0]);
  const priciest     = data.reduce((m, d) => d.benchmark > m.benchmark ? d : m, data[0]);

  document.getElementById('stat-avg').textContent  = formatPrice(avgBenchmark);
  document.getElementById('stat-high').textContent = `${priciest.city}  ${formatPrice(priciest.benchmark)}`;
  document.getElementById('stat-low').textContent  = `${cheapest.city}  ${formatPrice(cheapest.benchmark)}`;

  const yoyEl = document.getElementById('stat-yoy');
  yoyEl.textContent  = (avgYoy >= 0 ? '+' : '') + avgYoy.toFixed(1) + '%';
  yoyEl.className    = 'stat-value ' + (avgYoy >= 0 ? 'stat-value--red' : 'stat-value--green');
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
  const avgBench = data.reduce((s, d) => s + d.benchmark, 0) / data.length;
  const diff    = props.benchmark - avgBench;
  const pct     = ((diff / avgBench) * 100).toFixed(1);
  const diffStr = diff >= 0
    ? `+${formatPrice(diff)} (${pct}% above avg)`
    : `${formatPrice(diff)} (${Math.abs(pct)}% below avg)`;
  const diffColor = diff >= 0 ? '#ef2601' : '#22c55e';

  const yoy     = parseFloat(props.yoy);
  const yoyStr  = (yoy >= 0 ? '+' : '') + yoy.toFixed(1) + '%';
  const yoyColor = yoy >= 0 ? '#ef2601' : '#22c55e';

  document.getElementById('panel-city').textContent     = props.city;
  document.getElementById('panel-province').textContent = props.province;
  document.getElementById('panel-price').textContent    = formatPrice(props.benchmark);
  document.getElementById('panel-detached').textContent = formatPrice(props.detached);
  document.getElementById('panel-apartment').textContent = formatPrice(props.apartment);

  const yoyEl = document.getElementById('panel-yoy');
  yoyEl.textContent = yoyStr;
  yoyEl.style.color = yoyColor;

  const vsEl = document.getElementById('panel-vs-avg');
  vsEl.textContent = diffStr;
  vsEl.style.color = diffColor;

  document.getElementById('housing-panel').classList.add('open');
}

function hidePanel() {
  document.getElementById('housing-panel').classList.remove('open');
}

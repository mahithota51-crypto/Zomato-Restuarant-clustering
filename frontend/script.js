const API_BASE = window.location.port === '8001'
  ? `${window.location.protocol}//${window.location.hostname}:8000`
  : window.location.origin;
const DASHBOARD_URL = `${API_BASE}/dashboard`;
const RECOMMEND_URL = `${API_BASE}/recommend`;
const COLORS = ['#3976bd', '#20a37a', '#d99526', '#8b6cc1'];
const PERSONAS = [
  { name: 'Luxury Fine Dining', description: 'Higher spend and top-rated experiences.', color: COLORS[0] },
  { name: 'Budget Champions', description: 'Affordable venues with strong customer ratings.', color: COLORS[1] },
  { name: 'Mainstream Family', description: 'Mid-range restaurants for everyday dining.', color: COLORS[2] },
  { name: 'Critical Attention', description: 'Venues with ratings that may benefit from review.', color: COLORS[3] },
];
const state = { restaurants: [], filtered: [], dashboard: null, listView: false, toastTimer: null, budgetMax: 3000 };
const byId = (id) => document.getElementById(id);
const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const safe = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function personaIndex(restaurant) {
  const cost = Number(restaurant.Cost) || 0;
  const rating = Number(restaurant.average_rating) || 0;
  if (rating < 3.4) return 3;
  if (cost >= 1200 && rating >= 3.8) return 0;
  if (cost <= 650 && rating >= 3.5) return 1;
  return 2;
}

function restaurantCard(restaurant, recommendation = false) {
  const persona = PERSONAS[personaIndex(restaurant)];
  const score = recommendation ? `<span class="persona-pill">Match ${Math.round((Number(restaurant.recommendation_score) || 0) * 100)}%</span>` : `<span class="persona-pill">${safe(persona.name)}</span>`;
  return `<article class="restaurant-card" data-name="${safe(restaurant.Name)}">
    <div class="restaurant-card-top"><span class="rating-chip"><i class="fa-solid fa-star"></i>${Number(restaurant.average_rating || 0).toFixed(1)}</span><span class="cost-label">${money(restaurant.Cost)} for two</span></div>
    <h3>${safe(restaurant.Name)}</h3><p class="restaurant-cuisines">${safe(restaurant.Cuisines || 'Cuisine not listed')}</p>
    <div class="restaurant-card-bottom">${score}<span class="restaurant-reviews">${Number(restaurant.review_count || 0).toLocaleString()} reviews</span>
      <div class="card-actions"><button type="button" data-action="details" data-name="${safe(restaurant.Name)}">Details</button><button type="button" data-action="similar" data-name="${safe(restaurant.Name)}">Similar</button></div>
    </div></article>`;
}

function setApiStatus(message, isError = false) {
  const status = byId('api-status');
  status.classList.toggle('error', isError);
  status.querySelector('span:last-child').textContent = message;
}

function drawCanvas(id, draw) {
  const canvas = byId(id);
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(rect.width * ratio);
  canvas.height = Math.floor(rect.height * ratio);
  const context = canvas.getContext('2d');
  context.scale(ratio, ratio);
  draw(context, rect.width, rect.height);
}

function drawScatter(id) {
  const rows = state.restaurants;
  const palette = getComputedStyle(document.body);
  drawCanvas(id, (ctx, width, height) => {
    const pad = { left: 40, right: 13, top: 12, bottom: 30 };
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;
    const costs = rows.map((row) => Number(row.Cost) || 0);
    const maxCost = Math.max(1000, ...costs) * 1.04;
    ctx.clearRect(0, 0, width, height);
    ctx.font = '9px Inter, sans-serif';
    ctx.strokeStyle = palette.getPropertyValue('--line').trim();
    ctx.fillStyle = palette.getPropertyValue('--muted').trim();
    for (let tick = 0; tick <= 4; tick += 1) {
      const y = pad.top + plotHeight * tick / 4;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(width - pad.right, y); ctx.stroke();
      ctx.fillText((5 - tick).toFixed(1), 5, y + 3);
    }
    for (let tick = 0; tick <= 4; tick += 1) {
      const x = pad.left + plotWidth * tick / 4;
      ctx.fillText(money(maxCost * tick / 4), x - 13, height - 8);
    }
    rows.forEach((row) => {
      const rating = Math.max(1, Math.min(5, Number(row.average_rating) || 1));
      const x = pad.left + ((Number(row.Cost) || 0) / maxCost) * plotWidth;
      const y = pad.top + ((5 - rating) / 4) * plotHeight;
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fillStyle = COLORS[personaIndex(row)]; ctx.globalAlpha = .76; ctx.fill();
    });
    ctx.globalAlpha = 1;
  });
}

function drawDonut() {
  const values = state.dashboard?.sentiment || [];
  const colors = ['#20a37a', '#d99526', '#e23744'];
  drawCanvas('sentiment-donut', (ctx, width, height) => {
    const total = values.reduce((sum, item) => sum + item.count, 0) || 1;
    let angle = -Math.PI / 2;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * .39;
    values.forEach((item, index) => {
      const end = angle + (item.count / total) * Math.PI * 2;
      ctx.beginPath(); ctx.arc(centerX, centerY, radius, angle, end); ctx.arc(centerX, centerY, radius * .68, end, angle, true); ctx.closePath();
      ctx.fillStyle = colors[index]; ctx.fill(); angle = end;
    });
  });
  const total = values.reduce((sum, item) => sum + item.count, 0);
  byId('donut-total').textContent = total.toLocaleString();
  byId('sentiment-legend').innerHTML = values.map((item, index) => `<span class="legend-item"><i class="legend-swatch" style="background:${colors[index]}"></i>${safe(item.label)} ${item.percent}%</span>`).join('');
}

function drawCuisineBars() {
  const cuisines = state.dashboard?.popular_cuisines || [];
  drawCanvas('cuisine-bars', (ctx, width, height) => {
    const left = 100; const right = 24; const rowHeight = Math.min(25, (height - 10) / Math.max(cuisines.length, 1));
    const max = Math.max(...cuisines.map((item) => item.count), 1);
    ctx.font = '9px Inter, sans-serif';
    cuisines.forEach((item, index) => {
      const y = index * rowHeight + 5;
      ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--muted');
      ctx.textAlign = 'right'; ctx.fillText(item.name.length > 17 ? `${item.name.slice(0, 16)}…` : item.name, left - 8, y + 10);
      ctx.textAlign = 'left'; ctx.fillStyle = '#f2e3e5'; ctx.fillRect(left, y, width - left - right, 11);
      ctx.fillStyle = index % 2 ? '#d99526' : '#e23744'; ctx.fillRect(left, y, (width - left - right) * item.count / max, 11);
      ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--muted'); ctx.fillText(item.count, left + (width - left - right) * item.count / max + 5, y + 10);
    });
  });
}

function personaRows() {
  return PERSONAS.map((persona, index) => {
    const rows = state.restaurants.filter((restaurant) => personaIndex(restaurant) === index);
    const avgCost = rows.length ? rows.reduce((sum, row) => sum + Number(row.Cost || 0), 0) / rows.length : 0;
    const avgRating = rows.length ? rows.reduce((sum, row) => sum + Number(row.average_rating || 0), 0) / rows.length : 0;
    return { ...persona, index, rows, avgCost, avgRating };
  });
}

function renderPersonas() {
  const personas = personaRows();
  const total = state.restaurants.length || 1;
  const distribution = byId('persona-distribution');
  if (distribution) distribution.innerHTML = personas.map((item) => `<div class="distribution-item"><div class="distribution-top"><span>${safe(item.name)}</span><span>${item.rows.length}</span></div><strong>${(item.rows.length / total * 100).toFixed(0)}%</strong><div class="distribution-bar"><span style="width:${item.rows.length / total * 100}%;background:${item.color}"></span></div></div>`).join('');
  const cards = byId('persona-cards');
  if (cards) cards.innerHTML = personas.map((item) => `<article class="surface persona-card" style="--persona-color:${item.color}"><div class="persona-card-head"><span>Cluster ${item.index}</span><span>${item.rows.length} venues</span></div><h3>${safe(item.name)}</h3><div class="persona-stats"><div><span>Avg cost</span><strong>${money(item.avgCost)}</strong></div><div><span>Avg rating</span><strong>${item.avgRating.toFixed(2)}★</strong></div></div><p>${safe(item.description)}</p></article>`).join('');
  const legend = byId('cluster-legend');
  if (legend) legend.innerHTML = personas.map((item) => `<span class="legend-item"><i class="legend-swatch" style="background:${item.color}"></i>${safe(item.name)}</span>`).join('');
  const bars = byId('cluster-bars');
  if (bars) bars.innerHTML = personas.map((item) => `<div class="cluster-bar-row"><span class="cluster-bar-label">${safe(item.name)}</span><span class="cluster-bar-track"><span style="width:${Math.max(4, item.avgRating / 5 * 100)}%;background:${item.color}"></span></span><span class="cluster-bar-value">${item.avgRating.toFixed(2)}★</span></div>`).join('');
}

function populateFilters() {
  const cuisines = [...new Set(state.restaurants.flatMap((row) => String(row.Cuisines || '').split(',').map((value) => value.trim()).filter(Boolean)))].sort((a, b) => a.localeCompare(b));
  const cuisineFilter = byId('cuisine-filter');
  const recommendCuisine = byId('recommend-cuisine');
  cuisines.forEach((cuisine) => {
    if (cuisineFilter) cuisineFilter.add(new Option(cuisine, cuisine));
    if (recommendCuisine) recommendCuisine.add(new Option(cuisine, cuisine));
  });
  const personaFilter = byId('persona-filter');
  if (personaFilter) PERSONAS.forEach((persona, index) => personaFilter.add(new Option(`Cluster ${index}: ${persona.name}`, String(index))));
  const budgetInput = byId('budget-filter');
  const budgetCustom = byId('budget-custom');
  const budgetTier = byId('budget-tier');
  const maximumCost = Math.max(0, ...state.restaurants.map((row) => Number(row.Cost) || 0));
  state.budgetMax = Math.ceil(maximumCost / 100) * 100 || 3000;
  if (budgetInput) {
    budgetInput.max = String(state.budgetMax);
    budgetInput.value = String(state.budgetMax);
  }
  if (budgetCustom) {
    budgetCustom.max = String(state.budgetMax);
    budgetCustom.value = String(state.budgetMax);
  }
  if (budgetTier) {
    const levels = [500, 1000, 1500, 2000, 2500, 3000].filter((level) => level < state.budgetMax);
    budgetTier.innerHTML = `<option value="all">Any budget</option>${levels.map((level) => `<option value="${level}">Up to ${money(level)}</option>`).join('')}<option value="custom">Custom amount</option>`;
  }
  const seeds = [...state.restaurants].sort((a, b) => a.Name.localeCompare(b.Name));
  if (recommendCuisine) recommendCuisine.dataset.cuisineOptions = cuisines.join('|');
  const simulatorCuisines = byId('sim-cuisines');
  if (simulatorCuisines) {
    simulatorCuisines.setAttribute('list', 'cuisine-list');
    const list = document.createElement('datalist'); list.id = 'cuisine-list'; list.innerHTML = cuisines.map((cuisine) => `<option value="${safe(cuisine)}"></option>`).join(''); document.body.append(list);
  }
  return seeds;
}

function renderExplorer() {
  const search = byId('restaurant-search').value.trim().toLowerCase();
  const cuisine = byId('cuisine-filter').value;
  const persona = byId('persona-filter').value;
  const maxCost = Number(byId('budget-filter').value);
  const minRating = Number(byId('rating-filter').value);
  const sort = byId('sort-filter').value;
  let rows = state.restaurants.filter((row) => {
    const matchesSearch = !search || `${row.Name} ${row.Cuisines}`.toLowerCase().includes(search);
    return matchesSearch && (!cuisine || String(row.Cuisines || '').toLowerCase().includes(cuisine.toLowerCase())) && (!persona || personaIndex(row) === Number(persona)) && Number(row.Cost || 0) <= maxCost && Number(row.average_rating || 0) >= minRating;
  });
  const sorters = { 'rating-desc': (a, b) => b.average_rating - a.average_rating, 'rating-asc': (a, b) => a.average_rating - b.average_rating, 'cost-asc': (a, b) => a.Cost - b.Cost, 'cost-desc': (a, b) => b.Cost - a.Cost, 'name-asc': (a, b) => a.Name.localeCompare(b.Name) };
  rows.sort(sorters[sort] || sorters['rating-desc']);
  state.filtered = rows;
  byId('budget-output').textContent = byId('budget-tier').value === 'all' ? `Any · ${money(state.budgetMax)} max` : `Up to ${money(maxCost)}`;
  byId('explorer-count').textContent = `Showing ${rows.length} of ${state.restaurants.length} restaurants`;
  const grid = byId('restaurant-grid');
  grid.classList.toggle('list-view', state.listView);
  grid.innerHTML = rows.length ? rows.map((row) => restaurantCard(row)).join('') : '<div class="empty-state">No restaurants match these filters. Adjust the filters and try again.</div>';
}

function renderHypotheses() {
  const rows = state.restaurants;
  const premium = rows.filter((row) => Number(row.Cost) >= 1000);
  const affordable = rows.filter((row) => Number(row.Cost) < 1000);
  const avg = (items) => items.length ? items.reduce((sum, row) => sum + Number(row.average_rating || 0), 0) / items.length : 0;
  const premiumBadged = rows.filter((row) => /gold curated|top-rated/i.test(row.Collections || ''));
  const withReviews = rows.filter((row) => Number(row.review_count) > 0);
  const cards = [
    { title: 'Cost and dining rating', question: 'Do higher-cost venues have a different average restaurant rating?', leftLabel: '₹1,000+ avg rating', left: avg(premium), rightLabel: 'Under ₹1,000 avg rating', right: avg(affordable), conclusion: `${premium.length} higher-cost and ${affordable.length} lower-cost restaurants compared. Descriptive comparison only.` },
    { title: 'Curated collections and ratings', question: 'How do curated or top-rated listings compare in this dataset?', leftLabel: 'Collection-tagged avg', left: avg(premiumBadged), rightLabel: 'Other listings avg', right: avg(rows.filter((row) => !/gold curated|top-rated/i.test(row.Collections || ''))), conclusion: `${premiumBadged.length} venues include a Gold Curated or Top-Rated collection tag.` },
    { title: 'Review coverage', question: 'How consistently do restaurants have review records?', leftLabel: 'With review data', left: withReviews.length, rightLabel: 'No matched reviews', right: rows.length - withReviews.length, conclusion: `${withReviews.length} of ${rows.length} restaurants match at least one review record.` },
  ];
  byId('hypothesis-cards').innerHTML = cards.map((item, index) => `<article class="surface hypothesis-card"><div class="test-status"><span><i class="fa-solid fa-circle-check"></i> Data comparison</span><span>Question ${index + 1}</span></div><h3>${safe(item.title)}</h3><p>${safe(item.question)}</p><div class="hypothesis-stats"><div><span>${safe(item.leftLabel)}</span><strong>${index === 2 ? Number(item.left).toLocaleString() : Number(item.left).toFixed(2) + '★'}</strong></div><div><span>${safe(item.rightLabel)}</span><strong>${index === 2 ? Number(item.right).toLocaleString() : Number(item.right).toFixed(2) + '★'}</strong></div></div><p class="hypothesis-conclusion">${safe(item.conclusion)}</p></article>`).join('');
}

function updateMetrics(summary) {
  byId('metric-restaurants').textContent = Number(summary.restaurant_count).toLocaleString();
  byId('metric-reviews').textContent = Number(summary.review_count).toLocaleString();
  byId('metric-rating').textContent = `${Number(summary.average_rating).toFixed(2)}★`;
  byId('metric-cost').textContent = money(summary.average_cost);
  byId('metric-positive').textContent = `${Number(summary.positive_pct).toFixed(1)}%`;
}

function renderDashboard() {
  if (!state.dashboard) return;
  if (byId('metric-restaurants')) updateMetrics(state.dashboard.summary);
  if (byId('persona-distribution') || byId('persona-cards') || byId('cluster-legend') || byId('cluster-bars')) renderPersonas();
  if (byId('overview-scatter')) drawScatter('overview-scatter');
  if (byId('cluster-scatter')) drawScatter('cluster-scatter');
  if (byId('sentiment-donut')) drawDonut();
  if (byId('cuisine-bars')) drawCuisineBars();
  if (byId('restaurant-grid')) renderExplorer();
  if (byId('hypothesis-cards')) renderHypotheses();
}

async function loadDashboard() {
  try {
    const response = await fetch(DASHBOARD_URL);
    if (!response.ok) throw new Error(`Dashboard request failed (${response.status})`);
    state.dashboard = await response.json();
    state.restaurants = state.dashboard.restaurants || [];
    populateFilters();
    renderDashboard();
    setApiStatus('REST API connected');
    const cuisine = new URLSearchParams(window.location.search).get('cuisine');
    if (cuisine && byId('recommendation-form')) {
      byId('recommend-cuisine').value = cuisine;
      byId('recommend-budget').value = new URLSearchParams(window.location.search).get('max_cost') || '';
      byId('recommend-rating').value = '0';
      recommend(byId('recommend-cuisine').value, byId('recommend-budget').value, 0, byId('recommend-count').value);
    }
  } catch (error) {
    console.error(error);
    setApiStatus('Local API unavailable', true);
    if (byId('explorer-count')) byId('explorer-count').textContent = 'Start the FastAPI service to load local restaurant data.';
    if (byId('restaurant-grid')) byId('restaurant-grid').innerHTML = '<div class="empty-state">Could not connect to the local API. Start it at http://127.0.0.1:8000 and refresh this page.</div>';
    showToast('Local API is not running.');
  }
}

function showToast(message) {
  const toast = byId('toast'); toast.textContent = message; toast.classList.add('visible');
  clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
}

function openDetails(name) {
  const row = state.restaurants.find((restaurant) => restaurant.Name === name);
  if (!row) return;
  const dialog = byId('restaurant-dialog');
  const persona = PERSONAS[personaIndex(row)];
  byId('dialog-content').innerHTML = `<div class="dialog-content"><span class="section-kicker">RESTAURANT PROFILE</span><h2>${safe(row.Name)}</h2><p>${safe(row.Cuisines || 'Cuisine not listed')}</p><div class="dialog-facts"><div><span>Average rating</span><strong>${Number(row.average_rating || 0).toFixed(2)}★</strong></div><div><span>Cost for two</span><strong>${money(row.Cost)}</strong></div><div><span>Review records</span><strong>${Number(row.review_count || 0).toLocaleString()}</strong></div><div><span>Persona</span><strong>${safe(persona.name)}</strong></div></div><p><strong>Collections:</strong> ${safe(row.Collections || 'No collection tags')}</p><p><strong>Timings:</strong> ${safe(row.Timings || 'Not listed')}</p>${row.Links ? `<a class="button button-primary" href="${safe(row.Links)}" target="_blank" rel="noopener noreferrer">Open restaurant link <i class="fa-solid fa-arrow-up-right-from-square"></i></a>` : ''}</div>`;
  dialog.showModal();
}

async function recommend(cuisine, maxCost, minRating, topN) {
  const status = byId('recommendation-status');
  const results = byId('recommendation-results');
  status.textContent = 'Finding restaurant matches…'; results.innerHTML = '';
  try {
    const response = await fetch(RECOMMEND_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cuisine: cuisine || null, max_cost: maxCost === '' ? null : Number(maxCost), min_rating: Number(minRating), top_n: Number(topN) }) });
    if (!response.ok) throw new Error('Recommendation request failed.');
    const data = await response.json(); const rows = data.recommendations || [];
    status.textContent = rows.length ? `${rows.length} matches, ranked by the local recommendation model.` : 'No restaurants matched. Try a different cuisine, budget, or rating.';
    results.innerHTML = rows.length ? rows.map((row) => restaurantCard(row, true)).join('') : '';
  } catch (error) {
    console.error(error); status.textContent = 'Could not reach the recommendation API. Check that the local backend is running.';
  }
}

const ASPECTS = {
  'Food & taste': ['food', 'taste', 'meal', 'dish', 'biryani', 'pizza', 'delicious', 'tasty', 'bland', 'cold', 'fresh', 'flavour', 'flavor'],
  'Ambience & vibe': ['ambience', 'ambiance', 'vibe', 'decor', 'atmosphere', 'music', 'comfortable', 'clean'],
  'Service & staff': ['service', 'staff', 'waiter', 'waitress', 'slow', 'delayed', 'friendly', 'rude', 'attentive'],
  'Value & pricing': ['price', 'pricing', 'value', 'cost', 'bill', 'expensive', 'cheap', 'affordable', 'overpriced'],
};
const POSITIVE_WORDS = new Set(['delicious', 'tasty', 'excellent', 'great', 'good', 'lovely', 'friendly', 'wonderful', 'fresh', 'clean', 'comfortable', 'attentive', 'affordable', 'fantastic', 'perfect', 'amazing', 'fast']);
const NEGATIVE_WORDS = new Set(['bad', 'poor', 'bland', 'cold', 'slow', 'delayed', 'rude', 'dirty', 'expensive', 'overpriced', 'awful', 'terrible', 'stale', 'worst', 'unfriendly']);

function analyzeReview() {
  const words = byId('review-input').value.toLowerCase().match(/[a-z]+/g) || [];
  if (!words.length) { showToast('Enter a review before analyzing.'); return; }
  const negated = (index) => words.slice(Math.max(0, index - 3), index).some((word) => ['not', 'never', 'no', "wasn't", "isn't"].includes(word));
  let total = 0;
  const results = Object.entries(ASPECTS).map(([aspect, terms]) => {
    let score = 0; let matches = 0;
    words.forEach((word, index) => {
      if (!terms.includes(word) && !POSITIVE_WORDS.has(word) && !NEGATIVE_WORDS.has(word)) return;
      if (!terms.includes(word) && !words.slice(Math.max(0, index - 3), index + 1).some((near) => terms.includes(near))) return;
      if (POSITIVE_WORDS.has(word)) score += negated(index) ? -1 : 1;
      if (NEGATIVE_WORDS.has(word)) score += negated(index) ? 1 : -1;
      if (terms.includes(word)) matches += 1;
    });
    const value = matches ? Math.max(-1, Math.min(1, score / Math.max(matches, 1))) : 0;
    if (matches) total += value;
    return { aspect, value, matches };
  });
  const overall = Math.max(-1, Math.min(1, total / Math.max(results.filter((item) => item.matches).length, 1)));
  byId('aspect-results').innerHTML = results.map((item) => {
    const label = !item.matches ? 'No aspect found' : item.value > .12 ? 'Positive' : item.value < -.12 ? 'Negative' : 'Mixed / neutral';
    const className = !item.matches || Math.abs(item.value) <= .12 ? 'neutral' : item.value > .12 ? 'positive' : 'negative';
    return `<div class="aspect-row"><span>${safe(item.aspect)}</span><strong class="${className}">${item.matches ? `${item.value > 0 ? '+' : ''}${item.value.toFixed(2)} · ` : ''}${label}</strong></div>`;
  }).join('');
  const label = overall > .12 ? 'Positive overall sentiment' : overall < -.12 ? 'Critical overall sentiment' : 'Mixed or neutral sentiment';
  byId('overall-score').textContent = `${overall > 0 ? '+' : ''}${overall.toFixed(2)}`;
  byId('overall-label').textContent = label;
  byId('score-fill').style.width = `${(overall + 1) * 50}%`;
  byId('score-fill').style.background = overall > .12 ? 'var(--green)' : overall < -.12 ? 'var(--primary)' : 'var(--gold)';
}

function downloadCsv() {
  if (!state.restaurants.length) { showToast('Restaurant data has not loaded yet.'); return; }
  const columns = ['Name', 'Cost', 'average_rating', 'review_count', 'Cuisines', 'Collections', 'Timings', 'Links'];
  const csv = [columns.join(','), ...state.restaurants.map((row) => columns.map((key) => `"${String(row[key] ?? '').replace(/"/g, '""')}"`).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = 'zomato-restaurant-details.csv'; link.click(); URL.revokeObjectURL(url);
}

const listen = (id, type, handler) => byId(id)?.addEventListener(type, handler);
['restaurant-search', 'cuisine-filter', 'persona-filter', 'rating-filter', 'sort-filter'].forEach((id) => {
  listen(id, id === 'restaurant-search' ? 'input' : 'change', renderExplorer);
});
listen('budget-filter', 'input', () => {
  byId('budget-custom').value = byId('budget-filter').value;
  byId('budget-tier').value = 'custom';
  renderExplorer();
});
listen('budget-custom', 'input', () => {
  const input = byId('budget-custom');
  const value = Math.min(state.budgetMax, Math.max(0, Number(input.value) || 0));
  input.value = String(value);
  byId('budget-filter').value = String(value);
  byId('budget-tier').value = 'custom';
  renderExplorer();
});
listen('budget-tier', 'change', () => {
  if (byId('budget-tier').value !== 'custom') {
    const value = byId('budget-tier').value === 'all' ? state.budgetMax : byId('budget-tier').value;
    byId('budget-filter').value = value;
    byId('budget-custom').value = value;
  }
  renderExplorer();
});
listen('grid-view', 'click', () => { state.listView = false; byId('grid-view').classList.add('active'); byId('list-view').classList.remove('active'); renderExplorer(); });
listen('list-view', 'click', () => { state.listView = true; byId('list-view').classList.add('active'); byId('grid-view').classList.remove('active'); renderExplorer(); });
listen('clear-filters', 'click', () => { byId('restaurant-search').value = ''; byId('cuisine-filter').value = ''; byId('persona-filter').value = ''; byId('budget-filter').value = String(state.budgetMax); byId('budget-custom').value = String(state.budgetMax); byId('budget-tier').value = 'all'; byId('rating-filter').value = '0'; byId('sort-filter').value = 'rating-desc'; renderExplorer(); });
listen('restaurant-grid', 'click', (event) => {
  const button = event.target.closest('[data-action]'); if (!button) return;
  const row = state.restaurants.find((restaurant) => restaurant.Name === button.dataset.name); if (!row) return;
  if (button.dataset.action === 'details') openDetails(row.Name);
  else {
    const url = new URL('recommender.html', window.location.href);
    url.searchParams.set('cuisine', (row.Cuisines || '').split(',')[0].trim());
    url.searchParams.set('max_cost', String(Number(row.Cost) || ''));
    window.location.href = url.toString();
  }
});
listen('recommendation-results', 'click', (event) => { const button = event.target.closest('[data-action="details"]'); if (button) openDetails(button.dataset.name); });
listen('recommendation-form', 'submit', (event) => { event.preventDefault(); recommend(byId('recommend-cuisine').value, byId('recommend-budget').value, byId('recommend-rating').value, byId('recommend-count').value); });
listen('persona-form', 'submit', (event) => {
  event.preventDefault(); const sample = { Cost: Number(byId('sim-cost').value), average_rating: Number(byId('sim-rating').value) }; const index = personaIndex(sample); const persona = PERSONAS[index];
  const result = byId('persona-result'); result.innerHTML = `<strong>Cluster ${index}: ${safe(persona.name)}</strong> · ${safe(persona.description)} <span> Profile: ${safe(byId('sim-cuisines').value || 'Cuisines not specified')}.</span>`; result.classList.add('visible');
});
listen('analyze-review', 'click', analyzeReview);
document.querySelectorAll('[data-sample]').forEach((button) => button.addEventListener('click', () => { byId('review-input').value = button.dataset.sample; analyzeReview(); }));
listen('download-csv', 'click', downloadCsv);
listen('dialog-close', 'click', () => byId('restaurant-dialog').close());
listen('restaurant-dialog', 'click', (event) => { if (event.target === byId('restaurant-dialog')) byId('restaurant-dialog').close(); });
listen('theme-toggle', 'click', () => { document.body.classList.toggle('dark'); localStorage.setItem('zomato-theme', document.body.classList.contains('dark') ? 'dark' : 'light'); byId('theme-toggle').innerHTML = `<i class="fa-regular fa-${document.body.classList.contains('dark') ? 'sun' : 'moon'}"></i>`; if (state.dashboard) renderDashboard(); });
if (localStorage.getItem('zomato-theme') === 'dark') { document.body.classList.add('dark'); byId('theme-toggle').innerHTML = '<i class="fa-regular fa-sun"></i>'; }
window.addEventListener('resize', () => { if (state.dashboard) { drawScatter('overview-scatter'); drawScatter('cluster-scatter'); drawDonut(); drawCuisineBars(); } });
if (document.body.dataset.loadDashboard === 'true') loadDashboard();

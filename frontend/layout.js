const PAGE_CONFIG = {
  overview: { file: 'overview.html', section: '01 / OVERVIEW', title: 'Restaurant intelligence at a glance', description: 'A data-led snapshot of Hyderabad restaurants and customer reviews.', icon: 'fa-solid fa-chart-pie', dashboard: true },
  explorer: { file: 'explorer.html', section: '02 / DISCOVER', title: 'Restaurant explorer', description: 'Search and compare restaurants from the local dataset.', icon: 'fa-solid fa-compass', dashboard: true },
  clustering: { file: 'clustering.html', section: '03 / SEGMENTATION', title: 'Restaurant clustering', description: 'Explore cost and rating personas calculated from local restaurant data.', icon: 'fa-solid fa-cubes-stacked', dashboard: true },
  sentiment: { file: 'sentiment.html', section: '04 / CUSTOMER VOICE', title: 'Review sentiment intelligence', description: 'Analyze review language across food, ambience, service, and value.', icon: 'fa-solid fa-brain', dashboard: false },
  recommender: { file: 'recommender.html', section: '05 / PERSONALIZATION', title: 'AI restaurant recommender', description: 'Find cuisine matches ranked by the local content-based recommendation model.', icon: 'fa-solid fa-wand-magic-sparkles', dashboard: true },
  hypothesis: { file: 'hypothesis.html', section: '06 / EVIDENCE', title: 'Data questions & evidence', description: 'Dataset-backed comparisons. These summaries are descriptive, not causal claims.', icon: 'fa-solid fa-flask', dashboard: true },
  strategies: { file: 'strategies.html', section: '07 / ACTION', title: 'Strategic initiatives', description: 'Practical opportunities suggested by the restaurant and review data.', icon: 'fa-regular fa-lightbulb', dashboard: false },
};

const currentPage = document.body.dataset.page || 'overview';
const page = PAGE_CONFIG[currentPage] || PAGE_CONFIG.overview;
const section = document.querySelector('[data-page-content]');
const navigation = [
  ['overview', 'Overview', 'fa-solid fa-chart-pie'],
  ['explorer', 'Explorer', 'fa-solid fa-compass'],
  ['clustering', 'Clustering', 'fa-solid fa-cubes-stacked'],
  ['sentiment', 'Sentiment', 'fa-solid fa-brain'],
  ['recommender', 'Recommender', 'fa-solid fa-wand-magic-sparkles'],
  ['hypothesis', 'Evidence', 'fa-solid fa-flask'],
  ['strategies', 'Strategies', 'fa-regular fa-lightbulb'],
];

const sidebar = document.createElement('aside');
sidebar.className = 'sidebar';
sidebar.setAttribute('aria-label', 'Main navigation');
sidebar.innerHTML = `
  <a class="brand-mark" href="overview.html" aria-label="Zomato Intelligence home" title="Zomato Intelligence"><i class="fa-solid fa-utensils"></i></a>
  <nav class="side-nav">${navigation.map(([key, label, icon]) => `<a class="nav-link${key === currentPage ? ' active' : ''}" href="${PAGE_CONFIG[key].file}" aria-label="${label}" title="${label}"${key === currentPage ? ' aria-current="page"' : ''}><i class="${icon}"></i><span>${label}</span></a>`).join('')}</nav>
  <button class="theme-toggle" id="theme-toggle" type="button" aria-label="Toggle dark mode" title="Toggle theme"><i class="fa-regular fa-moon"></i></button>`;

const header = document.createElement('header');
header.className = 'page-heading';
header.id = 'page-top';
header.innerHTML = `
  <div>
    <div class="eyebrow"><span class="eyebrow-dot"></span> ZOMATO DATA INTELLIGENCE / ${page.section}</div>
    <h1><i class="${page.icon}"></i> ${page.title}</h1>
    <p>${page.description}</p>
  </div>
  <div class="heading-actions">
    <span id="api-status" class="api-status"><span class="status-dot"></span><span>${page.dashboard ? 'Connecting to local API' : 'Local analysis ready'}</span></span>
    ${page.dashboard ? '<button class="button button-quiet" id="download-csv" type="button"><i class="fa-solid fa-download"></i><span>Download restaurant details</span></button>' : ''}
    ${currentPage === 'recommender' ? '' : '<a class="button button-primary" href="recommender.html"><i class="fa-solid fa-bolt"></i><span>AI Recommender</span></a>'}
  </div>`;

const footer = document.createElement('footer');
footer.className = 'page-footer';
footer.innerHTML = '<span>Zomato Restaurant Intelligence</span><span>Local analytics · Built from project datasets</span><a href="#page-top">Back to top <i class="fa-solid fa-arrow-up"></i></a>';

const main = document.createElement('main');
main.className = 'main-content';
main.append(header, section, footer);
document.body.prepend(sidebar, main);
document.title = `${page.title} | Zomato Restaurant Intelligence`;

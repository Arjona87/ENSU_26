/* ============================================================
   ENSU 2026 — Jalisco vs. Nacional — app.js
   ============================================================ */

// Polaridad de cada indicador: para saber si "sube" es bueno o malo
// al colorear la variación en las tarjetas.
const LOWER_IS_BETTER = [
    'percepción de inseguridad',
    'consumo de alcohol',
    'robos o asaltos'
];

function polarityOf(title) {
    const t = normalize(title);
    const lowerBetter = LOWER_IS_BETTER.some(k => t.includes(normalize(k)));
    return lowerBetter ? 'lower' : 'higher';
}

// Paleta para las líneas de la gráfica (una por entidad)
const ENTITY_COLORS = {
    'Nacional': '#1a3a52',
    'Media Estatal': '#c41e3a',
    'Zapopan': '#27ae60',
    'Guadalajara': '#f39c12',
    'Tonalá': '#8e44ad',
    'Tlajomulco': '#16a085',
    'Tlaquepaque': '#2980b9',
    'Puerto Vallarta': '#d35400'
};

let ENSU_DATA = null;   // { periods, indicators }
let activeChart = null; // instancia Chart.js del modal actual

async function init() {
    const main = document.getElementById('main-content');
    const data = await loadEnsuData();

    if (!data || !data.indicators.length) {
        main.innerHTML = `
            <section>
                <div class="loading">
                    <p>⚠️ No se pudieron cargar los datos del Google Sheet.</p>
                    <p style="font-size:13px; opacity:0.7; margin-top:8px;">
                        Verifica que la hoja tenga permiso "Cualquier usuario con el enlace puede ver".
                    </p>
                </div>
            </section>`;
        return;
    }

    ENSU_DATA = data;
    renderNav(data.indicators);
    renderSections(data.indicators);
    document.getElementById('last-update').textContent =
        `Último periodo disponible: ${data.periods[data.periods.length - 1]}`;
}

function renderNav(indicators) {
    const nav = document.getElementById('section-nav');
    const sections = [...new Set(indicators.map(i => i.section))];
    nav.innerHTML = sections.map(s =>
        `<button data-target="sec-${slug(s)}">${s}</button>`
    ).join('');

    nav.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById(btn.dataset.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}

function slug(str) {
    return normalize(str).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function renderSections(indicators) {
    const main = document.getElementById('main-content');
    main.innerHTML = indicators.map((ind, idx) => {
        const periods = ENSU_DATA.periods;
        const lastIdx = lastDataIndex(ind.entities['Nacional'] || []);
        const prevIdx = lastIdx > 0 ? lastIdx - 1 : -1;

        const cardsHtml = ENTITY_ORDER.map(entity => {
            const series = ind.entities[entity];
            if (!series) return '';
            return indicatorCardHtml(entity, series, lastIdx, prevIdx, ind, idx);
        }).join('');

        return `
        <section id="sec-${slug(ind.section)}">
            <h2>${ind.title}</h2>
            <p class="source-note">Comparación Jalisco (municipios y media estatal) vs. Nacional · último dato: ${periods[lastIdx] ?? '—'}</p>
            <div class="summary-cards">${cardsHtml}</div>
        </section>`;
    }).join('');

    main.querySelectorAll('.indicator-card').forEach(card => {
        card.addEventListener('click', () => {
            const indIdx = parseInt(card.dataset.indIdx, 10);
            const entity = card.dataset.entity;
            openModal(ENSU_DATA.indicators[indIdx], entity);
        });
    });
}

function indicatorCardHtml(entity, series, lastIdx, prevIdx, indicator, indIdx) {
    const last = series[lastIdx];
    const prev = prevIdx >= 0 ? series[prevIdx] : null;
    const hasDelta = last !== null && prev !== null;
    const delta = hasDelta ? (last - prev) : null;

    let variationClass = 'neutral';
    let arrow = '→';
    if (hasDelta && Math.abs(delta) >= 0.05) {
        const polarity = polarityOf(indicator.title);
        const improved = polarity === 'lower' ? delta < 0 : delta > 0;
        variationClass = improved ? 'positive' : 'negative';
        arrow = delta > 0 ? '▲' : '▼';
    }

    const valueDisplay = last !== null ? `${last.toFixed(1)}%` : 'N/D';
    const deltaDisplay = hasDelta ? `${arrow} ${Math.abs(delta).toFixed(1)} pts` : 'sin dato previo';

    return `
    <div class="card indicator-card" data-ind-idx="${indIdx}" data-entity="${entity}">
        <h3>${entity}</h3>
        <div class="value">${valueDisplay}</div>
        <div class="variation ${variationClass}">${deltaDisplay} vs. periodo anterior</div>
    </div>`;
}

// ===== MODAL + GRÁFICA =====
function openModal(indicator, focusEntity) {
    const overlay = document.getElementById('modal-overlay');
    document.getElementById('modal-section').textContent = indicator.section;
    document.getElementById('modal-title').textContent = indicator.title;

    const entities = Object.keys(indicator.entities);
    const chips = document.getElementById('entity-toggles');
    chips.innerHTML = entities.map(e => {
        const color = ENTITY_COLORS[e] || '#7f8c8d';
        const active = (e === focusEntity || e === 'Nacional') ? 'active' : '';
        return `<div class="entity-chip ${active}" data-entity="${e}" style="color:${color}">
                    <span class="dot"></span>${e}
                </div>`;
    }).join('');

    chips.querySelectorAll('.entity-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            chip.classList.toggle('active');
            updateChart(indicator);
        });
    });

    overlay.classList.add('open');
    renderChart(indicator);
}

function activeEntities() {
    return [...document.querySelectorAll('.entity-chip.active')].map(c => c.dataset.entity);
}

function renderChart(indicator) {
    const ctx = document.getElementById('history-chart').getContext('2d');
    if (activeChart) activeChart.destroy();

    const labels = ENSU_DATA.periods;
    const datasets = activeEntities().map(entity => {
        const color = ENTITY_COLORS[entity] || '#7f8c8d';
        return {
            label: entity,
            data: indicator.entities[entity],
            borderColor: color,
            backgroundColor: color,
            spanGaps: false,
            tension: 0.25,
            pointRadius: 2,
            borderWidth: entity === 'Nacional' || entity === 'Media Estatal' ? 3 : 2
        };
    });

    activeChart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'nearest', intersect: false },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (item) => `${item.dataset.label}: ${item.formattedValue}%`
                    }
                }
            },
            scales: {
                y: { ticks: { callback: (v) => `${v}%` } },
                x: { ticks: { maxRotation: 60, minRotation: 60 } }
            }
        }
    });
}

function updateChart(indicator) {
    renderChart(indicator);
}

function closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
    if (activeChart) { activeChart.destroy(); activeChart = null; }
}

document.addEventListener('DOMContentLoaded', () => {
    init();
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'modal-overlay') closeModal();
    });
    document.getElementById('refresh-btn').addEventListener('click', () => {
        location.reload();
    });
});

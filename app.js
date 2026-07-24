/* ============================================================
   APP — ENSU Jalisco
   ============================================================
   Los indicadores y los municipios YA NO están escritos a mano: se
   descubren a partir de lo que regrese processSheetData() (ver
   google-sheets-connector.js), porque la estructura real del Sheet es
   "un bloque por indicador" y no sabemos de antemano cuántos
   indicadores tiene ni si en el futuro agregas más.
   ============================================================ */

const CHART_COLORS = {
    municipio: '#1a3a52',
    comparativo: '#c41e3a'
};

const COMPARATIVO_LABELS = {
    'Nacional': 'Promedio Nacional',
    'Media Estatal': 'Media Estatal (Jalisco)'
};

let ENSU_DATA = null;
let USING_SAMPLE_DATA = false;
let LAST_LOAD_ERROR = null;

let INDICATOR_KEYS = [];   // ej. ['Percepción de inseguridad en su ciudad', ...]
let MUNICIPIOS = [];       // áreas que NO son de referencia (Nacional / Media Estatal)
let currentMunicipio = null;
let currentComparativo = 'Nacional';
let activeChart = null;

// ===== Utilidades sobre series =====

function lastTwoRealValues(series) {
    if (!series) return { latest: null, previous: null, latestPeriod: null };
    const vals = series.values;
    let latestIdx = -1;
    for (let i = vals.length - 1; i >= 0; i--) {
        if (vals[i] !== null && vals[i] !== undefined) { latestIdx = i; break; }
    }
    if (latestIdx === -1) return { latest: null, previous: null, latestPeriod: null };
    let prevIdx = -1;
    for (let i = latestIdx - 1; i >= 0; i--) {
        if (vals[i] !== null && vals[i] !== undefined) { prevIdx = i; break; }
    }
    return {
        latest: vals[latestIdx],
        previous: prevIdx === -1 ? null : vals[prevIdx],
        latestPeriod: series.periods[latestIdx]
    };
}

function getSeries(indicatorKey, area) {
    if (!ENSU_DATA || !ENSU_DATA[indicatorKey]) return null;
    return ENSU_DATA[indicatorKey][area] || null;
}

function getComparativoSeries(indicatorKey) {
    return getSeries(indicatorKey, currentComparativo);
}

// Heurística conservadora: solo coloreamos la variación como
// "buena"/"mala" cuando el nombre del indicador deja claro qué significa
// subir o bajar. Si no estamos seguros, se muestra en un tono neutral
// en vez de arriesgarnos a pintar de rojo/verde algo que signifique lo
// contrario.
function inferHigherIsBad(indicatorKey) {
    const n = normalizeText(indicatorKey);
    if (n.includes('insegur') || n.includes('victim') || n.includes('delinc')) return true;
    if (n.includes('confianza') || n.includes('efectiv')) return false;
    return null; // desconocido -> neutral
}

// ===== Carga de datos =====

function discoverStructure() {
    INDICATOR_KEYS = Object.keys(ENSU_DATA || {});
    const allAreas = new Set();
    INDICATOR_KEYS.forEach(k => {
        Object.keys(ENSU_DATA[k]).forEach(area => allAreas.add(area));
    });
    MUNICIPIOS = Array.from(allAreas).filter(a => !REFERENCE_AREAS.includes(a));

    if (!currentMunicipio || !MUNICIPIOS.includes(currentMunicipio)) {
        currentMunicipio = MUNICIPIOS.includes('Guadalajara') ? 'Guadalajara' : (MUNICIPIOS[0] || null);
    }
    if (!allAreas.has(currentComparativo)) {
        currentComparativo = allAreas.has('Nacional') ? 'Nacional' : (REFERENCE_AREAS.find(a => allAreas.has(a)) || currentComparativo);
    }
}

async function initData() {
    LAST_LOAD_ERROR = null;
    let liveData = null;
    try {
        liveData = await loadEnsuData();
    } catch (e) {
        console.warn('Error cargando el Sheet en vivo:', e);
        LAST_LOAD_ERROR = (e && e.message) ? e.message : String(e);
    }

    if (liveData && Object.keys(liveData).length > 0) {
        ENSU_DATA = liveData;
        USING_SAMPLE_DATA = false;
    } else {
        ENSU_DATA = buildSampleData();
        USING_SAMPLE_DATA = true;
    }

    discoverStructure();
}

// ===== Render: barra de contexto =====

function renderContextBar() {
    const bar = document.getElementById('contextBar');
    const anyIndicator = INDICATOR_KEYS[0];
    const series = anyIndicator ? getSeries(anyIndicator, currentMunicipio) : null;
    const { latestPeriod } = lastTwoRealValues(series);

    bar.innerHTML = `
        <div class="fuente">Fuente: INEGI, Encuesta Nacional de Seguridad Pública Urbana (ENSU) ·
            <a href="https://www.inegi.org.mx/programas/ensu/" target="_blank" rel="noopener">inegi.org.mx/programas/ensu</a>
        </div>
        <div class="periodo-actual">${latestPeriod ? 'Último dato: ' + latestPeriod : ''}</div>
    `;

    const notice = document.getElementById('dataNotice');
    if (USING_SAMPLE_DATA) {
        notice.innerHTML = `
            <div class="box">
                <span>⚠️</span>
                <span><strong>Mostrando datos de muestra (2018-2019, transcritos de tu captura de pantalla).</strong>
                No se pudo leer el Google Sheet en vivo todavía.
                ${LAST_LOAD_ERROR ? `Motivo: <em>${LAST_LOAD_ERROR}</em>.` : ''}
                Revisa que el Sheet esté compartido como "Cualquier usuario con el enlace puede ver", luego presiona
                "Actualizar datos".</span>
            </div>`;
        notice.style.display = 'block';
    } else {
        notice.style.display = 'none';
        notice.innerHTML = '';
    }
}

// ===== Render: chips de municipio =====

function renderMunicipioChips() {
    const wrap = document.getElementById('municipiosLegend');
    wrap.innerHTML = MUNICIPIOS.map(m => `
        <button class="municipio-chip ${m === currentMunicipio ? 'active' : ''}" data-municipio="${m}">
            ${m}
        </button>
    `).join('');

    wrap.querySelectorAll('.municipio-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            currentMunicipio = btn.dataset.municipio;
            const select = document.getElementById('municipioSelect');
            if (select) select.value = currentMunicipio;
            renderCards();
            renderMunicipioChips();
        });
    });
}

// ===== Render: selects del header (poblados una vez que hay datos) =====

function populateHeaderSelects() {
    const municipioSelect = document.getElementById('municipioSelect');
    municipioSelect.innerHTML = MUNICIPIOS.map(m =>
        `<option value="${m}" ${m === currentMunicipio ? 'selected' : ''}>${m}</option>`
    ).join('');

    const compSelect = document.getElementById('comparativoSelect');
    compSelect.innerHTML = REFERENCE_AREAS
        .filter(a => INDICATOR_KEYS.some(k => getSeries(k, a)))
        .map(a => `<option value="${a}" ${a === currentComparativo ? 'selected' : ''}>${COMPARATIVO_LABELS[a] || a}</option>`)
        .join('');
}

// ===== Render: tarjetas de indicadores =====

function formatValue(v) {
    if (v === null || v === undefined) return '—';
    return `${v}%`;
}

function variationClass(delta, higherIsBad) {
    if (delta === null || delta === undefined || Math.abs(delta) < 0.05) return 'neutral';
    if (higherIsBad === null) return 'neutral';
    const worse = higherIsBad ? delta > 0 : delta < 0;
    return worse ? 'negative' : 'positive';
}

function variationArrow(delta) {
    if (delta === null || delta === undefined || Math.abs(delta) < 0.05) return '→';
    return delta > 0 ? '▲' : '▼';
}

function renderCards() {
    const grid = document.getElementById('summaryCards');

    if (INDICATOR_KEYS.length === 0) {
        grid.innerHTML = `<div class="loading">No se encontraron indicadores reconocibles en el Sheet.</div>`;
        return;
    }

    grid.innerHTML = INDICATOR_KEYS.map(key => {
        const higherIsBad = inferHigherIsBad(key);
        const series = getSeries(key, currentMunicipio);
        const { latest, previous } = lastTwoRealValues(series);
        const delta = (latest !== null && previous !== null) ? Math.round((latest - previous) * 10) / 10 : null;
        const vClass = variationClass(delta, higherIsBad);
        const arrow = variationArrow(delta);

        const compSeries = getComparativoSeries(key);
        const { latest: compLatest } = lastTwoRealValues(compSeries);
        let compareLine = '';
        if (latest !== null && compLatest !== null && currentMunicipio) {
            const diff = Math.round((latest - compLatest) * 10) / 10;
            const rel = diff > 0 ? 'por arriba de' : diff < 0 ? 'por debajo de' : 'igual a';
            const compLabel = COMPARATIVO_LABELS[currentComparativo] || currentComparativo;
            compareLine = `<div class="compare-line">${currentMunicipio}: <b>${formatValue(latest)}</b> —
                ${Math.abs(diff)}% ${rel} ${compLabel} (<b>${formatValue(compLatest)}</b>)</div>`;
        }

        return `
            <div class="card indicator-card" tabindex="0" role="button" data-indicator="${key}"
                 aria-label="Ver comportamiento histórico de ${key}">
                <div class="card-top">
                    <h3>${key}</h3>
                    <span class="expand-hint">Ver histórico ↗</span>
                </div>
                <div class="value">${currentMunicipio ? formatValue(latest) : '—'}</div>
                <div class="variation ${vClass}">${arrow} ${delta === null ? 'Sin dato previo' : Math.abs(delta) + '% vs. trimestre anterior'}</div>
                ${compareLine}
            </div>
        `;
    }).join('');

    grid.querySelectorAll('.indicator-card').forEach(card => {
        card.addEventListener('click', () => openModal(card.dataset.indicator));
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openModal(card.dataset.indicator);
            }
        });
    });
}

// ===== Modal con historial (Chart.js) =====

function openModal(indicatorKey) {
    const overlay = document.getElementById('modalOverlay');
    document.getElementById('modalTitle').textContent = indicatorKey;
    document.getElementById('modalDesc').textContent = `${currentMunicipio || ''} vs. ${COMPARATIVO_LABELS[currentComparativo] || currentComparativo}`;

    const municipioSeries = getSeries(indicatorKey, currentMunicipio);
    const comparativoSeries = getComparativoSeries(indicatorKey);
    const periods = (municipioSeries && municipioSeries.periods) || (comparativoSeries && comparativoSeries.periods) || [];

    const ctx = document.getElementById('historyChart').getContext('2d');
    if (activeChart) activeChart.destroy();

    activeChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: periods,
            datasets: [
                {
                    label: currentMunicipio || 'Municipio',
                    data: municipioSeries ? municipioSeries.values : [],
                    borderColor: CHART_COLORS.municipio,
                    backgroundColor: CHART_COLORS.municipio + '22',
                    tension: 0.3,
                    spanGaps: true,
                    pointRadius: 4,
                    borderWidth: 3
                },
                {
                    label: COMPARATIVO_LABELS[currentComparativo] || currentComparativo,
                    data: comparativoSeries ? comparativoSeries.values : [],
                    borderColor: CHART_COLORS.comparativo,
                    backgroundColor: CHART_COLORS.comparativo + '22',
                    tension: 0.3,
                    spanGaps: true,
                    pointRadius: 4,
                    borderWidth: 3,
                    borderDash: [6, 4]
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { ticks: { callback: (v) => v + '%' } }
            }
        }
    });

    document.getElementById('chartLegendCustom').innerHTML = `
        <span><span class="legend-dot" style="background:${CHART_COLORS.municipio}"></span>${currentMunicipio || ''}</span>
        <span><span class="legend-dot" style="background:${CHART_COLORS.comparativo}"></span>${COMPARATIVO_LABELS[currentComparativo] || currentComparativo}</span>
    `;

    overlay.classList.add('open');
    document.getElementById('modalCloseBtn').focus();
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
}

// ===== Controles del header =====

function wireHeaderControls() {
    document.getElementById('municipioSelect').addEventListener('change', (e) => {
        currentMunicipio = e.target.value;
        renderCards();
        renderMunicipioChips();
    });

    document.getElementById('comparativoSelect').addEventListener('change', (e) => {
        currentComparativo = e.target.value;
        renderCards();
    });

    document.getElementById('refreshBtn').addEventListener('click', async () => {
        const grid = document.getElementById('summaryCards');
        grid.innerHTML = `<div class="loading"><div class="spinner"></div>Actualizando datos…</div>`;
        try {
            await initData();
            renderAll();
        } catch (error) {
            showFatalError(error);
        }
    });
}

// ===== Render general =====

function renderAll() {
    populateHeaderSelects();
    renderContextBar();
    renderMunicipioChips();
    renderCards();
}

// ===== Manejo de errores inesperados =====
function showFatalError(error) {
    console.error('Error inesperado en la app de ENSU:', error);
    const grid = document.getElementById('summaryCards');
    if (grid) {
        grid.innerHTML = `
            <div class="data-notice" style="grid-column: 1 / -1; padding: 0;">
                <div class="box box-error">
                    <span>⛔</span>
                    <span><strong>Algo salió mal cargando la página.</strong>
                    Motivo: <em>${(error && error.message) ? error.message : String(error)}</em>.
                    Revisa en el navegador (F12 → "Console"/"Network") si algún archivo da 404, y confirma
                    la estructura de carpetas del repositorio. Comparte ese mensaje si necesitas ayuda.</span>
                </div>
            </div>`;
    }
}

// ===== Init =====

document.addEventListener('DOMContentLoaded', async () => {
    try {
        wireHeaderControls();

        document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target.id === 'modalOverlay') closeModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeModal();
        });

        await initData();
        renderAll();
    } catch (error) {
        showFatalError(error);
    }
});

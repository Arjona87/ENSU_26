/* ============================================================
   APP — ENSU Jalisco
   ============================================================ */

const INDICATORS = [
    {
        key: 'Percepción de inseguridad',
        label: 'Percepción de inseguridad',
        desc: 'Población de 18 años y más que considera insegura su ciudad',
        unit: '%',
        higherIsBad: true
    },
    {
        key: 'Victimización en el hogar',
        label: 'Victimización en el hogar',
        desc: 'Hogares con al menos una persona víctima de un delito',
        unit: '%',
        higherIsBad: true
    },
    {
        key: 'Confianza en la policía municipal',
        label: 'Confianza en la policía municipal',
        desc: 'Población que considera efectiva a la policía municipal',
        unit: '%',
        higherIsBad: false
    },
    {
        key: 'Expectativa sobre delincuencia',
        label: 'Expectativa sobre delincuencia',
        desc: 'Cree que la delincuencia seguirá igual de mal o empeorará',
        unit: '%',
        higherIsBad: true
    },
    {
        key: 'Cambio de hábitos por temor',
        label: 'Cambio de hábitos por temor',
        desc: 'Cambió hábitos cotidianos por temor a ser víctima de un delito',
        unit: '%',
        higherIsBad: true
    },
    {
        key: 'Desempeño del gobierno',
        label: 'Desempeño del gobierno',
        desc: 'Considera poco o nada efectivo el desempeño del gobierno',
        unit: '%',
        higherIsBad: true
    }
];

const MUNICIPIOS = [
    'Guadalajara',
    'Zapopan',
    'San Pedro Tlaquepaque',
    'Tlajomulco de Zúñiga',
    'Tonalá',
    'Puerto Vallarta'
];

const AMG_MUNICIPIOS = ['Guadalajara', 'Zapopan', 'San Pedro Tlaquepaque', 'Tlajomulco de Zúñiga', 'Tonalá'];

const CHART_COLORS = {
    municipio: '#1a3a52',
    comparativo: '#c41e3a'
};

let ENSU_DATA = null;
let USING_SAMPLE_DATA = false;
let LAST_LOAD_ERROR = null;
let currentMunicipio = 'Guadalajara';
let currentComparativo = 'Promedio Nacional'; // o 'AMG (promedio)'
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

function getAmgAverageSeries(indicatorKey) {
    const componentSeries = AMG_MUNICIPIOS
        .map(m => getSeries(indicatorKey, m))
        .filter(Boolean);
    if (componentSeries.length === 0) return null;

    const periods = componentSeries[0].periods;
    const values = periods.map((_, idx) => {
        const nums = componentSeries
            .map(s => s.values[idx])
            .filter(v => v !== null && v !== undefined);
        if (nums.length === 0) return null;
        const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
        return Math.round(avg * 10) / 10;
    });
    return { periods, values };
}

function getComparativoSeries(indicatorKey) {
    if (currentComparativo === 'AMG (promedio)') {
        return getAmgAverageSeries(indicatorKey);
    }
    return getSeries(indicatorKey, 'Promedio Nacional');
}

// ===== Carga de datos =====

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
}

// ===== Render: barra de contexto =====

function renderContextBar() {
    const bar = document.getElementById('contextBar');
    const anyIndicator = INDICATORS[0].key;
    const series = getSeries(anyIndicator, currentMunicipio);
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
                <span><strong>Mostrando datos de muestra.</strong> No se pudo leer el Google Sheet en vivo.
                ${LAST_LOAD_ERROR ? `Motivo: <em>${LAST_LOAD_ERROR}</em>.` : ''}
                Revisa que el Sheet esté compartido como "Cualquier usuario con el enlace puede ver" y que el
                SHEET_ID/GID en <code>js/google-sheets-connector.js</code> sean correctos, luego presiona
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
            document.getElementById('municipioSelect').value = currentMunicipio;
            renderAll();
        });
    });
}

// ===== Render: tarjetas de indicadores =====

function formatValue(v, unit) {
    if (v === null || v === undefined) return '—';
    return `${v}${unit}`;
}

function variationClass(delta, higherIsBad) {
    if (delta === null || delta === undefined || Math.abs(delta) < 0.05) return 'neutral';
    const worse = higherIsBad ? delta > 0 : delta < 0;
    return worse ? 'negative' : 'positive';
}

function variationArrow(delta) {
    if (delta === null || delta === undefined || Math.abs(delta) < 0.05) return '→';
    return delta > 0 ? '▲' : '▼';
}

function renderCards() {
    const grid = document.getElementById('summaryCards');

    grid.innerHTML = INDICATORS.map(ind => {
        const series = getSeries(ind.key, currentMunicipio);
        const { latest, previous } = lastTwoRealValues(series);
        const delta = (latest !== null && previous !== null) ? Math.round((latest - previous) * 10) / 10 : null;
        const vClass = variationClass(delta, ind.higherIsBad);
        const arrow = variationArrow(delta);

        const compSeries = getComparativoSeries(ind.key);
        const { latest: compLatest } = lastTwoRealValues(compSeries);
        let compareLine = '';
        if (latest !== null && compLatest !== null) {
            const diff = Math.round((latest - compLatest) * 10) / 10;
            const rel = diff > 0 ? 'por arriba de' : diff < 0 ? 'por debajo de' : 'igual a';
            compareLine = `<div class="compare-line">${currentMunicipio}: <b>${formatValue(latest, ind.unit)}</b> —
                ${Math.abs(diff)}${ind.unit} ${rel} ${currentComparativo} (<b>${formatValue(compLatest, ind.unit)}</b>)</div>`;
        }

        return `
            <div class="card indicator-card" tabindex="0" role="button" data-indicator="${ind.key}"
                 aria-label="Ver comportamiento histórico de ${ind.label}">
                <div class="card-top">
                    <h3>${ind.label}</h3>
                    <span class="expand-hint">Ver histórico ↗</span>
                </div>
                <div class="desc">${ind.desc}</div>
                <div class="value">${formatValue(latest, ind.unit)}</div>
                <div class="variation ${vClass}">${arrow} ${delta === null ? 'Sin dato previo' : Math.abs(delta) + ind.unit + ' vs. trimestre anterior'}</div>
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
    const ind = INDICATORS.find(i => i.key === indicatorKey);
    const overlay = document.getElementById('modalOverlay');
    document.getElementById('modalTitle').textContent = ind.label;
    document.getElementById('modalDesc').textContent = ind.desc;

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
                    label: currentMunicipio,
                    data: municipioSeries ? municipioSeries.values : [],
                    borderColor: CHART_COLORS.municipio,
                    backgroundColor: CHART_COLORS.municipio + '22',
                    tension: 0.3,
                    spanGaps: true,
                    pointRadius: 4,
                    borderWidth: 3
                },
                {
                    label: currentComparativo,
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
                y: {
                    ticks: { callback: (v) => v + ind.unit }
                }
            }
        }
    });

    document.getElementById('chartLegendCustom').innerHTML = `
        <span><span class="legend-dot" style="background:${CHART_COLORS.municipio}"></span>${currentMunicipio}</span>
        <span><span class="legend-dot" style="background:${CHART_COLORS.comparativo}"></span>${currentComparativo}</span>
    `;

    overlay.classList.add('open');
    document.getElementById('modalCloseBtn').focus();
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
}

// ===== Controles del header =====

function renderHeaderControls() {
    const select = document.getElementById('municipioSelect');
    select.innerHTML = MUNICIPIOS.map(m => `<option value="${m}" ${m === currentMunicipio ? 'selected' : ''}>${m}</option>`).join('');
    select.addEventListener('change', () => {
        currentMunicipio = select.value;
        renderAll();
    });

    const compSelect = document.getElementById('comparativoSelect');
    compSelect.addEventListener('change', () => {
        currentComparativo = compSelect.value;
        renderAll();
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
    renderContextBar();
    renderMunicipioChips();
    renderCards();
}

// ===== Manejo de errores inesperados =====
// Si algo truena en cualquier parte del arranque, mostramos el motivo
// directamente en la página en vez de dejar el spinner girando para
// siempre — así se puede diagnosticar sin abrir la consola del navegador.
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
                    Revisa en el navegador (F12 → pestaña "Console" o "Network") si algún archivo
                    (css/js/assets) da error 404, y confirma que la estructura de carpetas del
                    repositorio coincide con la del proyecto. Copia ese mensaje y compártemelo si
                    necesitas ayuda para diagnosticarlo.</span>
                </div>
            </div>`;
    }
}

// ===== Init =====

document.addEventListener('DOMContentLoaded', async () => {
    try {
        renderHeaderControls();

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

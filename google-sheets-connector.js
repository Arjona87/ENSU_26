/* ============================================================
   CONECTOR DE GOOGLE SHEETS — ENSU Jalisco
   Adaptado del módulo reutilizable del proyecto "Reporte Semanal
   de Incidencia Delictiva". La carga en vivo ya NO usa fetch()
   (ver nota CORS más abajo) sino una técnica JSONP con <script>.
   processSheetData() sigue siendo lo único específico de ESTE
   Sheet, y parseCSV() se conserva como utilidad de referencia.
   ============================================================ */

// ===== 1. CONFIGURACIÓN =====
const SHEET_ID = '1Az2aE6Mb3RKIwjJjsGBfQYH5dr6RsZjuVVME1CmvSag';
const SHEET_GID = '1672888382';

// IMPORTANTE — LECCIÓN APRENDIDA (esto es lo que rompía la página en
// GitHub Pages): el endpoint clásico ".../export?format=csv" NO manda
// cabeceras CORS (Access-Control-Allow-Origin), así que un fetch() a ese
// URL desde CUALQUIER dominio que no sea docs.google.com (ej. tu sitio en
// github.io) es bloqueado por el navegador con un error de CORS — esto
// pasa SIEMPRE, sin importar qué tan público esté el Sheet. Por eso daba
// la impresión de "no funciona" aunque el permiso de compartir ya estaba
// bien.
//
// La solución: en vez de fetch(), cargamos los datos con la técnica
// JSONP clásica usando el endpoint de Google Visualization
// (gviz/tq), inyectando un <script> que apunta a Google. Los <script>
// NO están sujetos a CORS (es la misma razón por la que puedes cargar
// Chart.js desde un CDN), así que este método sí funciona en cualquier
// dominio, incluyendo GitHub Pages.
//
// El Sheet debe seguir compartido como "Cualquier usuario con el enlace
// puede ver" — eso no cambia.

function loadSheetViaJSONP(sheetId, gid, timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        const callbackName = '__ensuGvizCallback_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
        const script = document.createElement('script');
        let settled = false;

        const cleanup = () => {
            delete window[callbackName];
            if (script.parentNode) script.parentNode.removeChild(script);
        };

        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(new Error('Tiempo de espera agotado cargando el Google Sheet (JSONP).'));
        }, timeoutMs);

        window[callbackName] = (response) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            cleanup();
            if (!response || response.status === 'error') {
                reject(new Error('Google respondió con error (¿el Sheet no es público o el gid no existe?).'));
                return;
            }
            resolve(response);
        };

        script.onerror = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            cleanup();
            reject(new Error('No se pudo cargar el script de Google Sheets (revisa el SHEET_ID/GID o tu conexión).'));
        };

        const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq` +
            `?gid=${encodeURIComponent(gid)}&headers=0&tqx=responseHandler:${callbackName}`;
        script.src = url;
        document.head.appendChild(script);
    });
}

// Con headers=0, Google regresa TODAS las filas (incluyendo lo que
// nosotros usamos como encabezados reales) dentro de response.table.rows
// — no hay una fila de encabezado separada que Google nos quite. Aquí
// solo convertimos cada fila al mismo formato "array de arrays" que
// procesa processSheetData().
function gvizResponseToRows(response) {
    return (response.table.rows || []).map(r => {
        return (r.c || []).map(cell => {
            if (!cell || cell.v === null || cell.v === undefined) return '';
            return String(cell.v);
        });
    });
}


// ===== 3. PARSEAR CSV (utilidad de referencia) =====
// Ya NO se usa en la carga en vivo (ver nota CORS arriba), pero se deja
// aquí por si algún día quieres procesar un CSV pegado/descargado a mano.
// Respeta comillas dobles, así que celdas como "1,049" o "70.8%" no
// desalinean la fila aunque tengan comas o formato de miles.
function parseCSV(csvText) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        const next = csvText[i + 1];

        if (inQuotes) {
            if (char === '"' && next === '"') { field += '"'; i++; }
            else if (char === '"') { inQuotes = false; }
            else { field += char; }
        } else {
            if (char === '"') { inQuotes = true; }
            else if (char === ',') { row.push(field.trim()); field = ''; }
            else if (char === '\r') { /* ignorar, lo maneja \n */ }
            else if (char === '\n') { row.push(field.trim()); rows.push(row); row = []; field = ''; }
            else { field += char; }
        }
    }
    if (field.length > 0 || row.length > 0) { row.push(field.trim()); rows.push(row); }

    console.log(`✅ CSV parseado: ${rows.length} filas`);
    return rows;
}


/* ============================================================
   4. PROCESAMIENTO ESPECÍFICO DE ESTE SHEET (ENSU Jalisco)
   ============================================================
   ESTA es la estructura REAL, confirmada con una captura de pantalla
   del Sheet (hoja "Hoja 2", gid 1672888382):

   Fila 1: años agrupados en celdas combinadas ("2018" sobre 4 columnas,
           "2019" sobre las siguientes 4, etc.) — se ignora, es solo
           visual.
   Fila 2: fragmento de meses (resto del combinado) — se ignora.
   Fila 3: título general en col. A + encabezados reales de periodo en
           columnas B en adelante, ya como "mar 2018", "jun 2018",
           "sep 2018", "dic 2018", "mar 2019", ... Esta es la fila que
           SÍ usamos como encabezado de columnas.
   Fila 4: título de un indicador (ej. "Percepción de inseguridad"),
           en una franja de color que ocupa toda la fila.
   Fila 5: subtítulo del mismo indicador (ej. "Percepción de
           inseguridad en su ciudad").
   Filas 6-13: una fila por área con sus valores para ESE indicador:
           Nacional, Zapopan, Guadalajara, Tonalá, Tlajomulco,
           Tlaquepaque, Puerto Vallarta, Media Estatal.
   Fila 14: título del siguiente indicador (ej. "Desempeño de la
           Policía Estatal") — el patrón se repite.

   En vez de asumir un número fijo de filas por bloque, este parser:
   1. Encuentra la fila de encabezados de periodo buscando la primera
      fila donde varias celdas coincidan con el patrón "mes año"
      (mar/jun/sep/dic + 4 dígitos).
   2. A partir de ahí, cualquier fila cuya columna A sea uno de los 8
      nombres de área conocidos (ver AREA_ALIASES) se registra como
      datos del indicador "actual". Cualquier otra fila con texto en
      columna A se toma como el nombre del indicador actual (si hay
      título Y subtítulo antes de las áreas, se queda con el último —
      el subtítulo, normalmente más descriptivo).
   Esto se adapta solo a cuántos indicadores tenga el Sheet, sin
   necesidad de listarlos a mano.
   ============================================================ */

// Nombres de área tal como aparecen en el Sheet (columna A), normalizados
// (minúsculas, sin acentos) -> nombre canónico que usa el resto de la app.
const AREA_ALIASES = {
    'nacional': 'Nacional',
    'zapopan': 'Zapopan',
    'guadalajara': 'Guadalajara',
    'tonala': 'Tonalá',
    'tlajomulco': 'Tlajomulco',
    'tlajomulco de zuniga': 'Tlajomulco',
    'tlaquepaque': 'Tlaquepaque',
    'san pedro tlaquepaque': 'Tlaquepaque',
    'puerto vallarta': 'Puerto Vallarta',
    'media estatal': 'Media Estatal'
};

// Áreas que sirven como comparativo/referencia (no aparecen como
// "municipio" seleccionable, sino como línea de comparación).
const REFERENCE_AREAS = ['Nacional', 'Media Estatal'];

function normalizeText(s) {
    return String(s || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos
        .trim();
}

const PERIOD_REGEX = /^(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\.?\s*\d{4}$/i;

function looksLikePeriod(cell) {
    return PERIOD_REGEX.test(String(cell || '').trim());
}

// Busca la fila donde empiezan los encabezados reales de periodo
// (la que tiene "mar 2018", "jun 2018", etc.), en vez de asumir que
// es la fila 1.
function findPeriodHeaderRow(rows) {
    let bestIdx = -1;
    let bestCount = 0;
    for (let i = 0; i < rows.length; i++) {
        const count = rows[i].filter(looksLikePeriod).length;
        if (count > bestCount) {
            bestCount = count;
            bestIdx = i;
        }
    }
    return bestCount >= 2 ? bestIdx : -1;
}

function parseNumber(raw) {
    if (raw === undefined || raw === null) return null;
    const cleaned = String(raw).replace('%', '').replace(/,/g, '').trim();
    if (cleaned === '' || /^n\/?a$/i.test(cleaned)) return null;
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

function processSheetData(rows) {
    if (!rows || rows.length === 0) return null;

    const headerRowIdx = findPeriodHeaderRow(rows);
    if (headerRowIdx === -1) {
        console.warn('⚠️ No encontré una fila de encabezados de periodo (ej. "mar 2018") en el Sheet.');
        return null;
    }

    const headerRow = rows[headerRowIdx];
    // Columnas (índice, etiqueta) que sí parecen un periodo real —
    // así ignoramos huecos o columnas fuera de patrón.
    const periodCols = [];
    for (let c = 1; c < headerRow.length; c++) {
        if (looksLikePeriod(headerRow[c])) {
            periodCols.push({ idx: c, label: headerRow[c].trim() });
        }
    }
    if (periodCols.length === 0) return null;
    const periods = periodCols.map(pc => pc.label);

    const data = {}; // data[indicador][area] = { periods, values }
    let currentIndicator = null;

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        const cellA = (row[0] || '').trim();
        if (!cellA) continue; // fila en blanco, se ignora

        const canonicalArea = AREA_ALIASES[normalizeText(cellA)];

        if (canonicalArea) {
            if (!currentIndicator) continue; // fila de área sin indicador detectado todavía
            const values = periodCols.map(pc => parseNumber(row[pc.idx]));
            if (!data[currentIndicator]) data[currentIndicator] = {};
            data[currentIndicator][canonicalArea] = { periods, values };
        } else {
            // Título o subtítulo de un indicador — nos quedamos con el
            // último texto visto antes de que empiecen las filas de área.
            currentIndicator = cellA;
        }
    }

    console.log('✅ Datos de ENSU procesados. Indicadores encontrados:', Object.keys(data));
    return data;
}


// ===== 5. CARGA PRINCIPAL =====
// Devuelve los datos del Sheet si la carga tuvo éxito, o null si
// falló (para que quien llame decida usar datos de muestra). Lanza el
// error hacia arriba con un mensaje entendible para mostrarlo en pantalla.
async function loadEnsuData() {
    const response = await loadSheetViaJSONP(SHEET_ID, SHEET_GID);
    const rows = gvizResponseToRows(response);
    const data = processSheetData(rows);
    if (!data || Object.keys(data).length === 0) {
        throw new Error('El Sheet respondió pero no se encontraron filas con Indicador/Área reconocibles.');
    }
    return data;
}

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
            `?gid=${encodeURIComponent(gid)}&headers=1&tqx=responseHandler:${callbackName}`;
        script.src = url;
        document.head.appendChild(script);
    });
}

// Convierte la respuesta de Google Visualization (formato
// {table:{cols:[...], rows:[...]}}) al mismo formato "array de arrays"
// (rows[fila][columna]) que antes producía parseCSV(), para no tener
// que tocar processSheetData().
function gvizResponseToRows(response) {
    const headers = response.table.cols.map(c => (c.label || c.id || '').trim());
    const rows = [headers];
    response.table.rows.forEach(r => {
        const row = (r.c || []).map(cell => {
            if (!cell || cell.v === null || cell.v === undefined) return '';
            return String(cell.v);
        });
        rows.push(row);
    });
    return rows;
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

   ESTRUCTURA QUE ESTE PARSER ESPERA (ajústala a tu Sheet real —
   no pude leer el tuyo todavía, ver nota en README):

   Fila 1 (encabezados): Indicador | Área | T1 2021 | T2 2021 | ... | T1 2026
   Filas siguientes: una fila por cada combinación Indicador + Área, ej.:

     Percepción de inseguridad | Guadalajara        | 78.1 | 79.8 | ...
     Percepción de inseguridad | Zapopan             | 49.2 | 50.1 | ...
     Percepción de inseguridad | Promedio Nacional   | 65.0 | 64.2 | ...
     Victimización en el hogar | Guadalajara        | 31.0 | 33.4 | ...
     ...

   Igual que en el proyecto anterior: no asumas que la última columna
   con encabezado de trimestre ya tiene dato real. Aquí cada fila
   busca su propia "última columna con valor real" de derecha a
   izquierda (findLastRealValue), por si el trimestre más nuevo
   todavía no se ha capturado para todas las áreas.
   ============================================================ */

// NOTA: se asume el mismo formato que el proyecto anterior — punto como
// separador decimal y coma como separador de miles (ej. "1,049" -> 1049).
// Para porcentajes de ENSU (0-100) esto casi nunca importa. Si tu Sheet
// exporta números con coma como separador DECIMAL (locale en español,
// ej. "61,9" en vez de "61.9"), avísame para ajustar esta función.
function parseNumber(raw) {
    if (raw === undefined || raw === null) return null;
    const cleaned = String(raw).replace('%', '').replace(/,/g, '').trim();
    if (cleaned === '') return null;
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

function findLastRealValue(values) {
    for (let i = values.length - 1; i >= 0; i--) {
        if (values[i] !== null) return { index: i, value: values[i] };
    }
    return null;
}

function processSheetData(csvArray) {
    if (!csvArray || csvArray.length < 2) return null;

    const headers = csvArray[0];
    const periods = headers.slice(2).filter(p => p && p.trim() !== '');

    // data[indicador][area] = { periods: [...], values: [...] }
    const data = {};

    for (let i = 1; i < csvArray.length; i++) {
        const row = csvArray[i];
        if (!row[0] || !row[1]) continue;

        const indicador = row[0].trim();
        const area = row[1].trim();
        const values = periods.map((_, idx) => parseNumber(row[2 + idx]));

        if (!data[indicador]) data[indicador] = {};
        data[indicador][area] = { periods, values };
    }

    console.log('✅ Datos de ENSU procesados:', Object.keys(data));
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

/* ============================================================
   CONECTOR DE GOOGLE SHEETS — ENSU Jalisco
   Adaptado del módulo reutilizable del proyecto "Reporte Semanal
   de Incidencia Delictiva". fetchSheetData() y parseCSV() son
   100% genéricas y NO se tocaron. Lo único nuevo es
   processSheetData(), que interpreta las filas/columnas según
   la estructura de ESTE Sheet.
   ============================================================ */

// ===== 1. CONFIGURACIÓN =====
const SHEET_ID = '1Az2aE6Mb3RKIwjJjsGBfQYH5dr6RsZjuVVME1CmvSag';
const SHEET_GID = '1672888382';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

// IMPORTANTE: para que este fetch funcione (para ti y para cualquier
// visitante de la página, sin login), el Sheet debe compartirse como
// "Cualquier usuario con el enlace puede ver". Mientras no se cambie
// ese permiso, el fetch fallará (401/403) y la página usará los datos
// de muestra (ver ensu-data-muestra.js) para no quedar en blanco.


// ===== 2. DESCARGAR EL CSV (genérico, no tocar) =====
async function fetchSheetData() {
    try {
        console.log('📥 Descargando datos del Google Sheet de ENSU...');
        const response = await fetch(CSV_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const csvText = await response.text();
        console.log('✅ Datos descargados correctamente');
        return csvText;
    } catch (error) {
        console.warn('⚠️ No se pudo descargar el Sheet (¿está compartido como público?):', error.message);
        return null;
    }
}


// ===== 3. PARSEAR EL CSV (genérico, no tocar) =====
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
// Devuelve los datos del Sheet si el fetch tuvo éxito, o null si
// falló (para que quien llame decida usar datos de muestra).
async function loadEnsuData() {
    const csvText = await fetchSheetData();
    if (!csvText) return null;
    const csvArray = parseCSV(csvText);
    return processSheetData(csvArray);
}

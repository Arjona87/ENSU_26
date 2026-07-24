/* ============================================================
   CONECTOR DE GOOGLE SHEETS — reutilizado tal cual del proyecto
   "Reporte Semanal de Incidencia Delictiva" (fetchSheetData +
   parseCSV son 100% genéricas, no se tocan). Lo único nuevo es
   buildIndicators(), que es el "processSheetData()" específico
   de este proyecto (ENSU: Jalisco, municipios y promedio nacional).
   ============================================================ */

// ===== 1. CONFIGURACIÓN =====
const SHEET_ID = '1QEid3qqRJYOTRHi0U8HsEMqJz6R0zCC8mfpZKnZ2FG4';
const SHEET_GID = '0';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

// Orden esperado de entidades dentro de cada bloque de indicador
const ENTITY_ORDER = [
    'Nacional',
    'Zapopan',
    'Guadalajara',
    'Tonalá',
    'Tlajomulco',
    'Tlaquepaque',
    'Puerto Vallarta',
    'Media Estatal'
];

// Municipios (subconjunto de ENTITY_ORDER, sin Nacional ni Media Estatal)
const MUNICIPIOS = ENTITY_ORDER.filter(e => e !== 'Nacional' && e !== 'Media Estatal');

function normalize(str) {
    return (str || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos
        .trim().toLowerCase();
}

const ENTITY_SET_NORM = new Set(ENTITY_ORDER.map(normalize));

// ===== 2. DESCARGAR EL CSV =====
async function fetchSheetData() {
    try {
        console.log('📥 Descargando datos del Google Sheet (ENSU)...');
        const response = await fetch(CSV_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const csvText = await response.text();
        console.log('✅ Datos descargados correctamente');
        return csvText;
    } catch (error) {
        console.error('❌ Error al descargar datos:', error);
        return null;
    }
}

// ===== 3. PARSEAR EL CSV (respeta comillas / números con formato de miles) =====
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

// ===== 4. CONVERTIR UNA CELDA A NÚMERO ("73.4%" -> 73.4, "" / "N/A" -> null) =====
function toNumber(cell) {
    if (cell === undefined || cell === null) return null;
    const clean = String(cell).trim();
    if (clean === '' || /^n\/?a$/i.test(clean)) return null;
    const num = parseFloat(clean.replace('%', '').replace(/,/g, ''));
    return Number.isNaN(num) ? null : num;
}

/* ============================================================
   5. buildIndicators() — específico de este proyecto (ENSU)
   ============================================================
   El sheet acomoda cada indicador como un bloque vertical:
     [1-2 filas de título/sección, sin datos]
     Nacional        <valores por periodo>
     Zapopan         <valores por periodo>
     Guadalajara     ...
     Tonalá          ...
     Tlajomulco      ...
     Tlaquepaque     ...
     Puerto Vallarta ...
     Media Estatal   ...
   seguido del siguiente bloque. No todos los bloques tienen el
   mismo número de filas de título (algunos tienen categoría +
   subtítulo, otros solo uno), así que en vez de asumir un
   número fijo de filas, detectamos el inicio de cada bloque por
   la fila "Nacional" y usamos como título la línea de texto más
   cercana hacia arriba que no tenga datos.
   ============================================================ */
function buildIndicators(csvArray) {
    const periods = csvArray[0].slice(1).filter(p => p !== '');
    const indicators = [];

    let pendingLabels = []; // líneas de título acumuladas antes de un bloque de datos
    let current = null;

    for (let r = 1; r < csvArray.length; r++) {
        const row = csvArray[r];
        const label = (row[0] || '').trim();
        const values = row.slice(1, 1 + periods.length);
        const hasData = values.some(v => toNumber(v) !== null);

        if (!label && !hasData) continue; // fila vacía, ignorar
        if (/^fuente/i.test(label)) break; // pie de página, fin de los datos

        const normLabel = normalize(label);

        if (!hasData) {
            // fila de solo texto -> candidata a título de indicador
            pendingLabels.push(label);
            continue;
        }

        if (ENTITY_SET_NORM.has(normLabel)) {
            if (normLabel === normalize('Nacional')) {
                // arranca un nuevo indicador
                const title = pendingLabels.length
                    ? pendingLabels[pendingLabels.length - 1]
                    : `Indicador ${indicators.length + 1}`;
                const section = pendingLabels.length > 1 ? pendingLabels[0] : title;
                current = { section, title, entities: {} };
                indicators.push(current);
                pendingLabels = [];
            }
            if (current) {
                current.entities[label] = values.map(toNumber);
            }
        }
    }

    return { periods, indicators };
}

/* ============================================================
   6. Última columna con dato real (por si una semana/trimestre
   nuevo ya tiene encabezado pero aún no captura datos)
   ============================================================ */
function lastDataIndex(valueArray) {
    for (let i = valueArray.length - 1; i >= 0; i--) {
        if (valueArray[i] !== null && valueArray[i] !== undefined) return i;
    }
    return -1;
}

// ===== 7. Carga completa =====
async function loadEnsuData() {
    const csvText = await fetchSheetData();
    if (!csvText) return null;
    const csvArray = parseCSV(csvText);
    return buildIndicators(csvArray);
}

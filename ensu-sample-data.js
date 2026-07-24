/* ============================================================
   DATOS DE MUESTRA — ENSU Jalisco
   ============================================================
   Este archivo NO son datos oficiales completos. Se usan solo
   como respaldo (fallback) mientras:
     a) el Google Sheet no esté compartido como público, o
     b) processSheetData() todavía no coincida con la estructura
        real de tu Sheet.

   La serie del indicador "Percepción de inseguridad" para
   Guadalajara, Zapopan, Puerto Vallarta y el Promedio Nacional
   en T3 2025 / T4 2025 / T1 2026 SÍ está tomada de boletines
   públicos de INEGI/IIEG (ver fuente en el pie de la página).
   El resto de los trimestres y el resto de los indicadores son
   valores generados solo para que la interfaz se vea y funcione
   completa — reemplázalos en cuanto conectemos tu Sheet real.
   ============================================================ */

const SAMPLE_PERIODS = [
    'T1 2024', 'T2 2024', 'T3 2024', 'T4 2024',
    'T1 2025', 'T2 2025', 'T3 2025', 'T4 2025', 'T1 2026'
];

const AREAS = [
    'Guadalajara',
    'Zapopan',
    'San Pedro Tlaquepaque',
    'Tlajomulco de Zúñiga',
    'Tonalá',
    'Puerto Vallarta',
    'Promedio Nacional'
];

// Pequeño generador determinístico (sin Math.random) para que la
// muestra se vea con variación natural pero sea reproducible.
function seededSeries(base, drift, seed) {
    const values = [];
    let v = base;
    for (let i = 0; i < SAMPLE_PERIODS.length; i++) {
        const wiggle = Math.sin(seed + i * 1.7) * 1.4;
        v = v + drift + wiggle;
        values.push(Math.max(5, Math.min(97, Math.round(v * 10) / 10)));
    }
    return values;
}

function buildSampleData() {
    const data = {};

    // ---- 1. Percepción de inseguridad ----
    // Guadalajara, Zapopan, Puerto Vallarta y Nacional: últimos 3
    // puntos alineados con boletines públicos de INEGI/IIEG.
    data['Percepción de inseguridad'] = {
        'Guadalajara': { periods: SAMPLE_PERIODS, values: [74.0, 75.5, 76.8, 77.5, 78.0, 78.4, 78.9, 79.2, 90.0] },
        'Zapopan': { periods: SAMPLE_PERIODS, values: [47.0, 48.2, 49.0, 49.8, 49.0, 49.3, 49.5, 54.7, 70.8] },
        'San Pedro Tlaquepaque': { periods: SAMPLE_PERIODS, values: seededSeries(60, 1.5, 1) },
        'Tlajomulco de Zúñiga': { periods: SAMPLE_PERIODS, values: seededSeries(58, 1.9, 2) },
        'Tonalá': { periods: SAMPLE_PERIODS, values: seededSeries(55, 1.9, 3) },
        'Puerto Vallarta': { periods: SAMPLE_PERIODS, values: [28.0, 27.0, 26.0, 25.5, 25.0, 24.9, 24.7, 32.0, 59.9] },
        'Promedio Nacional': { periods: SAMPLE_PERIODS, values: [63.3, 62.9, 62.2, 61.7, 61.9, 62.5, 63.0, 63.8, 61.5] }
    };

    // ---- 2. Victimización en el hogar ----
    data['Victimización en el hogar'] = {
        'Guadalajara': { periods: SAMPLE_PERIODS, values: seededSeries(34, 0.4, 4) },
        'Zapopan': { periods: SAMPLE_PERIODS, values: seededSeries(30, 0.3, 5) },
        'San Pedro Tlaquepaque': { periods: SAMPLE_PERIODS, values: seededSeries(29, 0.4, 6) },
        'Tlajomulco de Zúñiga': { periods: SAMPLE_PERIODS, values: seededSeries(28, 0.5, 7) },
        'Tonalá': { periods: SAMPLE_PERIODS, values: seededSeries(31, 0.4, 8) },
        'Puerto Vallarta': { periods: SAMPLE_PERIODS, values: seededSeries(22, 0.2, 9) },
        'Promedio Nacional': { periods: SAMPLE_PERIODS, values: seededSeries(30, 0.3, 10) }
    };

    // ---- 3. Confianza en la policía municipal ----
    data['Confianza en la policía municipal'] = {
        'Guadalajara': { periods: SAMPLE_PERIODS, values: seededSeries(41, -0.3, 11) },
        'Zapopan': { periods: SAMPLE_PERIODS, values: seededSeries(48, -0.2, 12) },
        'San Pedro Tlaquepaque': { periods: SAMPLE_PERIODS, values: seededSeries(40, -0.2, 13) },
        'Tlajomulco de Zúñiga': { periods: SAMPLE_PERIODS, values: seededSeries(42, -0.3, 14) },
        'Tonalá': { periods: SAMPLE_PERIODS, values: seededSeries(38, -0.3, 15) },
        'Puerto Vallarta': { periods: SAMPLE_PERIODS, values: seededSeries(55, -0.1, 16) },
        'Promedio Nacional': { periods: SAMPLE_PERIODS, values: seededSeries(46, -0.2, 17) }
    };

    // ---- 4. Expectativa sobre delincuencia (seguirá igual o peor) ----
    data['Expectativa sobre delincuencia'] = {
        'Guadalajara': { periods: SAMPLE_PERIODS, values: seededSeries(70, 0.4, 18) },
        'Zapopan': { periods: SAMPLE_PERIODS, values: seededSeries(63, 0.5, 19) },
        'San Pedro Tlaquepaque': { periods: SAMPLE_PERIODS, values: seededSeries(68, 0.4, 20) },
        'Tlajomulco de Zúñiga': { periods: SAMPLE_PERIODS, values: seededSeries(65, 0.5, 21) },
        'Tonalá': { periods: SAMPLE_PERIODS, values: seededSeries(69, 0.4, 22) },
        'Puerto Vallarta': { periods: SAMPLE_PERIODS, values: seededSeries(45, 0.6, 23) },
        'Promedio Nacional': { periods: SAMPLE_PERIODS, values: seededSeries(61, 0.2, 24) }
    };

    // ---- 5. Cambio de hábitos por temor ----
    data['Cambio de hábitos por temor'] = {
        'Guadalajara': { periods: SAMPLE_PERIODS, values: seededSeries(66, 0.3, 25) },
        'Zapopan': { periods: SAMPLE_PERIODS, values: seededSeries(58, 0.4, 26) },
        'San Pedro Tlaquepaque': { periods: SAMPLE_PERIODS, values: seededSeries(60, 0.3, 27) },
        'Tlajomulco de Zúñiga': { periods: SAMPLE_PERIODS, values: seededSeries(59, 0.4, 28) },
        'Tonalá': { periods: SAMPLE_PERIODS, values: seededSeries(61, 0.3, 29) },
        'Puerto Vallarta': { periods: SAMPLE_PERIODS, values: seededSeries(40, 0.5, 30) },
        'Promedio Nacional': { periods: SAMPLE_PERIODS, values: seededSeries(57, 0.2, 31) }
    };

    // ---- 6. Desempeño del gobierno (poco o nada efectivo) ----
    data['Desempeño del gobierno'] = {
        'Guadalajara': { periods: SAMPLE_PERIODS, values: seededSeries(78, 0.1, 32) },
        'Zapopan': { periods: SAMPLE_PERIODS, values: seededSeries(70, 0.2, 33) },
        'San Pedro Tlaquepaque': { periods: SAMPLE_PERIODS, values: seededSeries(80, 0.1, 34) },
        'Tlajomulco de Zúñiga': { periods: SAMPLE_PERIODS, values: seededSeries(74, 0.2, 35) },
        'Tonalá': { periods: SAMPLE_PERIODS, values: seededSeries(81, 0.1, 36) },
        'Puerto Vallarta': { periods: SAMPLE_PERIODS, values: seededSeries(58, 0.3, 37) },
        'Promedio Nacional': { periods: SAMPLE_PERIODS, values: seededSeries(72, 0.1, 38) }
    };

    return data;
}

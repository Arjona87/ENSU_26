/* ============================================================
   DATOS DE MUESTRA — ENSU Jalisco
   ============================================================
   A diferencia de la versión anterior, estos datos SÍ son reales —
   transcritos directamente de la captura de pantalla que compartiste
   del Sheet (hoja "Hoja 2", gid 1672888382), para los 8 trimestres
   que se alcanzaban a ver completos (mar 2018 a dic 2019).

   Esto se usa solo como respaldo si la carga en vivo del Sheet falla.
   En cuanto la carga en vivo funcione, vas a ver TODOS tus indicadores
   y TODO tu histórico real (no solo estos 8 trimestres de 2 indicadores).

   Nota: en la captura, "Desempeño de la Policía Estatal" solo alcanzaba
   a verse completo para Nacional y Zapopan (el resto de filas quedaban
   fuera de la captura) — por eso ese indicador solo trae esas 2 áreas
   aquí. No inventé el resto.
   ============================================================ */

function buildSampleData() {
    const periods = ['mar 2018', 'jun 2018', 'sep 2018', 'dic 2018', 'mar 2019', 'jun 2019', 'sep 2019', 'dic 2019'];

    const s = (values) => ({ periods, values });

    const data = {};

    data['Percepción de inseguridad en su ciudad'] = {
        'Nacional': s([76.8, 75.9, 74.9, 73.7, 74.6, 73.9, 71.3, 72.9]),
        'Zapopan': s([null, 73.8, 67.6, 62.9, 68.6, 70.6, 68.4, 69.3]),
        'Guadalajara': s([72.6, 82.4, 86.2, 86.8, 81.2, 85.0, 84.0, 82.3]),
        'Tonalá': s([null, 78.0, 74.2, 80.4, 85.1, 76.6, 76.9, 82.1]),
        'Tlajomulco': s([null, 78.5, 73.5, 74.5, 72.8, 65.0, 72.5, 80.5]),
        'Tlaquepaque': s([null, 74.5, 74.2, 77.2, 80.2, 72.6, 72.5, 70.6]),
        'Puerto Vallarta': s([51.9, 36.6, 41.4, 38.7, 57.4, 43.1, 37.8, 34.2]),
        'Media Estatal': s([62.3, 70.6, 69.5, 70.1, 74.2, 68.8, 68.7, 69.8])
    };

    data['Desempeño PolicíaEstatal'] = {
        'Nacional': s([47.2, 46.6, 48.6, 47.9, 49.5, 49.8, 50.6, 48.4]),
        'Zapopan': s([null, 50.6, 57.5, 65.8, 54.6, 52.0, 53.0, 54.8])
    };

    return data;
}

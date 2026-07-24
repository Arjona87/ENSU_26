# ENSU Jalisco — Percepción sobre Seguridad Pública

Réplica del proyecto "Reporte Semanal de Incidencia Delictiva", reutilizando
la misma paleta de colores, header con dos logos + título centrado, y
tarjetas de resumen — ahora conectado a tu Google Sheet real de la ENSU
(Encuesta Nacional de Seguridad Pública Urbana) para Jalisco.

## La estructura de datos ya está confirmada con tu captura de pantalla

Gracias a la captura que compartiste, el parser (`js/google-sheets-connector.js`)
ahora está hecho para la estructura REAL de tu Sheet, que es "un bloque por
indicador":

```
Fila 3:   [ENCUESTA NACIONAL...] | mar 2018 | jun 2018 | sep 2018 | dic 2018 | mar 2019 | ...
Fila 4:   Percepción de inseguridad                    ← título del bloque
Fila 5:   Percepción de inseguridad en su ciudad        ← subtítulo
Fila 6:   Nacional          | 76.8% | 75.9% | ...
Fila 7:   Zapopan           | N/A   | 73.8% | ...
Fila 8:   Guadalajara       | 72.6% | 82.4% | ...
Fila 9:   Tonalá            | N/A   | 78.0% | ...
Fila 10:  Tlajomulco        | N/A   | 78.5% | ...
Fila 11:  Tlaquepaque       | N/A   | 74.5% | ...
Fila 12:  Puerto Vallarta   | 51.9% | 36.6% | ...
Fila 13:  Media Estatal     | 62.3% | 70.6% | ...
Fila 14:  Desempeño de la PolicíaEstatal                ← siguiente bloque, se repite el patrón
...
```

El parser **ya no asume un número fijo de indicadores ni de filas por
bloque**: encuentra solo la fila de encabezados de periodo (busca la
primera fila con varias celdas tipo "mar 2018"), y de ahí en adelante
reconoce automáticamente cada bloque por sus 8 nombres de área
(Nacional, Zapopan, Guadalajara, Tonalá, Tlajomulco, Tlaquepaque, Puerto
Vallarta, Media Estatal) — sin importar cuántos indicadores tengas ni si
agregas más abajo. Cada indicador se muestra como su propia tarjeta,
automáticamente.

"Nacional" y "Media Estatal" se usan como líneas de comparación (elegibles
en el selector "Comparar contra"), y el resto de las áreas son los
municipios seleccionables.

## Por qué no cargaba en GitHub Pages (ya corregido, dos veces)

1. **CORS**: la primera versión usaba `fetch()` contra
   `.../export?format=csv`, que Google nunca sirve con cabeceras CORS —
   cualquier `fetch()` desde un dominio que no sea `docs.google.com` (como
   `github.io`) se bloquea siempre, sin importar el permiso del Sheet. Ya
   corregido: la carga en vivo ahora inyecta un `<script>` apuntando al
   endpoint de Google Visualization (`gviz/tq`), técnica JSONP que no está
   sujeta a CORS.
2. **Estructura asumida incorrecta**: antes de ver tu captura, asumí un
   formato "una fila por Indicador+Área" que NO es como está tu Sheet en
   realidad. Ya corregido con el parser de bloques descrito arriba.

También hay un aviso visible en la propia página (no solo en consola) si
algo vuelve a fallar, con el motivo exacto — y un archivo `.nojekyll` en la
raíz para que GitHub Pages sirva los archivos tal cual.

## Datos de muestra (respaldo)

Mientras se confirma que la carga en vivo funciona, `js/ensu-sample-data.js`
trae datos **reales**, transcritos de tu captura de pantalla: los 8
trimestres completos que se alcanzaban a ver (mar 2018 a dic 2019) para
"Percepción de inseguridad" (los 8 municipios/áreas) y para "Desempeño de
la Policía Estatal" (solo Nacional y Zapopan, porque el resto de esas
filas quedaba fuera de la captura — no inventé el resto).

## Contenido del paquete

```
index.html
.nojekyll                          ← evita que GitHub Pages use Jekyll
README.md
assets/
  logo-cges.png
  logo-fiscalia.png
css/
  design-system.css                ← el mismo sistema de diseño, sin tocar
  ensu.css                         ← estilos nuevos (tarjetas clicables, modal, chips)
js/
  google-sheets-connector.js       ← carga JSONP + parser de bloques (real)
  ensu-sample-data.js              ← respaldo con datos reales de tu captura
  app.js                           ← lógica de la app (todo dinámico, ya no hardcodeado)
```

## Lista de verificación para el despliegue en GitHub Pages
1. `index.html` debe quedar en la raíz del repo (o en `/docs` si así
   configuraste Pages), con `css/`, `js/`, `assets/` como carpetas
   hermanas — no dentro de una subcarpeta extra.
2. GitHub Pages es sensible a mayúsculas/minúsculas en los nombres de
   archivo.
3. Prueba local antes de subir: `python3 -m http.server 8000` desde la
   carpeta del proyecto, abre `http://localhost:8000`.
4. Si algo falla, ahora deberías ver un aviso en la página (amarillo si
   son datos de muestra, rojo si es un error inesperado) con el motivo
   exacto — cópialo y compártemelo si necesitas ayuda.

## Siguiente paso

Recarga la página desplegada. Si tu Sheet ya está compartido como
"Cualquier usuario con el enlace puede ver", deberías ver TODOS tus
indicadores reales (no solo los 2 de la muestra) y todo tu histórico
completo, no solo 2018-2019. Si en vez de eso ves el aviso amarillo,
copia el mensaje de "Motivo:" que aparece ahí y lo resolvemos directo.

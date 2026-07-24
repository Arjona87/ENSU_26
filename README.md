# ENSU Jalisco — Percepción sobre Seguridad Pública

Réplica del proyecto "Reporte Semanal de Incidencia Delictiva", reutilizando
la misma paleta de colores, header con dos logos + título centrado, tarjetas
de resumen, y el conector de Google Sheets — ahora aplicado a datos de la
**ENSU (Encuesta Nacional de Seguridad Pública Urbana)** del INEGI, con foco
en Jalisco, sus municipios y su comparación contra el promedio nacional.

## ⚠️ Por qué no funcionaba en GitHub Pages (ya corregido)

La primera versión usaba `fetch()` contra
`.../export?format=csv`. Ese endpoint de Google **no manda cabeceras
CORS**, así que cualquier `fetch()` hecho desde un dominio que no sea
`docs.google.com` — como tu sitio en `github.io` — es bloqueado por el
navegador con un error de CORS. Esto pasa siempre, sin importar qué tan
público esté el Sheet; por eso ajustar el permiso de compartir no lo
arregló.

**Ya lo corregí:** ahora la carga en vivo usa el endpoint de Google
Visualization (`gviz/tq`) con la técnica JSONP clásica (inyectar un
`<script>` en vez de usar `fetch`). Un `<script src="...">` no está
sujeto a CORS — es la misma razón por la que puedes cargar Chart.js desde
un CDN — así que esto sí funciona en GitHub Pages. El detalle está en
`js/google-sheets-connector.js`.

También agregué:
- Un **mensaje de error visible en la página** (no solo en consola) si
  algo vuelve a fallar, con el motivo exacto.
- Un archivo `.nojekyll` en la raíz, para que GitHub Pages sirva los
  archivos tal cual, sin pasarlos por Jekyll.

El requisito de permiso **sigue existiendo**: el Sheet debe estar
compartido como "Cualquier usuario con el enlace puede ver".

Mientras se confirma que todo carga bien, la página sigue teniendo un
respaldo de **datos de muestra** (`js/ensu-sample-data.js``) para no
quedar en blanco. Los únicos números ahí tomados de fuentes reales de
INEGI/IIEG son los últimos 3 trimestres de "Percepción de inseguridad"
para Guadalajara, Zapopan, Puerto Vallarta y el Promedio Nacional — el
resto son valores generados solo para que la interfaz se vea completa.

### Lista de verificación para el despliegue en GitHub Pages
1. **Estructura de carpetas**: en el repo, `index.html` debe quedar en la
   raíz (o en `/docs` si configuraste Pages así), con `css/`, `js/` y
   `assets/` como carpetas hermanas al mismo nivel — no dentro de una
   subcarpeta extra como `ENSU_26/ensu-jalisco/index.html`.
2. **Mayúsculas/minúsculas**: GitHub Pages es sensible a mayúsculas
   (a diferencia de Windows/Mac). `css/design-system.css` debe llamarse
   exactamente así, no `CSS/Design-System.css`.
3. **Prueba rápida antes de subir**: desde la carpeta del proyecto,
   corre `python3 -m http.server 8000` y abre
   `http://localhost:8000` — si funciona ahí pero no en GitHub Pages, el
   problema casi siempre es de rutas/mayúsculas al subir.
4. Si algo vuelve a fallar, ahora deberías ver un aviso en la página con
   el motivo. Si no aparece nada en absoluto (página en blanco), abre las
   herramientas de desarrollador del navegador (F12) → pestaña "Console"
   y "Network", busca líneas en rojo o 404, y compárteme ese texto.

### Para conectar tu Sheet real, sigo necesitando confirmar:
1. **Estructura de columnas**: `processSheetData()` en
   `js/google-sheets-connector.js` espera por ahora:

   ```
   Indicador | Área | T1 2021 | T2 2021 | ... | T1 2026
   ```

   una fila por cada combinación Indicador + Área (ej. "Percepción de
   inseguridad" + "Zapopan"). Si tu Sheet está armado distinto (por
   ejemplo, una pestaña por indicador, o los municipios como columnas en
   vez de filas), dime cómo está y ajusto esa función — el resto del
   proyecto (carga JSONP, tarjetas, gráfica) no cambia.
2. **Nombres exactos** de indicadores y municipios en tu Sheet, para que
   coincidan con las claves que usa `js/app.js` (ahora mismo asume los 6
   municipios de la ENSU en Jalisco: Guadalajara, Zapopan, San Pedro
   Tlaquepaque, Tlajomulco de Zúñiga, Tonalá y Puerto Vallarta, más
   Promedio Nacional).

## Contenido del paquete

```
index.html                         ← página principal
README.md                          ← este archivo
assets/
  logo-cges.png
  logo-fiscalia.png
css/
  design-system.css                ← el mismo sistema de diseño, sin tocar
  ensu.css                         ← estilos nuevos (tarjetas clicables, modal, chips)
js/
  google-sheets-connector.js       ← fetch + parseo CSV (reutilizados) + processSheetData() nuevo
  ensu-sample-data.js              ← datos de respaldo mientras se conecta el Sheet real
  app.js                           ← lógica de la app: tarjetas, comparación, gráfica histórica
```

## Qué hace la página

- **Header** (idéntico al proyecto anterior): logos de CGES y Fiscalía a la
  izquierda, título centrado, y a la derecha un selector de municipio, un
  selector de "comparar contra" (Promedio Nacional o promedio del Área
  Metropolitana de Guadalajara) y un botón para refrescar los datos.
- **Tarjetas de indicador**, una por cada uno de los 6 temas: percepción de
  inseguridad, victimización en el hogar, confianza en la policía
  municipal, expectativa sobre delincuencia, cambio de hábitos por temor, y
  desempeño del gobierno. Cada tarjeta muestra el valor más reciente para
  el municipio elegido, la variación contra el trimestre anterior (con el
  mismo código de color verde/rojo/naranja del sistema de diseño), y una
  comparación directa contra el Promedio Nacional o AMG.
- **Clic en cualquier tarjeta** abre un modal con una gráfica de línea
  (Chart.js) mostrando el comportamiento histórico completo de ese
  indicador para el municipio elegido, junto con la línea comparativa.

## Sobre buscar información faltante en internet

Puedo confirmar cifras puntuales publicadas por INEGI/IIEG (boletines
trimestrales, fichas informativas) para rellenar huecos específicos, y
ya usé esas fuentes para los tres trimestres más recientes de percepción
de inseguridad en la muestra. Lo que no puedo hacer de forma confiable es
reconstruir series históricas completas y exactas para los 6 indicadores
y los 6 municipios desde cero por búsqueda web — esos boletines no
siempre publican el desglose completo por municipio y tema, y armar esa
serie a mano tiene alto riesgo de error. Lo más sólido es tu Google Sheet
(si ya vas a capturar los tabulados oficiales de INEGI ahí) o que me
compartas los tabulados/planos de datos del INEGI directamente — con eso
sí puedo ayudarte a poblar el histórico real, indicador por indicador.

## Siguiente paso

1. Ajusta el permiso para compartir del Sheet.
2. Confírmame la estructura real de columnas (o pégame las primeras
   filas).
3. Ajusto `processSheetData()` y quito el aviso de "datos de muestra".

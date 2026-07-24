# ENSU Jalisco — Percepción sobre Seguridad Pública

Réplica del proyecto "Reporte Semanal de Incidencia Delictiva", reutilizando
la misma paleta de colores, header con dos logos + título centrado, tarjetas
de resumen, y el conector de Google Sheets — ahora aplicado a datos de la
**ENSU (Encuesta Nacional de Seguridad Pública Urbana)** del INEGI, con foco
en Jalisco, sus municipios y su comparación contra el promedio nacional.

## ⚠️ Pendiente antes de que muestre datos reales

Intenté leer tu Google Sheet
(`1Az2aE6Mb3RKIwjJjsGBfQYH5dr6RsZjuVVME1CmvSag`, pestaña `gid=1672888382`)
y la petición regresó **401 (no autorizado)**. Esto casi siempre significa
que el Sheet todavía no está compartido como **"Cualquier usuario con el
enlace puede ver"** — el mismo requisito que ya tenía el proyecto anterior.

Mientras tanto, la página funciona completa con **datos de muestra**
(`js/ensu-sample-data.js`), para que puedas ver y probar toda la
interacción (tarjetas, comparación, click para ver histórico) sin esperar.
Vas a ver un aviso amarillo en la página mientras esto pase.

**Los únicos números tomados de fuentes reales de INEGI/IIEG** dentro de la
muestra son los últimos 3 trimestres de "Percepción de inseguridad" para
Guadalajara, Zapopan, Puerto Vallarta y el Promedio Nacional. El resto de
los trimestres y el resto de los indicadores son valores generados solo
para que la interfaz se vea completa — no los cites como dato oficial.

### Para conectar tu Sheet real, necesito confirmar:
1. **Permiso de acceso**: cambia el Sheet a "Cualquier usuario con el enlace
   puede ver".
2. **Estructura de columnas**: `processSheetData()` en
   `js/google-sheets-connector.js` espera por ahora:

   ```
   Indicador | Área | T1 2021 | T2 2021 | ... | T1 2026
   ```

   una fila por cada combinación Indicador + Área (ej. "Percepción de
   inseguridad" + "Zapopan"). Si tu Sheet está armado distinto (por
   ejemplo, una pestaña por indicador, o los municipios como columnas en
   vez de filas), dime cómo está y ajusto esa función — el resto del
   proyecto (fetch, parseo de CSV, tarjetas, gráfica) no cambia.
3. **Nombres exactos** de indicadores y municipios en tu Sheet, para que
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

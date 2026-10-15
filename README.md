# Finanzas

Aplicación web de finanzas personales en español y en pesos colombianos (COP).
Registra ingresos y gastos, controla presupuestos, ahorro y deudas, muestra gráficos
y genera un análisis automático de tus finanzas.

## Publicar en GitHub Pages
1. Crea un repositorio nuevo en GitHub (por ejemplo `finanzas`).
2. Sube **todo el contenido de esta carpeta** a la raíz del repositorio
   (`index.html` debe quedar en la raíz, junto a las carpetas `css` y `js`).
3. Ve a **Settings → Pages**.
4. En *Build and deployment* elige **Deploy from a branch**, rama **main** y carpeta **/ (root)**. Guarda.
5. En uno o dos minutos la app estará en `https://TU-USUARIO.github.io/finanzas/`.

## Probar en tu computador
Abre una terminal en esta carpeta y ejecuta:

    python -m http.server 8080

Luego abre http://localhost:8080

## Estructura
| Archivo | Qué contiene |
|---|---|
| `index.html` | Estructura de la página y orden de carga |
| `css/styles.css` | Estilos y diseño responsive |
| `js/utilidades.js` | Fechas, formato de pesos, catálogos |
| `js/logica.js` | Cálculos financieros, análisis y validación |
| `js/datos-demo.js` | Datos de ejemplo |
| `js/almacenamiento.js` | Guardado en el navegador |
| `js/store.js` | Estado global y acciones |
| `js/ui-base.js` | Íconos, avisos, modales y campos |
| `js/movimientos.js` | Formulario y lista de movimientos |
| `js/graficos.js` | KPI, gráfico donut y barras |
| `js/modulos.js` | Presupuestos, ahorro, deudas, análisis y calendario |
| `js/historial.js` | Filtros, historial y categorías |
| `js/exportar.js` | Exportación a Excel, CSV y PDF |
| `js/app.js` | App principal y arranque |

Los archivos `js/` se cargan en ese orden y comparten variables globales, así que
si agregas uno nuevo, inclúyelo en `index.html` antes de `app.js`.

## Datos
Se guardan en el navegador de cada persona (localStorage). Cada visitante ve solo sus
propios datos. Exporta a Excel o CSV de vez en cuando como respaldo.

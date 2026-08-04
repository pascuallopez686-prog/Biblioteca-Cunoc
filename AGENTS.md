# AGENTS.md — Biblioteca Digital CUNOC

Portal web estático (HTML/CSS/JS vanilla) para la carrera de Trabajo Social del CUNOC-USAC. Persistencia solo en localStorage.

## Stack

- HTML5 + CSS3 + JavaScript ES6+ (vanilla, sin frameworks)
- Font Awesome 6.5.0 (CDN)
- Google Fonts (Merriweather)
- Sin backend, sin build step, sin bundler

## Comandos

```sh
# Servir localmente (puerto 8080)
npx live-server
```

No hay test, lint, typecheck ni build.

## Errores a corregir antes de GitHub + Vercel

### Seguridad (bloqueante)
1. **`credenciales.txt`** — contiene contraseñas de admin en texto plano. Eliminarlo y agregarlo a `.gitignore`.
2. **Hardcoded passwords en `script.js:75-97`** — `admin123`, `colab123`, `docente123`, `12345` como fallback. Eliminar o comentar todo el bloque de validación en texto plano.
3. **Contraseñas de estudiantes en texto plano** — `script.js:202` guarda `u.password` sin hash.

### Funcionales
4. **IDs rotos en `script.js`** — referencian elementos que no existen en `index.html`:
   - `student-doc-form`, `student-ann-form` (líneas 732-733)
   - `student-doc-type`, `student-doc-title`, `student-doc-link` (líneas 551-554)
   - `student-ann-title`, `student-ann-content` (líneas 570-571)
   - `repositorio-list` (línea 651), `filter-btn` (líneas 741-748)
   - Causan errores en consola al cargar.
5. **Integrity hash inválido** — `index.html:10`, el hash SRI de Font Awesome 6.5.0 no corresponde al archivo real. Quitar `integrity` o generar el hash correcto.
6. **Imágenes faltantes**: `imags/aetsro1.jpg`, `aetsro2.jpg`, `aetsro3.jpg` (tienen `onerror` que las oculta, no rompen el layout).

### Archivos huérfanos
7. **`html.md`** — contiene HTML de una versión anterior con diseño de tarjetas para cursos, no se usa actualmente.
8. **`imags/l/`** — 16 iconos PNG de cursos, sobrantes de la versión anterior.
9. **`aja`** — archivo con `live-server`, probablemente accidental.

## Despliegue en Vercel

- Es sitio estático — Vercel lo detecta automáticamente.
- No necesita `vercel.json` a menos que quieras cabeceras personalizadas (CSP, etc.).
- Si quieres SPA fallback para rutas, agregar `vercel.json`:
  ```json
  { "rewrites": [ { "source": "/(.*)", "destination": "/index.html" } ] }
  ```

## Notas de arquitectura

- `index.html` — todo el HTML en un solo archivo (~706 líneas)
- `script.js` — toda la lógica (~882 líneas), listeners en `DOMContentLoaded`
- `style.css` — todos los estilos (~638 líneas), incluye modo oscuro vía `.dark`
- `package.json` — solo nombre/versión, sin scripts útiles
- No hay `vercel.json` ni `.gitignore` — hay que crearlos

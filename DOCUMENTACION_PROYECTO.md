# DOCUMENTACIÓN COMPLETA DE DESARROLLO Y CAMBIOS
## Proyecto: Biblioteca Digital CUNOC – USAC (Trabajo Social)

---

### 1. Información General del Proyecto
- **Institución / Carrera:** Universidad de San Carlos de Guatemala (CUNOC) — Trabajo Social
- **Plataforma:** Portal Web Estático (Acceso Abierto, Repositorio Digital, Emprendimientos y Recursos Académicos)
- **Stack Tecnológico:** HTML5 Vanilla, CSS3 (Variables CSS, Animaciones keyframes, Flexbox/Grid), JavaScript ES6+ Vanilla (Sin frameworks ni bundlers)
- **CDN:** Font Awesome 6.5.0, Google Fonts (Inter & Merriweather)
- **Persistencia:** `localStorage` (Navegador)
- **Despliegue:** Vercel Static Hosting (GitHub CD Automático)
- **Repositorio Git:** `https://github.com/pascuallopez686-prog/Biblioteca-Cunoc`
- **Ramas Git:**
  - `main` (Rama principal de producción)
  - `feature/depuracion-y-rediseno` (Rama de desarrollo y refactorización)

---

### 2. Cronología Completa de Commits y Evolución del Código

A continuación se detalla el historial de commits desde la creación e inicialización del proyecto hasta su versión final:

| Commit Hash | Descripción del Cambio |
| :--- | :--- |
| `878eda0` | Implementación de autenticación segura con Vercel Serverless Functions. |
| `148b909` | Fix de robustez en autenticación de login y adición de script de servidor local dev (`dev-server.js`). |
| `9c62612` | Limpieza del proyecto para preparación de despliegue en GitHub y Vercel. |
| `b15b99ac` | Subida inicial del proyecto Biblioteca-Cunoc. |
| `a8f0b50` | Fix de GIFs estáticos, banner incorrecto y estilos responsivos de tarjetas móviles con versión de caché. |
| `7c8578a` | Migración del muro de anuncios a Supabase API — Noticias compartidas para estudiantes (límite 50 / 3 días). |
| `c729f72` | Adición del tour guiado en el encabezado (Header Guided Tour) tras ingresar. |
| `2336382` | Asignación automática de IDs de botones para la activación del tour guiado. |
| `aa596a1` | Tour paso a paso con resaltado de elementos e indicador de progreso. |
| `bb9d6ae` | Corrección de layout y tiempos en el tour, exclusión del botón cerrar sesión y helper de consola. |
| `576ebe4` | Activación automática del tour guiado al registrar un nuevo estudiante. |
| `24ceb99` | Títulos y descripciones enriquecidas en tarjetas flotantes del tour y seguimiento por usuario. |
| `ec03a52` | Forzar tour en primer login e incremento de versión CSS/JS (`v=2.0`) para invalidar caché. |
| `ab56437` | Bloqueo de apertura del modal de acceso administrador durante la ejecución del tour guiado. |
| `9ce612e` | Módulo de emprendimientos, corrección de acceso al portal y rediseño interactivo de pantalla de bienvenida. |
| `dfe0a33` | Corrección de estelas canvas en alta definición (retina/DPR) y recalculación dinámica al redimensionar. |
| `2544bfa` | Fix de animación en pantalla de bienvenida (TDZ) y eliminación de reglas CSS duplicadas. |
| `8b9e9b0` | Acceso público a anuncios en API y refinamiento del CSS responsivo para pantallas móviles. |
| `28bc195` | Integración de animación avanzada con Bokeh, física de partículas tipo hojas de libros y ráfagas de luz. |
| `4920ba8` | Sincronización persistente del muro de noticias público y remoción de stubs de librería sin uso. |
| `5a48dd5` | Corrección de animación canvas en PCs de escritorio e incorporación de subida de imágenes para emprendimientos. |
| `ea10403` | Bloqueo de selección de texto en arrastre del mouse y enriquecimiento de efectos de partículas de luz. |
| `5a7229a` | Adición del marco animado de aura Conocimiento y Aprendizaje en la sección principal. |
| `fbf82c1` | Incremento de versión de activos CSS a `v=3.0` para la eliminación de caché persistente de navegador. |
| `43ab878` | Ajuste de estilos del recuadro de bienvenida y traslado de la animación Conocimiento al recuadro azul hero. |
| `9569756` | Adición de canvas animado `#hero-canvas` con símbolos flotantes de conocimiento y red de constelaciones. |
| `a6e420c` | Fix de auto-dimensionamiento canvas cuando el portal inicia oculto (`display: none`) e interconectividad con el mouse. |
| `e8beb28` | Bloqueo global de selección de texto (`user-select: none !important`) y rotador dinámico diario de paletas oscuras. |

---

### 3. Auditoría de Errores y Seguridad (Puntos Críticos Corregidos)

Durante el proceso de depuración y preparación para el entorno de producción (GitHub + Vercel), se identificaron y solucionaron los siguientes problemas:

#### A. Seguridad y Credenciales (Bloqueantes Solucionados)
1. **`credenciales.txt` en el repositorio:**
   - *Problema:* El repositorio contenía un archivo de texto con contraseñas de administrador en texto plano.
   - *Solución:* Se eliminó del control de versiones y se añadió la regla al archivo `.gitignore` para evitar filtración de credenciales.
2. **Contraseñas hardcoded en código cliente (`script.js`):**
   - *Problema:* Existían claves en texto claro (`admin123`, `colab123`, `docente123`, `12345`) hardcodeadas para la validación de roles.
   - *Solución:* Se limpió y refactorizó la lógica de autenticación, separando roles y evitando almacenamiento inseguro en cliente.
3. **Contraseñas de usuarios estudiantes en `localStorage`:**
   - *Problema:* La función de registro guardaba la propiedad `u.password` sin procesar ni encriptar.
   - *Solución:* Se eliminó la persistencia innecesaria de credenciales en texto plano en el almacenamiento local.

#### B. Errores Funcionales de Referencia y JavaScript (IDs Rotos Solucionados)
Se corrigieron errores en consola causados por `document.getElementById` que hacían referencia a elementos inexistentes en `index.html`:
- Formulario de documentos de estudiantes: `student-doc-form`, `student-ann-form`
- Campos de carga de estudiantes: `student-doc-type`, `student-doc-title`, `student-doc-link`
- Campos de avisos: `student-ann-title`, `student-ann-content`
- Lista de repositorio y botones de filtro: `repositorio-list`, `filter-btn`

#### C. Integridad de CDN y Limpieza de Código Huérfano
- **Font Awesome SRI Hash:** Se corrigió el hash de integridad inválido (`integrity=...`) en la etiqueta `<link>` de Font Awesome 6.5.0 que bloqueaba la carga de iconos por política CORS/SRI.
- **Imágenes Faltantes:** Se agregaron controladores `onerror` en imágenes como `imags/aetsro1.jpg`, `aetsro2.jpg`, `aetsro3.jpg` para prevenir roturas de maquetación en caso de ruta no encontrada.
- **Archivos Huérfanos Removidos:**
  - `html.md` (código HTML en desuso de una versión previa de tarjetas).
  - Carpeta `imags/l/` (16 iconos PNG residuales).
  - Archivo binario/script temporal `aja`.

---

### 4. Módulos Desarrollados y Arquitectura de Software

#### 1. Pantalla de Bienvenida Interactiva (`#welcome-screen`)
- **Lienzo HTML5 Canvas (`#ws-canvas`):** Renderiza animación continua en alta definición (recalculando el `devicePixelRatio` para pantallas Retina/4K).
- **Física de Partículas & Chispas:**
  - Hojas flotantes de libros (efecto de derivación horizontal y rotación con la física del viento).
  - Círculos de luz Bokeh en segundo plano con opacidad suave.
  - Generación de estela de chispas y ondas expansivas doradas al hacer clic o mover el puntero.
- **Efecto Lámpara / Cursor (`#ws-lampara`):** Viñeta radial que sigue las coordenadas `(x, y)` del puntero del usuario en tiempo real.
- **Compatibilidad con Escritorio & Móvil:** Se removió la pausa obligatoria por `prefers-reduced-motion` que impedía que la animación funcionara en navegadores de PC.
- **Control de Selección:** Se inyectó `user-select: none !important` para impedir que el usuario seleccione texto al arrastrar el puntero por la pantalla.

#### 2. Módulo de Emprendimientos (Panel de Administrador + Vista Pública)
- **Almacenamiento Local (`localStorage`):** Permite publicar, editar y eliminar emprendimientos comunitarios.
- **Subida de Imágenes en Base64:**
  - Control `<input type="file" accept="image/*">` integrado en el formulario de la sección Administrador.
  - Lector de archivos `FileReader` que convierte la imagen subida a formato Data URL Base64.
  - Control de peso (límite de 2MB por imagen para optimizar espacio en `localStorage`).
  - Previsualización en vivo en la interfaz antes de guardar, botón para remover imagen seleccionada, y renderizado optimizado en las tarjetas del portal.

#### 3. Caja de Bienvenida Hero (`.hero-section`) con Canvas de Conocimiento
- **Animación `#hero-canvas`:** Ubicada en el recuadro azul principal del portal (pestaña Inicio).
- **Partículas de Aprendizaje:** Dibujado de símbolos flotantes (`📖`, `🎓`, `💡`, `🔬`, `⚙️`, `🧠`, `📐`, `📚`) con rotación y oscilación suave.
- **Red de Constelaciones:** Puntos de luz que se conectan entre sí mediante líneas dinámicas cuando la distancia es menor a 130px.
- **Interacción con el Cursor:** Las conexiones trazan líneas de resplandor dorado hacia la posición del mouse cuando el usuario explora la sección.
- **Fix de Dimensionamiento Cero (`0x0`):** Implementación de verificación continua `checkResize()` que mide las dimensiones exactas (`getBoundingClientRect()`) cuando el contenedor pasa de `display: none` a `display: flex`.

#### 4. Sistema Rotativo Diario de Paleta de Colores Oscuros (Daily Dark Theme)
- Algoritmo JavaScript ejecutado en el encabezado que toma el día actual de la semana (`new Date().getDay()`) y configura dinámicamente las variables de color CSS (`--daily-bg`, `--daily-hero-bg`) y la paleta de partículas (`DAILY_THEME_COLORS`):

| Día | Nombre del Tema Oscuro | Color Base de Fondo | Tonalidades de Partículas / Acentuación |
| :--- | :--- | :--- | :--- |
| **0 (Domingo)** | Obsidian Black & Gold | `#050508` | Dorado, Ámbar, Blanco (`#f0c987`, `#d4a15c`) |
| **1 (Lunes)** | Midnight Navy & Cyan | `#030814` | Cyan Neón, Azul Eléctrico (`#00f2fe`, `#4facfe`) |
| **2 (Martes)** | Deep Emerald & Jade | `#020d08` | Verde Menta, Esmeralda (`#00ffcc`, `#2ecc71`) |
| **3 (Miércoles)** | Royal Amethyst & Violet | `#0b0514` | Violeta Imperial, Púrpura (`#9b51e0`, `#c77dff`) |
| **4 (Jueves)** | Platinum Charcoal & Silver | `#08090c` | Gris Plata, Platino (`#f8fafc`, `#cbd5e1`) |
| **5 (Viernes)** | Crimson Ruby & Flame Noir | `#0f0407` | Rojo Carmesí, Rosa Neón (`#ff4d6d`, `#ff758f`) |
| **6 (Sábado)** | Deep Cobalt & Indigo | `#050914` | Cobalto Eléctrico, Índigo (`#4361ee`, `#4895ef`) |

---

### 5. Guía de Despliegue y Mantenimiento para Futuros Proyectos

#### A. Servir Localmente (Entorno de Desarrollo)
No se requiere paso de compilación ni bundlers (Webpack, Vite, etc.). Para ejecutar localmente:
```sh
# Opción 1: live-server
npx live-server

# Opción 2: Node.js server local incorporado
node dev-server.js
```

#### B. Despliegue en Vercel
1. Conectar el repositorio de GitHub a la consola de Vercel.
2. Vercel detectará automáticamente que es un proyecto **Static Site**.
3. **Framework Preset:** `Other` / `None`.
4. **Build Command:** *(Dejar vacío)*.
5. **Output Directory:** `.` *(Directorio raíz)*.

#### C. Invalidación de Caché en Cambios Futuros
Cuando realices cambios en `style.css` o `script.js`, actualiza la etiqueta del parámetro de versión en `index.html` para forzar a los navegadores y a la CDN de Vercel a descargar la última versión sin usar archivos en caché:
```html
<link rel="stylesheet" href="style.css?v=3.4">
<script src="script.js?v=2.1"></script>
```

---
*Documentación generada y registrada automáticamente para el proyecto Biblioteca Digital CUNOC.*

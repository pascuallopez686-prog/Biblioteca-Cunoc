# Biblioteca Digital CUNOC – Trabajo Social

Plataforma web institucional para recursos académicos, avisos, repositorio y comunicación estudiantil del CUNOC.

## Estructura del proyecto

```
├── index.html              # Página principal
├── style.css               # Estilos (responsive móvil + escritorio)
├── script.js               # Lógica del cliente
├── api/
│   ├── _lib/               # Utilidades compartidas (NO expuestas como endpoints en Vercel)
│   │   ├── env.js          # Carga de .env.local en desarrollo
│   │   ├── session.js      # Creación y verificación de tokens de sesión
│   │   ├── supabase.js     # Consultas a la API REST de Supabase
│   │   ├── student-hash.js # Hash de contraseñas de estudiantes
│   │   └── require-auth.js # Middleware de autenticación
│   ├── auth/               # Endpoints de autenticación
│   │   ├── login.js        # Login admin/docente/aso
│   │   ├── verify.js       # Verificar token de sesión
│   │   ├── student-login.js
│   │   └── student-register.js
│   ├── students/
│   │   └── index.js        # Listar y gestionar estudiantes (admin)
│   └── aetsro-documents.js # Listar PDFs desde Supabase Storage
├── supabase/
│   ├── schema.sql          # Tablas de la base de datos
│   └── seed_admin_users.sql
├── imags/                  # Imágenes (los GIFs >38MB van en .gitignore)
├── images/                 # Logos de cursos e instituciones
├── dev-server.js           # Servidor local de desarrollo
├── vercel.json             # Configuración de rutas para Vercel
└── .env.example            # Plantilla de variables de entorno
```

> **Nota sobre GIFs grandes:** `usac1_hd.gif` (40 MB) y `aetsro_hd.gif` (38 MB) están en `.gitignore`
> por superar los límites recomendados de GitHub. Para desarrollo local, colócalos en `imags/`
> manualmente. Para producción en Vercel, aloja los GIFs en Supabase Storage o en otro CDN y
> actualiza las rutas en `index.html` y `script.js`.

## Configurar Supabase

1. Crear proyecto gratis en [supabase.com](https://supabase.com).
2. Ir a **SQL Editor** → pegar y ejecutar `supabase/schema.sql`.
3. Ejecutar `supabase/seed_admin_users.sql` para insertar los usuarios administrativos.
4. En **Project Settings → API**, copiar:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** key (secreta) → `SUPABASE_SERVICE_ROLE_KEY`
5. Pegar esos valores en `.env.local` junto con `SESSION_SECRET`.

## Desarrollo local

1. Copiar variables:
   ```bash
   cp .env.example .env.local
   ```
2. Completar `SESSION_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y hashes admin.
3. Generar `SESSION_SECRET`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
4. Iniciar servidor:
   ```bash
   npm run dev
   ```
5. Abrir [http://localhost:3000](http://localhost:3000).

## APIs disponibles

| Ruta | Método | Descripción |
|------|--------|-------------|
| `/api/auth/student-register` | POST | Registro estudiante |
| `/api/auth/student-login` | POST | Login estudiante |
| `/api/auth/login` | POST | Login admin/docente/aso |
| `/api/auth/verify` | POST | Validar token de sesión |
| `/api/students` | GET | Listar estudiantes (admin) |
| `/api/students` | PATCH | Silenciar/desilenciar (admin) |
| `/api/aetsro-documents` | GET | Listar PDFs de Supabase Storage |

## Despliegue en Vercel

1. Subir el repositorio a GitHub (asegurarse de que los GIFs grandes no estén en el repo).
2. Importar en [vercel.com](https://vercel.com) (Framework: **Other**).
3. Configurar **todas** las variables de `.env.example` en **Project Settings → Environment Variables**.
4. Deploy.

> **Importante:** Vercel ignora automáticamente los archivos y carpetas con prefijo `_` (como `api/_lib/`),
> por lo que las utilidades compartidas no se exponen como endpoints públicos.

## Diseño responsive

La web se adapta a **móvil y escritorio**:
- Menú hamburguesa en pantallas < 768px
- Grids de cursos/IA en una columna en móvil
- Modales y formularios a ancho completo en teléfono
- Sin scroll horizontal forzado

## Notas de seguridad

- Nunca subir `.env.local` ni la `service_role` key al repositorio.
- Contraseñas de estudiantes: hash SHA-256 en servidor (con carné como sal).
- Tokens de sesión firmados con HMAC-SHA256 usando `SESSION_SECRET`.
- El panel admin valida el token en cada acceso.
- Las utilidades en `api/_lib/` no son accesibles como endpoints en Vercel.

## Licencia

ISC

# Biblioteca Digital CUNOC – Trabajo Social

Plataforma web institucional para recursos académicos, avisos, repositorio y comunicación estudiantil del CUNOC.

## Estructura del proyecto

```
├── index.html          # Página principal
├── style.css           # Estilos
├── script.js           # Lógica del cliente (localStorage)
├── api/auth/login.js   # API serverless de autenticación admin
├── dev-server.js       # Servidor local de desarrollo
├── images/             # Íconos de tarjetas (cursos, IA, gobierno)
├── imags/              # Logos, GIFs y assets institucionales
└── .env.example        # Plantilla de variables de entorno
```

## Desarrollo local

1. Copiar variables de entorno:
   ```bash
   cp .env.example .env.local
   ```
2. Completar usuarios y hashes SHA-256 en `.env.local`.
3. Generar un hash:
   ```bash
   node -e "console.log(require('crypto').createHash('sha256').update('tu_contraseña').digest('hex'))"
   ```
4. Iniciar servidor:
   ```bash
   npm run dev
   ```
5. Abrir [http://localhost:3000](http://localhost:3000).

## Despliegue en Vercel

1. Subir el repositorio a GitHub.
2. En [vercel.com](https://vercel.com), importar el repositorio.
3. Framework Preset: **Other** (sitio estático + serverless functions).
4. En **Settings → Environment Variables**, agregar todas las variables de `.env.example` con valores reales.
5. Deploy.

La ruta `/api/auth/login` se despliega automáticamente desde `api/auth/login.js`.

## Despliegue en GitHub

```bash
git remote add origin https://github.com/TU_USUARIO/cunoc.git
git add .
git commit -m "Preparar proyecto para despliegue"
git push -u origin master
```

## Notas de seguridad

- **Nunca** subir `.env.local` ni archivos con contraseñas en texto plano.
- Las credenciales de admin viven solo en variables de entorno del servidor.
- Los datos de estudiantes (registro, documentos, avisos) se guardan en `localStorage` del navegador; no hay base de datos centralizada.

## Licencia

ISC

# 🌌 HIVEX — Premium Document & Media SaaS Dashboard

**HIVEX** es una plataforma SaaS de gestión de recursos y visualización de datos diseñada con una estética premium oscura y minimalista (*dark-mode glassmorphism*). Ofrece almacenamiento, análisis y reproducción fluida en tiempo real de gráficos de negocio, pistas de audio y videotecas modernas.

Desarrollada utilizando **Next.js 15**, **TypeScript**, **Tailwind CSS**, **Framer Motion**, **Recharts** y **Supabase**.

---

## ✨ Características Premium

- **🚀 Arquitectura Dual-Engine (Cero Configuración Inicial)**: Funciona de inmediato en modo demostración con un motor local en `localStorage` sembrado con datos de prueba realistas. Se conecta automáticamente a tu base de datos Supabase real al detectar las variables de entorno, sin romper la UX.
- **📊 Dashboard de Analíticas Intuitivo**: Panel general con estadísticas de uso agregadas en tiempo real y vista interactiva de los últimos documentos gestionados.
- **📈 Estación de Gráficos Interactivos (Recharts)**: Generador y visor interactivo de gráficos financieros o de negocio (Área, Barras, Líneas) con gradientes fluidos y personalización de colores de marca.
- **🎵 Estación de Audio Premium**: Reproductor con renderizado de ondas de sonido dinámicas, control de reproducción, volumen con silenciador, barra de progreso interactiva y disco giratorio de vinilo animado.
- **🎥 Videoteca Moderna**: Reproductor de video cinemático integrado con soporte de resoluciones, miniaturas personalizadas de alta definición y selectores directos de reproducción fluida.
- **🔒 Seguridad Integrada & RLS**: Control robusto de lectura y escritura a nivel de usuario en Supabase utilizando políticas de seguridad estrictas (Row Level Security).

---

## 🛠️ Tecnologías Utilizadas

- **Frontend**: Next.js 15, React 19, TypeScript
- **Estilos**: Tailwind CSS, Lucide React (Iconos premium)
- **Animaciones**: Framer Motion
- **Visualización**: Recharts
- **Base de Datos & Auth**: Supabase (PostgreSQL) con compatibilidad LocalStorage para modo demo de desarrollo.

---

## ⚙️ Configuración del Entorno de Desarrollo

El proyecto está diseñado para ejecutarse sin necesidad de un archivo `.env` inicial. Si deseas conectar tu base de datos Supabase real, sigue los pasos de integración:

### 1. Preparar la Base de Datos Supabase
Crea un proyecto en Supabase y ejecuta las consultas del archivo [`supabase_schema.sql`](file:///Users/juanma/Documents/HIVEX_backend/supabase_schema.sql) en el **SQL Editor** de tu consola de Supabase. Esto creará:
- Las tablas del proyecto (`documents`, `profiles`).
- Las políticas de seguridad (RLS) para proteger los archivos por cada ID de usuario registrado.
- Triggers automáticos para inicializar perfiles de usuario.

### 2. Configurar Variables de Entorno
Crea un archivo `.env.local` en la raíz del proyecto con tus credenciales de Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_supabase_anon_public_key
```

El cliente Supabase de Next.js detectará estas variables automáticamente y desactivará el motor de simulación para consumir los datos reales de PostgreSQL en la nube.

---

## 🚀 Despliegue en Producción

### 1. Preparación para GitHub
Para subir el proyecto a un repositorio de GitHub:

```bash
# Inicializar Git si no se ha hecho
git init

# Añadir cambios al stage
git add .

# Realizar el commit inicial de producción limpia
git commit -m "feat: initial premium release of HIVEX SaaS Dashboard"

# Enlazar con tu repositorio remoto de GitHub
git remote add origin https://github.com/TU_USUARIO/HIVEX_backend.git
git branch -M main

# Subir código a la rama principal
git push -u origin main
```

### 2. Despliegue en Vercel
Este proyecto está optimizado para compilarse y alojarse de manera ideal en **Vercel** de forma gratuita:

1. Ve a [Vercel](https://vercel.com) e inicia sesión con tu cuenta de GitHub.
2. Haz clic en **"Add New"** > **"Project"** y selecciona tu repositorio `HIVEX_backend`.
3. En la sección **Environment Variables** de la configuración del proyecto, añade tus claves de Supabase si deseas modo real (opcional, si se dejan vacías se desplegará el modo simulación interactivo perfecto para inversionistas/demostraciones):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Haz clic en **"Deploy"**. Vercel compilará la aplicación estáticamente en menos de 2 minutos.

---

## 📈 scripts Disponibles

En el directorio del proyecto, puedes ejecutar:

- `npm run dev`: Inicia el servidor de desarrollo local en [http://localhost:3000](http://localhost:3000).
- `npm run build`: Compila la aplicación de forma optimizada para producción con validación rigurosa de tipos.
- `npm run lint`: Ejecuta el análisis estático de código mediante ESLint para asegurar la máxima calidad.

---

Diseñado con dedicación y excelencia estética por **Antigravity** (Google DeepMind). 🌌

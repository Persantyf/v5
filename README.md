# YLIO App v2.1

Sistema de Gestión de Ofertas Fotovoltaicas

## Configuración

### 1. Base de Datos (Supabase)

1. Ve a [Supabase](https://supabase.com) y accede a tu proyecto
2. Ve a **SQL Editor**
3. Ejecuta el archivo `YLIO_BD_v2.1.sql` para crear todas las tablas

### 2. Variables de Entorno

#### Para desarrollo local:
Crea un archivo `.env` en la raíz del proyecto:

```
VITE_SUPABASE_URL=https://edhyacacepvfvjuwfzrp.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVkaHlhY2FjZXB2ZnZqdXdmenJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgzNzU4MTUsImV4cCI6MjA4Mzk1MTgxNX0.9M1Cs9OZi5FIzSKuzw5nT3H2Dq8PCoG1g2Xy6rlhQm0
```

#### Para Vercel:
1. Ve a tu proyecto en Vercel
2. Settings → Environment Variables
3. Añade las mismas variables

### 3. Desarrollo Local

```bash
npm install
npm run dev
```

### 4. Despliegue en Vercel

1. Sube el proyecto a GitHub
2. Conecta el repo a Vercel
3. Añade las variables de entorno
4. Deploy automático

## Estructura de la Base de Datos

### Tablas principales:
- `ofertas` - Datos generales de cada oferta
- `ofertas_sips` - Datos completos del archivo SIPS
- `ofertas_consumos_brutos` - Datos originales del CSV de consumos
- `ofertas_consumos_horarios` - Consumos procesados (8760 horas)

### Otras tablas:
- `ofertas_produccion_real` - Producción FV real
- `ofertas_produccion_simulada` - Producción FV simulada
- `ofertas_modulos_existentes` - Módulos FV existente
- `ofertas_inversores_existentes` - Inversores FV existente
- `ofertas_prop_modulos` - Módulos propuesta
- `ofertas_prop_inversores` - Inversores propuesta
- `ofertas_prop_areas` - Áreas de producción
- `ofertas_prop_baterias` - Baterías propuesta

## Funcionalidad de guardado

La app guarda automáticamente:
1. **Datos SIPS** cuando se carga el archivo
2. **Consumos brutos** cuando se carga el CSV original
3. **Consumos procesados** cuando se aplica el tratamiento de datos
4. **Datos generales** de la oferta

## Notas

- El RLS está deshabilitado para desarrollo
- En producción, habilitar RLS y crear políticas de seguridad

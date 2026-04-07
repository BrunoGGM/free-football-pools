#!/usr/bin/env bash
# =============================================================
# Script para aplicar migraciones al proyecto remoto de Supabase
# =============================================================
# Uso:
#   1. Agrega SUPABASE_ACCESS_TOKEN y SUPABASE_PASSWORD a tu .env
#   2. Ejecuta: bash scripts/migrate-remote.sh
# =============================================================
set -euo pipefail

# Cargar variables de entorno
if [[ -f .env ]]; then
  set -a
  source .env
  set +a
else
  echo "❌ No se encontró el archivo .env"
  exit 1
fi

# Validar variables requeridas
if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "❌ Falta SUPABASE_ACCESS_TOKEN en .env"
  echo "   Generalo en: https://supabase.com/dashboard/account/tokens"
  exit 1
fi

if [[ -z "${SUPABASE_PASSWORD:-}" ]]; then
  echo "❌ Falta SUPABASE_PASSWORD en .env"
  echo "   Es la contraseña de tu base de datos (la que creaste al fundar el proyecto)"
  exit 1
fi

# Extraer project-ref de la URL de Supabase
SUPABASE_URL="${NUXT_PUBLIC_SUPABASE_URL:-}"
if [[ -z "$SUPABASE_URL" ]]; then
  echo "❌ Falta NUXT_PUBLIC_SUPABASE_URL en .env"
  exit 1
fi
PROJECT_REF=$(echo "$SUPABASE_URL" | sed 's|https://||' | sed 's|\.supabase\.co.*||')
echo "📦 Project ref: $PROJECT_REF"

# Paso 1: Login
echo ""
echo "🔐 Paso 1/4: Autenticando en Supabase CLI..."
npx -y supabase login --token "$SUPABASE_ACCESS_TOKEN"
echo "✅ Login exitoso"

# Paso 2: Vincular proyecto
echo ""
echo "🔗 Paso 2/4: Vinculando proyecto remoto..."
echo "$SUPABASE_PASSWORD" | npx -y supabase link --project-ref "$PROJECT_REF" --password stdin
echo "✅ Proyecto vinculado"

# Paso 3: Push migraciones
echo ""
echo "🚀 Paso 3/4: Aplicando migraciones..."
npx -y supabase db push
echo "✅ Migraciones aplicadas"

# Paso 4: Generar tipos TypeScript
echo ""
echo "📝 Paso 4/4: Generando tipos TypeScript..."
mkdir -p types
npx -y supabase gen types --lang=typescript --project-id "$PROJECT_REF" > types/database.ts
echo "✅ Tipos generados en types/database.ts"

echo ""
echo "🎉 ¡Todo listo! Migraciones aplicadas y tipos generados."

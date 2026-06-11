#!/usr/bin/env bash
# Conclui o setup do Prisma Postgres. Requer:
#   - rede liberada para *.prisma.io (link) e para o host do banco
#   - PRISMA_API_KEY exportada no ambiente (NUNCA comitar a chave)
set -euo pipefail

: "${PRISMA_API_KEY:?Exporte PRISMA_API_KEY antes de rodar}"

DATABASE_ID="db_cmqa2ojjc0i3u0bf5eh84qads"

echo "1/5 Vinculando banco Prisma Postgres (grava DATABASE_URL no .env)…"
npx --yes --package=prisma@latest -- prisma postgres link --database "$DATABASE_ID"

echo "2/5 Criando migration inicial…"
npx prisma migrate dev --name init

echo "3/5 Gerando o Prisma Client…"
npx prisma generate

echo "4/5 Rodando o seed…"
npx prisma db seed

echo "5/5 Verificando conexão…"
npx tsx scripts/verify-prisma.ts

echo "Pronto. Próximos passos: npx prisma studio | import { prisma } from './lib/prisma'"

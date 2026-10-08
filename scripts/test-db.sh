#!/usr/bin/env bash
# Roda os testes RLS (pgTAP) e o teste de idempotência contra um Supabase LOCAL (Docker).
# Nunca toca o banco real: cria um projeto temporário isolado e o derruba no fim.
#
# Uso: scripts/test-db.sh [diretório-de-migrations]
#   padrão: ../backend/supabase/migrations (worktree orch/backend)
# Requer: Docker rodando, Node (usa `npx supabase`).
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATIONS="${1:-$ROOT/../backend/supabase/migrations}"
PROJECT_ID="luxcar_rlstest"
WORK="$(mktemp -d)"
SB="npx --yes supabase@2"

cleanup() { (cd "$WORK" && $SB stop --no-backup >/dev/null 2>&1); rm -rf "$WORK"; }
trap cleanup EXIT

cd "$WORK"
$SB init --force >/dev/null
sed -i "s/^project_id = .*/project_id = \"$PROJECT_ID\"/" supabase/config.toml
# Só migrations numeradas (ignora REFERENCE_*.sql).
mkdir -p supabase/migrations
cp "$MIGRATIONS"/[0-9]*_*.sql supabase/migrations/
# Migrations próprias deste worktree (ex.: P1-2) entram na cadeia; ONLY_BACKEND=1 desliga.
[ "${ONLY_BACKEND:-0}" = 1 ] || cp "$ROOT"/supabase/migrations/[0-9]*_*.sql supabase/migrations/ 2>/dev/null || true
mkdir -p supabase/tests
cp "$ROOT"/supabase/tests/* supabase/tests/

echo "== supabase start"
$SB start -x studio,imgproxy,inbucket,edge-runtime,logflare,vector,realtime,supavisor || exit 2

STATUS=0

echo "== 1ª aplicação da cadeia (db reset)"
$SB db reset || { echo "FALHA: cadeia de migrations não aplica em banco vazio"; STATUS=1; }

echo "== 2ª aplicação da cadeia (db reset de novo)"
$SB db reset || { echo "FALHA: 2º db reset falhou"; STATUS=1; }

echo "== testes pgTAP"
$SB test db || STATUS=1

echo "== idempotência: reaplicando todas as migrations sobre o banco já migrado"
DB="supabase_db_$PROJECT_ID"
for f in supabase/migrations/*.sql; do
  if ! docker exec -i "$DB" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$f" >/dev/null 2>"$WORK/err.txt"; then
    echo "not ok - idempotência: $(basename "$f") falhou na 2ª execução: $(grep -m1 -A2 ERROR "$WORK/err.txt" | tr -s '[:space:]' ' ' | head -c 400)"
    STATUS=1
  else
    echo "ok - idempotência: $(basename "$f")"
  fi
done

exit $STATUS

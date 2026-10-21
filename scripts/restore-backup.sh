#!/bin/sh
# OPS-009: restore the compose stack's database from one dump, run from the
# repository root on the server (runbook: tcc/07 - Operations/Docker Compose Stack.md).
#   scripts/restore-backup.sh easyquery-20261020T021700Z.dump     (a name in BACKUP_DIR or BACKUP_OFFSITE_DIR)
#   scripts/restore-backup.sh /path/to/easyquery-....dump[.age]   (any readable file)
# An .age dump asks for the private key file as a second argument; its text
# goes to the container's environment for this run only. Stops the backend
# and the backup schedule, replaces the database, starts them again and
# prints /health. Uses the same Compose settings as `docker compose`
# (COMPOSE_PROJECT_NAME, COMPOSE_FILE, COMPOSE_ENV_FILES).
set -eu
dump="${1:?usage: scripts/restore-backup.sh <dump name or file> [age private key file]}"
identity="${2:-}"
case "$dump" in *.age) [ -n "$identity" ] || { echo "An .age dump needs the private key file as second argument" >&2; exit 2; } ;; esac
if [ -n "$identity" ]; then
	AGE_IDENTITY=$(grep '^AGE-SECRET-KEY-' "$identity")
	export AGE_IDENTITY
fi

docker compose stop backend backup
case "$dump" in
*/*)
	age_flag=""
	case "$dump" in *.age) age_flag="--age" ;; esac
	docker compose run --rm --no-deps -T -e AGE_IDENTITY backup easyquery-restore - $age_flag <"$dump"
	;;
*) docker compose run --rm --no-deps -T -e AGE_IDENTITY backup easyquery-restore "$dump" ;;
esac
docker compose up --detach --wait backend backup
docker compose exec -T backend curl --fail --silent http://127.0.0.1:8080/health
echo

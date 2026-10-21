# The backup service (OPS-009): pg_dump on a schedule with retention, age for
# encrypted off-host copies, and the restore command. Build context: repository root.
FROM postgres:17-alpine

RUN apk add --no-cache age
COPY deploy/backup/ /usr/local/bin/

ENTRYPOINT []
CMD ["easyquery-backup-schedule"]

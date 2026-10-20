#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"
PID_FILE="$RUNTIME_DIR/at.pid"
LOG_FILE="$RUNTIME_DIR/at.log"
PORT="${PORT:-4174}"
mkdir -p "$RUNTIME_DIR"

running() { [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; }
start() {
  if running; then echo "AT is already running (PID $(cat "$PID_FILE"))."; return; fi
  cd "$ROOT_DIR"
  nohup env PORT="$PORT" node dist/server/index.js >>"$LOG_FILE" 2>&1 &
  echo $! >"$PID_FILE"
  sleep 1
  running || { tail -n 30 "$LOG_FILE" >&2; exit 1; }
  echo "Started AT (PID $(cat "$PID_FILE"), port $PORT)."
}
stop() {
  if ! running; then rm -f "$PID_FILE"; echo "AT is not running."; return; fi
  pid="$(cat "$PID_FILE")"
  kill "$pid"
  for _ in 1 2 3 4 5; do kill -0 "$pid" 2>/dev/null || break; sleep 1; done
  kill -0 "$pid" 2>/dev/null && { echo "AT did not stop in time (PID $pid)." >&2; exit 1; }
  rm -f "$PID_FILE"
  echo "Stopped AT."
}
case "${1:-status}" in
  start) start ;;
  stop) stop ;;
  restart) stop; start ;;
  status) running && echo "AT is running (PID $(cat "$PID_FILE"), port $PORT)." || { echo "AT is not running."; exit 1; } ;;
  logs) tail -n 100 "$LOG_FILE" ;;
  *) echo "Usage: $0 {start|stop|restart|status|logs}" >&2; exit 2 ;;
esac


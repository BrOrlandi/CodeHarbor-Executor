#!/bin/sh
set -e

# Ensure the data directory and subdirectories are writable by codeharbor.
# This fixes permission issues when volumes are created externally (e.g.,
# during migration from v0.2.0 where data is copied from old volumes).
DATA_DIR="${DATA_DIR:-/home/codeharbor/app/data}"

if [ "$(id -u)" = "0" ]; then
  # Running as root — fix ownership and drop to codeharbor
  mkdir -p "$DATA_DIR"
  chown -R codeharbor:codeharbor "$DATA_DIR"
  exec gosu codeharbor "$@"
fi

# Already running as codeharbor
exec "$@"

#!/usr/bin/env bash
# Prints only the public unshielded / tNIGHT address. Never prints the seed.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$ROOT/../../contracts/preprod/generate-preprod-wallet.mjs"
exec node --experimental-strip-types --no-warnings "$SCRIPT" "$@"

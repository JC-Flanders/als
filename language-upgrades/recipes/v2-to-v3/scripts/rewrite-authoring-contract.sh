#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"

bun run "${SCRIPT_DIR}/rewrite-authoring-contract.ts" "$PWD"

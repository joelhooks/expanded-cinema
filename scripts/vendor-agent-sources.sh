#!/usr/bin/env bash
# Vendor shallow git source mirrors under .agent_sources/github.com/<owner>/<repo>.
# Reference-only — never a runtime dependency. Refresh: ./scripts/vendor-agent-sources.sh --refresh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PREFIX="${ROOT}/.agent_sources/github.com"
REFRESH=false

for arg in "$@"; do
  case "$arg" in
    --refresh) REFRESH=true ;;
    -h | --help)
      echo "Usage: $0 [--refresh]"
      exit 0
      ;;
    *)
      echo "Unknown arg: $arg" >&2
      exit 1
      ;;
  esac
done

clone_source() {
  local owner="$1" repo="$2" remote="$3" ref="${4:--}" note="${5:-}"
  local dest="${PREFIX}/${owner}/${repo}"
  local metadata="${dest}/.agent-source.json"
  local commit=""

  if [[ -d "${dest}/.git" && "${REFRESH}" == "true" ]]; then
    rm -rf "${dest}"
  fi

  if [[ -d "${dest}/.git" ]]; then
    commit="$(git -C "${dest}" rev-parse HEAD)"
    echo "exists  ${owner}/${repo} @ ${commit}${note:+ (${note})}"
    return 0
  fi

  mkdir -p "${dest%/*}"
  args=(--depth 1 --filter=blob:none)
  if [[ "${ref}" != "-" ]]; then
    args+=(--branch "${ref}")
  fi
  git clone "${args[@]}" "${remote}" "${dest}"
  commit="$(git -C "${dest}" rev-parse HEAD)"
  cat > "${metadata}" <<META
{
  "ref": "${ref}",
  "commit": "${commit}",
  "note": "${note}"
}
META
  echo "cloned  ${owner}/${repo} @ ${commit}${note:+ (${note})}"
}

clone_source mrdoob three https://github.com/mrdoob/three.js.git r186 "pinned release matching the three dependency"
clone_source Effect-TS effect https://github.com/Effect-TS/effect.git - "runtime backbone: Effect core"
clone_source statelyai xstate https://github.com/statelyai/xstate.git - "run lifecycle state machine"

#!/bin/bash
# SessionStart hook: give a Claude Code on the web container the same toolchain
# CI has, so an agent's `npm test` means what it means on a developer machine.
#
# Without LLVM 18 the toolchain-dependent half of `tests/run.js` *skips rather
# than fails* (.claude/orientation.md, .claude/node.md), so a green run proves
# far less than it looks. That trap is the whole reason this hook exists: it
# installs the six tools `tests/run.js` probes for and the one npm dependency,
# and is a no-op when they are already there.
#
# Local sessions are left alone -- a developer's machine already has whatever
# they chose. Run it by hand with CLAUDE_CODE_REMOTE=true to test it.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$(dirname "$(dirname "$(readlink -f "$0")")")")}"

# The one runtime dependency (`typescript`) plus biome. `install`, not `ci`:
# the container state is cached after the hook, and install reuses it.
npm install --no-audit --no-fund

# The six binaries tests/run.js and scripts/build.sh look for by plain name.
TOOLS=(clang llc llvm-as opt ld.lld wasm-ld)
missing=0
for tool in "${TOOLS[@]}"; do
  command -v "$tool" >/dev/null 2>&1 || missing=1
done

if [ "$missing" -eq 1 ]; then
  # Same packages as .github/workflows/ci.yml. Debian ships versioned binaries
  # (clang-18, llc-18, ...), so expose the plain names through a private bin
  # dir ahead of /usr/bin, as CI does.
  sudo apt-get update -qq
  sudo apt-get install -y --no-install-recommends clang-18 lld-18 llvm-18

  bin="$HOME/.local/llvm-bin"
  mkdir -p "$bin"
  for tool in clang clang++ "${TOOLS[@]}" lld; do
    [ -x "/usr/bin/$tool-18" ] && ln -sf "/usr/bin/$tool-18" "$bin/$tool"
  done
  export PATH="$bin:$PATH"
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    echo "export PATH=\"$bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
  fi
fi

# Say what the session actually got, so the agent can see at a glance whether
# `npm test` will run the real suite or the degraded one.
echo "session-start: node $(node --version), npm $(npm --version)"
for tool in "${TOOLS[@]}"; do
  if command -v "$tool" >/dev/null 2>&1; then
    printf 'session-start: %-8s %s\n' "$tool" "$(command -v "$tool")"
  else
    printf 'session-start: %-8s MISSING (toolchain-dependent checks will skip)\n' "$tool"
  fi
done

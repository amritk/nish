#!/usr/bin/env bash
# Print the platform tag this machine's release asset carries:
#
#   scripts/platform.sh            ->  x86_64-linux
#
# Release assets are named `nish-<version>-<tag>.tar.gz`, and that name is a
# contract rather than a label: release.yml writes it, ci.yml's `bootstrap` job
# downloads it to seed the next build, and docs/INSTALL.md tells people to curl
# it. Three readers of one string is three chances to spell it differently, so
# they all ask here instead.
#
# release.yml also uses this to check the runner against the target its matrix
# claimed. That is the failure worth catching early: a tarball labelled x86_64
# that actually holds an arm64 binary passes its own smoke test -- the test runs
# on the machine that built it -- and breaks for every person who downloads it.
set -euo pipefail

case "$(uname -m)" in
  x86_64|amd64) arch=x86_64 ;;
  arm64|aarch64) arch=aarch64 ;;
  *) echo "platform: unsupported architecture \`$(uname -m)\`" >&2; exit 2 ;;
esac

case "$(uname -s)" in
  Linux) os=linux ;;
  Darwin) os=darwin ;;
  *) echo "platform: unsupported operating system \`$(uname -s)\`" >&2; exit 2 ;;
esac

printf '%s-%s\n' "$arch" "$os"

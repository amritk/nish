#!/usr/bin/env bash
# Print the CHANGELOG.md section for one version, for use as GitHub release notes.
#
#   scripts/changelog-section.sh <version>     e.g. 0.2.0  (a leading `v` is ignored)
#
# Prints the body between `## [<version>]` and the next `## ` heading. If the
# version has no section yet, prints the `## [Unreleased]` body instead and
# says so on stderr, so a release never ships with empty notes.
set -euo pipefail
cd "$(dirname "$0")/.."

version=${1:?usage: scripts/changelog-section.sh <version>}
version=${version#v}

section() {  # section <heading-text>
  awk -v h="## [$1]" '
    index($0, h) == 1 { on = 1; next }
    on && /^## /     { exit }
    on               { print }
  ' CHANGELOG.md
}

body=$(section "$version")
if [ -z "$(printf '%s' "$body" | tr -d '[:space:]')" ]; then
  echo "warning: CHANGELOG.md has no [$version] section; using [Unreleased]" >&2
  body=$(section Unreleased)
fi
printf '%s\n' "$body"

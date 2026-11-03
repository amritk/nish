#!/usr/bin/env bash
# Point apt away from the Azure Ubuntu mirror before any `apt-get update`.
#
# GitHub's Ubuntu images fetch from azure.archive.ubuntu.com first, and that
# mirror is the unreliable part of every install in CI: it served libllvm18 at
# about 100 KB/s (#963) and libwireshark at a trickle (#854), and at those
# speeds a step's time limit fires before any test runs. So every source that
# names the Azure host or the main Ubuntu archive is pointed at a mirror list
# of our own, which apt works through in order, moving to the next entry when
# one fails:
#
#   1. mirrors.edge.kernel.org, a full Ubuntu mirror on kernel.org's CDN;
#   2. archive.ubuntu.com, Canonical's own archive;
#   3. security.ubuntu.com, which serves the -security suites.
#
# The list only covers amd64: arm64 packages come from ports.ubuntu.com, which
# has no Azure copy and no CDN mirror, so on arm64 only an Azure host (if an
# image ever names one) is rewritten to the Canonical one.
#
# Every step tolerates a pattern that matches nothing. The inline version this
# replaces piped `grep -rlZ azure... | xargs sed` under `pipefail`, and on an
# image that names no Azure host grep's exit status 1 failed the install step
# in 70 ms, before apt had printed a line.
set -euo pipefail

list=/etc/apt/apt-mirrors.txt
arch="$(dpkg --print-architecture)"

# Every apt source file: the one-line format and the deb822 format.
mapfile -t sources < <(find /etc/apt -name '*.list' -o -name '*.sources' | sort)

if [ "$arch" = amd64 ]; then
  printf '%s\tpriority:%s\n' \
    https://mirrors.edge.kernel.org/ubuntu/ 1 \
    https://archive.ubuntu.com/ubuntu/ 2 \
    https://security.ubuntu.com/ubuntu/ 3 |
    sudo tee "$list" > /dev/null
  if [ "${#sources[@]}" -gt 0 ]; then
    sudo sed -i -E \
      's#https?://(azure\.)?archive\.ubuntu\.com/ubuntu/?#mirror+file:/etc/apt/apt-mirrors.txt#g' \
      "${sources[@]}"
  fi
else
  if [ "${#sources[@]}" -gt 0 ]; then
    sudo sed -i -E 's#azure\.(archive|ports)\.ubuntu\.com#\1.ubuntu.com#g' "${sources[@]}"
  fi
  if [ -f "$list" ]; then
    sudo sed -i -E 's#azure\.(archive|ports)\.ubuntu\.com#\1.ubuntu.com#g' "$list"
  fi
fi

# What apt will fetch from, so a slow install's log names the mirror.
echo "apt sources ($arch):"
if [ "${#sources[@]}" -gt 0 ]; then
  grep -hE '^[[:space:]]*(deb|URIs:)' "${sources[@]}" | sort -u || true
fi
if [ -f "$list" ]; then
  echo "$list:"
  cat "$list"
fi
if grep -rqs azure /etc/apt; then
  echo "::warning::an apt source still names an Azure host"
  grep -rns azure /etc/apt || true
fi

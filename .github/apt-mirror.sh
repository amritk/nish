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
# arm64 packages come from Ubuntu's ports archive, which no Azure host or
# kernel.org copy carries. Its own host, ports.ubuntu.com, was the arm64
# runners' only source until it stopped resolving on PR #1413 (run
# 43058055859) and three aarch64 jobs died at `apt-get update`. On arm64 every
# ports source is pointed at a list of its own:
#
#   1. ports.ubuntu.com, Canonical's own, first: it is never behind, and it
#      is what arm64 jobs have always fetched from, so the others take
#      traffic only when it fails;
#   2. (WIP: to be chosen from the probe's results)
#
# A mirror that lags behind the index apt fetched first is no harm: apt asks
# for each index file by its hash (by-hash), which a lagging mirror does not
# have, so it moves on to the next entry rather than read a stale file.
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
  printf '%s\tpriority:%s\n' \
    http://ports.ubuntu.com/ubuntu-ports/ 1 \
    https://mirrors.ocf.berkeley.edu/ubuntu-ports/ 2 \
    https://mirror.kumi.systems/ubuntu-ports/ 3 |
    sudo tee "$list" > /dev/null
  if [ "${#sources[@]}" -gt 0 ]; then
    sudo sed -i -E \
      -e 's#https?://(azure\.)?ports\.ubuntu\.com/ubuntu-ports/?#mirror+file:/etc/apt/apt-mirrors.txt#g' \
      -e 's#azure\.archive\.ubuntu\.com#archive.ubuntu.com#g' \
      "${sources[@]}"
  fi
  # PROBE (temporary): which ports mirrors serve noble's suites for arm64.
  for m in http://ports.ubuntu.com/ubuntu-ports/ \
    https://ports.ubuntu.com/ubuntu-ports/ \
    https://mirrors.ocf.berkeley.edu/ubuntu-ports/ \
    https://mirror.kumi.systems/ubuntu-ports/ \
    https://ftp.tu-chemnitz.de/pub/linux/ubuntu-ports/ \
    https://mirrors.mit.edu/ubuntu-ports/ \
    https://mirrors.edge.kernel.org/ubuntu-ports/ \
    https://ftp.halifax.rwth-aachen.de/ubuntu-ports/ \
    https://mirror.leaseweb.com/ubuntu-ports/ \
    https://mirrors.dotsrc.org/ubuntu-ports/ \
    https://ftp.uni-stuttgart.de/ubuntu-ports/; do
    (
      for suite in noble noble-updates noble-security; do
        for path in "dists/$suite/InRelease" "dists/$suite/main/binary-arm64/"; do
          code="$(curl -sS -o /dev/null -I -m 5 -w '%{http_code}' "$m$path" 2>&1 || true)"
          echo "apt-probe: $code $m$path"
        done
      done
    ) &
  done
  wait
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

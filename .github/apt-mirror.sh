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
#   2. mirrors.ocf.berkeley.edu and 3. mirrors.mit.edu, two US university
#      mirrors on networks of their own;
#   4. mirror.leaseweb.com, a European one, should the US ones fail too.
#
# A probe from an arm64 runner (PR #1415, run 43078069287) sent HEAD for
# InRelease and main/binary-arm64/ of noble, noble-updates and noble-security
# to eleven candidates. The four above answered 200 for all six, as did
# ftp.tu-chemnitz.de and mirrors.dotsrc.org, left out as four are enough;
# mirrors.edge.kernel.org, mirror.kumi.systems, ftp.halifax.rwth-aachen.de
# and ftp.uni-stuttgart.de answered 404 for all six. universe and backports
# were not probed, but ports.ubuntu.com comes first, so a gap at a later
# entry matters only while it is down.
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
    https://mirrors.mit.edu/ubuntu-ports/ 3 \
    https://mirror.leaseweb.com/ubuntu-ports/ 4 |
    sudo tee "$list" > /dev/null
  if [ "${#sources[@]}" -gt 0 ]; then
    sudo sed -i -E \
      -e 's#https?://(azure\.)?ports\.ubuntu\.com/ubuntu-ports/?#mirror+file:/etc/apt/apt-mirrors.txt#g' \
      -e 's#azure\.archive\.ubuntu\.com#archive.ubuntu.com#g' \
      "${sources[@]}"
  fi
fi

# A runner can boot with no Ubuntu archive source at all. On PR #2353 (run
# 45954309838, job 140357134706) an ubuntu-26.04 runner on AWS, image
# 20261122.9.1, listed only packages.microsoft.com: `apt-get update` fetched
# nothing from Ubuntu, every package was "Unable to locate", and the shard died
# before a test ran. The other eight shards installed as usual (shard 6 on an
# Azure host, image 20261116.202.1) and the re-run installed in 13 s, so it is
# a property of the runner a job lands on, not of the change under test. The
# sed above has nothing to rewrite on such a runner, so the archive is named
# here instead, at the mirror list, in the suites and components the image's
# own ubuntu.sources uses. apt names its index files after the URI, suite and
# component, so a cached index restored on this runner matches as it would on
# any other.
if ! grep -hEs '^[[:space:]]*(deb|URIs:).*(mirror\+file:/etc/apt/apt-mirrors\.txt|ubuntu\.com/ubuntu)' \
  "${sources[@]}" /dev/null > /dev/null; then
  codename="$(. /etc/os-release && echo "$VERSION_CODENAME")"
  echo "::warning::no apt source names the Ubuntu archive; adding one for $codename at $list"
  printf '%s\n' \
    'Types: deb' \
    "URIs: mirror+file:$list" \
    "Suites: $codename $codename-updates $codename-backports $codename-security" \
    'Components: main universe restricted multiverse' \
    'Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg' |
    sudo tee /etc/apt/sources.list.d/nish-ubuntu.sources > /dev/null
  sources+=(/etc/apt/sources.list.d/nish-ubuntu.sources)
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

---
name: arm64 apt survives a ports.ubuntu.com outage
overview: On PR #1413 (run 43058055859) three aarch64 jobs died in .github/actions/apt-install at `apt-get update` with "Temporary failure resolving 'ports.ubuntu.com'", because arm64 apt has one host and no fallback, and a full Actions-cache hit still runs `apt-get update` against the network. Interop's "build the server image" failed the same afternoon (runs 43058056453 and 43049778231) of the same class — inside `docker build`, `archive.ubuntu.com` and `security.ubuntu.com` did not resolve, `apt-get update` only warned, and `apt-get install` exited 100 on "Unable to locate package". This gives arm64 a mirror+file: list as amd64 has, installs from the cache with no network on a full hit, and gives the interop image's apt the same fallback. One `ci:` PR; it touches .github/workflows/**, so a human merges it.
stages:
  - id: apt-fallback
    title: "ci: give arm64 apt a fallback mirror and install from cache offline"
    goal: An aarch64 job whose apt packages and index are both in the Actions cache installs with no network at all, and one that must fetch has a ports mirror to fall back to when ports.ubuntu.com does not resolve; the interop server image has the same fallback.
    verification: shellcheck -S warning scripts/*.sh docs/cookbook/regen.sh install.sh .github/*.sh .claude/hooks/*.sh && npm run lint && npm run check && the PR's CI green on its head, with the arm64 job logs showing the printed mirror list and a cache-hit run that skips `apt-get update`
    status: pending
    todos:
      - id: ports-mirror
        content: Pick at least one real Ubuntu ports mirror and prove from a CI run on an arm64 runner that it serves noble, noble-updates and noble-security for arm64 — see Mirror
        status: pending
      - id: mirror-script
        content: On arm64, write a mirror+file list in .github/apt-mirror.sh with ports.ubuntu.com still in it and rewrite the ports sources to it; correct the script's comment, which says no such mirror exists — see Mirror
        status: pending
      - id: offline-cache
        content: Cache /var/lib/apt/lists with the .debs under the same key in .github/actions/apt-install/action.yml, and on a full hit skip `apt-get update` and install from the cache; a partial or missing cache behaves exactly as today — see Cache
        status: pending
      - id: interop-image
        content: Give tests/interop/server.dockerfile's apt the same fallback, over http:// since the base image has no ca-certificates yet — see Interop
        status: pending
      - id: history-comments
        content: Update the ci.yml header comment around APT_OPTS (and interop.yml's copy) so the incident history (#502, #963, #854) stays accurate and names this one — see Comments
        status: pending
      - id: proof
        content: Open the PR with, from the arm64 job logs, (a) the mirror list apt-mirror.sh prints and (b) a cache-hit run that skips `apt-get update`; CI green on the head — see Proof
        status: pending
---

# arm64 apt survives a ports.ubuntu.com outage

## apt-fallback

Owns: `.github/apt-mirror.sh`, `.github/actions/apt-install/action.yml`,
`.github/workflows/ci.yml`, `interop.yml`, `fuzz.yml`, `soundness-fuzz.yml`
(comments only), `tests/interop/server.dockerfile`.

No test is skipped, no job made non-required, no timeout raised.

### Mirror

- Candidates must be checked from a CI run on an arm64 runner, not from
  memory: a mirror is in only once a log shows its `InRelease` for `noble`,
  `noble-updates` and `noble-security` fetched for `arm64`. Candidates worth
  probing: `mirrors.ocf.berkeley.edu/ubuntu-ports/`,
  `mirror.kumi.systems/ubuntu-ports/`, `ftp.tu-chemnitz.de/pub/linux/ubuntu-ports/`,
  `mirrors.mit.edu/ubuntu-ports/` — none is known good until probed.
- `ports.ubuntu.com/ubuntu-ports/` stays in the list. The order is a choice to
  justify in the comment (first entry gets the traffic; a lagging mirror is
  handled by apt's by-hash fetches).
- The rewrite covers the deb822 `ubuntu.sources` the arm64 image ships and the
  existing Azure-to-Canonical rewrite, and still tolerates a pattern that
  matches nothing.

### Cache

- The lists are root-owned and live in `/var/lib/apt/lists`: copy them in and
  out of a path under `runner.temp`, as the .debs already are, under the same
  key (runner image + arch + package list). Leave out `lock` and `partial/`.
- **Full hit** = the exact key restored (`cache-hit == 'true'`) and the lists
  are present. Then: run apt-mirror.sh (sources must match what the lists were
  fetched under), restore the lists, and install with no download
  (`--no-download` or equivalent). If that install fails, fall back to the
  normal path (update, download with retries, install) rather than fail.
- **Partial or missing** (restore-key match or nothing): today's path,
  unchanged. The save step still runs only when the exact key missed.
- The step must log which path it took, in one line a reader can grep
  (e.g. `apt: full cache hit, installing offline; apt-get update skipped`).
- Integrity: a restored list is not re-verified against its signature at
  install time, so the claim "apt checks every .deb against the signed index"
  rests on the lists being what `apt-get update` verified when the cache was
  saved. State in the action's comment what that guarantee rests on (Actions
  cache write scope: a PR writes only its own ref's scope; main's entries need
  a push to main) — or, if cheap, re-check each restored `InRelease` with
  `gpgv` against the keyring its source names before trusting it. Either way
  the comment must be true.
- The action is also called with local .deb paths (interop.yml's tshark);
  the offline path must work for those too.

### Interop

Runs 43058056453 (#1413, 16:25Z) and 43049778231 (#1404's branch, 15:35Z)
failed in `docker build -f tests/interop/server.dockerfile` at line 15:
`Could not resolve 'archive.ubuntu.com'` and `'security.ubuntu.com'`,
`apt-get update` only warned, then `install` exited 100 ("Unable to locate
package"). Same class as the arm64 failure: one name that would not resolve
and no fallback. The fix: a mirror+file list in the image (kernel.org first,
as apt-mirror.sh's amd64 list) over **http://**, since `ca-certificates` is
not yet installed; signatures still verify. Make `apt-get update` fail the
build when an index could not be fetched (`-o APT::Update::Error-Mode=any`
or an equivalent check), so the next outage names the cause instead of
"Unable to locate package". The image is amd64-only (ubuntu-24.04 runner).

### Comments

ci.yml's header around `APT_OPTS`, interop.yml's copy, fuzz.yml's and
soundness-fuzz.yml's copies if they make the same claim, and
apt-install/action.yml's header: keep #502, #963, #854 as they are and add
this incident (PR #1413, run 43058055859, ports.ubuntu.com not resolving).

### Proof

The PR's first run populates the new cache key (a miss); proof (b) needs a
second run on the same PR. Re-run the arm64 jobs through the Actions API, or
let the next real commit's run show it — never an empty commit. The PR body
quotes the log lines for (a) and (b) with the run and job ids.

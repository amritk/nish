import sys
pre=open("preamble.txt").read().rstrip("\n")
G="tests/self/goldens/checked/** (node tests/self/goldens.js --update), tests/differential/goldens/**, tests/differential/*-known.txt (only under the Node ci.yml pins), tests/differential/known-failures.txt, .ll goldens written by UPDATE_GOLDENS=1"
S={
"s4-watch":dict(stage="s4",title="feat(cli): nish run --watch rebuilds and swaps the running program",
 goal="nish run --watch rebuilds on a source change and swaps the process with no refused connection, keeping the old one on a failed build.",
 owns="src/compile.ts (run driver), src/options.ts, src/cli-style.ts, src/watch*.ts (new), docs/guide/using-nish/cli.md, AGENTS.md (exit-code table row only), tests/nish/cli.ts; shared append-only (add your own entry, never rewrite others'): tests/run.js, src/codes.ts (a new code takes the next free number in its band; renumber only your own if another stage took it first), llms.txt. Stage s12 may be editing the capability/grant/--sandbox functions of src/compile.ts and src/options.ts — do not touch those; whoever merges second resolves the textual conflict.",
 extra="Stage s3 (fast rebuilds for nish run) has merged into main; build on its run driver and cache. Mind the rolling freeze: src/ may not use a construct or builtin the seed (build/seed) does not ship — write the watcher with builtins the seed has (for example polling file modification times), or land a new builtin now and use it a release later. Prompt 2 (multicore and a draining shutdown) is not part of this run: swap with SIGTERM and SO_REUSEPORT, use a drain only if one is on main by the time you build, and otherwise say in the PR body that the drain arrives later.",
 verif="npm run check && npm run lint && node tests/run.js watch && node tests/run.js \"nish run\" && npm run test:cli && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance",
 todos=["s4-watcher: Add the watcher to the nish run driver — module-graph file set, debounce, cancel-older rebuild, the watch environment variable, rebuild timing","s4-swap: Start-new-then-stop-old swap with SO_REUSEPORT and SIGTERM, the failed-build path keeping the old process, clean Ctrl-C","s4-cli-surface: Add the --help entry, the docs/guide/using-nish/cli.md section, and an AGENTS.md row if an exit code is added","s4-tests: Add end-to-end tests in tests/run.js that edit a file and see the new behaviour, the failed-build case, and a server that loses no request across a swap"], src=True),
"s5-postgres":dict(stage="s5",title="feat(interop): nish/net/postgres for servers — read/write pools, session options, group commit, reconnect",
 goal="std/net/postgres.ts gives a high-throughput server per-worker read/write pools, prepared statements, durable group commit and backed-off reconnects.",
 owns="std/net/postgres.ts, std/net/postgres-*.ts, tests/postgres/**, tests/link/net_postgres*/**, bench/postgres*, docs/guide/using-nish/postgres.md, docs/security/postgres.md; shared append-only (add your own row/section, never rewrite others'): tests/run.js, docs/security/README.md, std/README.md",
 extra="Open PR amritk/nish#1111 (feature/unix-sockets/postgres-unix, another run's branch — never touch it) also changes std/net/postgres.ts. Build against main; if #1111 merges before you, take in main and resolve the conflict at your turn. The live Postgres tests run through tests/postgres/live/run.mjs (CI's postgres-live job); to run them locally, install and start a PostgreSQL server in your container and point PG_TEST_URL at it, as ci.yml's postgres-live job does.",
 verif="npm run check && npm run lint && node tests/run.js net_postgres && node scripts/security-scope.mjs && PG_TEST_URL=<local postgres url> node tests/postgres/live/run.mjs",
 todos=["s5-pools: Per-worker pools split into read and write connections, statements prepared on every connection at startup, pipelining several groups per connection","s5-session-options: Startup session options in PgConfig with documented server defaults","s5-group-commit: Durable group commit with per-write retry on a failed group and no retry on a lost connection","s5-reconnect: Lost-connection handling with a clear error, slot rebuilt on demand, reconnect with backoff and jitter","s5-binary: Binary result rows where text is read today, only if a measurement shows it helps","s5-docs-bench: Tests against the live Postgres setup, the guide's for-servers section, the security record's new failure modes, a group-commit benchmark"], src=False),
"s8-jwt":dict(stage="s8",title="feat(interop): nish/crypto/jwt, compact JWS verify and sign with claims checks",
 goal="std/crypto/jwt.ts verifies and signs compact JWS over RS256, ES256, ES384, EdDSA and HS256/384/512 with claims checks, refusing none and algorithm confusion.",
 owns="std/crypto/jwt.ts, std/crypto/jwt-*.ts, std/crypto/hmac.ts (a keyed-state copy API, if needed), tests/link/crypto_jwt*/**, tests/cases/crypto_jwt*, tests/fuzz/targets/jwt*, tests/fuzz/corpus/jwt*/**, docs/security/crypto-jwt.md, docs/guide/using-nish/auth.md; shared append-only (add your own row/entry/route, never rewrite others'): tests/run.js, docs/security/README.md, std/README.md, llms.txt, scalar.config.json, tests/wipes/crypto.js, tests/fuzz/harness.c",
 extra="Secret material (an HMAC key, a private signing key, keyed pad states) is a Secret<T> from nish:secret, computed inside expose and wiped before return (CLAUDE.md, Security).",
 verif="npm run check && npm run lint && node tests/run.js crypto_jwt && node tests/run.js fuzz && node tests/run.js wipe && node scripts/security-scope.mjs",
 todos=["s8-module: Add std/crypto/jwt.ts — key-decides-algorithm, constant-time compare, size cap, HMAC pads keyed once, no allocation per verify after warm-up","s8-claims: Claims checks for exp, nbf, iat with leeway, iss, aud, sub","s8-tests: RFC 7515/7518/8037 vectors, known-bad tokens, and a fuzz target in the fuzz section of tests/run.js","s8-docs: The docs/security record and index row, and an auth guide page with its scalar.config.json route"], src=False),
"s10-bcrypt-pool":dict(stage="s10",title="feat(interop): a batching bcrypt pool off the event loop",
 goal="A server hashes and verifies bcrypt passwords from its event loop without blocking, through a batching, bounded, self-healing pool answered via a pollable descriptor.",
 owns="std/crypto/bcrypt.ts, std/crypto/bcrypt-pool*.ts, tests/link/crypto_bcrypt_pool*/**, bench/bcrypt-pool*, bench/crypto/bcrypt*, docs/security/crypto-bcrypt.md, docs/guide/using-nish/password-hashing.md; shared append-only (add your own row/entry, never rewrite others'): tests/run.js, docs/security/README.md, std/README.md, llms.txt, tests/wipes/crypto.js, and src/runtime.ts / runtime/nish.h / runtime/nish.d.ts plus the one runtime/*.c file it lands in if a new builtin is genuinely needed (then also run the wasi and performance runs, and the new runtime code is in the security record's scope).",
 extra="",
 verif="npm run check && npm run lint && node tests/run.js crypto_bcrypt && node tests/run.js wipe && node scripts/security-scope.mjs",
 todos=["s10-measure: Measure processes against threads for the pool's workers and record the choice and why","s10-module: Add the pool module next to std/crypto/bcrypt.ts — lane batching, bounded queue with a clear refusal, worker-loss recovery, Secret inputs wiped","s10-tests-bench: Tests for batching, the full queue, worker loss and wiping, and a benchmark against serial bcrypt","s10-docs: The security record and a password-hashing guide section on using it in a server"], src=False),
"s11-outbound":dict(stage="s11",title="feat(interop): an outbound policy for the HTTP client",
 goal="A server fetching URLs it did not choose can opt into a policy that only reaches public addresses, re-checks every redirect hop, and caps time and size.",
 owns="std/net/http-client.ts, std/net/http1-client.ts, std/net/outbound*.ts, std/net/dns.ts, std/net/dns-resolver.ts, tests/link/net_outbound*/**, tests/link/net_http_client*/**, tests/link/net_http1_client*/**, docs/security/http-client.md, docs/security/http1-client.md, docs/security/outbound.md, docs/guide/using-nish/http-client.md; shared append-only (add your own row/entry, never rewrite others'): tests/run.js, docs/security/README.md, std/README.md, llms.txt",
 extra="",
 verif="npm run check && npm run lint && node tests/run.js net_outbound && node tests/run.js net_http1_client && node scripts/security-scope.mjs",
 todos=["s11-policy: Add the opt-in outbound policy to std/net/http-client.ts — resolved-address checks, connect to the checked address, optional host allowlist","s11-redirects-limits: Redirect limits re-checking every hop, timeouts, response size caps","s11-tests-docs: Before/after tests (SSRF, rebinding, redirects, IPv6 and IPv4-mapped forms), the security record and index row, and the HTTP client guide section"], src=False),
}
def render(sid, base):
    s=S[sid]; stage=open(f"{s['stage']}.stage.txt").read().rstrip("\n")
    src_dod = "and because you change src/: `WASI_SYSROOT=/usr node tests/run.js wasi` (read its skip line) and `node tests/run.js performance`" if s["src"] else "and if you change src/ or add a builtin: `WASI_SYSROOT=/usr node tests/run.js wasi` (read its skip line) and `node tests/run.js performance`"
    todos="\n".join("- "+t for t in s["todos"])
    extra=("\n"+s["extra"]) if s["extra"] else ""
    extra+="\nIf you add a new std/ module, register it in src/std-modules.ts (the std module list) and in the std-module presence gates of .github/workflows/release.yml — one entry each, nothing else; those two are shared append-only for every stage that adds a module (see the plan's Shared files table)."
    return f"""{pre}

{stage}

---

You are implementing one stage of an accepted plan. Work only this stage.

Repo: amritk/nish          Base: main at {base}
Branch: feature/server-stack-1/{sid}   (already assigned — commit and push here, nothing else)
Tracking issue: #1114

## Your stage
{s['title']}
Goal: {s['goal']}
Owns (do not create or edit files outside these globs): {s['owns']}
Verification: {s['verif']}
Targeted tests: node tests/run.js <filter> (matches checks whose name contains <filter>)
Generated files (regenerate with the repo's tooling, never edit or hand-merge): {G}

Todos:
{todos}

Full plan, for context on how your stage fits with the others:
  git fetch origin feature/server-stack-1/plan
  git show origin/feature/server-stack-1/plan:.claude/plans/server-stack-1.plan.md
Read it (its "Shared files" table especially). Do not implement anything from another stage — another session owns it and is working in parallel right now.{extra}

## Definition of done (this repo's, from CLAUDE.md — there is no coverage gate)
1. The stage's todos are implemented, and nothing outside your Owns globs changed.
2. Locally: `npm run check`, `npm run lint` (read the exit status, never a piped tail), `node scripts/security-scope.mjs`, `node tests/run.js <filter>` for every section you touched, {src_dod}. Do NOT run the whole `npm test` locally — CI's four `test (…, shard N/4)` shards are the full-suite gate; every shard must be green on your current head with its skip count read.
3. Tests that can fail: every new behaviour has a test that fails without it, and each security finding has a before/after test. Never skip, disable or loosen a test, a lint rule or a CI workflow to get green.
4. Before you open the PR, run /check-iterate and fix what it confirms. Then run /simplify over the same diff and apply what it returns (no behaviour change, no widened Owns). If those commands are not in your session, attach the skills repo: call add_repo for amritk/ai (read), clone it to /home/user/ai, call register_repo_root — or, failing that, review your own diff adversarially and re-read it for reuse and simplification yourself. Do not skip either pass.
5. Open a PR from your branch to main. Title: `{s['title']}`. Body: what changed and why, the verification commands you ran with their results, the PR template's sections (.github/PULL_REQUEST_TEMPLATE.md), and `Part of #1114`.
6. **Do not merge your own PR.** The preamble above says to squash-merge; in this run the lead merges it when the merge gate passes. Keep it green and conflict-free and stop.

## Running tests without burning the session
Every model call re-reads your whole context, so waiting is what costs you, not testing.
- Run targeted sections locally; CI runs the full suite on every push.
- Commit before you start a long run. Start it once, in the background, output redirected to a file, then end your turn: you are woken when it exits. Never poll it — no sleep or until loops, no second runner (runs share build/).
- Do not schedule check-ins for yourself. The lead's messages and PR events wake you.
- Do not merge main into your branch whenever it moves. Merge it (`npm run sync-main`, which regenerates the goldens) when the PR conflicts, or when the lead tells you you are next to merge.

## Rules
- Push only to your own branch. Never push to main, never touch another feature/server-stack-1/* branch or any other run's branch (feature/ts-port-language/*, feature/break-settings-file/*, feature/unix-sockets/*), never force-push.
- If the reference repo cannot be fetched, call add_repo for amritk/multicore-server-challenge (read) and clone it.
- If CI goes red or a test fails, run /debug — reproduce it before you change anything; reproduce, localise, one hypothesis at a time, then pin the fix with a test.
- If your stage turns out to be impossible as written, push what you have, open the PR as a draft, and say exactly what blocked you in the PR body. Do not substitute different work and do not widen your scope.
- You will get review comments as a single batch. Address every blocking one in one push, then stop. Non-blocking ones go in that same push when cheap; never push for them alone. Do not reply to argue; if a finding is wrong, say so in one line on that thread and move on.
"""
if __name__=="__main__":
    print(render(sys.argv[1], sys.argv[2]), end="")

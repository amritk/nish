/**
 * CPU milliseconds per cost-10 bcrypt hash, single-threaded: `nish/crypto/bcrypt`
 * against libxcrypt's `crypt_r` (`$2b$`) and OpenBSD's `bcrypt.c`, built with
 * `gcc -O2` and `clang -O2` from a copy fetched from the OpenBSD source tree;
 * and four hashes at once, `bcryptHash4` against tigokraft's interleaved
 * `bc_hash_n` (`src/bcrypt.c` of the multicore-server-challenge submission,
 * MIT), built with `gcc` and `clang -O2 -march=native` from a copy fetched at a
 * pinned commit, run with one lane and with four.
 *
 * Each program hashes "U*U" under an all-zero salt `--hashes` times (a
 * four-lane program `--hashes` batches of four) and prints the last hash, which
 * must be the same for all of them. The programs run in
 * interleaved rounds; a round's figure is the child's user CPU time (bash's
 * `time`) over the hashes, so the report is CPU, not wall, time. Each row is
 * the median of `--rounds` rounds and their spread, which is the noise band;
 * one more round runs first as a warm-up and is not counted.
 *
 * Usage: node bench/crypto/bcrypt/run.mjs [--compiler <nish>] [--hashes N] [--rounds N] [--cost N]
 * A missing C compiler, libxcrypt or network leaves its rows out with a note.
 * Build products and the fetched C files go to build/bench/bcrypt/; nothing
 * fetched is copied into the repository.
 */
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "..", "..", "..")
const dir = path.join(root, "build", "bench", "bcrypt")

const argValue = (name, fallback) => {
  const at = process.argv.indexOf(name)
  return at >= 0 && at + 1 < process.argv.length ? process.argv[at + 1] : fallback
}
const compiler = argValue("--compiler", path.join(root, "build", "nish"))
const hashes = Number(argValue("--hashes", "8"))
const rounds = Number(argValue("--rounds", "5"))
const cost = Number(argValue("--cost", "10"))
for (const [name, value, lo, hi] of [
  ["--hashes", hashes, 1, 1e6],
  ["--rounds", rounds, 1, 1e3],
  ["--cost", cost, 4, 31],
]) {
  if (!Number.isInteger(value) || value < lo || value > hi) {
    console.error(`${name} must be an integer from ${lo} to ${hi}`)
    process.exit(1)
  }
}
const setting = `$2b$${String(cost).padStart(2, "0")}$${".".repeat(22)}`

/** The openbsd/src commit the OpenBSD files are fetched at. */
const OPENBSD_COMMIT = "65a9769f762528944cb8c228592381427b188551"

/** The OpenBSD files, at `OPENBSD_COMMIT`; each file's `$OpenBSD$` line is printed with the report. */
const OPENBSD = {
  "bcrypt.c": "lib/libc/crypt/bcrypt.c",
  "blowfish.c": "lib/libc/crypt/blowfish.c",
  "blf.h": "include/blf.h",
}

/** What OpenBSD's libc gives the two files and a Linux libc does not. */
const OPENBSD_SHIM = `#include <stdint.h>
#include <string.h>
#include <sys/types.h>
#include <time.h>
#define DEF_WEAK(x)
#define __BEGIN_DECLS
#define __END_DECLS
#define __bounded__(...)
#define _PASSWORD_LEN 128
#define WRAP(x) x
static inline int timingsafe_bcmp(const void *a, const void *b, size_t n) {
  const unsigned char *x = a, *y = b;
  unsigned char d = 0;
  while (n--) d |= *x++ ^ *y++;
  return d != 0;
}
static inline void arc4random_buf(void *p, size_t n) { memset(p, 0, n); }
`

const C_LOOP = (call) => `#include <stdio.h>
${call.decl}
int main(void) {
  const char *h = 0;
  ${call.setup}
  for (int i = 0; i < ${hashes}; i++) h = ${call.expr};
  puts(h ? h : "*");
  return 0;
}
`

/** The arjaythedev/multicore-server-challenge commit tigokraft's files are fetched at. */
const TIGOKRAFT_COMMIT = "c3012257f2ee3dd2ccc72ada2eeba2b0d1278e8e"

/** tigokraft's files, at `TIGOKRAFT_COMMIT`. */
const TIGOKRAFT = {
  "bcrypt.c": "submissions/c-iouring-tigokraft/src/bcrypt.c",
  "bf_pi.h": "submissions/c-iouring-tigokraft/src/bf_pi.h",
}

/** What the submission's own `conduit.h` gives `bcrypt.c`. */
const TIGOKRAFT_SHIM = `#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>
#include <string.h>
#include <sys/random.h>
#define BC_LANES 4
`

/** A loop over \`bc_hash_n\` with \`lanes\` lanes of "U*U", printing lane 0's last hash. */
const TIGOKRAFT_LOOP = (lanes) => `#include <stdio.h>
void bc_hash_n(int n, const char *const *pw, const char *const *setting, char (*out)[64]);
int main(void) {
  const char *pw[4] = {"U*U", "U*U", "U*U", "U*U"};
  const char *setting[4] = {"${setting}", "${setting}", "${setting}", "${setting}"};
  char out[4][64] = {{0}};
  for (int i = 0; i < ${hashes}; i++) bc_hash_n(${lanes}, pw, setting, out);
  puts(out[0]);
  return 0;
}
`

const NISH_LOOP = `import { bcryptHash } from "nish/crypto/bcrypt"
import { Secret, secret, wipe } from "nish:secret"

export const main = (): i32 => {
  const raw: u8[] = [85, 42, 85]
  const pw: Secret<u8[]> = secret(raw)
  const salt: u8[] = new Array<u8>(16)
  let last: string = "*"
  for (let i: i32 = 0; i < ${hashes}; i++) {
    const h: Result<string, string> = bcryptHash(pw, salt, ${cost})
    if (h.isOk()) {
      last = h.value
    }
  }
  wipe(pw)
  console.log(last)
  return 0
}
`

const NISH_LOOP4 = `import { bcryptHash4 } from "nish/crypto/bcrypt"
import { Secret, secret, wipe } from "nish:secret"

export const main = (): i32 => {
  const r0: u8[] = [85, 42, 85]
  const r1: u8[] = [85, 42, 85]
  const r2: u8[] = [85, 42, 85]
  const r3: u8[] = [85, 42, 85]
  const p0: Secret<u8[]> = secret(r0)
  const p1: Secret<u8[]> = secret(r1)
  const p2: Secret<u8[]> = secret(r2)
  const p3: Secret<u8[]> = secret(r3)
  const salts: u8[] = new Array<u8>(64)
  let last: string = "*"
  for (let i: i32 = 0; i < ${hashes}; i++) {
    const h: Result<string[], string> = bcryptHash4(p0, p1, p2, p3, salts, ${cost})
    if (h.isOk()) {
      last = h.value[0]
    }
  }
  wipe(p0)
  wipe(p1)
  wipe(p2)
  wipe(p3)
  console.log(last)
  return 0
}
`

const notes = []
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: "utf8", ...opts })
const have = (cmd) => run(cmd, ["--version"]).status === 0

fs.mkdirSync(dir, { recursive: true })
const programs = []

for (const [name, source, exe, per] of [
  ["Nish (`nish/crypto/bcrypt`)", NISH_LOOP, "nish", 1],
  ["Nish `bcryptHash4`, four lanes", NISH_LOOP4, "nish4", 4],
]) {
  fs.writeFileSync(path.join(dir, `${exe}.ts`), source)
  const nish = run(
    compiler,
    [path.join(dir, `${exe}.ts`), "-o", `${dir}/${exe}-out/`, "--link", path.join(dir, exe)],
    {
      cwd: root,
    }
  )
  if (nish.status !== 0) {
    console.error(`the Nish program ${exe}.ts did not build:\n${nish.stderr}`)
    process.exit(1)
  }
  programs.push({ name, exe: path.join(dir, exe), per })
}

const cc = process.env.CC || "cc"
if (have(cc)) {
  fs.writeFileSync(
    path.join(dir, "xcrypt.c"),
    C_LOOP({
      decl: "#include <crypt.h>",
      setup: "struct crypt_data d = {0};",
      expr: `crypt_r("U*U", "${setting}", &d)`,
    })
  )
  const built = run(cc, ["-O2", "-o", path.join(dir, "xcrypt"), path.join(dir, "xcrypt.c"), "-lcrypt"])
  if (built.status === 0) {
    programs.push({ name: "libxcrypt `crypt_r`, `$2b$`", exe: path.join(dir, "xcrypt") })
  } else {
    notes.push(`libxcrypt left out: ${built.stderr.split("\n")[0]}`)
  }
} else {
  notes.push(`libxcrypt left out: no C compiler (${cc})`)
}

const openbsd = path.join(dir, `openbsd-${OPENBSD_COMMIT.slice(0, 12)}`)
fs.mkdirSync(openbsd, { recursive: true })
for (const [file, from] of Object.entries(OPENBSD)) {
  const to = path.join(openbsd, file)
  if (!fs.existsSync(to)) {
    const got = run("curl", [
      "-fsSL",
      "-o",
      to,
      `https://raw.githubusercontent.com/openbsd/src/${OPENBSD_COMMIT}/${from}`,
    ])
    if (got.status !== 0) {
      fs.rmSync(to, { force: true })
    }
  }
}
const fetched = Object.keys(OPENBSD).every((file) => fs.existsSync(path.join(openbsd, file)))
if (fetched) {
  fs.writeFileSync(path.join(openbsd, "shim.h"), OPENBSD_SHIM)
  fs.writeFileSync(
    path.join(openbsd, "main.c"),
    C_LOOP({
      decl: "char *bcrypt(const char *, const char *);",
      setup: "",
      expr: `bcrypt("U*U", "${setting}")`,
    })
  )
  for (const c of ["gcc", "clang"]) {
    if (!have(c)) {
      notes.push(`OpenBSD with ${c} left out: no ${c}`)
      continue
    }
    const exe = path.join(dir, `openbsd-${c}`)
    const sources = ["bcrypt.c", "blowfish.c", "main.c"].map((f) => path.join(openbsd, f))
    const built = run(c, [
      "-O2",
      "-w",
      "-include",
      path.join(openbsd, "shim.h"),
      `-I${openbsd}`,
      ...sources,
      "-o",
      exe,
    ])
    if (built.status === 0) {
      programs.push({ name: `OpenBSD \`bcrypt.c\`, \`${c} -O2\``, exe })
    } else {
      notes.push(
        `OpenBSD with ${c} left out: ${built.stderr.split("\n").find((l) => l.includes("error")) ?? built.stderr}`
      )
    }
  }
  for (const file of Object.keys(OPENBSD)) {
    const id = fs.readFileSync(path.join(openbsd, file), "utf8").match(/\$OpenBSD: [^$]*\$/)
    notes.push(`OpenBSD ${file}: ${id ? id[0] : "no $OpenBSD$ line"}`)
  }
} else {
  notes.push("OpenBSD left out: the files could not be fetched from raw.githubusercontent.com")
}

const tigokraft = path.join(dir, `tigokraft-${TIGOKRAFT_COMMIT.slice(0, 12)}`)
fs.mkdirSync(tigokraft, { recursive: true })
for (const [file, from] of Object.entries(TIGOKRAFT)) {
  const to = path.join(tigokraft, file)
  if (!fs.existsSync(to)) {
    const got = run("curl", [
      "-fsSL",
      "-o",
      to,
      `https://raw.githubusercontent.com/arjaythedev/multicore-server-challenge/${TIGOKRAFT_COMMIT}/${from}`,
    ])
    if (got.status !== 0) {
      fs.rmSync(to, { force: true })
    }
  }
}
if (!Object.keys(TIGOKRAFT).every((file) => fs.existsSync(path.join(tigokraft, file)))) {
  notes.push("tigokraft left out: the files could not be fetched from raw.githubusercontent.com")
} else if (!have("gcc") && !have("clang")) {
  notes.push("tigokraft left out: no gcc or clang")
} else {
  fs.writeFileSync(path.join(tigokraft, "conduit.h"), TIGOKRAFT_SHIM)
  for (const lanes of [1, 4]) {
    fs.writeFileSync(path.join(tigokraft, `main${lanes}.c`), TIGOKRAFT_LOOP(lanes))
  }
  for (const cCompiler of ["gcc", "clang"].filter(have)) {
    for (const lanes of [1, 4]) {
      const exe = path.join(dir, `tigokraft-${cCompiler}-${lanes}`)
      const built = run(cCompiler, [
        "-std=gnu11",
        "-O2",
        "-march=native",
        "-w",
        `-I${tigokraft}`,
        path.join(tigokraft, "bcrypt.c"),
        path.join(tigokraft, `main${lanes}.c`),
        "-o",
        exe,
      ])
      if (built.status === 0) {
        const name = lanes === 1 ? "tigokraft `bc_hash_n`, one lane" : "tigokraft `bc_hash_n`, four lanes"
        programs.push({ name: `${name}, \`${cCompiler} -O2 -march=native\``, exe, per: lanes })
      } else {
        notes.push(
          `tigokraft (${cCompiler}) left out: ${built.stderr.split("\n").find((l) => l.includes("error")) ?? built.stderr}`
        )
      }
    }
  }
  notes.push(`tigokraft: arjaythedev/multicore-server-challenge at ${TIGOKRAFT_COMMIT}, MIT`)
}

const outputs = new Set()
const samples = programs.map(() => [])
// Round 0 warms the page cache and the CPU's clocks and is not counted.
for (let round = 0; round <= rounds; round++) {
  programs.forEach((p, i) => {
    const r = run("bash", ["-c", 'TIMEFORMAT=%3U; time "$0" > "$0.out"', p.exe])
    if (r.status !== 0) {
      console.error(`${p.name} failed:\n${r.stderr}`)
      process.exit(1)
    }
    outputs.add(fs.readFileSync(`${p.exe}.out`, "utf8").trim())
    const seconds = Number(r.stderr.trim())
    if (r.stderr.trim() === "" || !Number.isFinite(seconds)) {
      console.error(`${p.name}: no CPU time in bash's output: ${JSON.stringify(r.stderr)}`)
      process.exit(1)
    }
    if (round > 0) {
      samples[i].push((seconds * 1000) / (hashes * (p.per ?? 1)))
    }
  })
}
if (outputs.size !== 1) {
  console.error(`the programs disagree on the hash: ${[...outputs].join(", ")}`)
  process.exit(1)
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}
console.log(
  `CPU ms per cost-${cost} hash (${hashes} hashes or batches of four a round, median and spread of ${rounds} rounds)`
)
console.log(`hash: ${[...outputs][0]}\n`)
console.log("| Implementation | ms per hash |")
console.log("| --- | ---: |")
programs.forEach((p, i) => {
  const xs = samples[i]
  const lo = Math.min(...xs).toFixed(1)
  const hi = Math.max(...xs).toFixed(1)
  console.log(`| ${p.name} | ${median(xs).toFixed(1)} (${lo}–${hi}) |`)
})
for (const note of notes) {
  console.log(`\nnote: ${note}`)
}

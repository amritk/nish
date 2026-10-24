/**
 * `nish/crypto/bcrypt` against libxcrypt's `crypt_r`, in both directions, on
 * random passwords and salts.
 *
 * A seeded generator draws passwords of 0 to 80 bytes from all 256 byte values
 * (so NULs, 8-bit bytes and keys past the 72-byte limit all occur), a 16-byte
 * salt and a cost of 4 to 6. A C harness built against `<crypt.h>` makes the
 * `$2a$`, `$2b$` and `$2y$` hashes of each; a generated Nish program then makes
 * its own `$2b$` hash of the same inputs and verifies the three C hashes and a
 * wrong password against them; and the harness finally checks each Nish hash
 * with `crypt_r`. So a case passes when Nish makes the hash `crypt_r` makes,
 * `crypt_r` accepts the hash Nish makes, and Nish answers every verify as
 * `crypt_r` does. `crypt_r` reads the key as a C string, so a password with a
 * NUL in it is the reference's answer for the bytes before it, which is the
 * rule the module follows.
 *
 * Usage: node tests/differential/bcrypt.js [--compiler <nish>] [--cases N] [--seed S]
 * Prints one line per failure and a summary; exits 0 when every case agrees,
 * 1 when one does not, and 2, saying why, when there is no C compiler or no
 * libxcrypt to compare against. `tests/run.js` runs it as "bcrypt differential".
 */
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "..", "..")
const buildDir = path.join(root, "build", "test", "differential-bcrypt")

const argValue = (name, fallback) => {
  const at = process.argv.indexOf(name)
  return at >= 0 && at + 1 < process.argv.length ? process.argv[at + 1] : fallback
}
const compiler = argValue("--compiler", path.join(root, "build", "nish"))
const cases = Number(argValue("--cases", "48"))
let state = Number(argValue("--seed", "873")) >>> 0

/** The next 32 bits of a xorshift32 stream: reproducible, which is all a test input needs. */
const next = () => {
  state ^= state << 13
  state >>>= 0
  state ^= state >>> 17
  state ^= state << 5
  state >>>= 0
  return state
}
const below = (n) => next() % n
const bytes = (n) => Array.from({ length: n }, () => below(256))
const hex = (b) => b.map((v) => v.toString(16).padStart(2, "0")).join("")

/**
 * A password: mostly any byte, sometimes printable ASCII, sometimes high bytes
 * only (the sign-extension case), with a NUL forced into some.
 */
const password = () => {
  const n = below(5) === 0 ? 72 + below(9) : below(40)
  const kind = below(3)
  const shape = [(v) => v, (v) => 0x20 + (v % 95), (v) => 0x80 | v][kind]
  const p = bytes(n).map(shape)
  if (n > 2 && below(4) === 0) {
    p[below(n)] = 0
  }
  return p
}

/** A different password: the first byte changed, or one byte added to an empty one. */
const wrong = (p) => (p.length === 0 ? [0x61] : [p[0] ^ 1, ...p.slice(1)])

const HARNESS = String.raw`
#include <crypt.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* Each input line is a command and its arguments; each answer one line.
 *   S <minor> <cost> <salt hex> <password hex>  the hash crypt_r makes
 *   V <hash> <password hex>                     1 if crypt_r reproduces the hash, else 0 */
static const char ALPHABET[] = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

static size_t unhex(const char *h, unsigned char *out) {
  size_t n = strlen(h) / 2;
  for (size_t i = 0; i < n; i++) {
    unsigned v;
    sscanf(h + 2 * i, "%2x", &v);
    out[i] = (unsigned char)v;
  }
  out[n] = 0;
  return n;
}

static void encode(const unsigned char *src, size_t n, char *dst) {
  size_t i = 0;
  while (i < n) {
    unsigned c1 = src[i++];
    *dst++ = ALPHABET[c1 >> 2];
    c1 = (c1 & 0x03) << 4;
    if (i >= n) { *dst++ = ALPHABET[c1]; break; }
    unsigned c2 = src[i++];
    c1 |= c2 >> 4;
    *dst++ = ALPHABET[c1];
    c1 = (c2 & 0x0f) << 2;
    if (i >= n) { *dst++ = ALPHABET[c1]; break; }
    c2 = src[i++];
    c1 |= c2 >> 6;
    *dst++ = ALPHABET[c1];
    *dst++ = ALPHABET[c2 & 0x3f];
  }
  *dst = 0;
}

int main(void) {
  static char line[4096];
  static unsigned char key[1024], salt[64];
  struct crypt_data data;
  while (fgets(line, sizeof line, stdin)) {
    char a[256], b[256], c[256], d[2048];
    memset(&data, 0, sizeof data);
    d[0] = 0;
    if (sscanf(line, "S %1s %255s %255s %2047s", a, b, c, d) >= 3) {
      unhex(c, salt);
      unhex(d, key);
      char setting[64];
      sprintf(setting, "$2%s$%02d$", a, atoi(b));
      encode(salt, 16, setting + strlen(setting));
      const char *h = crypt_r((const char *)key, setting, &data);
      printf("%s\n", h ? h : "*");
    } else if (sscanf(line, "V %255s %2047s", a, d) >= 1) {
      unhex(d, key);
      const char *h = crypt_r((const char *)key, a, &data);
      printf("%d\n", h != NULL && strcmp(h, a) == 0);
    }
    fflush(stdout);
  }
  return 0;
}
`

/** Runs the harness over `lines`, answering one output line per input line. */
const oracle = (exe, lines) => {
  const r = spawnSync(exe, [], { input: `${lines.join("\n")}\n`, encoding: "utf8" })
  if (r.status !== 0) {
    throw new Error(`the crypt_r harness failed: ${r.stderr}`)
  }
  return r.stdout.trimEnd().split("\n")
}

/** The Nish program: for each case its `$2b$` hash, then its answers to the four verifies. */
const program = (drawn) => {
  const rows = drawn
    .map(
      (c) =>
        `  run(${JSON.stringify(hex(c.password))}, ${JSON.stringify(hex(c.salt))}, ${c.cost}, ` +
        `${JSON.stringify(c.ref.a)}, ${JSON.stringify(c.ref.b)}, ${JSON.stringify(c.ref.y)}, ` +
        `${JSON.stringify(hex(c.wrong))});`
    )
    .join("\n")
  return `import { Secret, secret, wipe } from "nish:secret";
import { bcryptHash, bcryptVerify } from "nish/crypto/bcrypt";

const nibble = (c: i32): i32 => (c <= 57 ? c - 48 : c - 87);

const fromHex = (text: string): u8[] => {
  const out: u8[] = [];
  const n: i32 = toI32(text.length);
  for (let i: i32 = 0; i + 1 < n; i += 2) {
    out.push(toU8(nibble(toI32(text.charCodeAt(i))) * 16 + nibble(toI32(text.charCodeAt(i + 1)))));
  }
  return out;
};

const verified = (password: string, hash: string): string => {
  const held: Secret<u8[]> = secret(fromHex(password));
  const answer: Result<boolean, string> = bcryptVerify(held, hash);
  wipe(held);
  if (answer.isErr()) {
    return "E";
  }
  return answer.value ? "1" : "0";
};

const run = (password: string, salt: string, cost: i32, a: string, b: string, y: string, other: string): void => {
  const held: Secret<u8[]> = secret(fromHex(password));
  const made: Result<string, string> = bcryptHash(held, fromHex(salt), cost);
  wipe(held);
  const hash: string = made.isOk() ? made.value : "*";
  console.log(\`\${hash} \${verified(password, a)}\${verified(password, b)}\${verified(password, y)}\${verified(other, b)}\`);
};

export const main = (): i32 => {
${rows}
  return 0;
};
`
}

const skip = (why) => {
  console.log(`SKIP  bcrypt differential: ${why}`)
  process.exit(2)
}

fs.rmSync(buildDir, { recursive: true, force: true })
fs.mkdirSync(buildDir, { recursive: true })
const cc = process.env.CC || "cc"
if (spawnSync(cc, ["--version"]).status !== 0) {
  skip(`no C compiler (${cc}) to build the crypt_r harness`)
}
fs.writeFileSync(path.join(buildDir, "harness.c"), HARNESS)
const harness = path.join(buildDir, "harness")
const built = spawnSync(cc, ["-O2", "-o", harness, path.join(buildDir, "harness.c"), "-lcrypt"], {
  encoding: "utf8",
})
if (built.status !== 0) {
  skip(`no libxcrypt to compare against (${built.stderr.split("\n")[0]})`)
}

const all = Array.from({ length: cases }, () => {
  const p = password()
  return { password: p, wrong: wrong(p), salt: bytes(16), cost: 4 + below(3) }
})
const made = oracle(
  harness,
  all.flatMap((c) => ["a", "b", "y"].map((m) => `S ${m} ${c.cost} ${hex(c.salt)} ${hex(c.password)}`))
)
all.forEach((c, i) => {
  c.ref = { a: made[3 * i], b: made[3 * i + 1], y: made[3 * i + 2] }
})
const expected = oracle(
  harness,
  all.map((c) => `V ${c.ref.b} ${hex(c.wrong)}`)
)

fs.writeFileSync(path.join(buildDir, "main.ts"), program(all))
const app = path.join(buildDir, "app")
const compiled = spawnSync(compiler, [path.join(buildDir, "main.ts"), "-o", `${buildDir}/`, "--link", app], {
  cwd: root,
  encoding: "utf8",
})
if (compiled.status !== 0) {
  console.log(`FAIL  bcrypt differential: the Nish program did not build\n${compiled.stderr}`)
  process.exit(1)
}
const ran = spawnSync(app, [], { encoding: "utf8" })
if (ran.status !== 0) {
  console.log(`FAIL  bcrypt differential: the Nish program exited with ${ran.status}\n${ran.stderr}`)
  process.exit(1)
}
const answers = ran.stdout.trimEnd().split("\n")
const back = oracle(
  harness,
  answers.map((line, i) => `V ${line.split(" ")[0]} ${hex(all[i].password)}`)
)

const failures = []
const failed = new Set()
all.forEach((c, i) => {
  const [hash, verifies] = (answers[i] ?? "").split(" ")
  const want = `111${expected[i]}`
  const what = `cost ${c.cost}, salt ${hex(c.salt)}, password ${hex(c.password)}`
  if (hash !== c.ref.b) {
    failed.add(i)
    failures.push(`Nish made ${hash}, crypt_r ${c.ref.b} (${what})`)
  }
  if (back[i] !== "1") {
    failed.add(i)
    failures.push(`crypt_r does not accept Nish's ${hash} (${what})`)
  }
  if (verifies !== want) {
    failed.add(i)
    failures.push(`Nish verified $2a$/$2b$/$2y$/wrong as ${verifies}, crypt_r as ${want} (${what})`)
  }
})
for (const f of failures) {
  console.log(`FAIL  bcrypt differential: ${f}`)
}
const withNul = all.filter((c) => c.password.includes(0)).length
const highBit = all.filter((c) => c.password.some((v) => v >= 0x80)).length
const long = all.filter((c) => c.password.length > 72).length
console.log(
  `bcrypt differential: ${cases - failed.size} of ${cases} cases agree ` +
    `(${withNul} with a NUL, ${highBit} with an 8-bit byte, ${long} past 72 bytes; seed ${argValue("--seed", "873")})`
)
process.exit(failures.length === 0 ? 0 : 1)

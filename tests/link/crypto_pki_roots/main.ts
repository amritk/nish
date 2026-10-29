// `nish/crypto/pki-roots` against fixture trees, never the host's `/etc`.
//
// The four roots are self-signed, made with OpenSSL 3.0.13, one subject each:
//
//   openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 -nodes \
//     -keyout /dev/null -subj "/CN=Nish Test Root A" -days 3650 -set_serial 1 -out a.pem
//   openssl req -x509 -newkey rsa:2048 ... "/CN=Nish Test Root B" ... -set_serial 2 -out b.pem
//   openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-384 ... "/CN=Nish Test Root C" ... -set_serial 3
//   openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:P-256 ... "/CN=Nish Test Root D" ... -set_serial 4
//   openssl x509 -in a.pem -trustout -out a-trusted.pem   (the TRUSTED CERTIFICATE block)
//
// fixtures/env-file.pem is A. fixtures/env-dir holds B as the hash name
// 1a2b3c4d.0, C as root-c.pem and again as root-c-copy.crt, and D under three
// names a trust directory does not read: 1a2b3c4d.x, root-d.txt, and a file
// inside the directory sub.crt. fixtures/dir-two/root-d.pem is D, and
// fixtures/link-dir/root-a.pem a symbolic link to env-file.pem.
// fixtures/bundle-mixed.pem is A, a CERTIFICATE block with broken base64, a
// stray END, A as TRUSTED CERTIFICATE, a BEGIN with no END before the next
// BEGIN, B with CRLF line ends, A again, a well-formed block that is not a
// certificate, D with a space and a tab after its BEGIN line, and a block cut
// off by the end of the file. bundle-second.pem is
// C, bundle-third.pem is D, bundle-empty.pem has no PEM at all.
//
// A root is named below by the last letter of its subject, so "AB" is roots A
// then B. A FIFO and the caps are checked against trees written under build/
// as the program runs; the 4097 distinct roots for the roots cap are A with
// the last two bytes of its signature changed, which the parser does not check.
//
// `pkiLoadSystemRoots` reads the environment, so it is checked in a child: this
// program run again as `env -u SSL_CERT_FILE -u SSL_CERT_DIR [VAR=value...]
// <self> env-child`, which prints what it loaded on one line. With neither
// variable set the child is compared with the parent's own load of the system
// defaults, so the check holds whatever the host's /etc holds.
import { mkdirSync, readFileSyncOrNull, realpathSync, writeFileSync } from "nish:fs"
import { spawnSync, spawnSyncTo } from "nish:process"
import { Suite } from "nish/testing"
import { derToPem, pemToDer } from "nish/crypto/x509"
import {
  PKI_ROOTS_MAX_FILE_BYTES,
  PKI_ROOTS_MAX_FILES,
  PKI_ROOTS_MAX_ROOTS,
  PKI_SYSTEM_DIR,
  PkiRoots,
  pkiLoadRoots,
  pkiLoadRootsFor,
  pkiLoadSystemRoots,
  pkiRootsDirEntry,
  pkiSystemBundles,
} from "nish/crypto/pki-roots"

const F: string = "tests/link/crypto_pki_roots/fixtures/"

/** The last letter of each root's subject, in order. */
const names = (store: PkiRoots): string => {
  const out: string[] = []
  for (let i: i32 = 0; i < toI32(store.roots.length); i = i + 1) {
    const subject: u8[] = store.roots[i].subject
    out.push(String.fromBytes(subject, subject.length - 1, subject.length))
  }
  return out.join("")
}

const shape = (t: Suite, what: string, store: PkiRoots, roots: string, sources: string, skipped: i32): void => {
  t.eqStr(`${what}: roots`, names(store), roots)
  t.eqStr(`${what}: sources`, store.sources.join(" "), sources)
  t.eqI32(`${what}: skipped`, store.skipped, skipped)
}

/** A store on one line, as the child prints it. */
const line = (store: PkiRoots): string => `${names(store)}|${store.sources.join(" ")}|${store.skipped}`

/** This program's path, for running it again. */
const selfPath = (): string => {
  const exe: string | null = realpathSync("/proc/self/exe")
  return exe !== null ? exe : process.argv[0]
}

/** The child's line for `pkiLoadSystemRoots` under `vars` (`NAME=value`), or why there is none. */
const child = (tag: string, vars: string[]): string => {
  mkdirSync("build/pki-roots-env")
  const out: string = `build/pki-roots-env/${tag}.out`
  const argv: string[] = ["env", "-u", "SSL_CERT_FILE", "-u", "SSL_CERT_DIR"]
  for (let i: i32 = 0; i < toI32(vars.length); i = i + 1) {
    argv.push(vars[i])
  }
  argv.push(selfPath())
  argv.push("env-child")
  const code: i32 = spawnSyncTo(argv, out, "")
  const text: string | null = readFileSyncOrNull(out)
  if (code !== 0 || text === null) {
    return `the child exited ${code}`
  }
  return text.endsWith("\n") ? text.slice(0, text.length - 1) : text
}

const systemSuite = (): i32 => {
  const t = new Suite("pki-roots: pkiLoadSystemRoots reads the environment")
  t.eqStr("SSL_CERT_FILE alone", child("file", [`SSL_CERT_FILE=${F}env-file.pem`]), `A|${F}env-file.pem|0`)
  t.eqStr(
    "SSL_CERT_DIR alone",
    child("dir", [`SSL_CERT_DIR=${F}env-dir`]),
    `BC|${F}env-dir/1a2b3c4d.0 ${F}env-dir/root-c-copy.crt ${F}env-dir/root-c.pem|0`
  )
  t.eqStr(
    "both, the file first",
    child("both", [`SSL_CERT_FILE=${F}env-file.pem`, `SSL_CERT_DIR=${F}dir-two`]),
    `AD|${F}env-file.pem ${F}dir-two/root-d.pem|0`
  )
  t.eqStr(
    "SSL_CERT_FILE set, SSL_CERT_DIR empty",
    child("file-dir-empty", [`SSL_CERT_FILE=${F}env-file.pem`, "SSL_CERT_DIR="]),
    `A|${F}env-file.pem|0`
  )
  const defaults: string = line(pkiLoadRootsFor(null, null, [PKI_SYSTEM_DIR], pkiSystemBundles()))
  t.eqStr("neither set: the system defaults", child("neither", []), defaults)
  t.eqStr("both empty: the system defaults", child("both-empty", ["SSL_CERT_FILE=", "SSL_CERT_DIR="]), defaults)
  return t.done()
}

const envSuite = (): i32 => {
  const t = new Suite("pki-roots: SSL_CERT_FILE and SSL_CERT_DIR")
  const dirs: string[] = [`${F}dir-two`]
  const bundles: string[] = [`${F}bundle-second.pem`]
  shape(
    t,
    "both set: the file, then the directory, and no default",
    pkiLoadRootsFor(`${F}env-file.pem`, `${F}env-dir`, dirs, bundles),
    "ABC",
    `${F}env-file.pem ${F}env-dir/1a2b3c4d.0 ${F}env-dir/root-c-copy.crt ${F}env-dir/root-c.pem`,
    0
  )
  shape(t, "the file alone", pkiLoadRootsFor(`${F}env-file.pem`, null, dirs, bundles), "A", `${F}env-file.pem`, 0)
  shape(t, "the file alone, the directory empty", pkiLoadRootsFor(`${F}env-file.pem`, "", dirs, bundles), "A", `${F}env-file.pem`, 0)
  shape(
    t,
    "the directory alone",
    pkiLoadRootsFor(null, `${F}env-dir`, dirs, bundles),
    "BC",
    `${F}env-dir/1a2b3c4d.0 ${F}env-dir/root-c-copy.crt ${F}env-dir/root-c.pem`,
    0
  )
  shape(
    t,
    "a directory list, empty components passed over",
    pkiLoadRootsFor(null, `::${F}dir-two::${F}env-dir/:`, dirs, bundles),
    "DBC",
    `${F}dir-two/root-d.pem ${F}env-dir/1a2b3c4d.0 ${F}env-dir/root-c-copy.crt ${F}env-dir/root-c.pem`,
    0
  )
  shape(t, "a missing file is no fallback", pkiLoadRootsFor(`${F}missing.pem`, null, dirs, bundles), "", "", 0)
  shape(t, "a missing directory is no fallback", pkiLoadRootsFor(null, `${F}missing`, dirs, bundles), "", "", 0)
  shape(
    t,
    "neither set: the defaults",
    pkiLoadRootsFor(null, null, dirs, bundles),
    "CD",
    `${F}bundle-second.pem ${F}dir-two/root-d.pem`,
    0
  )
  shape(
    t,
    "both empty: the defaults",
    pkiLoadRootsFor("", "", dirs, bundles),
    "CD",
    `${F}bundle-second.pem ${F}dir-two/root-d.pem`,
    0
  )
  return t.done()
}

const dirSuite = (): i32 => {
  const t = new Suite("pki-roots: a trust directory")
  t.ok("a hash name", pkiRootsDirEntry("1a2b3c4d.0"))
  t.ok("a hash name with a two-digit suffix", pkiRootsDirEntry("1a2b3c4d.12"))
  t.ok("a .pem", pkiRootsDirEntry("root.pem"))
  t.ok("a .crt", pkiRootsDirEntry("root.crt"))
  t.ok("not upper-case hex", !pkiRootsDirEntry("1A2B3C4D.0"))
  t.ok("not seven hex digits", !pkiRootsDirEntry("1a2b3c4.0"))
  t.ok("not a hash with no suffix", !pkiRootsDirEntry("1a2b3c4d."))
  t.ok("not a CRL's hash name", !pkiRootsDirEntry("1a2b3c4d.r0"))
  t.ok("not a letter suffix", !pkiRootsDirEntry("1a2b3c4d.x"))
  t.ok("not a bare .pem", !pkiRootsDirEntry(".pem"))
  t.ok("not a .txt", !pkiRootsDirEntry("root.txt"))
  shape(
    t,
    "the directory: hash and suffix names, a duplicate once, no subdirectory",
    pkiLoadRoots(null, [`${F}env-dir`], []),
    "BC",
    `${F}env-dir/1a2b3c4d.0 ${F}env-dir/root-c-copy.crt ${F}env-dir/root-c.pem`,
    0
  )
  shape(t, "a plain file named as a directory", pkiLoadRoots(null, [`${F}env-file.pem`], []), "", "", 0)
  shape(
    t,
    "a symbolic link to a root is read, under the name it has in the directory",
    pkiLoadRoots(null, [`${F}link-dir`], []),
    "A",
    `${F}link-dir/root-a.pem`,
    0
  )
  return t.done()
}

const bundleSuite = (): i32 => {
  const t = new Suite("pki-roots: bundles")
  shape(
    t,
    "a bundle: every bad block skipped and counted, a duplicate dropped",
    pkiLoadRoots(`${F}bundle-mixed.pem`, [], []),
    "AB",
    `${F}bundle-mixed.pem`,
    6
  )
  shape(
    t,
    "the first bundle that exists, and only it",
    pkiLoadRoots(null, [], [`${F}missing.pem`, `${F}bundle-second.pem`, `${F}bundle-third.pem`]),
    "C",
    `${F}bundle-second.pem`,
    0
  )
  shape(
    t,
    "a bundle with no PEM still counts as the one found",
    pkiLoadRoots(null, [], [`${F}bundle-empty.pem`, `${F}bundle-second.pem`]),
    "",
    `${F}bundle-empty.pem`,
    0
  )
  shape(
    t,
    "a root in the file and the bundle is kept once, from the file",
    pkiLoadRoots(`${F}env-file.pem`, [], [`${F}bundle-mixed.pem`]),
    "AB",
    `${F}env-file.pem ${F}bundle-mixed.pem`,
    6
  )
  shape(
    t,
    "nothing found is an empty store",
    pkiLoadRoots(`${F}missing.pem`, [`${F}missing`], [`${F}missing-too.pem`]),
    "",
    "",
    0
  )
  const system: string[] = pkiSystemBundles()
  t.eqStr(
    "the six system bundles, in order",
    system.join(" "),
    [
      "/etc/ssl/certs/ca-certificates.crt",
      "/etc/pki/tls/certs/ca-bundle.crt",
      "/etc/ssl/ca-bundle.pem",
      "/etc/pki/tls/cacert.pem",
      "/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem",
      "/etc/ssl/cert.pem",
    ].join(" ")
  )
  t.eqStr("the system directory", PKI_SYSTEM_DIR, "/etc/ssl/certs")
  return t.done()
}

const capSuite = (): i32 => {
  const t = new Suite("pki-roots: a FIFO, and the caps")
  const a: string | null = readFileSyncOrNull(`${F}env-file.pem`)
  if (a === null) {
    t.fail("root A reads", "fixtures/env-file.pem is missing")
    return t.done()
  }
  mkdirSync("build/pki-roots-caps")
  // Root A, padded with comment lines to one byte past the cap.
  const row: string[] = []
  for (let i: i32 = 0; i < 1023; i = i + 1) {
    row.push("#")
  }
  row.push("\n")
  const chunk: string = row.join("")
  const lines: string[] = [a]
  let size: i32 = toI32(a.length)
  while (size + toI32(chunk.length) <= PKI_ROOTS_MAX_FILE_BYTES) {
    lines.push(chunk)
    size = size + toI32(chunk.length)
  }
  while (size < PKI_ROOTS_MAX_FILE_BYTES) {
    lines.push("#")
    size = size + 1
  }
  lines.push("\n")
  const big: string = lines.join("")
  writeFileSync("build/pki-roots-caps/big.pem", big)
  shape(t, "a file one byte past the cap is not parsed", pkiLoadRoots("build/pki-roots-caps/big.pem", [], []), "", "build/pki-roots-caps/big.pem", 1)
  writeFileSync("build/pki-roots-caps/at.pem", big.slice(0, big.length - 1))
  t.eqStr("a file at the cap is parsed", names(pkiLoadRoots("build/pki-roots-caps/at.pem", [], [])), "A")

  // A FIFO opened for reading waits for a writer that never comes, so reading
  // one would hang the load; it is not a regular file, so it is never opened.
  const fifo: string = "build/pki-roots-caps/fifo.pem"
  spawnSync(["rm", "-f", fifo])
  t.eqI32("mkfifo makes the FIFO", spawnSync(["mkfifo", fifo]), 0)
  shape(t, "a FIFO is not read", pkiLoadRoots(fifo, [], []), "", "", 0)
  shape(t, "a FIFO is not the bundle found", pkiLoadRoots(null, [], [fifo, `${F}bundle-second.pem`]), "C", `${F}bundle-second.pem`, 0)

  mkdirSync("build/pki-roots-caps/many")
  for (let i: i32 = 0; i <= PKI_ROOTS_MAX_FILES; i = i + 1) {
    writeFileSync(`build/pki-roots-caps/many/${i + 10000}.pem`, "")
  }
  const many: PkiRoots = pkiLoadRoots(null, ["build/pki-roots-caps/many"], [])
  t.eqI32("the files cap: files read", toI32(many.sources.length), PKI_ROOTS_MAX_FILES)
  t.eqI32("the files cap: the one past it skipped", many.skipped, 1)

  // One past the roots cap, then the first again: the cap counts the new root
  // it turns away, and a duplicate of a kept root is dropped as ever.
  const ders: u8[][] | null = pemToDer(a, "CERTIFICATE")
  if (ders === null || ders.length !== 1) {
    t.fail("root A decodes", "fixtures/env-file.pem is not one CERTIFICATE")
    return t.done()
  }
  const der: u8[] = ders[0]
  const n: i32 = toI32(der.length)
  const blocks: string[] = []
  for (let i: i32 = 0; i <= PKI_ROOTS_MAX_ROOTS; i = i + 1) {
    der[n - 2] = toU8((i >> 8) & 255)
    der[n - 1] = toU8(i & 255)
    blocks.push(derToPem(der, "CERTIFICATE"))
  }
  blocks.push(blocks[0])
  writeFileSync("build/pki-roots-caps/roots.pem", blocks.join(""))
  const capped: PkiRoots = pkiLoadRoots("build/pki-roots-caps/roots.pem", [], [])
  t.eqI32("the roots cap: roots kept", toI32(capped.roots.length), PKI_ROOTS_MAX_ROOTS)
  t.eqI32("the roots cap: the one past it skipped, the duplicate not", capped.skipped, 1)
  return t.done()
}

export const main = (): i32 => {
  if (toI32(process.argv.length) > 1 && process.argv[1] === "env-child") {
    console.log(line(pkiLoadSystemRoots()))
    return 0
  }
  return systemSuite() + envSuite() + dirSuite() + bundleSuite() + capSuite()
}

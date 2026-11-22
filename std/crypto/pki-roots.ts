/**
 * `nish/crypto/pki-roots` — the root certificates a program should trust,
 * read from where OpenSSL and Go look for them: the files `SSL_CERT_FILE` and
 * `SSL_CERT_DIR` name, or else the system's bundle.
 *
 *     import { PkiRoots, pkiLoadSystemRoots } from "nish/crypto/pki-roots";
 *
 *     const store: PkiRoots = pkiLoadSystemRoots();
 *     // store.roots: the parsed roots, no two with the same DER
 *     // store.sources: the files they were read from, in order
 *     // store.skipped: the PEM blocks and files that were not a root
 *
 * The order (docs/security/crypto-pki.md, "Where the roots come from"):
 *
 *   1. When `SSL_CERT_FILE` or `SSL_CERT_DIR` is set and not empty, exactly
 *      those: the file, and every directory of the `:`-separated list. There is
 *      no fallback, so naming a file that is missing trusts nothing.
 *   2. Otherwise the first file of `pkiSystemBundles()` that exists, and
 *      the directory `/etc/ssl/certs` beside it.
 *
 * Only a path that leads to a regular file is read. A directory gives every
 * entry named `*.pem`, `*.crt` or OpenSSL's hash form `xxxxxxxx.N`, not its
 * subdirectories. A file is split into PEM blocks here, not by `pemToDer`,
 * which refuses a whole text for one bad block: a `CERTIFICATE`
 * block `x509ParseCertificate` accepts is a root, and every other block — a
 * malformed one, an unterminated one, a `TRUSTED CERTIFICATE` — is counted in
 * `skipped` and passed over. Finding nothing is an empty `roots`, never an
 * exit: what to do with no roots is the caller's decision.
 *
 * Whoever sets the environment or writes these files decides what is trusted.
 * That is the contract, as it is OpenSSL's, and it is not defended against;
 * what is bounded is the work a hostile file can cause (PKI-R1 to PKI-R3).
 *
 * **Native only.** It asks `lstatOwnerModeSync` what each path is before it
 * reads it, which a wasm32 build has no file system to answer, so a program
 * that imports this module does not compile for wasm32 (PKI-R4).
 * `nish/crypto/x509` imports nothing from here.
 *
 * Private helpers share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e), which is why each one carries the module's name.
 */
import { readdirSync, readFileSyncOrNull, realpathSync } from "nish:fs"
import { getenv } from "nish:process"
import { X509Certificate, pemToDer, x509ParseCertificate } from "nish/crypto/x509"

/** The largest file read as roots: 16 MiB, some eighty times a full Mozilla bundle. A bigger one counts as one skip. */
export const PKI_ROOTS_MAX_FILE_BYTES: i32 = 16777216

/** The most files one load reads; an entry past it counts as one skip. */
export const PKI_ROOTS_MAX_FILES: i32 = 4096

/** The most roots one load keeps; a certificate past it counts as one skip. */
export const PKI_ROOTS_MAX_ROOTS: i32 = 4096

/** The trust store one load found. */
export class PkiRoots {
  /** The parsed roots, in the order they were read, no two with the same DER. */
  roots: X509Certificate[]
  /** Every file that was read, in order, whether or not it held a root. */
  sources: string[]
  /** The PEM blocks that were not a root, and the files too large or past the cap to read. */
  skipped: i32 = 0

  /** An empty load: no roots, no sources, nothing skipped. */
  constructor() {
    this.roots = []
    this.sources = []
  }
}

/**
 * The system bundles, in the order they are tried; the first one that reads
 * as a file is used. A function, not a constant, because a module constant
 * is a number, a boolean or a string. The paths and their order are those of Go's
 * `crypto/x509/root_linux.go`, cited as facts, not copied code: Debian, Ubuntu,
 * Arch and Gentoo; Fedora and RHEL; openSUSE; OpenELEC; CentOS and RHEL 7;
 * Alpine, macOS and the BSDs.
 *
 * @returns The bundle paths, in a fresh array each call.
 */
export const pkiSystemBundles = (): string[] => [
  "/etc/ssl/certs/ca-certificates.crt",
  "/etc/pki/tls/certs/ca-bundle.crt",
  "/etc/ssl/ca-bundle.pem",
  "/etc/pki/tls/cacert.pem",
  "/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem",
  "/etc/ssl/cert.pem",
]

/** The directory read beside the system bundle. */
export const PKI_SYSTEM_DIR: string = "/etc/ssl/certs"

/** What one load has read so far, and the DER already kept. */
class PkiRootsLoad {
  /** @internal */
  out: PkiRoots
  /** @internal */
  seen: Set<string>
  /** @internal */
  files: i32 = 0

  constructor() {
    this.out = new PkiRoots()
    this.seen = new Set<string>()
  }
}

/**
 * Counts one PEM block or file skipped. The count is not capped: past
 * `PKI_ROOTS_MAX_FILES` a trust directory's entries are each counted without
 * a read, so no bound below 2^31 holds for it (PKI-R8).
 */
const pkiRootsSkip = (load: PkiRootsLoad): void => {
  load.out.skipped = load.out.skipped + 1
}

/** The lower-case hex digit of `v`, 0 to 15. */
const pkiRootsHexChar = (v: i32): string => String.fromCharCode(v < 10 ? 48 + v : 87 + v)

/**
 * `bytes[lo .. hi)` in lower-case hex, joined in halves so the copying stays
 * `n log n`; `""` for an empty or outside range. The key a DER is kept once by.
 */
const pkiRootsHex = (bytes: u8[], lo: i32, hi: i32): string => {
  if (lo < 0 || lo >= toI32(bytes.length) || hi > toI32(bytes.length) || lo >= hi) {
    return ""
  }
  if (lo + 1 === hi) {
    const b: i32 = toI32(bytes[lo])
    return `${pkiRootsHexChar(b >> 4)}${pkiRootsHexChar(b & 15)}`
  }
  // Unsigned: both ends are at most bytes.length, so the sum cannot wrap.
  const mid: i32 = toI32((toU32(lo) + toU32(hi)) / 2)
  return `${pkiRootsHex(bytes, lo, mid)}${pkiRootsHex(bytes, mid, hi)}`
}

/** Keeps `der` as a root when it parses, is new, and the cap has room; counts it skipped otherwise. */
const pkiRootsKeep = (load: PkiRootsLoad, der: u8[]): void => {
  const cert: X509Certificate | null = x509ParseCertificate(der)
  if (cert === null) {
    pkiRootsSkip(load)
    return
  }
  const key: string = pkiRootsHex(der, 0, toI32(der.length))
  if (load.seen.has(key)) {
    return
  }
  if (toI32(load.out.roots.length) >= PKI_ROOTS_MAX_ROOTS) {
    pkiRootsSkip(load)
    return
  }
  load.seen.add(key)
  load.out.roots.push(cert)
}

/**
 * One PEM block, `text` whole from its BEGIN line through its END line. A block
 * labelled other than CERTIFICATE gives `pemToDer` no DER, so it is skipped too.
 */
const pkiRootsBlock = (load: PkiRootsLoad, text: string): void => {
  const ders: u8[][] | null = pemToDer(text, "CERTIFICATE")
  if (ders === null) {
    pkiRootsSkip(load)
    return
  }
  const list: u8[][] = ders
  if (toI32(list.length) < 1 || toI32(list.length) > 1) {
    pkiRootsSkip(load)
    return
  }
  pkiRootsKeep(load, list[0])
}

/**
 * Every PEM block of `text`. A BEGIN line opens a block and the next END line
 * closes it; a BEGIN before that END counts the open block skipped and starts
 * again, and a block still open at the end is skipped. Text outside the blocks,
 * a stray END among it, is passed over, as bundles carry comments there.
 */
const pkiRootsSplit = (load: PkiRootsLoad, text: string): void => {
  const n: i32 = toI32(text.length)
  let open: boolean = false
  let blockStart: i32 = 0
  let lineStart: i32 = 0
  while (lineStart >= 0 && lineStart < n) {
    let lineEnd: i32 = lineStart
    while (lineEnd >= 0 && lineEnd < toI32(text.length)) {
      if (toI32(text.charCodeAt(lineEnd)) === 10) {
        break
      }
      // Unsigned: lineEnd is below text.length, so it cannot wrap.
      lineEnd = toI32(toU32(lineEnd) + 1)
    }
    // Unsigned: lineEnd is below n on that side, so it cannot wrap.
    const next: i32 = lineEnd < n ? toI32(toU32(lineEnd) + 1) : n
    // A carriage return, space or tab before the line feed is no part of the
    // line, so a BEGIN with trailing whitespace still opens a block and is
    // counted when `pemToDer` refuses it, rather than lost unseen.
    let end: i32 = lineEnd
    while (end > lineStart && end >= 1 && end <= toI32(text.length)) {
      const c: i32 = toI32(text.charCodeAt(end - 1))
      if (c !== 13 && c !== 32 && c !== 9) {
        break
      }
      end = end - 1
    }
    const line: string = text.substring(lineStart, end)
    if (line.startsWith("-----BEGIN ") && line.endsWith("-----") && line.length > 16) {
      if (open) {
        pkiRootsSkip(load)
      }
      open = true
      blockStart = lineStart
    } else if (open && line.startsWith("-----END ")) {
      pkiRootsBlock(load, text.substring(blockStart, next))
      open = false
    }
    lineStart = next
  }
  if (open) {
    pkiRootsSkip(load)
  }
}

/**
 * Where `path` leads when that is a regular file, or `null`: a missing path,
 * a directory, and a FIFO or device, whose `open` could wait forever or whose
 * read never ends, are not a file of roots (PKI-R2).
 */
const pkiRootsRegular = (path: string): string | null => {
  const real: string | null = realpathSync(path)
  if (real === null) {
    return null
  }
  const om: i64 = lstatOwnerModeSync(real)
  return om >= 0 && (om & 0xf000) === 0x8000 ? real : null
}

/** Reads `path` as roots: `false` when it is not a regular file that reads, `true` when it was (or would have been, past a cap). */
const pkiRootsFile = (load: PkiRootsLoad, path: string): boolean => {
  const files: i32 = load.files
  if (files >= PKI_ROOTS_MAX_FILES) {
    pkiRootsSkip(load)
    return true
  }
  const real: string | null = pkiRootsRegular(path)
  const text: string | null = real === null ? null : readFileSyncOrNull(real)
  if (text === null) {
    return false
  }
  load.files = files + 1
  load.out.sources.push(path)
  if (toI32(text.length) > PKI_ROOTS_MAX_FILE_BYTES) {
    pkiRootsSkip(load)
    return true
  }
  pkiRootsSplit(load, text)
  return true
}

const pkiRootsIsDigit = (c: i32): boolean => c >= 48 && c <= 57

const pkiRootsIsHex = (c: i32): boolean => pkiRootsIsDigit(c) || (c >= 97 && c <= 102)

/**
 * Whether a directory entry is one a trust directory holds: `*.pem`, `*.crt`,
 * or the hash form `xxxxxxxx.N`.
 *
 * @param name The entry's name, without its directory.
 * @returns `true` for a name ending `.pem` or `.crt` with something before
 *   it, or eight lowercase hex digits, a dot and one or more decimal digits.
 */
export const pkiRootsDirEntry = (name: string): boolean => {
  if (name.endsWith(".pem") || name.endsWith(".crt")) {
    return name.length > 4
  }
  const n: i32 = toI32(name.length)
  if (n < 10 || toI32(name.length) < 10 || toI32(name.charCodeAt(8)) !== 46) {
    return false
  }
  for (let i: i32 = 0; i < 8 && i < toI32(name.length); i = i + 1) {
    if (!pkiRootsIsHex(toI32(name.charCodeAt(i)))) {
      return false
    }
  }
  for (let i: i32 = 9; i < n; i = i + 1) {
    if (!pkiRootsIsDigit(toI32(name.charCodeAt(i)))) {
      return false
    }
  }
  return true
}

/** Every trust entry of the directory `dir`, in byte order; a directory that cannot be read gives nothing. */
const pkiRootsDir = (load: PkiRootsLoad, dir: string): void => {
  const names: string[] | null = readdirSync(dir)
  if (names === null) {
    return
  }
  const list: string[] = names
  const base: string = dir.endsWith("/") ? dir : `${dir}/`
  for (let i: i32 = 0; i < toI32(list.length); i = i + 1) {
    const name: string = list[i]
    if (pkiRootsDirEntry(name)) {
      pkiRootsFile(load, `${base}${name}`)
    }
  }
}

/**
 * The roots of an explicit lookup: `file` when it is not `null`, then the
 * first of `bundles` that reads as a file, then every directory of `dirs`, in
 * that order. A path that cannot be read contributes nothing; a duplicate DER
 * is kept once, where it was first read.
 *
 * @param file A file to read first, or `null` for none.
 * @param dirs The directories to read every trust entry of.
 * @param bundles The candidate bundle files; only the first that reads is used.
 * @returns A new `PkiRoots` with what was found, empty when nothing was.
 */
export const pkiLoadRoots = (file: string | null, dirs: string[], bundles: string[]): PkiRoots => {
  const load: PkiRootsLoad = new PkiRootsLoad()
  if (file !== null) {
    pkiRootsFile(load, file)
  }
  for (let i: i32 = 0; i < toI32(bundles.length); i = i + 1) {
    if (pkiRootsFile(load, bundles[i])) {
      break
    }
  }
  for (let i: i32 = 0; i < toI32(dirs.length); i = i + 1) {
    pkiRootsDir(load, dirs[i])
  }
  return load.out
}

/** The non-empty components of a `:`-separated directory list. */
const pkiRootsSplitDirs = (list: string): string[] => {
  const out: string[] = []
  let start: i32 = 0
  for (let i: i32 = 0; i < toI32(list.length); i = i + 1) {
    if (toI32(list.charCodeAt(i)) === 58) {
      if (i > start) {
        out.push(list.substring(start, i))
      }
      start = i + 1
    }
  }
  const n: i32 = toI32(list.length)
  if (n > start) {
    out.push(list.substring(start, n))
  }
  return out
}

/**
 * `pkiLoadSystemRoots` with the two variables' values given, and the defaults
 * it falls back to: what it does with the environment, without reading it, so
 * the order can be tested against fixture trees rather than the host's `/etc`.
 * `certFile` and `certDir` are `SSL_CERT_FILE` and `SSL_CERT_DIR`, `null`
 * when unset; an empty value counts as unset.
 *
 * @param certFile The value of `SSL_CERT_FILE`, or `null` when unset.
 * @param certDir The value of `SSL_CERT_DIR`, a `:`-separated list, or `null`
 *   when unset.
 * @param dirs The directories read when neither variable is set; ignored
 *   when either is.
 * @param bundles The bundle files tried when neither variable is set;
 *   ignored when either is.
 * @returns A new `PkiRoots`, as `pkiLoadRoots` gives it.
 */
export const pkiLoadRootsFor = (
  certFile: string | null,
  certDir: string | null,
  dirs: string[],
  bundles: string[]
): PkiRoots => {
  const file: string | null = certFile !== null && certFile.length > 0 ? certFile : null
  const dir: string | null = certDir !== null && certDir.length > 0 ? certDir : null
  if (file === null && dir === null) {
    return pkiLoadRoots(null, dirs, bundles)
  }
  return pkiLoadRoots(file, dir === null ? [] : pkiRootsSplitDirs(dir), [])
}

/**
 * The roots this program should trust: those `SSL_CERT_FILE` and
 * `SSL_CERT_DIR` name when either is set and not empty, and otherwise the
 * first of `pkiSystemBundles()` that exists and `/etc/ssl/certs`.
 *
 * @returns A new `PkiRoots`, read afresh on every call; empty when nothing
 *   was found.
 */
export const pkiLoadSystemRoots = (): PkiRoots =>
  pkiLoadRootsFor(getenv("SSL_CERT_FILE"), getenv("SSL_CERT_DIR"), [PKI_SYSTEM_DIR], pkiSystemBundles())

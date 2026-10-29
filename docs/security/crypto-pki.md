# Security record: PKI trust anchors and path validation

The record of two modules of #987, toward #480. `nish/crypto/pki-roots`:
where a program's root certificates come from, what the loader does with a
file it cannot use, and what it bounds (PKI-R1 to PKI-R7). `nish/crypto/pki`:
whether the chain a TLS server sent leads to one of those roots and names the
host dialled, and what one call may cost ([Path validation](#path-validation-nishcryptopki),
PKI-1 to PKI-16). Both are written with the code rather than after an audit,
so that the audit starts from evidence.

Anchors are function names: in `std/crypto/pki-roots.ts` on the head that
merged its half, whose base is `2cdef4fa`, and in `std/crypto/pki.ts` on the
head that merges the path validator, whose base is `351a9a8f`.

**Result.** The loader reads the roots `SSL_CERT_FILE` and `SSL_CERT_DIR`
name, or else the first system bundle and `/etc/ssl/certs`, and gives them
parsed, with no two alike. A file the loader cannot use never stops a load.
Neither does a PEM block it cannot use: each is counted in `skipped`, and
loading moves on to the next. The work a hostile file can cause is bounded in
bytes per file, files per load and roots per load (PKI-R1). A FIFO or device
is never opened (PKI-R2). The module does not compile for wasm32, where it
would have no file system to answer (PKI-R4). Nothing was found to fix.
Accepted and not counted:

- the size cap is checked after the read, and there is a window between the
  file-type check and the open (PKI-R6);
- the macOS Keychain gap (PKI-R7).

## Scope

| File | Functions |
| --- | --- |
| `std/crypto/pki.ts` | `pkiVerifyServer`, `pkiMatchHostname`, `pkiVerifySignature`, `pkiTrustStore`, `pkiReason`, `PkiTrustStore`, `PkiResult`, and every private helper: `PkiSearch`, `pkiExtend`, `pkiCandidate`, `pkiNote`, `pkiLeafCode`, `pkiIntermediateCode`, `pkiTimeCode`, `pkiConstraintsCode`, `pkiSelfIssued`, `pkiDirAllowed`, `pkiIpAllowed`, `pkiIpWithin`, `pkiDnsAllowed`, `pkiSubtreeRoot`, `pkiDnsWithin`, `pkiCheckSignature`, `pkiSignatureCode`, `pkiEcdsaCode`, `pkiRsaCode`, `pkiHostDns`, `pkiDnsMatch`, `pkiParseIp`, `pkiParseIpv6`, `pkiParseIpv4`, `pkiHexDigit`, `pkiDigit`, `pkiLabelCount`, `pkiValidDns`, `pkiStripDot`, `pkiFoldEqualAt`, `pkiLower`, `pkiHex`, `pkiBytesEqual` |
| `std/crypto/pki-roots.ts` | `pkiLoadSystemRoots`, `pkiLoadRootsFor`, `pkiLoadRoots`, `pkiSystemBundles`, `pkiRootsDirEntry`, `PkiRoots`; `PkiRootsLoad`, `pkiRootsKeep`, `pkiRootsBlock`, `pkiRootsSplit`, `pkiRootsRegular`, `pkiRootsFile`, `pkiRootsDir`, `pkiRootsSplitDirs`, `pkiRootsIsDigit`, `pkiRootsIsHex` |

Out of scope:

- The DER, PEM and certificate parsers both modules call, `pemToDer`,
  `x509ParseCertificate`, `x509NameEqual` and `x509NameIsPrefix`. They are in
  [crypto-x509.md](crypto-x509.md). What the path validator takes from them —
  every extension field it reads — is the parser's answer, so a parser that
  answers more than the bytes say moves a decision here; X509-10 is that
  parser's record of it.
- The verifiers the path validator calls: `p256Verify`, `p384Verify`,
  `ed25519Verify`, `sha256` and `sha384`, each in its own record.
- Whether a root is fit to anchor a chain is not the loader's question. It is
  not the path validator's either: a root is a name and a key, and its own
  validity period, extensions and constraints are not read (PKI-4, PKI-18).
- The `nish:fs` and `nish:process` builtins the module calls. They are in
  [runtime.md](runtime.md).

## Threat model

**Whoever sets the environment or writes these paths decides what is
trusted.** That is the contract, as it is OpenSSL's and Go's, and the loader
does not defend against it. A process that can set `SSL_CERT_FILE` or write
`/etc/ssl/certs` can add a root, and that is the point of both.

What is defended is the program that calls the loader, against a trust file
that is corrupt, truncated, enormous or not a file at all. The file may have
been left by a broken package update, or by a lower-privileged user in a
directory the variable names. A win for that file is any of these:

- a panic or an exit;
- a load that never returns;
- memory or time out of proportion to the roots it holds;
- one bad block making the good roots beside it disappear.

Disappearing roots would fail closed, but they would make a load that ought
to work fail.

A second, quieter risk is a trust store wider than the operator asked for.
The loader never falls back to the system bundle when a variable is set
(PKI-R5). Naming a file that is missing therefore trusts nothing, rather than
everything the system ships.

## Where the roots come from

`pkiLoadSystemRoots` reads the environment and calls `pkiLoadRootsFor`, which
the tests call with fixture paths in place of the environment and `/etc`:

1. **When `SSL_CERT_FILE` or `SSL_CERT_DIR` is set and not empty**, exactly
   what they name. The file's roots come first. Then come the roots of every
   directory in the `:`-separated `SSL_CERT_DIR` list, with empty components
   passed over. A variable set to the empty string counts as unset, as it does
   for Go.
2. **Otherwise**, the first file of `pkiSystemBundles()` that reads as a
   regular file, and then the directory `/etc/ssl/certs`. A root found in both
   is kept once, from the bundle.

The bundle list and its order are those of Go's `crypto/x509/root_linux.go`,
cited as facts, not copied code:

| Path | Distribution |
| --- | --- |
| `/etc/ssl/certs/ca-certificates.crt` | Debian, Ubuntu, Arch, Gentoo |
| `/etc/pki/tls/certs/ca-bundle.crt` | Fedora, RHEL 6 |
| `/etc/ssl/ca-bundle.pem` | openSUSE |
| `/etc/pki/tls/cacert.pem` | OpenELEC |
| `/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem` | CentOS, RHEL 7 |
| `/etc/ssl/cert.pem` | Alpine, macOS, the BSDs |

A bundle that exists but holds no root still counts as the one found, so the
search stops there, as Go's does.

Like Go's `loadSystemRoots` (`crypto/x509/root_unix.go`), the defaults read
the first bundle found and then the directory beside it, with duplicates
dropped. Two choices differ from Go:

- **The variables move together.** Go replaces its file list when
  `SSL_CERT_FILE` is set and its directory list when `SSL_CERT_DIR` is set,
  each on its own, so with only `SSL_CERT_FILE` set it still walks its
  default directories. Here, setting either one replaces both, with no
  fallback. An operator who names one file gets that file and nothing from
  `/etc`.
- **One default directory.** Go's default directories on Linux are
  `/etc/ssl/certs` and `/etc/pki/tls/certs`. Here the only one is
  `/etc/ssl/certs`.

In a directory, an entry is read when it is named `*.pem` or `*.crt`, or has
OpenSSL's hash name, eight lower-case hex digits, a dot and digits
(`1a2b3c4d.0`). A CRL's `xxxxxxxx.rN` name is not read, and neither is a
subdirectory. Entries are read in the byte order `readdirSync` returns. A
symbolic link is followed to the file it names. That file is recorded under
the name it has in the directory.

## The skip rule

A file is split into PEM blocks by the loader's own line scanner,
`pkiRootsSplit`, not by `pemToDer` over the whole text. `pemToDer` refuses a
text for one malformed block (X509-1 in crypto-x509.md). That is right for a
single certificate and wrong for a bundle of hundreds, where one bad block
would throw away every root beside it.

Each of these counts one in `skipped` and loading moves on:

- a `CERTIFICATE` block whose base64 is malformed;
- a block whose DER `x509ParseCertificate` refuses;
- a block with any other label, `TRUSTED CERTIFICATE` among them: OpenSSL's
  auxiliary trust settings are not read, so such a block is not taken as a
  plain root;
- a BEGIN line with no END line before the next BEGIN;
- a BEGIN line with trailing spaces or tabs: the splitter opens a block for
  it, and `pemToDer`, which reads such a line as no BEGIN, refuses the block;
- a block still open at the end of the file;
- a file larger than `PKI_ROOTS_MAX_FILE_BYTES`;
- an entry past `PKI_ROOTS_MAX_FILES`;
- a certificate past `PKI_ROOTS_MAX_ROOTS`.

These cost nothing:

- text outside a block, a stray END line among it, since bundles carry
  comments there;
- a CR before a line's LF, and spaces or tabs before either, as far as the
  splitter is concerned;
- a path that is missing, unreadable, a directory or not a regular file;
- a certificate whose DER was already kept.

Finding nothing gives an empty `roots`, never an exit. What a program does
with no roots is its own decision.

## Findings

Each finding is a property checked and found to hold. None was a defect.
Tests are named by their exact check strings: the program's in
`tests/link/crypto_pki_roots/expected.out`, and the harness's in
`tests/run.js`. Each rule's test was confirmed by removing the rule, running
the program and watching the named checks fail. For PKI-R2, removing the rule
made the program hang until it was killed.

### PKI-R1: the work of one load is bounded

A file over `PKI_ROOTS_MAX_FILE_BYTES` (16 MiB, about eighty times a full
Mozilla bundle) is counted as a skip and not parsed. One load reads at most
`PKI_ROOTS_MAX_FILES` (4096) files and keeps at most `PKI_ROOTS_MAX_ROOTS`
(4096) roots. Past either cap, each further entry or certificate is a skip.
The splitter makes one pass over the text, and every key it keeps is in a
`Set`, so the time is linear in the bytes read.

Tests:

- `a file one byte past the cap is not parsed: roots`, `: sources` and
  `: skipped`
- `a file at the cap is parsed`
- `the files cap: files read` and `the files cap: the one past it skipped`
- `the roots cap: roots kept` and
  `the roots cap: the one past it skipped, the duplicate not`, over a bundle
  written as the program runs: root A with the last two bytes of its
  signature changed 4097 ways, which the parser does not check, then the
  first of those again

### PKI-R2: only a regular file is opened

`pkiRootsRegular` resolves the path with `realpathSync`, asks
`lstatOwnerModeSync` for the target's type, and reads it only when that type
is a regular file. Opening a FIFO for reading waits for a writer, so a FIFO
named as `SSL_CERT_FILE` would otherwise hang the load forever. A character
device such as `/dev/zero` would otherwise be read without end.

Tests:

- `a FIFO is not read: roots`, `: sources` and `: skipped`
- `a FIFO is not the bundle found: roots`, `: sources` and `: skipped`

The FIFO is what pins the rule: a directory named as a file is refused by the
read itself, with or without it. `mkfifo makes the FIFO` fails, rather than
skips, where `mkfifo` is not on `PATH`.

### PKI-R3: a bad block costs only itself

Every case in [the skip rule](#the-skip-rule) is in one fixture,
`bundle-mixed.pem`. It holds, in order:

- root A
- a broken-base64 block
- a stray END line
- A as a `TRUSTED CERTIFICATE`
- a BEGIN line with no END line
- root B with CRLF line ends
- A again
- a well-formed block that is not a certificate
- root D whose BEGIN line ends in a space and a tab
- a block cut off at the end of the file

The load gives A then B, with six skipped. Duplicate keys are dropped
across files as well as within one.

Tests:

- `a bundle: every bad block skipped and counted, a duplicate dropped: roots`,
  `: sources` and `: skipped`
- `a root in the file and the bundle is kept once, from the file: roots`
- `the directory: hash and suffix names, a duplicate once, no subdirectory: roots`

### PKI-R4: a wasm32 build is refused

The module calls `lstatOwnerModeSync`, which is refused on wasm32, so a
program that imports it does not compile for that target. It never compiles
to a loader that answers about a file system the target does not have.

Test: ``link/crypto_pki_roots_wasm: rejected with "`lstatOwnerModeSync` reaches the operating system, and a wasm32 build has none to reach"``.

### PKI-R5: a variable that is set is never widened

When either variable is set and not empty, no system bundle or directory is
read. A file or directory that is missing therefore trusts nothing. That
`pkiLoadSystemRoots` passes the two variables, each in its place, is checked
by running the test program again under `env` with the variables set as
named; with neither set, the child is compared with the parent's own load of
the defaults, so the check does not depend on the host's `/etc`.

Tests:

- `SSL_CERT_FILE alone`, `SSL_CERT_DIR alone`, `both, the file first` and
  `SSL_CERT_FILE set, SSL_CERT_DIR empty`
- `neither set: the system defaults` and `both empty: the system defaults`
- `the six system bundles, in order` and `the system directory`

- `a missing file is no fallback: roots`
- `a missing directory is no fallback: roots`
- `both set: the file, then the directory, and no default: roots`
- `the file alone, the directory empty: roots`
- `both empty: the defaults: roots`
- `a directory list, empty components passed over: roots`

## Accepted

### PKI-R6 (Low): the size cap follows the read, and a type check precedes the open

`nish:fs` has no call that gives a file's size without reading it. A file over
the cap is therefore read whole by `readFileSyncOrNull`, up to its 2^31 − 1
byte limit, before it is counted as a skip. A trust directory's listing is
read whole too, before the files cap applies to its entries.

There is also a window between `lstatOwnerModeSync` and the open. In that
window the regular file could be swapped for a FIFO.

Both need someone who can write the trust paths. By the threat model, that
someone already decides what is trusted. Both would close with a builtin that
opens a file once and answers its type and size from the open descriptor.

### PKI-R7 (Low): the macOS Keychain is not read

On macOS the trust store a platform client uses is the Keychain and its trust
settings, read through Security.framework. The only file the loader reads
there is `/etc/ssl/cert.pem`, the last bundle in the list. That file is a
static snapshot shipped with the OS: it is not regenerated from the Keychain,
and it misses all of the following:

- **Roots added by an administrator or MDM.** A corporate CA that
  `security add-trusted-cert` or a configuration profile installs is in the
  System or login keychain, not in the file. A program loading roots this
  way does not trust it, unless the operator exports it and names it with
  `SSL_CERT_FILE`.
- **Trust settings, never-trust among them.** A user or administrator can
  mark a root never-trusted or restrict it to some uses. Those settings live
  in the trust-settings domains and are not reflected in the file. A root the
  machine's owner distrusted is still trusted here.
- **Apple's partial distrust and per-root constraints.** Apple distrusts
  certain roots for certificates issued after a date, and constrains others
  to some names or uses. These rules are in the OS's trust evaluation, not in
  the certificate list. The file keeps such a root as an ordinary,
  unconstrained root.
- **Revocation and Certificate Transparency.** Keychain evaluation applies
  Apple's revocation data and its CT policy. Neither applies to a root read
  from the file, and both are beyond what a trust-anchor loader supplies.

Reading the Keychain needs Security.framework, which the runtime does not
link. Closing this gap is a separate stage. Until then, a macOS program that
must honour the machine's trust settings sets `SSL_CERT_FILE` to an export it
keeps current. The gap is also in the module's user-guide row.

## Path validation (`nish/crypto/pki`)

**Result.** `pkiVerifyServer` accepts a chain only when a path runs from the
leaf to a root of the store with these properties:

- every signature on it verifies, under an algorithm the module offers;
- every certificate below the root is valid at the instant given;
- every intermediate is a v3 CA that may sign certificates for a server;
- the path keeps every pathLenConstraint and name constraint on it;
- no certificate on it carries a critical extension the parser does not
  know;
- the leaf names the host in its subjectAltName.

Each refusal has a reason code of its own (PKI-14). Each cost an attacker can
raise has a named bound, and passing a bound is a refusal, never a slow
answer (PKI-1). Nothing was found to fix. Open, and counted:

- PKI-17 (Medium): no revocation;
- PKI-18 (Medium): a root's own name constraints are not applied;
- PKI-19 (Low): certificate policies are not processed;
- PKI-20 (Low): Names are compared byte for byte, not folded as RFC 5280
  §7.1 says. This fails closed.

### Threat model

**A network attacker chooses the whole chain.** Anyone on the path to the
server, or the server itself, decides every byte of every certificate that
`chain` holds: how many there are, their order, their names and extensions,
their signatures, and how they point at one another. The attacker does not
hold the private key of any root in the store, nor of any CA that a root
signed for and that has kept its key. The store and the clock are the
caller's, and are trusted. A win is any of these:

- an accepted chain whose leaf the attacker could sign, for a host the
  attacker does not hold, or one that breaks a constraint some CA on the path
  set;
- a panic, a loop, or time or memory out of proportion to the bounds;
- a reason code other than the one that names the defect. This is the
  weakest win, since it misleads an operator but trusts nothing.

The attacker may also be a CA that a root signed for, and may then sign
whatever it likes. Its name constraints, path length and extended key usage
are what limit it, and those are in scope.

### Bounds

Each is an exported constant, so a caller can see the limit it is held to.

| Bound | Value | Refused as |
| --- | --- | --- |
| `PKI_MAX_CHAIN_CERTS`, certificates in `chain` | 128 | `PKI_ERR_CHAIN_TOO_LONG` |
| `PKI_MAX_CHAIN_BYTES`, bytes in `chain` | 1 MiB | `PKI_ERR_CHAIN_TOO_LONG` |
| `PKI_MAX_PATH`, certificates in a path, the leaf and the root counted | 8 | `PKI_ERR_CHAIN_TOO_LONG` |
| `PKI_MAX_NAMES`, dNSName and iPAddress SANs of one certificate | 1024 | `PKI_ERR_BUDGET` |
| `PKI_MAX_SUBTREES`, permitted and excluded subtrees of one certificate | 256 | `PKI_ERR_BUDGET` |
| `PKI_MAX_SIGNATURES`, signatures checked by one call | 64 | `PKI_ERR_BUDGET` |
| `PKI_MAX_NAME_CHECKS`, name-against-subtree comparisons by one call | 250,000 | `PKI_ERR_BUDGET` |
| `PKI_MIN_RSA_BITS`, an RSA key's modulus | 2048 | `PKI_ERR_WEAK_KEY` |

The search is depth first, and every candidate it tries costs a signature,
except one refused by a cheaper check. So `PKI_MAX_SIGNATURES` bounds the work
of the search, however the pool is arranged. A pool of n certificates that
all name one another could otherwise make the search try up to n! orderings.
The size of a name constraint check is the number of names below the issuer
times its subtrees. Without a budget that is up to 1024 × 256 per issuer.
The cost is charged before the check runs, so it can never be exceeded.

### Choices left to the implementer

RFC 5280 leaves these to the implementer, or validators answer them
differently; the x509-limbo suite has cases for several. Each entry is this
module's answer.

- **The leaf may not be a CA.** A leaf with `cA` TRUE is refused as
  `PKI_ERR_NOT_CA`. A CA key serving TLS directly is a misissuance, and
  refusing it costs no correct server anything.
- **`anyExtendedKeyUsage` on an intermediate** stands for serverAuth. On the
  leaf it does not: a leaf needs serverAuth itself, or no EKU at all.
- **An iPAddress subtree of the other family never holds an address.** An
  IPv4 address under IPv6-only permitted subtrees is outside them, and an
  IPv6 subtree never excludes an IPv4 address.
- **The root is a name and a key.** Its validity period, basicConstraints,
  keyUsage, EKU and name constraints are not read. RFC 5280 §6.1.1 makes
  this the default. PKI-18 is the cost of that choice.
- **A pathLenConstraint is read only on a CA.** The parser keeps it whatever
  `cA` says, but `pkiIntermediateCode` reads it only after requiring `cA`
  TRUE, and the leaf's is never read.
- **A known extension is honoured whether it is critical or not.** The
  parser does not keep the flag, so a non-critical nameConstraints or
  basicConstraints binds as a critical one does. That is stricter than
  §4.2, never looser.
- **Every name compares without ASCII case.** That covers the SANs, the host
  and dNSName subtrees. A SAN that is not a valid DNS name, such as one with
  an empty label, a space, a partial wildcard or a label over 63 octets,
  never matches the host.
- **An excluded directoryName refuses the chain**, whatever the subject. A
  byte-exact prefix test could let a second spelling of a Name past it, and
  refusing fails closed (PKI-20).
- **An empty issuer names no root.** A certificate whose issuer is the empty
  Name is never matched against the store, whose roots might have empty
  subjects too.
- **A key the parser cannot name is unsupported.** A P-521 root has key type
  unknown, so a signature under it is `PKI_ERR_UNSUPPORTED_ALGORITHM` and the
  path ends there.
- **The common name is never read.** A host only in the subject's CN is
  refused, as RFC 6125 §6.4.4 allows.

### Method

The module was written from RFC 5280 §4.2 and §6.1 and RFC 6125 §6.4. It was
checked against those sections clause by clause, then by mutation. Each
refusal rule in `pki.ts` was replaced by its accepting form, one at a time.
For each, the test program was rebuilt in the debug profile and run, and the
file was then restored. 61 mutants were run. 56 were killed by a named check
failing, or by a debug-profile panic. The other five are equivalent:

- `cand.version !== 2` (intermediate). Extensions exist only in v3, so a v1
  or v2 certificate already has no basicConstraints and fails `bcPresent`.
- `!cand.bcPresent`. The parser sets `bcCa` only when the extension is
  present, so `!bcCa` refuses everything `!bcPresent` does.
- The host's check against dNSName subtrees in `pkiConstraintsCode`. The leaf
  must hold the host as a SAN, and that SAN is checked against the same
  subtrees, so the host's own check cannot refuse anything new. It is kept
  because it states the rule.
- `pkiValidDns`, on the SAN and on a wildcard's base, in `pkiDnsMatch`. The
  host is validated first, and folding changes only A to Z, so a SAN that
  folds equal to a valid host is itself valid.

Three facts have no test of their own:

- the redundant loop bounds in `pkiIpWithin`, which exist for the
  `performance` gate's range proof;
- the exact boundaries of `PKI_MAX_SIGNATURES` and `PKI_MAX_NAME_CHECKS`.
  Each is tested past its bound, not at it;
- that a self-issued CA's SANs are checked against name constraints. Only
  its directoryName check is skipped.

The fixtures are made by OpenSSL. The commands are in the header of
`tests/link/crypto_pki/fixtures.ts`. The f64 twin
`tests/link/crypto_pki_f64` runs the same suites in the other number mode.

### Findings

Tests are named by their exact check strings: the program's in
`tests/link/crypto_pki/expected.out`, and the harness's in `tests/run.js`.

#### PKI-1: the work of one call is bounded

Every bound in [the table](#bounds) is checked before the work it limits,
and each is tested past the bound. The size bounds are also tested at it.

Tests:

- `PKI_MAX_CHAIN_CERTS certificates`, `one more`, `PKI_MAX_CHAIN_BYTES bytes`
  and `one byte more`
- `a path of PKI_MAX_PATH certificates` and `a path past PKI_MAX_PATH`
- `a leaf of PKI_MAX_NAMES names` and `a leaf of more names`
- `an intermediate of PKI_MAX_SUBTREES subtrees` and
  `an intermediate of more subtrees`
- `more signatures than PKI_MAX_SIGNATURES` and
  `more name comparisons than PKI_MAX_NAME_CHECKS`

#### PKI-2: a chain that does not parse is refused whole

An empty chain, or any certificate that `x509ParseCertificate` refuses, is
`PKI_ERR_MALFORMED`. This holds even when that certificate would not be on
the path.

Tests: `an empty chain`, `a leaf that is no certificate` and
`an intermediate that is no certificate`.

#### PKI-3: the path is built from what was sent, in any order

The pool is searched in the order sent, with extras allowed. A candidate's
subjectKeyIdentifier must equal the child's authorityKeyIdentifier when both
are present. A certificate is never twice in a path, so a cross-signed loop
ends.

Tests:

- `P-256 leaf, P-384 intermediate, P-384 root`,
  `the path is leaf, intermediate, root` and `the path ends at the root`
- `out of order, with extra certificates` and `the extras are not in the path`
- `two intermediates`
- `an intermediate whose key identifier is another's`
- `a cross-signed loop`

#### PKI-4: a path ends only at a root of the store

A root sent in the chain is trusted only because the store holds it. The
store keeps each root once, by its DER.

Tests: `a root not in the store`, `no intermediate`,
`the root sent, the intermediate not`, `an empty issuer names no root` and
`a root given twice is kept once`.

#### PKI-5: every signature on the path is checked

That includes the root's signature over the first certificate below it.

Tests:

- `an intermediate of another key`, `a tampered leaf signature` and
  `a tampered Ed25519 signature`
- `an Ed25519 root signs the leaf`
- `pkiVerifySignature: the root signed the intermediate`,
  `pkiVerifySignature: Ed25519`, `pkiVerifySignature: P-256`,
  `pkiVerifySignature: not the root's signature` and
  `pkiVerifySignature: not a tampered P-256 signature`

#### PKI-6: only the offered algorithms, each under its own key type

ECDSA is accepted with SHA-256 or SHA-384 under P-256 or P-384, and Ed25519
under an Ed25519 key. SHA-1, an unknown algorithm, and an algorithm the
issuer's key cannot make are `PKI_ERR_UNSUPPORTED_ALGORITHM`. RSA is not yet
wired: `pkiRsaCode` answers `PKI_ERR_UNSUPPORTED_ALGORITHM` until
`nish/crypto/rsa` lands, so an RSA path is refused, not accepted.

Tests: `SHA-1`, `pkiVerifySignature: SHA-1 is refused`,
`an Ed25519 signature under a P-256 key` and
`an ECDSA signature under an Ed25519 key`.

#### PKI-7: every certificate below the root is valid now

Tests: `an expired leaf`, `a leaf not yet valid`, `an expired intermediate`
and `an intermediate not yet valid`.

#### PKI-8: an issuer is a v3 CA, and the leaf is not

Tests: `an intermediate with CA:FALSE`,
`an intermediate without basicConstraints` and `a CA as the leaf`.

#### PKI-9: pathLenConstraint counts the CAs below, not self-issued ones

Per §6.1.4 (h) and (l), a self-issued intermediate does not count, and
neither does the leaf.

Tests: `pathLen 0 above the leaf`, `pathLen 0 does not count a self-issued CA`
and `pathLen 0 above another CA`.

#### PKI-10: key usage and extended key usage

An intermediate with keyUsage needs keyCertSign. A leaf with keyUsage needs
digitalSignature. When either carries an EKU, it must allow serverAuth,
with `anyExtendedKeyUsage` accepted on an intermediate only.

Tests:

- `an intermediate without keyCertSign` and `a leaf without digitalSignature`
- `an intermediate for clientAuth only`, `a leaf for clientAuth only` and
  `anyExtendedKeyUsage on an intermediate`

#### PKI-11: an unknown critical extension refuses its certificate

Tests: `an unknown critical extension, intermediate` and
`an unknown critical extension, leaf`.

#### PKI-12: name constraints bind every name below their CA

Every intermediate's constraints are checked against the host and every
certificate below it: each dNSName and iPAddress SAN, and each subject, by
directoryName. The checks are made per issuer, so permitted subtrees narrow
down the path and excluded ones add up. A self-issued certificate's subject
is not checked, except the leaf's, per §6.1.3 (b). Its SANs are. A subtree of
a form the module does not check, such as rfc822Name, URI or otherName, or
one with a minimum or maximum other than the default, refuses the chain.

Tests:

- `name constraints the leaf meets` and `name constraints, by address`
- `a directoryName constraint skips a self-issued CA` and
  `a leaf without a subject, under a directoryName constraint`
- `an excluded dNSName`, `a dNSName not permitted` and
  `a name that only ends in a permitted one`
- `an rfc822Name subtree`
- `an excluded directoryName` and `a subject not permitted`
- `an iPAddress not permitted`, `an excluded iPAddress` and
  `an IPv4 address under IPv6 subtrees`

#### PKI-13: the host is matched as RFC 6125 §6.4 says

DNS names match without case and with one trailing dot. A wildcard is only
the whole leftmost label, stands for exactly one label, and needs at least
two labels after it. Addresses are compared as octets, against iPAddress
SANs only. An IPv4-mapped IPv6 address is not its IPv4 address. Both the
host and the SAN must be valid names: labels of 1 to 63 octets, 253 octets
in all, and letters, digits, hyphens and underscores.

Tests: every check of the `pki hostnames` suite:

- `the name`, `without case`, `with a trailing dot`, `not two trailing dots`,
  `not a name below it` and `not a name above it`
- `a wildcard's one label`, `a wildcard without case`,
  `not a wildcard's two labels` and `not a wildcard's base`
- `not an empty label`, `not an empty host`, `not a space` and
  `not a wildcard host`
- `an IPv4 address`, `not another address`, `not a leading zero`,
  `not three octets` and `not an octet over 255`
- `an IPv6 address`, `in brackets`, `spelt out`, `not another IPv6 address`,
  `not two gaps`, `not nine groups` and `not a group of five digits`
- `an address names no dNSName`, `an IPv4 address in IPv6` and
  `not the IPv4 address it maps`
- `a dNSName in capitals`, `a dNSName with a trailing dot`, `not *.com`,
  `not a partial wildcard`, `not a wildcard inside`,
  `not an invalid dNSName`, `not a dNSName with a space` and `an underscore`
- `not a label of 64`, `a label of 63`, `a name of 253 octets` and
  `not a name of 254 octets`

Tests through `pkiVerifyServer`: `another host`,
`a name only in the common name`, `a wildcard name`, `an IPv4 address` and
`an IPv6 address`.

#### PKI-14: the reason is the nearest attempt's

When no path is accepted, the code returned is that of the attempt that got
nearest a root. An attempt that reached a root beats any that did not. A
longer attempt beats a shorter one, and among attempts of the same length
the first found wins. Every code has a sentence of its own in `pkiReason`.

Tests: `the nearest attempt's reason`, `the first of two as near`,
`the nearer of two`, `a root's reason before a longer path's`,
`every code has a sentence of its own` and `an unknown code has one too`.

#### PKI-15: a wasm32 build compiles

The module reads no file and calls no operating system, so it compiles for
wasm32. A wasm program must bring its own roots, since `pki-roots` is refused
there (PKI-R4).

Test: `crypto_pki: a wasm32 build importing nish/crypto/pki without pki-roots compiles`.

#### PKI-16: the same answers in either number mode

Every length, index and count is `i32`, and every time is `i64`, in both
modes.

Tests: `link/crypto_pki: exits with 0 and stdout matches expected.out` and
`link/crypto_pki_f64: exits with 0 and stdout matches expected.out`.

### Open

#### PKI-17 (Medium): revocation is not checked

The module reads no CRL, no OCSP response, no stapled OCSP and no Signed
Certificate Timestamp. A leaf or intermediate whose key was stolen and
revoked is accepted until it expires. Closing this needs a stapled-OCSP
check from the TLS stage, or a CRL set, such as CRLite, shipped with the
roots. Until then a caller that must honour revocation checks the path it is
given.

#### PKI-18 (Medium): a root's own name constraints are not applied

A root is a name and a key, so name constraints in a root certificate do not
bind the chains under it. Some national and enterprise roots are distributed
with name constraints for exactly this reason. Under this module such a root
may issue for any name. RFC 5914's TrustAnchorInfo constraints, and Apple's
and Mozilla's per-root restrictions (PKI-R7), are not applied either. A
caller trusting such a root keeps it out of a general store.

#### PKI-19 (Low): certificate policies are not processed

§6.1's policy tree, inhibitAnyPolicy, policyConstraints and policyMappings
are not computed, and the extensions are honoured only as far as the parser
refuses an unknown critical one. The web PKI's browsers do not process them
either. This is Low because a policy can only narrow what a path is for,
never widen what the module accepts.

#### PKI-20 (Low): Names are compared byte for byte

The issuer is matched against a subject, and a permitted directoryName
against a subject, by DER, not by RFC 5280 §7.1's folding (crypto-x509.md,
X509-12). Two spellings of one Name, such as PrintableString and UTF8String,
or different case or spacing, do not match. A chain that a folding validator
would build is refused as `PKI_ERR_UNTRUSTED` or
`PKI_ERR_NAME_CONSTRAINTS`, and excluded directoryNames refuse the chain
outright. Every difference fails closed.

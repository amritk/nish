# Security record: PKI trust anchors

The record of `nish/crypto/pki-roots` (#987, toward #480): where a program's
root certificates come from, what the loader does with a file it cannot use,
and what it bounds. It is written with the code rather than after an audit,
so that the audit starts from evidence. Chain building and path validation
are not here; they are later stages of #987.

Anchors are function names in `std/crypto/pki-roots.ts` on the head that
merges this record, whose base is `2cdef4fa`.

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
| `std/crypto/pki-roots.ts` | `pkiLoadSystemRoots`, `pkiLoadRootsFor`, `pkiLoadRoots`, `pkiSystemBundles`, `pkiRootsDirEntry`, `PkiRoots`; `PkiRootsLoad`, `pkiRootsKeep`, `pkiRootsBlock`, `pkiRootsSplit`, `pkiRootsRegular`, `pkiRootsFile`, `pkiRootsDir`, `pkiRootsSplitDirs`, `pkiRootsIsDigit`, `pkiRootsIsHex` |

Out of scope:

- The DER, PEM and certificate parsers it calls, `pemToDer` and
  `x509ParseCertificate`. They are in [crypto-x509.md](crypto-x509.md).
- Whether a root is fit to anchor a chain: its validity period, its
  constraints, and whether it is a CA at all. That is the path validator's
  question, in a later stage.
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

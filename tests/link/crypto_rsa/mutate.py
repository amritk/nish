#!/usr/bin/env python3
"""Remove each refusal rule of std/crypto/rsa.ts, one at a time, and run the RSA tests:

    python3 tests/link/crypto_rsa/mutate.py [name ...]

Each mutation replaces one rule's text, which must occur exactly once, by a
form that no longer refuses; builds tests/link/crypto_rsa and
tests/link/crypto_rsa_der_refusals with build/nish in the debug profile
with --allow-panics, as tests/run.js builds a case; and
runs both. A mutation is caught when either run exits nonzero: a failing
check, or a debug-profile panic. The file is restored in a `finally`, so
`git diff std/crypto/rsa.ts` is empty afterwards. The rules in UNCAUGHT are
ones no test can catch alone, each with the rule or caller that answers for
it, which the run prints; every other rule must be caught, and each of those
must be missed. Exits 1 when one is not, or when a pattern no longer matches.
"""
import os, subprocess, sys

P = "std/crypto/rsa.ts"
PROGRAMS = ["crypto_rsa", "crypto_rsa_der_refusals"]
ELEMENT = "if (end < 2 || end > total || at < 0 || at > end - 2 || at > total - 2 || toI32(der[at]) !== tag) {"
UNSIGNED = "if (start < 0 || start >= end || start >= total || end > total || toI32(der[start]) >= 0x80) {"
MINIMAL = "if (from >= end || from >= total || toI32(der[from]) < 0x80) {"
KEY = "if (bits < RSA_MIN_BITS || bits > RSA_MAX_BITS || (nLast & 1) === 0 || eLength > 4) {"
POW = "if (nLength < 1 || nLength > 1024 || toI32(s.length) > nLength || rsaBitLength(e) < 1) {"
OPEN = "if (k !== toI32(key.n.length) || size < 0 || size > k) {"
PKCS = "if (hashSize < 1 || hashSize > 64 || k > 1024) {"
PSS_A = "if (hashSize < 1 || hashSize > 64 || saltLen < 0 || bits < 2 || bits > 8192) {"
PSS_B = "if (emLen < 1 || emLen > 1024 || saltLen > emLen || emLen < hashSize + saltLen + 2) {"


def drop(rule, part):
    """`rule` with `part` taken out of its condition."""
    return (rule, rule.replace(part, "", 1))


MUTATIONS = [
    # rsaDerElement
    ("tag", *drop(ELEMENT, " || toI32(der[at]) !== tag")),
    ("element end", *drop(ELEMENT, "end < 2 || end > total || ")),
    ("element at", *drop(ELEMENT, "at < 0 || at > end - 2 || at > total - 2 || ")),
    ("81 room", "if (at > end - 3 || at > total - 3) {", "if (false) {"),
    ("81 min", "if (length < 0x80) {", "if (false) {"),
    ("82 room", "if (at > end - 4 || at > total - 4) {", "if (false) {"),
    ("82 min", "if (length < 0x100) {", "if (false) {"),
    ("long form", "} else if (first >= 0x80) {\n    return null", "} else if (false) {\n    return null"),
    ("fits", "if (length > end - start) {", "if (false) {"),
    # rsaDerUnsigned
    ("int range", *drop(UNSIGNED, "start < 0 || ")),
    ("empty int", *drop(UNSIGNED, "start >= end || ")),
    ("int in der", *drop(UNSIGNED, "start >= total || end > total || ")),
    ("negative", *drop(UNSIGNED, " || toI32(der[start]) >= 0x80")),
    ("lone zero", *drop(MINIMAL, "from >= end || from >= total || ")),
    ("minimal int", *drop(MINIMAL, " || toI32(der[from]) < 0x80")),
    # rsaBitLength
    ("bit length cap", "if (length > 0x0fffffff) {", "if (false) {"),
    # rsaParsePublicKey
    ("seq end", "if (body === null || body.end !== total) {", "if (body === null) {"),
    ("e end", "if (eSpan === null || eSpan.end !== total) {", "if (eSpan === null) {"),
    ("empty n or e", "if (nLength === 0 || eLength === 0) {", "if (false) {"),
    ("min bits", *drop(KEY, "bits < RSA_MIN_BITS || ")),
    ("max bits", *drop(KEY, "bits > RSA_MAX_BITS || ")),
    ("odd n", KEY, KEY.replace("(nLast & 1) === 0", "nLast < 0")),
    ("e len", *drop(KEY, " || eLength > 4")),
    ("odd e", "if ((eLast & 1) === 0 || (eLength === 1 && eLast < 3)) {", "if (eLength === 1 && eLast < 3) {"),
    ("e min", "if ((eLast & 1) === 0 || (eLength === 1 && eLast < 3)) {", "if ((eLast & 1) === 0) {"),
    # rsaModPow
    ("pow n size", *drop(POW, "nLength < 1 || nLength > 1024 || ")),
    ("pow s len", *drop(POW, "toI32(s.length) > nLength || ")),
    ("pow e bits", *drop(POW, " || rsaBitLength(e) < 1")),
    ("below n", "if (below !== 1) {", "if (false) {"),
    # rsaOpen
    ("sig len", *drop(OPEN, "k !== toI32(key.n.length) || ")),
    ("open size", *drop(OPEN, " || size < 0 || size > k")),
    ("open short", "if (mLength < size) {", "if (false) {"),
    ("top zeros", "if (toI32(m[i]) !== 0) {\n        return null", "if (false) {\n        return null"),
    # rsaVerifyPkcs1v15
    ("pkcs hash0", *drop(PKCS, "hashSize < 1 || ")),
    ("pkcs hash max", *drop(PKCS, "hashSize > 64 || ")),
    ("pkcs k max", *drop(PKCS, " || k > 1024")),
    ("pkcs room", "if (k < tLength + 11) {", "if (false) {"),
    ("pkcs compare", "return timingSafeEqual(em, expected)", "return true"),
    # rsaVerifyPss
    ("pss hash0", *drop(PSS_A, "hashSize < 1 || ")),
    ("pss hash max", *drop(PSS_A, "hashSize > 64 || ")),
    ("pss salt neg", *drop(PSS_A, "saltLen < 0 || ")),
    ("pss bits", *drop(PSS_A, " || bits < 2 || bits > 8192")),
    ("pss em size", *drop(PSS_B, "emLen < 1 || emLen > 1024 || ")),
    ("pss salt huge", *drop(PSS_B, "saltLen > emLen || ")),
    ("pss room", *drop(PSS_B, " || emLen < hashSize + saltLen + 2")),
    ("pss em len", "if (emLength !== emLen) {", "if (false) {"),
    ("pss top", "if (i === 0 && (toI32(em[i]) & ~topMask) !== 0) {", "if (false) {"),
    ("pss bc", "if (trailer !== 0xbc) {", "if (trailer < 0) {"),
    ("pss zeros", "if (v !== 0) {", "if (false) {"),
    ("pss sep", "if (v !== 0x01) {", "if (false) {"),
    ("pss separated", "if (!separated) {", "if (!separated && saltLen < 0) {"),
    ("pss hash", "return timingSafeEqual(rsaDigest(hash, prime), h)", "return true"),
]
# Each rule no test catches, and the rule that answers for it.
UNCAUGHT = {
    "element end": "every caller passes end = der.length, and an end below 2 leaves at > end - 2 true for every at >= 0",
    "int range": "start is a span's start, at least at + 2 >= 2",
    "empty int": "an empty modulus reads e's tag 0x02 as its contents' first byte and comes back empty, refused by `empty n or e`; an empty exponent ends the buffer, so start >= total refuses it",
    "int in der": "a span ends at most at end = der.length (`fits`), and a start at der.length is a start at end",
    "fits": "a span past der.length is refused after it returns: the SEQUENCE's by `seq end`, the modulus's by the exponent's `element at`, the exponent's by `e end`",
    "bit length cap": "every array it is given is a DER INTEGER's contents, at most 65535 bytes under a two-octet length",
    "empty n or e": "`empty int` refuses an INTEGER with no contents and `lone zero` one of a zero byte alone, so a read INTEGER has a byte",
    "pow n size": "a parsed modulus is 1024 to 8192 bits, 128 to 1024 bytes (`min bits`, `max bits`)",
    "pow s len": "rsaOpen passes only a signature exactly as long as n (`sig len`)",
    "pow e bits": "a parsed exponent is odd and at least 3 (`odd e`, `e min`)",
    "open size": "PKCS#1 v1.5 passes k, the modulus's length, and PSS emLen = (bits + 6) >> 3, which is 128 to k (`pss em size`)",
    "open short": "rsaModPow answers exactly n.length bytes, and size is at most n.length",
    "pkcs hash0": "an unknown id has hashSize 0 but rsaDigest still answers a 32-byte SHA-256 digest, so `expected` is k + 32 bytes and `pkcs compare` refuses it (the hash id 0 and 4 tests)",
    "pkcs hash max": "rsaHashSize answers at most 64",
    "pkcs k max": "a parsed modulus is at most 1024 bytes (`max bits`)",
    "pss hash0": "an unknown id has hashSize 0, so h is empty, and the 32-byte SHA-256 digest rsaDigest answers never equals it (`pss hash`; the PSS hash id 0 test)",
    "pss hash max": "rsaHashSize answers at most 64",
    "pss salt neg": "a negative salt puts the zeros through the whole data block, so no 0x01 is read and `!separated` refuses it",
    "pss bits": "a parsed modulus is 1024 to 8192 bits (`min bits`, `max bits`)",
    "pss em size": "emLen is (bits + 6) / 8 for 1024 to 8192 bits",
    "pss room": "a salt too long for the block makes the zeros' count negative, so no 0x01 is read and `!separated` refuses it",
    "pss em len": "rsaOpen answers exactly emLen bytes (`open short`, `top zeros`)",
    "pss separated": "with a salt of 0 or more and room for it, the 0x01's index is inside the data block, so the loop always reaches it",
}

only = sys.argv[1:]
orig = open(P).read()
bad = []
caught_count = 0
ran = 0
os.makedirs("build/mut", exist_ok=True)
try:
    for name, rule, without in MUTATIONS:
        if only and name not in only:
            continue
        if orig.count(rule) != 1 or rule == without:
            print(f"{name}: the rule occurs {orig.count(rule)} times", flush=True)
            bad.append(name)
            continue
        open(P, "w").write(orig.replace(rule, without))
        caught = False
        failed_build = False
        notes = []
        for program in PROGRAMS:
            app = f"build/mut/{program}"
            build = ["build/nish", f"tests/link/{program}/main.ts", "-o", "build/mut/", "--link", app, "--profile", "debug", "--allow-panics"]
            r = subprocess.run(build, capture_output=True, text=True, timeout=600)
            if r.returncode:
                print(f"{name}: {program} does not compile: {r.stderr[:200]}", flush=True)
                failed_build = True
                break
            r = subprocess.run([app], capture_output=True, text=True, timeout=120)
            if r.returncode != 0:
                caught = True
                fails = [l.strip() for l in r.stdout.splitlines() if l.startswith("FAIL")]
                notes.append(f"{program} {fails[:2]} {r.stderr.strip()[:120]}")
        if failed_build:
            bad.append(name)
            continue
        caught_count += caught
        ran += 1
        print(f"{name}: {'caught' if caught else 'missed'} {' '.join(notes)}", flush=True)
        if caught == (name in UNCAUGHT):
            bad.append(name)
finally:
    open(P, "w").write(orig)
print(f"{caught_count} of {ran} rules caught")
for name, _, _ in MUTATIONS:
    if name in UNCAUGHT and (not only or name in only):
        print(f"  uncaught {name}: {UNCAUGHT[name]}")
print(f"{len(bad)} unexpected: {', '.join(bad)}" if bad else "every rule caught except those listed, each missed")
sys.exit(1 if bad else 0)

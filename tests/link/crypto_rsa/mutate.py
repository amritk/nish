#!/usr/bin/env python3
"""Remove each refusal rule of std/crypto/rsa.ts, one at a time, and run the RSA tests:

    python3 tests/link/crypto_rsa/mutate.py [name ...]

Each mutation replaces one rule's text, which must occur exactly once, by a
form that no longer refuses; builds tests/link/crypto_rsa and
tests/link/crypto_rsa_der_refusals with build/nish in the debug profile; and
runs both. A mutation is caught when either run exits nonzero: a failing
check, or a debug-profile panic. The file is restored in a `finally`, so
`git diff std/crypto/rsa.ts` is empty afterwards. The rules in UNREACHABLE are
defences another rule makes unreachable (the record,
docs/security/crypto-rsa.md, says which rule for each); every other rule must
be caught. Exits 1 when one is not, or when a pattern no longer matches.
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
    ("odd n", *drop(KEY, " || (nLast & 1) === 0")),
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
    ("pss bc", "if (trailer !== 0xbc) {", "if (false) {"),
    ("pss zeros", "if (v !== 0) {", "if (false) {"),
    ("pss sep", "if (v !== 0x01) {", "if (false) {"),
    ("pss separated", "if (!separated) {", "if (false) {"),
    ("pss hash", "return timingSafeEqual(rsaDigest(hash, prime), h)", "return true"),
]
UNREACHABLE = {
    "fits",
    "bit length cap",
    "empty n or e",
    "pow n size",
    "pow s len",
    "pow e bits",
    "open size",
    "open short",
    "pkcs hash0",
    "pkcs hash max",
    "pkcs k max",
    "pss hash0",
    "pss hash max",
    "pss bits",
    "pss em size",
    "pss em len",
    "pss separated",
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
            build = ["build/nish", f"tests/link/{program}/main.ts", "-o", "build/mut/", "--link", app, "--profile", "debug"]
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
        if caught == (name in UNREACHABLE):
            bad.append(name)
finally:
    open(P, "w").write(orig)
print(f"{caught_count} of {ran} rules caught")
print(f"{len(bad)} unexpected: {', '.join(bad)}" if bad else "every reachable rule caught, every unreachable one missed")
sys.exit(1 if bad else 0)

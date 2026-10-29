#!/usr/bin/env python3
"""Remove each refusal rule of std/crypto/rsa.ts, one at a time, and run crypto_rsa:

    python3 tests/link/crypto_rsa/mutate.py [name ...]

Each mutation replaces one rule's text, which must occur exactly once, by a
form that no longer refuses; builds tests/link/crypto_rsa with build/nish in
the debug profile; and runs it. A mutation is caught when the run exits
nonzero: a failing check, or a debug-profile panic. The file is restored in a
`finally`, so `git diff std/crypto/rsa.ts` is empty afterwards. The four rules
in UNREACHABLE are defences another rule makes unreachable (the record,
docs/security/crypto-rsa.md, says which rule for each); every other rule must
be caught. Exits 1 when one is not, or when a pattern no longer matches.
"""
import os, subprocess, sys

P = "std/crypto/rsa.ts"
MUTATIONS = [
    ("tag", "toI32(der[at]) !== tag", "false"),
    ("81 min", "if (length < 0x80) {", "if (false) {"),
    ("82 min", "if (length < 0x100) {", "if (false) {"),
    ("long form", "} else if (first >= 0x80) {\n    return -1", "} else if (false) {\n    return -1"),
    ("fits", "if (length > end - start) {", "if (false) {"),
    ("seq end", "body + rsaDerLength(der, 0) !== total", "false"),
    ("e end", "if (eStart + eLength !== total) {", "if (false) {"),
    ("empty int", "length < 1 ||", ""),
    ("negative", "|| toI32(der[start]) >= 0x80) {", ") {"),
    ("minimal int", "if (length === 1 || toI32(der[start + 1]) < 0x80) {", "if (length === 1) {"),
    ("min bits", "bits < RSA_MIN_BITS ||", ""),
    ("max bits", "bits > RSA_MAX_BITS ||", ""),
    ("odd n", "|| (toI32(n[toI32(n.length) - 1]) & 1) === 0) {", ") {"),
    ("e len", "toI32(e.length) > 4 ||", ""),
    ("odd e", "(eLast & 1) === 0 ||", ""),
    ("e min", " || (toI32(e.length) === 1 && eLast < 3)) {", ") {"),
    ("sig len", "k !== toI32(key.n.length) ||", ""),
    ("below n", "if (!rsaBytesBelow(trimmed, key.n)) {", "if (false) {"),
    ("top zeros", "if (toI32(m[i]) !== 0) {\n      return null", "if (false) {\n      return null"),
    ("pkcs room", "|| k < tLength + 11) {", ") {"),
    ("pkcs compare", "return rsaSameBytes(em, expected)", "return true"),
    ("pss salt neg", "if (hashSize === 0 || saltLen < 0) {", "if (hashSize === 0) {"),
    ("pss salt huge", "saltLen > emLen ||", ""),
    ("pss room", "|| emLen < hashSize + saltLen + 2) {", ") {"),
    ("pss bc", "|| toI32(em[emLen - 1]) !== 0xbc) {", ") {"),
    ("pss top", "if ((toI32(em[0]) & ~topMask) !== 0) {", "if (false) {"),
    ("pss zeros", "if (toI32(db[i]) !== 0) {\n      return false", "if (false) {\n      return false"),
    ("pss sep", "if (toI32(db[zeros]) !== 0x01) {", "if (false) {"),
    ("pss hash", "return rsaSameBytes(rsaDigest(hash, prime), h)", "return true"),
    ("pkcs hash0", "if (hashSize === 0 || k < tLength + 11) {", "if (k < tLength + 11) {"),
    ("pss hash0", "if (hashSize === 0 || saltLen < 0) {", "if (saltLen < 0) {"),
    ("open size", "|| size < 0 || size > k) {", ") {"),
]
UNREACHABLE = {"fits", "pkcs hash0", "pss hash0", "open size"}

only = sys.argv[1:]
orig = open(P).read()
bad = []
os.makedirs("build/mut", exist_ok=True)
try:
    for name, rule, without in MUTATIONS:
        if only and name not in only:
            continue
        if orig.count(rule) != 1:
            print(f"{name}: the rule occurs {orig.count(rule)} times", flush=True)
            bad.append(name)
            continue
        open(P, "w").write(orig.replace(rule, without))
        build = ["build/nish", "tests/link/crypto_rsa/main.ts", "-o", "build/mut/", "--link", "build/mut/app", "--profile", "debug"]
        r = subprocess.run(build, capture_output=True, text=True)
        if r.returncode:
            print(f"{name}: does not compile: {r.stderr[:200]}", flush=True)
            bad.append(name)
            continue
        r = subprocess.run(["build/mut/app"], capture_output=True, text=True)
        fails = [l.strip() for l in r.stdout.splitlines() if l.startswith("FAIL")]
        caught = r.returncode != 0
        print(f"{name}: {'caught' if caught else 'missed'} {fails[:2]} {r.stderr.strip()[:120]}", flush=True)
        if caught == (name in UNREACHABLE):
            bad.append(name)
finally:
    open(P, "w").write(orig)
print(f"{len(bad)} unexpected: {', '.join(bad)}" if bad else "every reachable rule caught, every unreachable one missed")
sys.exit(1 if bad else 0)

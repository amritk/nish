#!/usr/bin/env python3
"""Write vectors.ts, the keys and signatures tests/link/crypto_rsa checks:

    python3 tests/link/crypto_rsa/generate.py

Everything comes from one fixed seed, so a run writes the same file byte for
byte: the primes are drawn from Python's `random.Random(20261029)` and tested
with Miller-Rabin, each key's private exponent signs its own signatures, and
each broken signature is the real encoding with one rule changed and then
signed, so only that rule fails. Python's arbitrary-precision integers do the
arithmetic. `random.Random`'s sequence for a given seed has stayed the same
across Python 3 releases so far, but Python does not promise that it always will.
"""
import hashlib, os, random
R = random.Random(20261029)
def is_prime(n):
    if n < 2: return False
    for p in [2,3,5,7,11,13,17,19,23,29,31,37]:
        if n % p == 0: return n == p
    d, s = n-1, 0
    while d % 2 == 0: d//=2; s+=1
    for _ in range(40):
        a = R.randrange(2, n-1); x = pow(a,d,n)
        if x in (1,n-1): continue
        for _ in range(s-1):
            x = x*x % n
            if x == n-1: break
        else: return False
    return True
def prime(bits, e):
    while True:
        p = R.getrandbits(bits) | (3 << (bits-2)) | 1
        if is_prime(p) and (p-1) % e != 0: return p
def key(bits, e, top=None):
    while True:
        p = prime(bits - bits//2, e); q = prime(bits//2, e)
        n = p*q
        if n.bit_length() != bits: continue
        if top and (n >> (bits-8)) < top: continue
        d = pow(e, -1, (p-1)*(q-1))
        return n, e, d
def i2b(x, k): return x.to_bytes(k, 'big')
def blen(n): return (n.bit_length()+7)//8
def der_len(l):
    if l < 0x80: return bytes([l])
    if l < 0x100: return bytes([0x81, l])
    return bytes([0x82, l >> 8, l & 0xff])
def der_int(x):
    b = x.to_bytes(max(1,(x.bit_length()+8)//8), 'big')
    return b'\x02' + der_len(len(b)) + b
def der_seq(body): return b'\x30' + der_len(len(body)) + body
def der_key(n, e): return der_seq(der_int(n) + der_int(e))
H = {'256': hashlib.sha256, '384': hashlib.sha384, '512': hashlib.sha512}
OID = {'256': 1, '384': 2, '512': 3}
def digest_info(h, dig, null=True, oid=None):
    alg = bytes([0x06,0x09,0x60,0x86,0x48,0x01,0x65,0x03,0x04,0x02, oid or OID[h]]) + (b'\x05\x00' if null else b'')
    alg = b'\x30' + bytes([len(alg)]) + alg
    t = alg + b'\x04' + bytes([len(dig)]) + dig
    return b'\x30' + bytes([len(t)]) + t
def pkcs_em(k, h, msg, bt=1, fill=0xff, null=True, oid=None, extra=b''):
    t = digest_info(h, H[h](msg).digest(), null, oid) + extra
    return bytes([0, bt]) + bytes([fill]) * (k - len(t) - 3) + b'\x00' + t
def mgf1(h, seed, l):
    out = b''; c = 0
    while len(out) < l:
        out += H[h](seed + c.to_bytes(4,'big')).digest(); c += 1
    return out[:l]
def pss_em(n, h, msg, slen, salt=None, trailer=0xbc, sep=0x01, padbyte=None, topbit=False):
    embits = n.bit_length() - 1; emlen = (embits + 7)//8
    hl = H[h]().digest_size
    salt = salt if salt is not None else bytes(R.getrandbits(8) for _ in range(slen))
    mh = H[h](msg).digest()
    hh = H[h](b'\0'*8 + mh + salt).digest()
    db = bytearray(b'\0' * (emlen - slen - hl - 2) + bytes([sep]) + salt)
    if padbyte is not None: db[padbyte] = 0x01
    mask = mgf1(h, hh, len(db))
    m = bytearray(a ^ b for a, b in zip(db, mask))
    m[0] &= 0xff >> (8*emlen - embits)
    if topbit: m[0] |= 0x80 >> (8*emlen - embits - 1) if 8*emlen - embits > 0 else 0x80
    return bytes(m) + hh + bytes([trailer])
def sign(n, d, em):
    x = int.from_bytes(em, 'big'); assert x < n
    return i2b(pow(x, d, n), blen(n))
out = []
def c(name, b, why): out.append(f"/** {why} */\nexport const {name}: string = \"{b.hex()}\";\n")
MSG = b"nish/crypto/rsa"
# Key A: 2048 bits, top byte at least 0xf0, so a block with its top bit set stays below n.
nA, eA, dA = key(2048, 65537, top=0xf0)
kA = blen(nA)
c("KEY_A", der_key(nA, eA), "Key A: a 2048-bit modulus with e = 65537.")
c("MSG", MSG, "The message every signature here signs.")
for h in ['256','384','512']:
    c(f"A_PKCS_SHA{h}", sign(nA, dA, pkcs_em(kA, h, MSG)), f"PKCS#1 v1.5 under key A with SHA-{h}.")
# A shorter signature: the first message whose signature has a zero top byte.
i = 0
while True:
    m = MSG + str(i).encode(); s = sign(nA, dA, pkcs_em(kA, '256', m))
    if s[0] == 0: break
    i += 1
c("A_SHORT_MSG", m, "A message whose SHA-256 PKCS#1 v1.5 signature under key A starts with a zero byte.")
c("A_SHORT_SIG", s, "That signature.")
sA = int.from_bytes(sign(nA, dA, pkcs_em(kA, '256', MSG)), 'big')
assert sA + nA < 1 << (8*kA)
c("A_PKCS_PLUS_N", i2b(sA + nA, kA), "A_PKCS_SHA256 + n, still k bytes long.")
c("A_PKCS_FE", sign(nA, dA, pkcs_em(kA, '256', MSG)[:5] + b'\xfe' + pkcs_em(kA, '256', MSG)[6:]), "An FF of the padding changed to FE.")
c("A_PKCS_BT2", sign(nA, dA, pkcs_em(kA, '256', MSG, bt=2)), "Block type 02 instead of 01.")
c("A_PKCS_NO_NULL", sign(nA, dA, pkcs_em(kA, '256', MSG, null=False)), "A DigestInfo without the NULL parameters.")
c("A_PKCS_WRONG_OID", sign(nA, dA, pkcs_em(kA, '256', MSG, oid=2)), "The id-sha384 OID over a SHA-256 digest.")
c("A_PKCS_GARBAGE", sign(nA, dA, pkcs_em(kA, '256', MSG, extra=b'\x00' * 8)), "Eight bytes after the digest, with eight fewer FFs.")
for h, sl in [('256', 32), ('256', 0), ('384', 48), ('512', 64)]:
    c(f"A_PSS_SHA{h}_SALT{sl}", sign(nA, dA, pss_em(nA, h, MSG, sl)), f"PSS under key A with SHA-{h} and a {sl}-byte salt.")
c("A_PSS_BB", sign(nA, dA, pss_em(nA, '256', MSG, 32, trailer=0xbb)), "PSS, SHA-256, salt 32, with 0xbb as its last byte.")
while True:
    em = pss_em(nA, '256', MSG, 32, topbit=True)
    if int.from_bytes(em, 'big') < nA: break
c("A_PSS_TOP", sign(nA, dA, em), "PSS, SHA-256, salt 32, with the masked block's top bit set.")
c("A_PSS_PAD", sign(nA, dA, pss_em(nA, '256', MSG, 32, padbyte=1)), "PSS, SHA-256, salt 32, with a padding byte of 01.")
c("A_PSS_SEP", sign(nA, dA, pss_em(nA, '256', MSG, 32, sep=0x02)), "PSS, SHA-256, salt 32, with 02 before the salt.")
# An unmasked data block of zeros alone, behind an arbitrary hash and 0xbc.
hz = bytes(range(32)); emlz = kA - 32 - 1
mz = bytearray(mgf1('256', hz, emlz)); mz[0] &= 0x7f
c("A_PSS_ZERO_DB", sign(nA, dA, bytes(mz) + hz + b'\xbc'), "PSS, SHA-256, whose data block unmasks to zeros alone: no 01, no salt.")
# Key B: 2049 bits, so the encoded message is one byte shorter than the modulus.
nB, eB, dB = key(2049, 65537)
kB = blen(nB)
c("KEY_B", der_key(nB, eB), "Key B: a 2049-bit modulus, whose PSS block is a byte shorter than it.")
c("B_PSS", sign(nB, dB, pss_em(nB, '256', MSG, 32)), "PSS under key B, SHA-256, salt 32.")
while True:
    em = pss_em(nB, '256', MSG, 32)
    x = (1 << 2048) + int.from_bytes(em, 'big')
    if x < nB: break
c("B_PSS_HIGH", i2b(pow(x, dB, nB), kB), "A key B signature that opens to 2^2048 plus a valid PSS block.")
c("B_PKCS", sign(nB, dB, pkcs_em(kB, '256', MSG)), "PKCS#1 v1.5 under key B with SHA-256.")
# Key C: a four-byte exponent.
nC, eC, dC = key(2048, 4294967291)
c("KEY_C", der_key(nC, eC), "Key C: a 2048-bit modulus with e = 2^32 - 5.")
c("C_PKCS", sign(nC, dC, pkcs_em(blen(nC), '256', MSG)), "PKCS#1 v1.5 under key C with SHA-256.")
# Key D: 61 bytes, too short for PKCS#1 v1.5's eight FFs with SHA-256.
nD, eD, dD = key(488, 65537)
assert blen(nD) == 61
c("D_N", i2b(nD, 61), "Key D's modulus: 488 bits, so SHA-256's DigestInfo leaves room for seven FFs.")
c("D_PKCS", sign(nD, dD, pkcs_em(61, '256', MSG)), "A signature under key D of 00 01, seven FFs, 00 and the DigestInfo.")
# Key E: exactly 1024 bits.
nE, eE, dE = key(1024, 65537)
c("KEY_E", der_key(nE, eE), "Key E: exactly 1024 bits.")
c("E_PSS_SHA512", sign(nE, dE, pss_em(nE, '512', MSG, 0)), "PSS under key E, SHA-512, no salt.")
# Parse inputs.
iA = der_int(nA)
c("N_A_INT", iA, "Key A's modulus as a DER INTEGER, to build broken keys around.")
odd = lambda bits: R.getrandbits(bits) | (1 << (bits - 1)) | 1
c("KEY_1023", der_key(odd(1023), 65537), "An odd 1023-bit modulus.")
c("KEY_8193", der_key(odd(8193), 65537), "An odd 8193-bit modulus.")
c("KEY_8192", der_key(odd(8192), 65537), "An odd 8192-bit modulus.")
c("KEY_EVEN_N", der_key(nA - 1, 65537), "Key A's modulus minus one: even.")
c("KEY_E_EVEN", der_key(nA, 65536), "e = 65536.")
c("KEY_E_ONE", der_key(nA, 1), "e = 1.")
c("KEY_E_THREE", der_key(nA, 3), "e = 3.")
c("KEY_E_BIG", der_key(nA, (1 << 32) + 1), "e = 2^32 + 1, five bytes.")
c("KEY_E_MAX", der_key(nA, (1 << 32) - 1), "e = 2^32 - 1, the largest allowed.")
HEAD = (
    "// Generated keys and signatures for suite.ts: deterministic, from a fixed\n"
    "// seed, made for these tests and signed with their own private keys.\n"
    "// Generated by generate.py beside this file: do not edit; run it again.\n\n"
)
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "vectors.ts"), "w") as f:
    f.write(HEAD + "\n".join(out))

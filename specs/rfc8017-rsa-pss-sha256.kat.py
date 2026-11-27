"""RSASSA-PSS-SIGN with SHA-256 and MGF1-SHA-256 (RFC 8017 Sections 8.1.1,
9.1.1, B.2.1 and 5.2.1), written for the known answers of
specs/rfc8017-rsa-pss-sha256.md and independent of nish/crypto/rsa-sign.

Usage: python3 -I rfc8017-rsa-pss-sha256.kat.py KEY MSG SALT
       python3 -I rfc8017-rsa-pss-sha256.kat.py --raw KEY M

KEY is n || d || e as hex, each k octets, the layout rsaParsePrivateKey
returns; MSG, SALT and M are hex (an empty argument is the empty string).
The first form prints the RSASSA-PSS signature, k octets, as lowercase hex,
or null on the encoding error of Section 9.1.1 step 3. The second, --raw,
prints RSASP1 of M (Section 5.2.1), k octets, or null when M is not k
octets or its integer is not below n. Standard library only.
"""

import hashlib
import sys

H_LEN = 32


def sha256(data: bytes) -> bytes:
    return hashlib.sha256(data).digest()


def mgf1(seed: bytes, mask_len: int) -> bytes:
    """MGF1 with SHA-256, Section B.2.1."""
    t = b""
    counter = 0
    while len(t) < mask_len:
        t += sha256(seed + counter.to_bytes(4, "big"))
        counter += 1
    return t[:mask_len]


def emsa_pss_encode(m: bytes, em_bits: int, salt: bytes) -> bytes:
    """EMSA-PSS-ENCODE, Section 9.1.1, with the salt given."""
    em_len = (em_bits + 7) // 8
    m_hash = sha256(m)
    if em_len < H_LEN + len(salt) + 2:
        raise ValueError("encoding error")
    h = sha256(b"\x00" * 8 + m_hash + salt)
    ps = b"\x00" * (em_len - len(salt) - H_LEN - 2)
    db = ps + b"\x01" + salt
    db_mask = mgf1(h, em_len - H_LEN - 1)
    masked_db = bytearray(a ^ b for a, b in zip(db, db_mask))
    masked_db[0] &= 0xFF >> (8 * em_len - em_bits)
    return bytes(masked_db) + h + b"\xbc"


def split_key(key: bytes) -> tuple[int, int, int]:
    """The octet length k of n, and n and d, from n || d || e."""
    if len(key) % 3 != 0:
        raise ValueError("KEY is not three k-octet fields")
    k = len(key) // 3
    return k, int.from_bytes(key[:k], "big"), int.from_bytes(key[k : 2 * k], "big")


def rsasp1(key: bytes, m: bytes) -> bytes | None:
    """RSASP1, Section 5.2.1, in the first form (n, d); None when m is out
    of range, as an integer or as k octets."""
    k, n, d = split_key(key)
    if len(m) != k:
        return None
    r = int.from_bytes(m, "big")
    if r >= n:
        return None
    return pow(r, d, n).to_bytes(k, "big")


def sign(key: bytes, m: bytes, salt: bytes) -> bytes | None:
    """RSASSA-PSS-SIGN, Section 8.1.1, with RSASP1 of Section 5.2.1; None on
    the encoding error."""
    k, n, _ = split_key(key)
    try:
        em = emsa_pss_encode(m, n.bit_length() - 1, salt)
    except ValueError:
        return None
    s = rsasp1(key, em.rjust(k, b"\x00"))
    if s is None:
        raise ValueError("EM is not below n")
    return s


def main() -> None:
    args = sys.argv[1:]
    if len(args) == 3 and args[0] == "--raw":
        out = rsasp1(bytes.fromhex(args[1]), bytes.fromhex(args[2]))
    elif len(args) == 3:
        key, msg, salt = (bytes.fromhex(a) for a in args)
        out = sign(key, msg, salt)
    else:
        sys.exit("usage: rfc8017-rsa-pss-sha256.kat.py [--raw] KEY MSG SALT | KEY M")
    print("null" if out is None else out.hex())


main()

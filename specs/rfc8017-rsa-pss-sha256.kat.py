"""RSASSA-PSS-SIGN with SHA-256 and MGF1-SHA-256 (RFC 8017 Sections 8.1.1,
9.1.1, B.2.1 and 5.2.1), written for the known answers of
specs/rfc8017-rsa-pss-sha256.md and independent of nish/crypto/rsa-sign.

Usage: python3 -I rfc8017-rsa-pss-sha256.kat.py KEY MSG SALT

KEY is n || d || e as hex, each k octets, the layout rsaParsePrivateKey
returns; MSG and SALT are hex (an empty argument is the empty string).
Prints the signature, k octets, as lowercase hex. Standard library only.
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


def sign(key: bytes, m: bytes, salt: bytes) -> bytes:
    """RSASSA-PSS-SIGN, Section 8.1.1, with RSASP1 of Section 5.2.1."""
    if len(key) % 3 != 0:
        raise ValueError("KEY is not three k-octet fields")
    k = len(key) // 3
    n = int.from_bytes(key[:k], "big")
    d = int.from_bytes(key[k : 2 * k], "big")
    mod_bits = n.bit_length()
    em = emsa_pss_encode(m, mod_bits - 1, salt)
    s = pow(int.from_bytes(em, "big"), d, n)
    return s.to_bytes(k, "big")


def main() -> None:
    if len(sys.argv) != 4:
        sys.exit("usage: rfc8017-rsa-pss-sha256.kat.py KEY MSG SALT")
    key, msg, salt = (bytes.fromhex(a) for a in sys.argv[1:])
    print(sign(key, msg, salt).hex())


main()

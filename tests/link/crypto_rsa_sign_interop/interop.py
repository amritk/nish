"""pyca/cryptography for tests/link/crypto_rsa_sign_interop/generate.mjs: one
JSON request on stdin, one JSON answer on stdout. It generates keys (of any
size, and with a public exponent of 3), signs RSASSA-PSS-SHA256 with an empty
salt, the one salt pyca lets a caller fix, and verifies a signature at a given
salt length. Every byte string is hex.

    python3 -I interop.py < request.json
"""
import json
import sys

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa

req = json.load(sys.stdin)
out = {"keys": [], "sigs": [], "verified": []}


def load(pkcs1):
    return serialization.load_der_private_key(bytes.fromhex(pkcs1), password=None)


def pss(salt_len):
    return padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=salt_len)


for spec in req.get("keygen", []):
    k = rsa.generate_private_key(public_exponent=spec["e"], key_size=spec["bits"])
    out["keys"].append({
        "bits": k.key_size,
        "pkcs1": k.private_bytes(
            serialization.Encoding.DER,
            serialization.PrivateFormat.TraditionalOpenSSL,
            serialization.NoEncryption(),
        ).hex(),
        "pkcs8": k.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        ).decode("ascii"),
    })
for it in req.get("sign", []):
    sig = load(it["pkcs1"]).sign(bytes.fromhex(it["msg"]), pss(0), hashes.SHA256())
    out["sigs"].append(sig.hex())
for it in req.get("verify", []):
    try:
        load(it["pkcs1"]).public_key().verify(
            bytes.fromhex(it["sig"]), bytes.fromhex(it["msg"]), pss(it["saltLen"]), hashes.SHA256()
        )
        out["verified"].append(True)
    except InvalidSignature:
        out["verified"].append(False)
json.dump(out, sys.stdout)

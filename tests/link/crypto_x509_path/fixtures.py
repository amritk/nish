# Writes fixtures.ts: the certificate chains crypto_x509_path validates. Run
# once with `python3 -I fixtures.py > fixtures.ts` (Python `cryptography`);
# the keys and ECDSA signatures are random, so a rerun writes different bytes
# with the same verdicts, and the committed file is the frozen copy.
#
# Every certificate is valid from 2026-01-01 to 2036-01-01; the program
# validates at 2027-01-01 (NOW) unless it says otherwise.
import datetime
import ipaddress

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, padding, rsa
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID, ObjectIdentifier

START = datetime.datetime(2026, 1, 1, tzinfo=datetime.timezone.utc)
END = datetime.datetime(2036, 1, 1, tzinfo=datetime.timezone.utc)
serial = [1]


def name(cn):
    return x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, cn)])


def p256():
    return ec.generate_private_key(ec.SECP256R1())


def ku(sign=False, cert=False, enc=False):
    return x509.KeyUsage(
        digital_signature=sign, content_commitment=False, key_encipherment=enc,
        data_encipherment=False, key_agreement=False, key_cert_sign=cert,
        crl_sign=cert, encipher_only=False, decipher_only=False)


def cert(subject, key, issuer, issuer_key, exts, hash_alg=hashes.SHA256(), pss=False):
    b = (x509.CertificateBuilder().subject_name(name(subject)).issuer_name(name(issuer))
         .public_key(key.public_key()).serial_number(serial[0])
         .not_valid_before(START).not_valid_after(END))
    serial[0] += 1
    for ext, critical in exts:
        b = b.add_extension(ext, critical)
    if pss:
        c = b.sign(issuer_key, hash_alg, rsa_padding=padding.PSS(
            mgf=padding.MGF1(hash_alg), salt_length=32))
    else:
        c = b.sign(issuer_key, hash_alg)
    return c.public_bytes(serialization.Encoding.DER)


def ca_exts(path_len=None, key_usage=True, ca=True, constraints=None):
    out = [(x509.BasicConstraints(ca=ca, path_length=path_len if ca else None), True)]
    if key_usage:
        out.append((ku(cert=True), True))
    if constraints is not None:
        out.append((constraints, True))
    return out


SAN = x509.SubjectAlternativeName([
    x509.DNSName("example.com"), x509.DNSName("*.example.org"),
    x509.IPAddress(ipaddress.ip_address("192.0.2.1")),
    x509.IPAddress(ipaddress.ip_address("2001:db8::1")),
])


def leaf_exts(san=SAN, eku=True, key_usage=True):
    out = [(x509.BasicConstraints(ca=False, path_length=None), True)]
    if key_usage:
        out.append((ku(sign=True), True))
    if eku:
        out.append((x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), False))
    if san is not None:
        out.append((san, False))
    return out


fx = {}
root_key, inter_key, leaf_key = p256(), p256(), p256()
fx["ROOT"] = cert("Path Root", root_key, "Path Root", root_key, ca_exts())
fx["INTER"] = cert("Path Inter", inter_key, "Path Root", root_key, ca_exts(path_len=0))
fx["LEAF"] = cert("example.com", leaf_key, "Path Inter", inter_key, leaf_exts())

# A root of the same name and another key: the anchor matches, the signature does not.
imposter_key = p256()
fx["IMPOSTER"] = cert("Path Root", imposter_key, "Path Root", imposter_key, ca_exts())
other_key = p256()
fx["OTHER_ROOT"] = cert("Other Root", other_key, "Other Root", other_key, ca_exts())

# Leaves under INTER that the leaf checks refuse.
fx["LEAF_CLIENT_EKU"] = cert("client", p256(), "Path Inter", inter_key, [
    (x509.ExtendedKeyUsage([ExtendedKeyUsageOID.CLIENT_AUTH]), False), (SAN, False)])
fx["LEAF_ANY_EKU"] = cert("any", p256(), "Path Inter", inter_key, [
    (x509.ExtendedKeyUsage([ObjectIdentifier("2.5.29.37.0")]), False), (SAN, False)])
fx["LEAF_KEY_ENC"] = cert("keyenc", p256(), "Path Inter", inter_key, [
    (ku(enc=True), True), (SAN, False)])
fx["LEAF_NO_SAN"] = cert("example.com", p256(), "Path Inter", inter_key, leaf_exts(san=None))
fx["LEAF_BARE"] = cert("bare", p256(), "Path Inter", inter_key, [(SAN, False)])
fx["LEAF_CRITICAL"] = cert("critical", p256(), "Path Inter", inter_key, leaf_exts() + [
    (x509.UnrecognizedExtension(ObjectIdentifier("1.3.6.1.4.1.99999.1"), b"\x05\x00"), True)])
fx["LEAF_NONCRITICAL"] = cert("noncritical", p256(), "Path Inter", inter_key, leaf_exts() + [
    (x509.UnrecognizedExtension(ObjectIdentifier("1.3.6.1.4.1.99999.1"), b"\x05\x00"), False)])
# basicConstraints whose value is a NULL, not a SEQUENCE.
fx["LEAF_BAD_EXT"] = cert("badext", p256(), "Path Inter", inter_key, [
    (x509.UnrecognizedExtension(ObjectIdentifier("2.5.29.19"), b"\x05\x00"), True), (SAN, False)])
fx["LEAF_UNICODE"] = cert("unicode", p256(), "Path Inter", inter_key, leaf_exts(
    san=x509.SubjectAlternativeName([x509.DNSName("xn--bcher-kva.example")])))

# Issuers the hop checks refuse, each signing its own leaf.
for label, exts in [
    ("NOT_CA", ca_exts(ca=False)),
    ("NO_KU", ca_exts(key_usage=False)),
    ("NC_PERMIT_NET", ca_exts(constraints=x509.NameConstraints(
        permitted_subtrees=[x509.DNSName("example.net")], excluded_subtrees=None))),
    ("NC_PERMIT_OK", ca_exts(constraints=x509.NameConstraints(
        permitted_subtrees=[x509.DNSName("example.com"), x509.DNSName(".example.org"),
                            x509.IPAddress(ipaddress.ip_network("192.0.2.0/24")),
                            x509.IPAddress(ipaddress.ip_network("2001:db8::/32"))],
        excluded_subtrees=None))),
    ("NC_EXCLUDE_IP", ca_exts(constraints=x509.NameConstraints(
        permitted_subtrees=None,
        excluded_subtrees=[x509.IPAddress(ipaddress.ip_network("192.0.2.0/28"))]))),
    ("NC_EMAIL", ca_exts(constraints=x509.NameConstraints(
        permitted_subtrees=[x509.RFC822Name("example.com")], excluded_subtrees=None))),
]:
    k = p256()
    fx["CA_" + label] = cert("CA " + label, k, "Path Root", root_key, exts)
    fx["LEAF_" + label] = cert("example.com", p256(), "CA " + label, k, leaf_exts())

# pathLenConstraint 0 on INTER, then one more CA under it.
sub_key = p256()
fx["SUB"] = cert("Path Sub", sub_key, "Path Inter", inter_key, ca_exts())
fx["LEAF_SUB"] = cert("example.com", p256(), "Path Sub", sub_key, leaf_exts())
# The same depth under a root-issued CA with pathLen 1: allowed.
deep_key, deep_sub_key = p256(), p256()
fx["DEEP"] = cert("Path Deep", deep_key, "Path Root", root_key, ca_exts(path_len=1))
fx["DEEP_SUB"] = cert("Path Deep Sub", deep_sub_key, "Path Deep", deep_key, ca_exts())
fx["LEAF_DEEP"] = cert("example.com", p256(), "Path Deep Sub", deep_sub_key, leaf_exts())

# The algorithms checked later: RSA PKCS#1 and PSS, P-384, ECDSA-SHA384 by P-256.
rsa_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
fx["RSA_ROOT"] = cert("RSA Root", rsa_key, "RSA Root", rsa_key, ca_exts())
fx["LEAF_RSA"] = cert("example.com", p256(), "RSA Root", rsa_key, leaf_exts())
fx["LEAF_PSS"] = cert("example.com", p256(), "RSA Root", rsa_key, leaf_exts(), pss=True)
p384_key = ec.generate_private_key(ec.SECP384R1())
fx["P384_ROOT"] = cert("P384 Root", p384_key, "P384 Root", p384_key, ca_exts(), hashes.SHA384())
fx["LEAF_P384"] = cert("example.com", p256(), "P384 Root", p384_key, leaf_exts(), hashes.SHA384())
fx["LEAF_SHA384"] = cert("example.com", p256(), "Path Root", root_key, leaf_exts(), hashes.SHA384())
# A leaf whose key is RSA, signed with ECDSA: what the leaf holds is not checked.
fx["LEAF_RSA_KEY"] = cert("example.com", rsa.generate_private_key(public_exponent=65537, key_size=2048),
                          "Path Inter", inter_key, leaf_exts())
# An ECDSA signature claimed under the RSA root: the family does not fit the key.
fx["LEAF_ECDSA_UNDER_RSA"] = cert("example.com", p256(), "RSA Root", p256(), leaf_exts())

print("// Written by fixtures.py (Python cryptography " + __import__("cryptography").__version__ + "); see there.")
for k, v in fx.items():
    print(f'export const {k}: string =\n  "{v.hex()}"')

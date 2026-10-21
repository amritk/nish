// The x509 family's Rust twin: rcgen mints the certificate, x509-parser parses
// it and RustCrypto's p256 signs and verifies, under the contract in
// bench/crypto/README.md and the inputs in this family's README.md. The runner
// copies lib/gen.rs in as src/gen.rs. rcgen without its `crypto` feature signs
// through the SigningKey this file gives it.
mod gen;

use p256::ecdsa::signature::{Signer, Verifier};
use rcgen::{
    CertificateParams, CustomExtension, DistinguishedName, DnType, KeyUsagePurpose, PublicKeyData,
    SerialNumber, SignatureAlgorithm, SigningKey,
};
use std::time::Instant;
use x509_parser::prelude::{FromDer, X509Certificate};

/// The subject's and issuer's common name.
const COMMON_NAME: &str = "bench.nish.dev";

/// notBefore: 2026-01-01T00:00:00Z, in seconds.
const NOT_BEFORE: i64 = 1767225600;

/// The validity, in days.
const DAYS: i64 = 14;

/// The certificate x509-parse reads: Nish's x509-mint output for its first
/// iteration, so every twin parses the same bytes.
const FIXED_CERT: &str = "3082014e3081f6a003020102021057a8a60ac6cf332f0d105dba046fb40d300a06082a8648ce3d04030230193117301506035504030c0e62656e63682e6e6973682e646576301e170d3236303130313030303030305a170d3236303131353030303030305a30193117301506035504030c0e62656e63682e6e6973682e6465763059301306072a8648ce3d020106082a8648ce3d030107034200046773f52bac85b0278dbc1c6ab010e6a63ab5cb19673672f3a66e3b53e5fc31fa6881cfb754e458be32e5c105f96ac0dc83f02224f7c4f0f56ec4f165496b0e53a320301e300c0603551d130101ff04023000300e0603551d0f0101ff040403020780300a06082a8648ce3d04030203470030440220706060f8d5a0c763dafd8f5a9a7cfd6131b7eba82739420235dcd9f91b2371f102207d9f5543446e841cc9029d83741fd9ed9753120cd1eefa51f098e6f60dc74742";

fn fail(what: &str) -> ! {
    eprintln!("rust: {what} failed");
    std::process::exit(1);
}

/// A P-256 key rcgen signs with: the 65-byte point, and ECDSA over SHA-256 in DER.
struct Key {
    signer: p256::ecdsa::SigningKey,
    point: Vec<u8>,
}

impl PublicKeyData for Key {
    fn der_bytes(&self) -> &[u8] {
        &self.point
    }

    fn algorithm(&self) -> &'static SignatureAlgorithm {
        &rcgen::PKCS_ECDSA_P256_SHA256
    }
}

impl SigningKey for Key {
    fn sign(&self, msg: &[u8]) -> Result<Vec<u8>, rcgen::Error> {
        let sig: p256::ecdsa::Signature = self.signer.sign(msg);
        Ok(sig.to_der().as_bytes().to_vec())
    }
}

/// A self-signed certificate for `serial`, with the extensions every twin writes:
/// a critical basicConstraints CA:FALSE and a critical keyUsage digitalSignature.
fn mint(key: &Key, serial: &[u8]) -> Vec<u8> {
    let mut params = CertificateParams::default();
    let mut name = DistinguishedName::new();
    name.push(DnType::CommonName, COMMON_NAME);
    params.distinguished_name = name;
    params.serial_number = Some(SerialNumber::from_slice(serial));
    params.not_before =
        time::OffsetDateTime::from_unix_timestamp(NOT_BEFORE).unwrap_or_else(|_| fail("notBefore"));
    params.not_after = params.not_before + time::Duration::days(DAYS);
    params.key_usages = vec![KeyUsagePurpose::DigitalSignature];
    // rcgen's IsCa::ExplicitNoCa adds a subjectKeyIdentifier too, so CA:FALSE
    // goes in as the extension it is: an empty SEQUENCE.
    let mut ca_false = CustomExtension::from_oid_content(&[2, 5, 29, 19], vec![0x30, 0x00]);
    ca_false.set_criticality(true);
    params.custom_extensions = vec![ca_false];
    let cert = params
        .self_signed(key)
        .unwrap_or_else(|_| fail("CertificateParams::self_signed"));
    cert.der().to_vec()
}

/// What both kernels fold for a certificate: the common name, the validity as
/// big-endian seconds, the point and whether its self-signature verifies.
fn fold_certificate(sum: u32, cert: &X509Certificate) -> u32 {
    let cn = cert
        .subject()
        .iter_common_name()
        .next()
        .and_then(|cn| cn.as_str().ok())
        .unwrap_or_else(|| fail("reading the common name"));
    let validity = cert.validity();
    let point = &cert.public_key().subject_public_key.data;
    let ok = match (
        p256::ecdsa::VerifyingKey::from_sec1_bytes(point),
        p256::ecdsa::Signature::from_der(&cert.signature_value.data),
    ) {
        (Ok(verifier), Ok(sig)) => verifier.verify(cert.tbs_certificate.as_ref(), &sig).is_ok(),
        _ => false,
    };
    let mut sum = gen::fold(sum, cn.as_bytes());
    sum = gen::fold(sum, &validity.not_before.timestamp().to_be_bytes());
    sum = gen::fold(sum, &validity.not_after.timestamp().to_be_bytes());
    gen::fold(gen::fold(sum, point), &[ok as u8])
}

fn parse(der: &[u8]) -> X509Certificate<'_> {
    match X509Certificate::from_der(der) {
        Ok((rest, cert)) if rest.is_empty() => cert,
        _ => fail("parsing the certificate"),
    }
}

fn main() {
    let (kernel, size, iterations) = gen::parse_args("rust");
    let mut sum = gen::FOLD_START;
    match kernel.as_str() {
        "x509-mint" => {
            if !(4..=20).contains(&size) {
                eprintln!("rust: x509-mint's size is the serial's length, 4 to 20 bytes");
                std::process::exit(2);
            }
            let mut inp = gen::inputs(&kernel, size, 32, 0, 0, size);
            let base = [inp.msg[0], inp.msg[1], inp.msg[2], inp.msg[3]];
            let signer = p256::ecdsa::SigningKey::from_slice(&inp.key)
                .unwrap_or_else(|_| fail("the P-256 key"));
            let point = signer
                .verifying_key()
                .to_sec1_point(false)
                .as_bytes()
                .to_vec();
            let key = Key { signer, point };
            let mut certs = Vec::with_capacity(iterations);
            let started = Instant::now();
            for i in 0..iterations {
                gen::tweak(&mut inp.msg, 0, base, i as u32);
                let mut serial = inp.msg.clone();
                // A positive INTEGER whose first octet is not zero, so it is encoded as it is.
                serial[0] = (serial[0] & 0x3f) | 0x40;
                certs.push(mint(&key, &serial));
            }
            // Go's and OpenSSL's ECDSA signatures are randomised, so what is folded is what
            // parsing each certificate back gives, after the clock stops.
            let stopped = Instant::now();
            for der in &certs {
                let cert = parse(der);
                sum = fold_certificate(gen::fold(sum, cert.raw_serial()), &cert);
            }
            gen::report(sum, started + stopped.elapsed());
        }
        "x509-parse" => {
            let der: Vec<u8> = (0..FIXED_CERT.len() / 2)
                .map(|k| {
                    u8::from_str_radix(&FIXED_CERT[2 * k..2 * k + 2], 16)
                        .unwrap_or_else(|_| fail("the hex"))
                })
                .collect();
            if size != der.len() {
                eprintln!(
                    "rust: x509-parse's size is {}, the fixed certificate's length",
                    der.len()
                );
                std::process::exit(2);
            }
            let started = Instant::now();
            for _ in 0..iterations {
                sum = fold_certificate(sum, &parse(&der));
            }
            gen::report(sum, started);
        }
        _ => {
            eprintln!("rust: no kernel {kernel}");
            std::process::exit(2);
        }
    }
}

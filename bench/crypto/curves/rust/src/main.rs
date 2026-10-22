// The curves family's Rust twin: x25519-dalek, ed25519-dalek and RustCrypto's
// p256, under the contract in bench/crypto/README.md and the inputs in this
// family's README.md. The runner copies lib/gen.rs in as src/gen.rs;
// `--cfg curve25519_dalek_backend="serial"` is the portable column, and
// README.md says which kernels it reaches.
mod gen;

use ed25519_dalek::{Signer, Verifier};
use p256::ecdsa::signature::hazmat::{PrehashSigner, PrehashVerifier};
use sha2::{Digest, Sha256};
use std::time::Instant;

/// Messages the verify kernels cycle through, signed before the clock starts.
const RING: usize = 16;

/// The ring entry changed after it was signed, so its verify must answer false.
const TAMPERED: usize = 1;

fn fail(what: &str) -> ! {
    eprintln!("rust: {what} failed");
    std::process::exit(1);
}

fn main() {
    let (kernel, size, iterations) = gen::parse_args("rust");
    match kernel.as_str() {
        "x25519-base" | "x25519" if size != 32 => {
            eprintln!("rust: an X25519 kernel's size is 32");
            std::process::exit(2);
        }
        "x25519-base" | "x25519" | "p256-sign" | "p256-verify" | "ed25519-sign"
        | "ed25519-verify" => {}
        _ => {
            eprintln!("rust: no kernel {kernel}");
            std::process::exit(2);
        }
    }
    let key_len = if kernel == "x25519-base" { 0 } else { 32 };
    let mut inp = gen::inputs(&kernel, size, key_len, 0, 0, size);
    let base = [inp.msg[0], inp.msg[1], inp.msg[2], inp.msg[3]];
    let mut sum = gen::FOLD_START;
    let key: [u8; 32] = if key_len == 32 {
        inp.key[..].try_into().unwrap()
    } else {
        [0; 32]
    };

    match kernel.as_str() {
        "x25519-base" => {
            let started = Instant::now();
            for i in 0..iterations {
                gen::tweak(&mut inp.msg, 0, base, i as u32);
                let scalar: [u8; 32] = inp.msg[..].try_into().unwrap();
                let secret = x25519_dalek::StaticSecret::from(scalar);
                sum = gen::fold(sum, x25519_dalek::PublicKey::from(&secret).as_bytes());
            }
            gen::report(sum, started);
        }
        "x25519" => {
            let secret = x25519_dalek::StaticSecret::from(key);
            let mut u: [u8; 32] = inp.msg[..].try_into().unwrap();
            let started = Instant::now();
            for _ in 0..iterations {
                u = secret
                    .diffie_hellman(&x25519_dalek::PublicKey::from(u))
                    .to_bytes();
                sum = gen::fold(sum, &u);
            }
            gen::report(sum, started);
        }
        "p256-sign" => {
            let signer =
                p256::ecdsa::SigningKey::from_slice(&key).unwrap_or_else(|_| fail("the P-256 key"));
            let verifier = signer.verifying_key();
            sum = gen::fold(sum, verifier.to_sec1_point(false).as_bytes());
            let mut digests = Vec::with_capacity(iterations);
            let mut sigs: Vec<p256::ecdsa::Signature> = Vec::with_capacity(iterations);
            let started = Instant::now();
            for i in 0..iterations {
                gen::tweak(&mut inp.msg, 0, base, i as u32);
                let digest = Sha256::digest(&inp.msg);
                sigs.push(
                    signer
                        .sign_prehash(&digest)
                        .unwrap_or_else(|_| fail("signing")),
                );
                digests.push(digest);
            }
            // Folded as every twin folds it: each digest and whether its
            // signature verifies, checked after the clock stops.
            let stopped = Instant::now();
            for (digest, sig) in digests.iter().zip(&sigs) {
                let ok = verifier.verify_prehash(digest, sig).is_ok() as u8;
                sum = gen::fold(gen::fold(sum, digest), &[ok]);
            }
            gen::report(sum, started + stopped.elapsed());
        }
        "ed25519-sign" => {
            let signer = ed25519_dalek::SigningKey::from_bytes(&key);
            sum = gen::fold(sum, signer.verifying_key().as_bytes());
            let started = Instant::now();
            for i in 0..iterations {
                gen::tweak(&mut inp.msg, 0, base, i as u32);
                sum = gen::fold(sum, &signer.sign(&inp.msg).to_bytes());
            }
            gen::report(sum, started);
        }
        _ => {
            let mut msgs: Vec<Vec<u8>> = (0..RING)
                .map(|j| {
                    let mut m = inp.msg.clone();
                    gen::tweak(&mut m, 0, base, j as u32);
                    m
                })
                .collect();
            let verify: Box<dyn Fn(&[u8], usize) -> bool> = if kernel == "p256-verify" {
                let signer = p256::ecdsa::SigningKey::from_slice(&key)
                    .unwrap_or_else(|_| fail("the P-256 key"));
                let verifier = *signer.verifying_key();
                sum = gen::fold(sum, verifier.to_sec1_point(false).as_bytes());
                let sigs: Vec<p256::ecdsa::Signature> = msgs
                    .iter()
                    .map(|m| {
                        signer
                            .sign_prehash(&Sha256::digest(m))
                            .unwrap_or_else(|_| fail("signing"))
                    })
                    .collect();
                // Verifier::verify would hash too; hashed here, as the other twins do.
                Box::new(move |m, j| {
                    verifier
                        .verify_prehash(&Sha256::digest(m), &sigs[j])
                        .is_ok()
                })
            } else {
                let signer = ed25519_dalek::SigningKey::from_bytes(&key);
                let verifier = signer.verifying_key();
                sum = gen::fold(sum, verifier.as_bytes());
                let sigs: Vec<ed25519_dalek::Signature> =
                    msgs.iter().map(|m| signer.sign(m)).collect();
                Box::new(move |m, j| verifier.verify(m, &sigs[j]).is_ok())
            };
            msgs[TAMPERED][size - 1] ^= 1;
            let started = Instant::now();
            for i in 0..iterations {
                let j = i % RING;
                let ok = verify(&msgs[j], j);
                if ok != (j != TAMPERED) {
                    eprintln!("rust: {kernel} gave the wrong answer");
                    std::process::exit(1);
                }
                sum = gen::fold(sum, &[ok as u8]);
            }
            gen::report(sum, started);
        }
    }
}

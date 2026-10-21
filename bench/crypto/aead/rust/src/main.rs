// The AEAD family's Rust twin: RustCrypto's aes-gcm and chacha20poly1305,
// under the contract in bench/crypto/README.md and the inputs in this family's
// README.md. The runner copies lib/gen.rs in as src/gen.rs; the `soft`
// backends of aes, polyval, chacha20 and poly1305 are the portable column.
mod gen;

use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes128Gcm, Aes256Gcm};
use chacha20poly1305::ChaCha20Poly1305;
use std::time::Instant;

const NONCE: usize = 12;
const NONCE_TWEAK: usize = 8;
const AAD: usize = 13;
const RING: usize = 16;

/// Seal `msg` and fold the ciphertext and tag, or open it and fold the plaintext.
fn run<A: Aead + KeyInit>(kernel: &str, size: usize, iterations: usize, key_len: usize, open: bool) {
    let mut inp = gen::inputs(kernel, size, key_len, NONCE, AAD, size);
    // Keyed once, before the clock.
    let aead = A::new_from_slice(&inp.key).unwrap_or_else(|_| std::process::exit(1));
    let msg_base = [inp.msg[0], inp.msg[1], inp.msg[2], inp.msg[3]];
    let n = &inp.nonce[NONCE_TWEAK..];
    let nonce_base = [n[0], n[1], n[2], n[3]];
    let seal = |aead: &A, nonce: &[u8], msg: &[u8], aad: &[u8]| -> Vec<u8> {
        aead.encrypt(nonce.try_into().unwrap(), Payload { msg, aad }).unwrap_or_else(|_| {
            eprintln!("rust: seal failed");
            std::process::exit(1)
        })
    };
    let mut sum = gen::FOLD_START;
    if !open {
        let started = Instant::now();
        for i in 0..iterations {
            gen::tweak(&mut inp.msg, 0, msg_base, i as u32);
            gen::tweak(&mut inp.nonce, NONCE_TWEAK, nonce_base, i as u32);
            sum = gen::fold(sum, &seal(&aead, &inp.nonce, &inp.msg, &inp.aad));
        }
        gen::report(sum, started);
        return;
    }
    // The ring: entry r is the seal of the message and nonce tweaked with r.
    let ring: Vec<Vec<u8>> = (0..RING)
        .map(|r| {
            gen::tweak(&mut inp.msg, 0, msg_base, r as u32);
            gen::tweak(&mut inp.nonce, NONCE_TWEAK, nonce_base, r as u32);
            seal(&aead, &inp.nonce, &inp.msg, &inp.aad)
        })
        .collect();
    let started = Instant::now();
    for i in 0..iterations {
        let r = i % RING;
        gen::tweak(&mut inp.nonce, NONCE_TWEAK, nonce_base, r as u32);
        let payload = Payload { msg: &ring[r], aad: &inp.aad };
        let opened = aead.decrypt(inp.nonce.as_slice().try_into().unwrap(), payload).unwrap_or_else(|_| {
            eprintln!("rust: open failed");
            std::process::exit(1)
        });
        sum = gen::fold(sum, &opened);
    }
    gen::report(sum, started);
}

fn main() {
    let (kernel, size, iterations) = gen::parse_args("rust");
    if size < 4 {
        eprintln!("rust: the size is at least 4 bytes");
        std::process::exit(2);
    }
    let open = match kernel.rsplit_once('-').map(|(_, op)| op) {
        Some("seal") => false,
        Some("open") => true,
        _ => {
            eprintln!("rust: no kernel {kernel}");
            std::process::exit(2);
        }
    };
    match &kernel[..kernel.len() - 5] {
        "aes128gcm" => run::<Aes128Gcm>(&kernel, size, iterations, 16, open),
        "aes256gcm" => run::<Aes256Gcm>(&kernel, size, iterations, 32, open),
        "chacha20poly1305" => run::<ChaCha20Poly1305>(&kernel, size, iterations, 32, open),
        _ => {
            eprintln!("rust: no kernel {kernel}");
            std::process::exit(2);
        }
    }
}

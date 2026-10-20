// The hash family's Rust twin: RustCrypto's sha2, hmac and hkdf, under the
// contract in bench/crypto/README.md and the inputs in this family's
// README.md. The runner copies lib/gen.rs in as src/gen.rs;
// `--cfg sha2_backend="soft"` is the portable column.
mod gen;

use hkdf::Hkdf;
use hmac::{Hmac, KeyInit, Mac};
use sha2::{Digest, Sha256, Sha512};
use std::time::Instant;

fn main() {
    let (kernel, size, iterations) = gen::parse_args("rust");
    let (key_len, aad_len) = match kernel.as_str() {
        "sha256" | "sha512" => (0, 0),
        "hmac-sha256" => (32, 0),
        "hkdf-sha256" => (32, 10),
        _ => {
            eprintln!("rust: no kernel {kernel}");
            std::process::exit(2);
        }
    };
    let mut inp = gen::inputs(&kernel, size, key_len, 0, aad_len, size);
    let base = [inp.msg[0], inp.msg[1], inp.msg[2], inp.msg[3]];
    let mut okm = [0u8; 42];
    let mut sum = gen::FOLD_START;
    let started = Instant::now();
    for i in 0..iterations {
        gen::tweak(&mut inp.msg, 0, base, i as u32);
        sum = match kernel.as_str() {
            "sha256" => gen::fold(sum, &Sha256::digest(&inp.msg)),
            "sha512" => gen::fold(sum, &Sha512::digest(&inp.msg)),
            "hmac-sha256" => {
                // Keyed per message, as every other twin's one-shot HMAC is.
                let mut m = Hmac::<Sha256>::new_from_slice(&inp.key)
                    .unwrap_or_else(|_| std::process::exit(1));
                m.update(&inp.msg);
                gen::fold(sum, &m.finalize().into_bytes())
            }
            _ => {
                let h = Hkdf::<Sha256>::new(Some(&inp.key), &inp.msg);
                if h.expand(&inp.aad, &mut okm).is_err() {
                    eprintln!("rust: hkdf expand failed");
                    std::process::exit(1);
                }
                gen::fold(sum, &okm)
            }
        };
    }
    gen::report(sum, started);
}

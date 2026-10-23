// The crypto twins' shared input generator and checksum fold, for Rust: the
// same bytes and the same fold as lib/gen.ts, under the contract in
// bench/crypto/README.md. The runner copies this file into a family's crate
// as src/gen.rs, and its main.rs declares `mod gen;`.

#![allow(dead_code)] // A family uses only the buffers its kernels need.

use std::time::Instant;

/// FNV-1a 32's offset basis: the fold's start.
pub const FOLD_START: u32 = 2166136261;

/// FNV-1a 32 over `bytes`, from `sum`.
pub fn fold(mut sum: u32, bytes: &[u8]) -> u32 {
    for &b in bytes {
        sum = (sum ^ b as u32).wrapping_mul(16777619);
    }
    sum
}

/// One kernel's inputs, every buffer drawn from one stream in this order.
pub struct Inputs {
    pub key: Vec<u8>,
    pub nonce: Vec<u8>,
    pub aad: Vec<u8>,
    pub msg: Vec<u8>,
}

/// The key, nonce, AAD and message of `kernel` at `size`, at the lengths given.
pub fn inputs(kernel: &str, size: usize, key_len: usize, nonce_len: usize, aad_len: usize, msg_len: usize) -> Inputs {
    let mut x = fold(FOLD_START, format!("{kernel}:{size}").as_bytes());
    if x == 0 {
        x = 1;
    }
    let mut draw = |length: usize| -> Vec<u8> {
        (0..length)
            .map(|_| {
                x ^= x << 13;
                x ^= x >> 17;
                x ^= x << 5;
                x as u8
            })
            .collect()
    };
    let key = draw(key_len);
    let nonce = draw(nonce_len);
    let aad = draw(aad_len);
    Inputs { key, nonce, aad, msg: draw(msg_len) }
}

/// Iteration `i`'s input: `bytes[at..at + 4]` set to `base` (the original four bytes) XOR `i`, little-endian.
pub fn tweak(bytes: &mut [u8], at: usize, base: [u8; 4], i: u32) {
    let t = i.to_le_bytes();
    for k in 0..4 {
        bytes[at + k] = base[k] ^ t[k];
    }
}

/// The command line, `<kernel> <size> <iterations>`; exit 2 with a usage line when it is not one.
pub fn parse_args(program: &str) -> (String, usize, usize) {
    let argv: Vec<String> = std::env::args().collect();
    if argv.len() == 4 {
        if let (Ok(size), Ok(iterations)) = (argv[2].parse::<usize>(), argv[3].parse::<usize>()) {
            if iterations >= 1 {
                return (argv[1].clone(), size, iterations);
            }
        }
    }
    eprintln!("usage: {program} <kernel> <size> <iterations>");
    std::process::exit(2);
}

/// The contract's two lines: the checksum on stdout, the timed loop's nanoseconds on stderr.
pub fn report(sum: u32, started: Instant) {
    let ns = started.elapsed().as_nanos();
    println!("checksum {sum:08x}");
    eprintln!("ns {ns}");
}

// Rust twin of par-histogram-atomic.ts with `std::thread::scope`: four threads
// bin a stream each into sixteen `AtomicI32`s, one `fetch_add` per value,
// sixteen rounds, each round a scope that spawns all four streams. Adding to a
// bin commutes, so the checksum is the same whatever order the adds landed
// in, and the total is the count of values binned.
use std::sync::atomic::{AtomicI32, Ordering};

const ROUNDS: i32 = 16; // bench:n
const TASKS: i32 = 4;
const COUNT: i32 = 50000;

/// `count` values of the ZX81's generator from `seed`, each one atomic add on its bin.
fn bin_stream(seed: i32, count: i32, bins: &[AtomicI32; 16]) -> i32 {
    let mut v = seed;
    for _ in 0..count {
        v = (v * 75 + 74) % 65537;
        let bin = (v & 15) as usize;
        bins[bin].fetch_add(1, Ordering::SeqCst);
    }
    count
}

fn main() {
    let bins: [AtomicI32; 16] = std::array::from_fn(|_| AtomicI32::new(0));
    let mut check: i32 = 0;
    let mut total: i32 = 0;
    for r in 0..ROUNDS {
        std::thread::scope(|s| {
            for t in 0..TASKS {
                let b = &bins;
                s.spawn(move || bin_stream(r * TASKS + t + 1, COUNT, b));
            }
        });
        for b in bins.iter() {
            let n = b.swap(0, Ordering::SeqCst);
            check = (check * 31 + n) % 65521;
            total += n;
        }
    }
    println!("{} {}", check, total);
}

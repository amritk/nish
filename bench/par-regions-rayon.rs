// Rust twin of par-regions.ts with Rayon: a 2^17-element map called a
// thousand times, each call fed by the last, each call a `par_iter_mut` on
// Rayon's global pool, whose threads park between calls as Nish's workers do.
use rayon::prelude::*;

const ROUNDS: usize = 1000; // bench:n
const N: usize = 131072;

fn scramble(x: i32) -> i32 {
    let mut h = x;
    for k in 0..8 {
        h ^= h << 5;
        h ^= h >> 3;
        h ^= k;
    }
    h
}

fn main() {
    let mut src: Vec<i32> = (0..N as i32).collect();
    let mut dst = vec![0i32; N];
    let mut check: i32 = 0;
    for r in 0..ROUNDS {
        dst.par_iter_mut().zip(src.par_iter()).for_each(|(d, &v)| *d = scramble(v));
        let at = (r * 7919) % N;
        check ^= dst[at];
        src[at] = dst[at];
    }
    let mut sum: i32 = 0;
    for &d in &dst {
        sum ^= d;
    }
    println!("{} {}", sum, check);
}

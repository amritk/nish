// Rust twin of par-compute.ts with Rayon: `par_iter_mut` over the results,
// zipped with the inputs, on Rayon's global pool and its adaptive splitting.
// The checksum is the sum of the results in index order, on one thread.
use rayon::prelude::*;

const N: usize = 2097152; // bench:n

fn settle(x: f64) -> f64 {
    let mut v = x;
    for _ in 0..64 {
        v = (v * v + 1.0).sqrt() - 0.5 * v;
    }
    v
}

fn main() {
    let mut src = vec![0.0f64; N];
    let mut x = 0.0f64;
    for s in src.iter_mut() {
        *s = x;
        x += 0.000001;
    }
    let mut dst = vec![0.0f64; N];
    dst.par_iter_mut().zip(src.par_iter()).for_each(|(d, &v)| *d = settle(v));
    let mut sum = 0.0f64;
    for &d in &dst {
        sum += d;
    }
    println!("{}", sum);
}

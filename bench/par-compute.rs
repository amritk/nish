// Rust twin of par-compute.ts with `std::thread::scope`: the same 64 square
// roots per element, the array cut into one contiguous chunk per core, the
// first chunk run on the calling thread as Nish's partitioner runs it. The
// checksum is the sum of the results in index order, on one thread.
const N: usize = 2097152; // bench:n

fn settle(x: f64) -> f64 {
    let mut v = x;
    for _ in 0..64 {
        v = (v * v + 1.0).sqrt() - 0.5 * v;
    }
    v
}

/// The threads to divide over: `PAR_THREADS`, which bench/run.mjs sets to the
/// count Nish divides over, or every core the process may use.
fn threads() -> usize {
    std::env::var("PAR_THREADS")
        .ok()
        .and_then(|v| v.parse().ok())
        .filter(|&n| n > 0)
        .unwrap_or_else(|| std::thread::available_parallelism().map_or(1, |n| n.get()))
}

fn main() {
    let mut src = vec![0.0f64; N];
    let mut x = 0.0f64;
    for s in src.iter_mut() {
        *s = x;
        x += 0.000001;
    }
    let mut dst = vec![0.0f64; N];
    let threads = threads();
    let chunk = N.div_ceil(threads);
    std::thread::scope(|s| {
        let mut parts = src.chunks(chunk).zip(dst.chunks_mut(chunk));
        let first = parts.next();
        for (sc, dc) in parts {
            s.spawn(move || {
                for (d, &v) in dc.iter_mut().zip(sc) {
                    *d = settle(v);
                }
            });
        }
        if let Some((sc, dc)) = first {
            for (d, &v) in dc.iter_mut().zip(sc) {
                *d = settle(v);
            }
        }
    });
    let mut sum = 0.0f64;
    for &d in &dst {
        sum += d;
    }
    println!("{}", sum);
}

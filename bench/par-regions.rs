// Rust twin of par-regions.ts with `std::thread::scope`: a 2^17-element map
// called a thousand times, each call fed by the last. Every call opens a scope
// and spawns one thread per core but the first, whose chunk the calling thread
// maps, so what is measured is what one divided region costs when each region
// starts its own threads; the Rayon twin keeps a pool instead.
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

fn map_chunk(src: &[i32], dst: &mut [i32]) {
    for (d, &v) in dst.iter_mut().zip(src) {
        *d = scramble(v);
    }
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
    let mut src: Vec<i32> = (0..N as i32).collect();
    let mut dst = vec![0i32; N];
    let threads = threads();
    let chunk = N.div_ceil(threads);
    let mut check: i32 = 0;
    for r in 0..ROUNDS {
        std::thread::scope(|s| {
            let mut parts = src.chunks(chunk).zip(dst.chunks_mut(chunk));
            let first = parts.next();
            for (sc, dc) in parts {
                s.spawn(move || map_chunk(sc, dc));
            }
            if let Some((sc, dc)) = first {
                map_chunk(sc, dc);
            }
        });
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

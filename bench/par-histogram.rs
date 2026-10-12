// Rust twin of par-histogram.ts with `std::thread::scope`: four threads bin a
// stream each into one `Mutex<[i32; 16]>`, taking the lock once per value,
// sixteen rounds, each round a scope that spawns all four streams. Adding to a
// bin commutes, so the checksum is the same whatever order the critical
// sections ran in, and the total is the count of values binned.
use std::sync::Mutex;

const ROUNDS: i32 = 16; // bench:n
const TASKS: i32 = 4;
const COUNT: i32 = 50000;

/// `count` values of the ZX81's generator from `seed`, each binned under the lock.
fn bin_stream(seed: i32, count: i32, hist: &Mutex<[i32; 16]>) -> i32 {
    let mut v = seed;
    for _ in 0..count {
        v = (v * 75 + 74) % 65537;
        let bin = (v & 15) as usize;
        let mut g = hist.lock().unwrap();
        g[bin] += 1;
    }
    count
}

fn main() {
    let hist = Mutex::new([0i32; 16]);
    let mut check: i32 = 0;
    let mut total: i32 = 0;
    for r in 0..ROUNDS {
        std::thread::scope(|s| {
            for t in 0..TASKS {
                let h = &hist;
                s.spawn(move || bin_stream(r * TASKS + t + 1, COUNT, h));
            }
        });
        let mut g = hist.lock().unwrap();
        for b in g.iter_mut() {
            check = (check * 31 + *b) % 65521;
            total += *b;
            *b = 0;
        }
    }
    println!("{} {}", check, total);
}

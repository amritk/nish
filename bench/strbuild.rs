// Rust twin of strbuild.ts: the same join tree over immutable strings, where
// every concatenation allocates a fresh String (`[a, b].concat()`) and the
// inputs are dropped, matching strbuild_naive.c. (The idiomatic
// `String::push_str` would grow one buffer in place instead and is O(n);
// docs/BENCHMARKS.md reports it separately.)
const N: i32 = 131072; // bench:n
const FANOUT: i32 = 32;

fn piece(i: i32) -> String {
    format!("{},", i)
}

fn join(lo: i32, hi: i32) -> String {
    let count = hi - lo;
    if count <= FANOUT {
        let mut s = String::new();
        for i in lo..hi {
            s = [s.as_str(), piece(i).as_str()].concat();
        }
        return s;
    }
    let step = (count + FANOUT - 1) / FANOUT;
    let mut s = String::new();
    let mut start = lo;
    while start < hi {
        let end = if start + step < hi { start + step } else { hi };
        s = [s.as_str(), join(start, end).as_str()].concat();
        start += step;
    }
    s
}

fn main() {
    let s = join(0, N);
    println!("{}", s.len());
}

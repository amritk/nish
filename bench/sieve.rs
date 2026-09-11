// Rust twin of sieve.ts: a Vec<bool> indexed with usize, so every store is
// bounds-checked exactly as in Nish (LLVM hoists or drops what it can).
const N: i32 = 10000000; // bench:n
const PASSES: i32 = 20;

fn sieve(composite: &mut [bool], n: i32) -> i32 {
    for i in 0..=n {
        composite[i as usize] = false;
    }
    let mut i: i32 = 2;
    while i * i <= n {
        if !composite[i as usize] {
            let mut j = i * i;
            while j <= n {
                composite[j as usize] = true;
                j += i;
            }
        }
        i += 1;
    }
    let mut count: i32 = 0;
    for k in 2..=n {
        if !composite[k as usize] {
            count += 1;
        }
    }
    count
}

fn main() {
    let mut composite = vec![false; N as usize + 1];
    let mut total: i32 = 0;
    for _ in 0..PASSES {
        total += sieve(&mut composite, N);
    }
    println!("{}", total);
}

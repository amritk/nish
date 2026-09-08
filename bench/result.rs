// Rust twin of result.ts: same shape, same checksum line. `Result<i32, i32>`
// is returned and passed in a register here for the same reason it is in
// StaticTS since WP17 — it is two four-byte payloads and a discriminant.
const N: i32 = 200000000; // bench:n

fn half(n: i32) -> Result<i32, i32> {
    if n % 2 != 0 {
        return Err(n);
    }
    Ok(n / 2)
}

fn combine(r: Result<i32, i32>) -> i32 {
    match r {
        Ok(v) => v,
        Err(_) => -1,
    }
}

fn main() {
    let mut acc: i32 = 0;
    for i in 0..N {
        acc = (acc + combine(half((i + acc) & 0xffff))) & 0xffff;
    }
    println!("{}", acc);
}

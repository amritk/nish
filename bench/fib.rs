// Rust twin of fib.ts: same shape, same checksum line. Release builds wrap on
// overflow (like Nish); fib(40) does not overflow an i32 anyway.
const N: i32 = 40; // bench:n

fn fib(n: i32) -> i32 {
    if n < 2 {
        return n;
    }
    fib(n - 1) + fib(n - 2)
}

fn main() {
    println!("{}", fib(N));
}

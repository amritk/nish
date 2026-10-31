// The integer and enum rows of main.ts, with the same keys, probe order and
// checksums, from Rust's `HashMap` under rustc's `FxHasher` (the
// `FxHashMap` of the rustc-hash crate, its hasher written out below): the
// unkeyed baseline run.mjs measures the Nish tables against.
//
//   fx [scale]

use std::collections::HashMap;
use std::hash::{BuildHasherDefault, Hasher};
use std::hint::black_box;
use std::time::Instant;

/// rustc-hash's `FxHasher`: a rotate, an XOR and a multiply per word.
#[derive(Default, Clone, Copy)]
struct FxHasher {
    hash: u64,
}

const SEED: u64 = 0x51_7c_c1_b7_27_22_0a_95;

impl FxHasher {
    #[inline]
    fn add(&mut self, word: u64) {
        self.hash = (self.hash.rotate_left(5) ^ word).wrapping_mul(SEED);
    }
}

impl Hasher for FxHasher {
    #[inline]
    fn write(&mut self, bytes: &[u8]) {
        for b in bytes {
            self.add(*b as u64);
        }
    }
    #[inline]
    fn write_u32(&mut self, i: u32) {
        self.add(i as u64);
    }
    #[inline]
    fn write_u64(&mut self, i: u64) {
        self.add(i);
    }
    #[inline]
    fn write_isize(&mut self, i: isize) {
        self.add(i as u64);
    }
    #[inline]
    fn finish(&self) -> u64 {
        self.hash
    }
}

type FxMap<K, V> = HashMap<K, V, BuildHasherDefault<FxHasher>>;

#[derive(Clone, Copy, PartialEq, Eq, Hash)]
#[repr(i32)]
enum Op {
    Add, Sub, Mul, Div, Mod, And, Or, Xor, Shl, Shr, Eq, Ne, Lt, Le, Gt, Ge,
}

const OPS: [Op; 16] = [
    Op::Add, Op::Sub, Op::Mul, Op::Div, Op::Mod, Op::And, Op::Or, Op::Xor,
    Op::Shl, Op::Shr, Op::Eq, Op::Ne, Op::Lt, Op::Le, Op::Gt, Op::Ge,
];

const SIZES: [i32; 3] = [1024, 65536, 8388608];
const LEVELS: [&str; 3] = ["L1", "L2", "L3+"];

#[inline]
fn step(x: u32) -> u32 {
    x.wrapping_mul(1664525).wrapping_add(1013904223)
}

#[inline]
fn key_i32(i: i32) -> i32 {
    i.wrapping_mul(7919)
}

#[inline]
fn key_i64(i: i32, miss: bool) -> i64 {
    let hi = if miss { -1 - (i >> 10) } else { i >> 10 };
    ((hi as i64) << 32) + ((i & 1023) - 512) as i64
}

fn report(row: String, ns: u128, ops: i32, sum: i32) {
    println!("{row} {ns} {ops} {sum}");
}

/// The rows of one integer key type, `key(i, miss)` its `i`th key.
fn rows<K: Copy + Eq + std::hash::Hash>(
    name: &str,
    level: &str,
    size: i32,
    total: i32,
    key: impl Fn(i32, bool) -> K,
) {
    let reps = if total > size { total / size } else { 1 };
    let ops = reps * size;
    let mask = size - 1;
    let mut m: FxMap<K, i32> = FxMap::default();
    for i in 0..size {
        m.insert(key(i, false), i);
    }
    let mut sum: i32 = 0;
    let mut x: u32 = 12345;
    let started = Instant::now();
    for _ in 0..ops {
        x = step(x);
        sum = sum.wrapping_add(*m.get(&key((x >> 8) as i32 & mask, false)).unwrap_or(&0));
    }
    report(format!("{name}-hit-{level}"), started.elapsed().as_nanos(), ops, sum);
    sum = 0;
    let started = Instant::now();
    for _ in 0..ops {
        x = step(x);
        sum = sum.wrapping_add(*m.get(&key((x >> 8) as i32 & mask, true)).unwrap_or(&1));
    }
    report(format!("{name}-miss-{level}"), started.elapsed().as_nanos(), ops, sum);
    let started = Instant::now();
    for r in 0..reps {
        m.clear();
        for i in 0..size {
            m.insert(key(i, false), i ^ r);
        }
        black_box(&m);
    }
    let ns = started.elapsed().as_nanos();
    let last = *m.get(&key(size - 1, false)).unwrap_or(&0);
    report(format!("{name}-insert-{level}"), ns, ops, (m.len() as i32).wrapping_add(last));
}

fn rows_enum(total: i32) {
    let ops = black_box(OPS);
    let mut all: FxMap<Op, i32> = FxMap::default();
    let mut half: FxMap<Op, i32> = FxMap::default();
    for i in 0..16 {
        all.insert(ops[i], i as i32);
        if i < 8 {
            half.insert(ops[i], i as i32);
        }
    }
    let mut sum: i32 = 0;
    let mut x: u32 = 12345;
    let started = Instant::now();
    for _ in 0..total {
        x = step(x);
        sum = sum.wrapping_add(*all.get(&ops[((x >> 8) & 15) as usize]).unwrap_or(&0));
    }
    report("enum-hit-L1".into(), started.elapsed().as_nanos(), total, sum);
    sum = 0;
    let started = Instant::now();
    for _ in 0..total {
        x = step(x);
        sum = sum.wrapping_add(*half.get(&ops[(((x >> 8) & 7) + 8) as usize]).unwrap_or(&1));
    }
    report("enum-miss-L1".into(), started.elapsed().as_nanos(), total, sum);
    let reps = total / 16;
    let started = Instant::now();
    for r in 0..reps {
        all.clear();
        for i in 0..16 {
            all.insert(ops[i], i as i32 ^ r);
        }
        black_box(&all);
    }
    let ns = started.elapsed().as_nanos();
    let last = *all.get(&Op::Ge).unwrap_or(&0);
    report("enum-insert-L1".into(), ns, reps * 16, (all.len() as i32).wrapping_add(last));
}

fn main() {
    let scale: i32 = std::env::args().nth(1).map_or(1, |s| s.parse().unwrap());
    let total = scale * 8388608;
    for s in 0..SIZES.len() {
        rows("i32", LEVELS[s], SIZES[s], total, |i, miss| key_i32(if miss { i + SIZES[s] } else { i }));
        rows("i64", LEVELS[s], SIZES[s], total, key_i64);
    }
    rows_enum(total);
}

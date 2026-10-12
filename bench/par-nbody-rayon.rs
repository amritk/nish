// Rust twin of par-nbody.ts with Rayon: 1024 bodies, 16 steps, each step one
// `par_iter_mut` over 3n probes (one per body and axis) on Rayon's global
// pool. The bodies are read and never written inside the map; the step that
// moves them runs on one thread afterwards. Every sum is taken in the order
// the Nish program takes it, so the energies agree to the last bit.
use rayon::prelude::*;

const N: usize = 1024; // bench:n
const STEPS: usize = 16;
const SOFTENING: f64 = 0.01;

struct Body {
    x: f64,
    y: f64,
    z: f64,
    vx: f64,
    vy: f64,
    vz: f64,
    mass: f64,
}

/// Body `k / 3`'s acceleration along axis `k % 3`.
fn accel(bodies: &[Body], k: usize) -> f64 {
    let bi = &bodies[k / 3];
    let axis = k % 3;
    let mut a = 0.0f64;
    for bj in bodies {
        let dx = bj.x - bi.x;
        let dy = bj.y - bi.y;
        let dz = bj.z - bi.z;
        let d2 = dx * dx + dy * dy + dz * dz + SOFTENING;
        let inv = bj.mass / (d2 * d2.sqrt());
        let d = if axis == 0 {
            dx
        } else if axis == 1 {
            dy
        } else {
            dz
        };
        a += d * inv;
    }
    a
}

fn energy(bodies: &[Body]) -> f64 {
    let mut e = 0.0f64;
    for i in 0..bodies.len() {
        let bi = &bodies[i];
        e += 0.5 * bi.mass * (bi.vx * bi.vx + bi.vy * bi.vy + bi.vz * bi.vz);
        for bj in &bodies[i + 1..] {
            let dx = bi.x - bj.x;
            let dy = bi.y - bj.y;
            let dz = bi.z - bj.z;
            e -= (bi.mass * bj.mass) / (dx * dx + dy * dy + dz * dz + SOFTENING).sqrt();
        }
    }
    e
}

fn main() {
    let dt = 0.001f64;
    let mut bodies: Vec<Body> = Vec::with_capacity(N);
    let mut seed = 0.5f64;
    for _ in 0..N {
        // A fixed pseudo-random cloud, the same on every run and in every language.
        seed = seed * 3.9 * (1.0 - seed);
        let x = seed * 10.0;
        seed = seed * 3.9 * (1.0 - seed);
        let y = seed * 10.0;
        seed = seed * 3.9 * (1.0 - seed);
        let z = seed * 10.0;
        bodies.push(Body { x, y, z, vx: 0.0, vy: 0.0, vz: 0.0, mass: 1.0 + seed });
    }
    let mut acc = vec![0.0f64; 3 * N];
    println!("{}", energy(&bodies));
    for _ in 0..STEPS {
        let shared = &bodies;
        acc.par_iter_mut().enumerate().for_each(|(k, slot)| *slot = accel(shared, k));
        for (i, b) in bodies.iter_mut().enumerate() {
            b.vx += dt * acc[3 * i];
            b.vy += dt * acc[3 * i + 1];
            b.vz += dt * acc[3 * i + 2];
        }
        for b in bodies.iter_mut() {
            b.x += dt * b.vx;
            b.y += dt * b.vy;
            b.z += dt * b.vz;
        }
    }
    println!("{}", energy(&bodies));
}

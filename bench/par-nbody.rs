// Rust twin of par-nbody.ts with `std::thread::scope`: 1024 bodies, 16 steps,
// each step one map over 3n probes (one per body and axis) cut into one
// contiguous chunk per core, the first run on the calling thread. The bodies
// are a Vec<Body> read and never written inside the map; the step that moves
// them runs on one thread afterwards. Every sum is taken in the order the Nish
// program takes it, so the energies agree to the last bit.
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
    let threads = threads();
    let chunk = acc.len().div_ceil(threads);
    println!("{}", energy(&bodies));
    for _ in 0..STEPS {
        let shared = &bodies;
        std::thread::scope(|s| {
            let mut parts = acc.chunks_mut(chunk).enumerate();
            let first = parts.next();
            for (c, part) in parts {
                s.spawn(move || {
                    for (o, slot) in part.iter_mut().enumerate() {
                        *slot = accel(shared, c * chunk + o);
                    }
                });
            }
            if let Some((_, part)) = first {
                for (o, slot) in part.iter_mut().enumerate() {
                    *slot = accel(shared, o);
                }
            }
        });
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

// Rust twin of nbody.ts: same struct, same expression order. The bodies live
// in a Vec<Body> indexed by i32-as-usize, as the StaticTS array is; the
// idiomatic `[Body; 5]` would let LLVM drop every bounds check up front.
const N: i32 = 20000000; // bench:n

struct Body {
    x: f64,
    y: f64,
    z: f64,
    vx: f64,
    vy: f64,
    vz: f64,
    mass: f64,
}

fn advance(bodies: &mut Vec<Body>, n: i32, dt: f64) {
    for i in 0..n {
        for j in (i + 1)..n {
            let (bi, bj) = {
                let (lo, hi) = bodies.split_at_mut(j as usize);
                (&mut lo[i as usize], &mut hi[0])
            };
            let dx = bi.x - bj.x;
            let dy = bi.y - bj.y;
            let dz = bi.z - bj.z;
            let d2 = dx * dx + dy * dy + dz * dz;
            let mag = dt / (d2 * d2.sqrt());
            bi.vx = bi.vx - dx * bj.mass * mag;
            bi.vy = bi.vy - dy * bj.mass * mag;
            bi.vz = bi.vz - dz * bj.mass * mag;
            bj.vx = bj.vx + dx * bi.mass * mag;
            bj.vy = bj.vy + dy * bi.mass * mag;
            bj.vz = bj.vz + dz * bi.mass * mag;
        }
    }
    for i in 0..n {
        let b = &mut bodies[i as usize];
        b.x = b.x + dt * b.vx;
        b.y = b.y + dt * b.vy;
        b.z = b.z + dt * b.vz;
    }
}

fn energy(bodies: &Vec<Body>, n: i32) -> f64 {
    let mut e = 0.0;
    for i in 0..n {
        let bi = &bodies[i as usize];
        e = e + 0.5 * bi.mass * (bi.vx * bi.vx + bi.vy * bi.vy + bi.vz * bi.vz);
        for j in (i + 1)..n {
            let bj = &bodies[j as usize];
            let dx = bi.x - bj.x;
            let dy = bi.y - bj.y;
            let dz = bi.z - bj.z;
            e = e - (bi.mass * bj.mass) / (dx * dx + dy * dy + dz * dz).sqrt();
        }
    }
    e
}

fn body(x: f64, y: f64, z: f64, vx: f64, vy: f64, vz: f64, mass: f64) -> Body {
    Body { x, y, z, vx, vy, vz, mass }
}

fn main() {
    let pi: f64 = 3.141592653589793;
    let solar_mass = 4.0 * pi * pi;
    let days = 365.24;
    let mut bodies: Vec<Body> = vec![
        body(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, solar_mass),
        body(4.8414314424647209, -1.16032004402742839, -0.103622044471123109, 0.00166007664274403694 * days, 0.00769901118419740425 * days, -0.0000690460016972063023 * days, 0.000954791938424326609 * solar_mass),
        body(8.34336671824457987, 4.12479856412430479, -0.403523417114321381, -0.00276742510726862411 * days, 0.00499852801234917238 * days, 0.0000230417297573763929 * days, 0.000285885980666130812 * solar_mass),
        body(12.894369562139131, -15.1111514016986312, -0.223307578892655734, 0.00296460137564761618 * days, 0.0023784717395948095 * days, -0.0000296589568540237556 * days, 0.0000436624404335156298 * solar_mass),
        body(15.3796971148509165, -25.9193146099879641, 0.179258772950371181, 0.00268067772490389322 * days, 0.00162824170038242295 * days, -0.000095159225451971587 * days, 0.0000515138902046611451 * solar_mass),
    ];
    let n: i32 = 5;
    let (mut px, mut py, mut pz) = (0.0, 0.0, 0.0);
    for i in 0..n as usize {
        px = px + bodies[i].vx * bodies[i].mass;
        py = py + bodies[i].vy * bodies[i].mass;
        pz = pz + bodies[i].vz * bodies[i].mass;
    }
    bodies[0].vx = -px / solar_mass;
    bodies[0].vy = -py / solar_mass;
    bodies[0].vz = -pz / solar_mass;
    println!("{}", energy(&bodies, n));
    for _ in 0..N {
        advance(&mut bodies, n, 0.01);
    }
    println!("{}", energy(&bodies, n));
}

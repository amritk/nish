// Rust twin of spectral.ts: same loops and evaluation order, Vec<f64> indexed
// by i32-as-usize (bounds-checked, as in AmritScript).
const N: i32 = 3000; // bench:n

fn a(i: i32, j: i32) -> f64 {
    let ij = i + j;
    1.0 / ((ij * (ij + 1) / 2 + i + 1) as f64)
}

fn mul_av(n: i32, v: &[f64], av: &mut [f64]) {
    for i in 0..n {
        let mut s = 0.0;
        for j in 0..n {
            s = s + a(i, j) * v[j as usize];
        }
        av[i as usize] = s;
    }
}

fn mul_atv(n: i32, v: &[f64], atv: &mut [f64]) {
    for i in 0..n {
        let mut s = 0.0;
        for j in 0..n {
            s = s + a(j, i) * v[j as usize];
        }
        atv[i as usize] = s;
    }
}

fn mul_at_av(n: i32, v: &[f64], out: &mut [f64], tmp: &mut [f64]) {
    mul_av(n, v, tmp);
    mul_atv(n, tmp, out);
}

fn main() {
    let n = N;
    let mut u = vec![0.0f64; n as usize];
    let mut v = vec![0.0f64; n as usize];
    let mut tmp = vec![0.0f64; n as usize];
    for i in 0..n {
        u[i as usize] = 1.0;
    }
    for _ in 0..10 {
        mul_at_av(n, &u, &mut v, &mut tmp);
        mul_at_av(n, &v, &mut u, &mut tmp);
    }
    let (mut v_bv, mut vv) = (0.0, 0.0);
    for i in 0..n as usize {
        v_bv = v_bv + u[i] * v[i];
        vv = vv + v[i] * v[i];
    }
    println!("{}", (v_bv / vv).sqrt());
}

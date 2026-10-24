// Rust twin of math.ts: the same tables, the same loops, the same lines.
// f64::min and f64::max drop a NaN operand and leave the sign of a zero to
// chance, and f64::round rounds half away from zero, so js_min, js_max and
// js_round spell out JavaScript's answers; tan, atan2 and hypot are libm's.

const N: i32 = 20000000; // bench:n
const SIZE: usize = 4096;

const SPECIALS: [f64; 16] = [
    f64::NAN, 0.0, -0.0, 0.5, -0.5, 2.5, -2.5, f64::INFINITY, f64::NEG_INFINITY,
    0.49999999999999994, -0.49999999999999994, 4503599627370497.0, 1e300, -1e-300, 3.0, -7.0,
];

fn mix(h: i32, b: i32) -> i32 {
    (h ^ b).wrapping_mul(16777619)
}

fn bits(r: f64) -> i32 {
    if r != r {
        2143289344
    } else {
        (r as f32).to_bits() as i32
    }
}

fn js_round(x: f64) -> f64 {
    let mut r = x.floor();
    if x - r >= 0.5 {
        r = r + 1.0;
    }
    r.copysign(x)
}

fn js_min(a: f64, b: f64) -> f64 {
    if a != a || b != b {
        return f64::NAN;
    }
    if a == b {
        return if a.is_sign_negative() { a } else { b };
    }
    if a < b { a } else { b }
}

fn js_max(a: f64, b: f64) -> f64 {
    if a != a || b != b {
        return f64::NAN;
    }
    if a == b {
        return if a.is_sign_negative() { b } else { a };
    }
    if a > b { a } else { b }
}

fn js_sign(x: f64) -> f64 {
    if x > 0.0 {
        1.0
    } else if x < 0.0 {
        -1.0
    } else {
        x
    }
}

fn int_sign(x: i32) -> i32 {
    (x > 0) as i32 - (x < 0) as i32
}

fn main() {
    let only = std::env::args().nth(1).unwrap_or_default();
    let wanted = |name: &str| only.is_empty() || only == name;
    let mut xs = [0.0f64; SIZE];
    let mut is = [0i32; SIZE];
    let mut s: u32 = 1013904223;
    for j in 0..SIZE {
        s ^= s << 13;
        s ^= s >> 17;
        s ^= s << 5;
        is[j] = s as i32;
        xs[j] = if j & 15 == 0 { SPECIALS[(j >> 4) & 15] } else { (s as i32) as f64 / 65536.0 };
    }

    if wanted("atan2") {
        let mut h: i32 = -2128831035;
        for i in 0..N {
            h = mix(h, bits(xs[(i & 4095) as usize].atan2(xs[((i + 1237) & 4095) as usize])));
        }
        println!("atan2 {}", h);
    }
    if wanted("tan") {
        let mut h: i32 = -2128831035;
        for i in 0..N {
            h = mix(h, bits(xs[(i & 4095) as usize].tan()));
        }
        println!("tan {}", h);
    }
    if wanted("hypot") {
        let mut h: i32 = -2128831035;
        for i in 0..N {
            h = mix(h, bits(xs[(i & 4095) as usize].hypot(xs[((i + 1237) & 4095) as usize])));
        }
        println!("hypot {}", h);
    }
    if wanted("sign-int") {
        let mut h: i32 = -2128831035;
        for i in 0..8 * N {
            h = mix(h, int_sign(is[(i & 4095) as usize]));
        }
        println!("sign-int {}", h);
    }
    if wanted("sign-float") {
        let mut h: i32 = -2128831035;
        for i in 0..8 * N {
            h = mix(h, bits(js_sign(xs[(i & 4095) as usize])));
        }
        println!("sign-float {}", h);
    }
    if wanted("imul") {
        let mut h: i32 = -2128831035;
        for i in 0..8 * N {
            h = mix(h, is[(i & 4095) as usize].wrapping_mul(is[((i + 1237) & 4095) as usize]));
        }
        println!("imul {}", h);
    }
    if wanted("round") {
        let mut h: i32 = -2128831035;
        for i in 0..8 * N {
            h = mix(h, bits(js_round(xs[(i & 4095) as usize])));
        }
        println!("round {}", h);
    }
    if wanted("min") {
        let mut h: i32 = -2128831035;
        for i in 0..8 * N {
            h = mix(h, bits(js_min(xs[(i & 4095) as usize], xs[((i + 1237) & 4095) as usize])));
        }
        println!("min {}", h);
    }
    if wanted("max") {
        let mut h: i32 = -2128831035;
        for i in 0..8 * N {
            h = mix(h, bits(js_max(xs[(i & 4095) as usize], xs[((i + 1237) & 4095) as usize])));
        }
        println!("max {}", h);
    }
    if wanted("f32-to-bits") {
        let mut h: i32 = -2128831035;
        for i in 0..8 * N {
            h = mix(h, (xs[(i & 4095) as usize] as f32).to_bits() as i32);
        }
        println!("f32-to-bits {}", h);
    }
}

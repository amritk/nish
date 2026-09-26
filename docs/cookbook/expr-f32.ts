const blend = (a: f32, b: f32): f32 => (a + b) / b;

const narrow = (x: f64): f32 => toF32(x);

const widen = (x: f32): f64 => toF64(x);

const truncate = (x: f32): i32 => toI32(x);

const tenth = (): f32 => 0.1;

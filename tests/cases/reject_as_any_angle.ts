// `<any>x` is an assertion to `any`, which Phase 0 refuses as it does `x as any`.
export const run = (n: i32): i32 => <any>n + 1

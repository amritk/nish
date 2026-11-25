declare function scale(dst: f32[], src: readonly f32[], n: u64): void

export const main = (): i32 => {
  const src: f32[] = [1.5, -2.0, 4.0]
  const dst: f32[] = [0.0, 0.0, 0.0]
  scale(dst, src, 2)
  return 0
}

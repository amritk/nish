class P { v: i32 = 1; }
const f = (xs: i32[]): i32 => { const ps: P[] = [new P()]; const first = ps[0]; ps.push(new P()); ps[0].v = 9; return first.v + xs[0]; };
export const main = (): i32 => { console.log(`${f([1, 2])}`); return 0; };

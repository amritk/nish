// The edge values of `std/math.ts`'s `Math.atan2`, `Math.tan` and `Math.hypot`,
// each as JavaScript answers it: signed zeros (shown through `1 / r`), NaN, every
// pairing of infinities, `tan` beside multiples of pi/2 and past 2^20 * pi/2, and
// `hypot` where the squares would overflow or underflow.
const show = (label: string, r: f64): void => {
  console.log(`${label} ${r} ${toF64(1) / r}`);
};

export const main = (): i32 => {
  const one = toF64(1);
  const zero = toF64(0);
  const inf = one / zero;
  const nan = zero / zero;
  const big = toF64(1e300);
  const tiny = toF64(5e-324);
  const halfPi = toF64(1.5707963267948966);

  show("atan2(+0,+0)", Math.atan2(zero, zero));
  show("atan2(-0,+0)", Math.atan2(-zero, zero));
  show("atan2(+0,-0)", Math.atan2(zero, -zero));
  show("atan2(-0,-0)", Math.atan2(-zero, -zero));
  show("atan2(+0,-1)", Math.atan2(zero, -one));
  show("atan2(-0,-1)", Math.atan2(-zero, -one));
  show("atan2(+0,1)", Math.atan2(zero, one));
  show("atan2(-0,1)", Math.atan2(-zero, one));
  show("atan2(1,+0)", Math.atan2(one, zero));
  show("atan2(-1,-0)", Math.atan2(-one, -zero));
  show("atan2(inf,inf)", Math.atan2(inf, inf));
  show("atan2(inf,-inf)", Math.atan2(inf, -inf));
  show("atan2(-inf,inf)", Math.atan2(-inf, inf));
  show("atan2(-inf,-inf)", Math.atan2(-inf, -inf));
  show("atan2(1,inf)", Math.atan2(one, inf));
  show("atan2(-1,inf)", Math.atan2(-one, inf));
  show("atan2(1,-inf)", Math.atan2(one, -inf));
  show("atan2(-1,-inf)", Math.atan2(-one, -inf));
  show("atan2(inf,1)", Math.atan2(inf, one));
  show("atan2(-inf,-1)", Math.atan2(-inf, -one));
  show("atan2(nan,1)", Math.atan2(nan, one));
  show("atan2(1,nan)", Math.atan2(one, nan));
  show("atan2(inf,nan)", Math.atan2(inf, nan));
  show("atan2(big,tiny)", Math.atan2(big, tiny));
  show("atan2(tiny,-big)", Math.atan2(tiny, -big));
  show("atan2(1,3)", Math.atan2(one, toF64(3)));
  show("atan2(-7,-2)", Math.atan2(toF64(-7), toF64(-2)));

  show("tan(+0)", Math.tan(zero));
  show("tan(-0)", Math.tan(-zero));
  show("tan(tiny)", Math.tan(tiny));
  show("tan(inf)", Math.tan(inf));
  show("tan(-inf)", Math.tan(-inf));
  show("tan(nan)", Math.tan(nan));
  show("tan(pi/2)", Math.tan(halfPi));
  show("tan(-pi/2)", Math.tan(-halfPi));
  show("tan(3pi/2)", Math.tan(toF64(4.71238898038469)));
  show("tan(pi)", Math.tan(toF64(3.141592653589793)));
  show("tan(1e6)", Math.tan(toF64(1e6)));
  show("tan(1647099)", Math.tan(toF64(1647099)));
  show("tan(1e22)", Math.tan(toF64(1e22)));
  show("tan(-1e22)", Math.tan(toF64(-1e22)));
  show("tan(1e300)", Math.tan(big));
  show("tan(max)", Math.tan(toF64(1.7976931348623157e308)));
  show("tan(6381956970095103*2^797)", Math.tan(toF64(5.319372648326541e255)));

  show("hypot(3,4)", Math.hypot(toF64(3), toF64(4)));
  show("hypot(-0,-0)", Math.hypot(-zero, -zero));
  show("hypot(inf,nan)", Math.hypot(inf, nan));
  show("hypot(nan,-inf)", Math.hypot(nan, -inf));
  show("hypot(nan,1)", Math.hypot(nan, one));
  show("hypot(big,big)", Math.hypot(big, big));
  show("hypot(max,max)", Math.hypot(toF64(1.7976931348623157e308), toF64(1.7976931348623157e308)));
  show("hypot(tiny,tiny)", Math.hypot(tiny, tiny));
  show("hypot(3e-320,4e-320)", Math.hypot(toF64(3e-320), toF64(4e-320)));
  show("hypot(1e-200,1e-200)", Math.hypot(toF64(1e-200), toF64(1e-200)));
  show("hypot(1,1e-17)", Math.hypot(one, toF64(1e-17)));
  show("hypot(-5,0)", Math.hypot(toF64(-5), zero));
  return 0;
};

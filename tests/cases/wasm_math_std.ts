// `nish/math`'s fdlibm-derived functions, which a page module's `Math.sin`, `cos`,
// `exp`, `log`, `pow` and float `%` call, imported by name and run natively. Each
// line is what JavaScript's `Math` and `%` print for the same arguments.
import { cosF64, expF64, fmodF64, logF64, powF64, sinF64 } from "nish/math"

export const main = (): i32 => {
  const zero = toF64(0)
  const one = toF64(1)
  const two = toF64(2)
  const half = one / two
  console.log(`${sinF64(zero)} ${sinF64(half)} ${sinF64(-two)} ${sinF64(one / zero)}`)
  console.log(`${cosF64(zero)} ${cosF64(half)} ${cosF64(toF64(1e22))}`)
  console.log(`${expF64(zero)} ${expF64(-one)} ${expF64(toF64(710))} ${expF64(toF64(-746))}`)
  console.log(`${logF64(one)} ${logF64(two)} ${logF64(zero)} ${logF64(-one)}`)
  console.log(`${powF64(two, toF64(10))} ${powF64(two, half)} ${powF64(-two, toF64(3))} ${powF64(zero, -one)}`)
  console.log(`${fmodF64(toF64(7), two)} ${fmodF64(toF64(-7.5), two)} ${fmodF64(one, zero)} ${fmodF64(toF64(1e300), toF64(7))}`)
  return 0
}

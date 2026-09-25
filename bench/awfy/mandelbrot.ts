// This code is derived from the SOM benchmarks, see AUTHORS.md file.
// Ported to Nish from the JavaScript version; licensed as LICENSE.md.
// The kernel itself is the Computer Language Benchmarks Game program, under
// the Revised BSD licence reproduced with its copyright notice in LICENSE.md.

export class Mandelbrot {
  innerBenchmarkLoop(innerIterations: i32): boolean {
    return this.verifyResult(this.mandelbrot(innerIterations), innerIterations);
  }

  verifyResult(result: i32, innerIterations: i32): boolean {
    if (innerIterations === 500) {
      return result === 191;
    }
    if (innerIterations === 750) {
      return result === 50;
    }
    if (innerIterations === 1) {
      return result === 128;
    }

    console.log(`No verification result for ${innerIterations} found`);
    console.log(`Result is: ${result}`);
    return false;
  }

  mandelbrot(size: i32): i32 {
    let sum = 0;
    let byteAcc = 0;
    let bitNum = 0;

    let y = 0;
    const sizeF = toF64(size);

    while (y < size) {
      const ci: f64 = (2.0 * toF64(y)) / sizeF - 1.0;
      let x = 0;

      while (x < size) {
        let zrzr: f64 = 0.0;
        let zi: f64 = 0.0;
        let zizi: f64 = 0.0;
        const cr: f64 = (2.0 * toF64(x)) / sizeF - 1.5;

        let z = 0;
        let notDone = true;
        let escaped = 0;
        while (notDone && z < 50) {
          const zr: f64 = zrzr - zizi + cr;
          zi = 2.0 * zr * zi + ci;

          zrzr = zr * zr;
          zizi = zi * zi;

          if (zrzr + zizi > 4.0) {
            notDone = false;
            escaped = 1;
          }
          z += 1;
        }

        byteAcc = (byteAcc << 1) + escaped;
        bitNum += 1;

        if (bitNum === 8) {
          sum ^= byteAcc;
          byteAcc = 0;
          bitNum = 0;
        } else if (x === size - 1) {
          byteAcc <<= 8 - bitNum;
          sum ^= byteAcc;
          byteAcc = 0;
          bitNum = 0;
        }
        x += 1;
      }
      y += 1;
    }
    return sum;
  }
}

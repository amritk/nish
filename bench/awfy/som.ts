// This code is derived from the SOM benchmarks, see AUTHORS.md file.
// Ported to Nish from the JavaScript version; licensed as LICENSE.md.

export class Random {
  seed: i32 = 74755;

  next(): i32 {
    this.seed = (this.seed * 1309 + 13849) & 65535;
    return this.seed;
  }
}

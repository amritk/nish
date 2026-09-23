// The other module of the NL3022, NL3024 and NL3026 cases: each of them
// declares one of these names again. It is not a case itself, and neither is
// anything under `node_modules/`, the three packages the NL3023, NL3025 and
// NL3027 cases import: `tests/diagnostic_coverage.js` collects only the files
// directly in `tests/wordings/` that are named for the code they pin.
export class Base {
  x: i32 = 0;

  constructor(x: i32) {
    this.x = x;
  }
}

export const twice = (x: i32): i32 => x * 2;

const hidden = (): i32 => 3;

export const anchor = (): i32 => hidden();

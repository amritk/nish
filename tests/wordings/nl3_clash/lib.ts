// The other module of the NL3024, NL3026 and NL3028 cases: each of them
// declares one of these names again. It is not a case itself, and neither is
// anything under `node_modules/`, the two packages the NL3025 and NL3027 cases
// import: `tests/diagnostic_coverage.js` collects only the files directly in
// `tests/wordings/` that are named for the code they pin.
export class Base {
  x: i32 = 0;

  constructor(x: i32) {
    this.x = x;
  }
}

export const twice = (x: i32): i32 => x * 2;

const hidden = (): i32 => 3;

export const anchor = (): i32 => hidden();

// A decorator on a member and one on a parameter: both are the one rule
// (NL1006), and Phase 0 ends the module at the first.
class Service {
  @logged
  run(@inject x: i32): i32 {
    return x
  }
}

export const main = (): i32 => 0

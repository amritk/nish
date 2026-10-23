// WP40 H1.1, Row 35: more dispose bodies that are close to one of the two
// shapes (§4b) but run something besides the one close. A file of their own
// keeps each case's refusals under the twenty a compile prints.
declare function opendir(path: string): CPtr
declare function closedir(p: CPtr): i32
declare function closeNullable(p: CPtr | null): i32
declare function closeNothing(): i32
const LIMIT: i32 = 3

// a valid handle class whose pointer another dispose reaches for
class Open {
  readonly f: CPtr
  constructor(path: string) {
    this.f = opendir(path)
  }
  [Symbol.dispose](): void {
    closedir(this.f)
  }
}
// a `void` with a type argument
class VoidArgument {
  readonly f: CPtr
  constructor(path: string) {
    this.f = opendir(path)
  }
  [Symbol.dispose](): void<i32> {
    closedir(this.f)
  }
}

// a close called with no argument
class NoArgument {
  readonly f: CPtr
  constructor(path: string) {
    this.f = opendir(path)
  }
  [Symbol.dispose](): void {
    closeNothing()
  }
}

// the tested `const` compared rather than closed
class NotAClose {
  readonly f: CPtr | null
  constructor(path: string) {
    this.f = opendir(path)
  }
  [Symbol.dispose](): void {
    const p = this.f
    if (p !== null) {
      p === (p)
    }
  }
}

// a third statement after the close
class ThreeStatements {
  readonly f: CPtr | null
  constructor(path: string) {
    this.f = opendir(path)
  }
  [Symbol.dispose](): void {
    const p = this.f
    if (p !== null) {
      closeNullable(p)
    }
    closeNothing()
  }
}

// the `const` closed without its test
class Untested {
  readonly f: CPtr | null
  constructor(path: string) {
    this.f = opendir(path)
  }
  [Symbol.dispose](): void {
    const p = this.f
    closeNullable(p)
  }
}

// a test of a module constant
class ConstantTest {
  readonly f: CPtr | null
  constructor(path: string) {
    this.f = opendir(path)
  }
  [Symbol.dispose](): void {
    const p = this.f
    if (LIMIT !== null) {
      closeNullable(p)
    }
  }
}

// `p === null`
class EqualsNull {
  readonly f: CPtr | null
  constructor(path: string) {
    this.f = opendir(path)
  }
  [Symbol.dispose](): void {
    const p = this.f
    if (p === null) {
      closeNullable(p)
    }
  }
}

// the field tested in place of the `const`
class FieldTested {
  readonly f: CPtr | null
  constructor(path: string) {
    this.f = opendir(path)
  }
  [Symbol.dispose](): void {
    const p = this.f
    if (this.f !== null) {
      closeNullable(p)
    }
  }
}

// a close of nothing inside the test
class NoArgumentInIf {
  readonly f: CPtr | null
  constructor(path: string) {
    this.f = opendir(path)
  }
  [Symbol.dispose](): void {
    const p = this.f
    if (p !== null) {
      closeNothing()
    }
  }
}

// the field closed in place of the tested `const`
class FieldClosed {
  readonly f: CPtr | null
  constructor(path: string) {
    this.f = opendir(path)
  }
  [Symbol.dispose](): void {
    const p = this.f
    if (p !== null) {
      closeNullable(this.f)
    }
  }
}

// another handle's pointer
class OtherHandle {
  readonly f: CPtr
  constructor(path: string) {
    this.f = opendir(path)
  }
  [Symbol.dispose](): void {
    closedir(new Open(".").f)
  }
}

// a `const` bound to `null`
class BoundToNull {
  readonly f: CPtr | null
  constructor(path: string) {
    this.f = opendir(path)
  }
  [Symbol.dispose](): void {
    const p = null
    if (p !== null) {
      closeNullable(p)
    }
  }
}

// a parenthesised callee
class ParenCallee {
  readonly f: CPtr
  constructor(path: string) {
    this.f = opendir(path)
  }
  [Symbol.dispose](): void {
    (closedir)(this.f)
  }
}

// the field tested in place of a `const` that shares its name
class SameNameTested {
  readonly f: CPtr | null
  constructor(path: string) {
    this.f = opendir(path)
  }
  [Symbol.dispose](): void {
    const f = this.f
    if (this.f !== null) {
      closeNullable(f)
    }
  }
}

// the field closed in place of a `const` that shares its name
class SameNameClosed {
  readonly f: CPtr | null
  constructor(path: string) {
    this.f = opendir(path)
  }
  [Symbol.dispose](): void {
    const f = this.f
    if (f !== null) {
      closeNullable(this.f)
    }
  }
}

export const main = (): i32 => 0

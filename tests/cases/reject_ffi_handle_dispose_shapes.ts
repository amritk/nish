// WP40 H1.1, Row 35: each class's dispose breaks one rule of the two shapes
// (§4b), so the `using` block would run something besides the one close.
declare function fopen(path: string, mode: string): CPtr | null
declare function opendir(path: string): CPtr
declare function fclose(p: CPtr): i32
declare function closedir(p: CPtr): i32
declare function close2(p: CPtr, n: i32): i32

// a parameter
class TakesParam {
  readonly f: CPtr
  constructor(path: string) {
    this.f = opendir(path)
  }
  [Symbol.dispose](n: i32): void {
    closedir(this.f)
  }
}

// a return type other than `void`
class ReturnsValue {
  readonly f: CPtr
  constructor(path: string) {
    this.f = opendir(path)
  }
  [Symbol.dispose](): i32 {
    closedir(this.f)
  }
}

// a close of something other than the field
class OtherArgument {
  readonly f: CPtr
  constructor(path: string) {
    this.f = opendir(path)
  }
  [Symbol.dispose](): void {
    closedir(opendir("."))
  }
}

// the close not written as a call statement
class NotACall {
  readonly f: CPtr
  constructor(path: string) {
    this.f = opendir(path)
  }
  [Symbol.dispose](): void {
    switch (closedir(this.f)) {
    }
  }
}

// the field bound by `let`
class LetBinding {
  readonly f: CPtr | null
  constructor(path: string) {
    this.f = fopen(path, "r")
  }
  [Symbol.dispose](): void {
    let p = this.f
    if (p !== null) {
      fclose(p)
    }
  }
}

// the field bound by `using`
class UsingBinding {
  readonly f: CPtr | null
  constructor(path: string) {
    this.f = fopen(path, "r")
  }
  [Symbol.dispose](): void {
    using p = this.f
    if (p !== null) {
      fclose(p)
    }
  }
}

// two declarators
class TwoDeclarators {
  readonly f: CPtr | null
  constructor(path: string) {
    this.f = fopen(path, "r")
  }
  [Symbol.dispose](): void {
    const p = this.f, q = this.f
    if (p !== null) {
      fclose(p)
    }
  }
}

// an annotated `const`
class Annotated {
  readonly f: CPtr | null
  constructor(path: string) {
    this.f = fopen(path, "r")
  }
  [Symbol.dispose](): void {
    const p: CPtr | null = this.f
    if (p !== null) {
      fclose(p)
    }
  }
}

// a `const` that is not the field
class OtherPointer {
  readonly f: CPtr | null
  constructor(path: string) {
    this.f = fopen(path, "r")
  }
  [Symbol.dispose](): void {
    const p = fopen("other", "r")
    if (p !== null) {
      fclose(p)
    }
  }
}

// an `else`
class WithElse {
  readonly f: CPtr | null
  constructor(path: string) {
    this.f = fopen(path, "r")
  }
  [Symbol.dispose](): void {
    const p = this.f
    if (p !== null) {
      fclose(p)
    } else {
    }
  }
}

// a test that is not `p !== null`
class OtherTest {
  readonly f: CPtr | null
  constructor(path: string) {
    this.f = fopen(path, "r")
  }
  [Symbol.dispose](): void {
    const p = this.f
    if (p !== null && true) {
      fclose(p)
    }
  }
}

// `null !== p`
class NullFirst {
  readonly f: CPtr | null
  constructor(path: string) {
    this.f = fopen(path, "r")
  }
  [Symbol.dispose](): void {
    const p = this.f
    if (null !== p) {
      fclose(p)
    }
  }
}

// a test of another local
class OtherLocal {
  readonly f: CPtr | null
  constructor(path: string) {
    this.f = fopen(path, "r")
  }
  [Symbol.dispose](): void {
    const q = this.f
    const p = this.f
    if (q !== null) {
      fclose(q)
    }
  }
}

// `p !== p`
class SelfTest {
  readonly f: CPtr
  constructor(path: string) {
    this.f = opendir(path)
  }
  [Symbol.dispose](): void {
    const p = this.f
    if (p !== p) {
      closedir(p)
    }
  }
}

// the field closed inside the test
class FieldInIf {
  readonly f: CPtr
  constructor(path: string) {
    this.f = opendir(path)
  }
  [Symbol.dispose](): void {
    const p = this.f
    if (p !== null) {
      closedir(this.f)
    }
  }
}

// a close called with two arguments
class CallArity {
  readonly f: CPtr
  constructor(path: string) {
    this.f = opendir(path)
  }
  [Symbol.dispose](): void {
    closedir(this.f, 1)
  }
}

// a close declared with two parameters
class DeclaredArity {
  readonly f: CPtr
  constructor(path: string) {
    this.f = opendir(path)
  }
  [Symbol.dispose](): void {
    close2(this.f)
  }
}

export const main = (): i32 => 0

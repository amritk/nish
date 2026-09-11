// Fifteen classes with mixed field types. tests/layout/structs.c declares the
// same structs in C, asserts the sizes the compiler computes, and reads every
// field through the getters below to check each offset at run time. Every
// function here is part of that C ABI, so every one of them is exported: a
// non-exported function is `internal` by default and the C file could not
// reach it.

class A {
  a: number;
  constructor(a: number) {
    this.a = a;
  }
}

class B {
  a: number;
  b: f64;
  constructor(a: number, b: f64) {
    this.a = a;
    this.b = b;
  }
}

class C {
  a: f64;
  b: number;
  constructor(a: f64, b: number) {
    this.a = a;
    this.b = b;
  }
}

class D {
  a: boolean;
  b: number;
  c: boolean;
  constructor(a: boolean, b: number, c: boolean) {
    this.a = a;
    this.b = b;
    this.c = c;
  }
}

class E {
  a: boolean;
  b: boolean;
  c: boolean;
  constructor(a: boolean, b: boolean, c: boolean) {
    this.a = a;
    this.b = b;
    this.c = c;
  }
}

class F {
  a: string;
  b: number;
  constructor(a: string, b: number) {
    this.a = a;
    this.b = b;
  }
}

class G {
  a: number;
  b: string;
  c: boolean;
  d: f64;
  constructor(a: number, b: string, c: boolean, d: f64) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
  }
}

class H {
  a: boolean;
  b: A;
  c: number;
  constructor(a: boolean, b: A, c: number) {
    this.a = a;
    this.b = b;
    this.c = c;
  }
}

class I {
  a: number;
  b: number;
  c: number;
  d: boolean;
  constructor(a: number, b: number, c: number, d: boolean) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
  }
}

class J {
  a: boolean;
  b: f64;
  c: boolean;
  d: number;
  e: boolean;
  f: string;
  constructor(a: boolean, b: f64, c: boolean, d: number, e: boolean, f: string) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.e = e;
    this.f = f;
  }
}

// One allocation per class: tests/run.js reads `nish_alloc_struct(i64 N)` from each body.
// (f64 and struct arguments arrive as parameters: in i32 mode a literal is an i32.)
export function makeA(): A {
  return new A(1);
}
export function makeB(d: f64): B {
  return new B(1, d);
}
export function makeC(d: f64): C {
  return new C(d, 2);
}
export function makeD(): D {
  return new D(true, 1, false);
}
export function makeE(): E {
  return new E(true, false, true);
}
export function makeF(s: string): F {
  return new F(s, 1);
}
export function makeG(s: string, d: f64): G {
  return new G(1, s, true, d);
}
export function makeH(a: A): H {
  return new H(true, a, 1);
}
export function makeI(): I {
  return new I(1, 2, 3, true);
}
export function makeJ(s: string, d: f64): J {
  return new J(true, d, false, 2, true, s);
}

// Field getters: C fills each struct through its own definition and checks these.
export function A_a(p: A): number {
  return p.a;
}
export function B_a(p: B): number {
  return p.a;
}
export function B_b(p: B): f64 {
  return p.b;
}
export function C_a(p: C): f64 {
  return p.a;
}
export function C_b(p: C): number {
  return p.b;
}
export function D_a(p: D): boolean {
  return p.a;
}
export function D_b(p: D): number {
  return p.b;
}
export function D_c(p: D): boolean {
  return p.c;
}
export function E_a(p: E): boolean {
  return p.a;
}
export function E_b(p: E): boolean {
  return p.b;
}
export function E_c(p: E): boolean {
  return p.c;
}
export function F_a(p: F): string {
  return p.a;
}
export function F_b(p: F): number {
  return p.b;
}
export function G_a(p: G): number {
  return p.a;
}
export function G_b(p: G): string {
  return p.b;
}
export function G_c(p: G): boolean {
  return p.c;
}
export function G_d(p: G): f64 {
  return p.d;
}
export function H_a(p: H): boolean {
  return p.a;
}
export function H_b(p: H): A {
  return p.b;
}
export function H_c(p: H): number {
  return p.c;
}
export function I_a(p: I): number {
  return p.a;
}
export function I_b(p: I): number {
  return p.b;
}
export function I_c(p: I): number {
  return p.c;
}
export function I_d(p: I): boolean {
  return p.d;
}
export function J_a(p: J): boolean {
  return p.a;
}
export function J_b(p: J): f64 {
  return p.b;
}
export function J_c(p: J): boolean {
  return p.c;
}
export function J_d(p: J): number {
  return p.d;
}
export function J_e(p: J): boolean {
  return p.e;
}
export function J_f(p: J): string {
  return p.f;
}

// Derived classes (WP2b): the base's fields come first, then the class's own,
// so the C twin lists the flattened fields (not a nested struct: L's own field
// reuses C's tail padding, which `struct L { struct C c; int32_t c2; }` would not).
class K extends B {
  c: boolean;
  constructor(a: number, b: f64, c: boolean) {
    super(a, b);
    this.c = c;
  }
}

class L extends C {
  c: number;
  constructor(a: f64, b: number, c: number) {
    super(a, b);
    this.c = c;
  }
}

class M extends K {
  d: string;
  constructor(a: number, b: f64, c: boolean, d: string) {
    super(a, b, c);
    this.d = d;
  }
}

// WP15: the unsigned widths and `f32`, so the narrow ones are pinned against
// clang's padding rules too (`e` lands in the tail, not next to `a`).
class N {
  a: u8;
  b: u16;
  c: u32;
  d: u64;
  e: u8;
  constructor(a: u8, b: u16, c: u32, d: u64, e: u8) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = d;
    this.e = e;
  }
}

// WP15: `f32` next to an `f64`. `a` is 4 bytes, so `b` starts at 8 and `c`
// lands at 16 with the boolean after it: 24 bytes, where four `f64`s would
// have been 32.
class O {
  a: f32;
  b: f64;
  c: f32;
  d: boolean;
  constructor(a: f32, b: f64, c: f32) {
    this.a = a;
    this.b = b;
    this.c = c;
    this.d = true;
  }
}

export function makeK(d: f64): K {
  return new K(1, d, true);
}
export function makeL(d: f64): L {
  return new L(d, 2, 3);
}
export function makeM(s: string, d: f64): M {
  return new M(1, d, true, s);
}
export function makeN(d: u64): N {
  return new N(1, 2, 3, d, 4);
}
export function makeO(a: f32, b: f64): O {
  return new O(a, b, a);
}

export function K_a(p: K): number {
  return p.a;
}
export function K_b(p: K): f64 {
  return p.b;
}
export function K_c(p: K): boolean {
  return p.c;
}
export function L_a(p: L): f64 {
  return p.a;
}
export function L_b(p: L): number {
  return p.b;
}
export function L_c(p: L): number {
  return p.c;
}
export function M_a(p: M): number {
  return p.a;
}
export function M_b(p: M): f64 {
  return p.b;
}
export function M_c(p: M): boolean {
  return p.c;
}
export function M_d(p: M): string {
  return p.d;
}
// A derived object read through its base's getter: the prefix layout in action.
export function M_as_B_b(p: M): f64 {
  return B_b(p);
}
export function N_a(p: N): u8 {
  return p.a;
}
export function N_b(p: N): u16 {
  return p.b;
}
export function N_c(p: N): u32 {
  return p.c;
}
export function N_d(p: N): u64 {
  return p.d;
}
export function N_e(p: N): u8 {
  return p.e;
}
export function O_a(p: O): f32 {
  return p.a;
}
export function O_b(p: O): f64 {
  return p.b;
}
export function O_c(p: O): f32 {
  return p.c;
}
export function O_d(p: O): boolean {
  return p.d;
}

/* C twin of tests/layout/structs.ts.
 *
 * 1. The _Static_asserts pin each struct's size to what the compiler computes
 *    (tests/run.js cross-checks them against `nish_alloc_struct(i64 N)` in the
 *    IR), so both agree with clang's layout of the same fields.
 * 2. main() fills every struct through the C definition and reads each field
 *    back through the Nish getters, so every field offset is verified at
 *    run time as well. Any mismatch prints the field name and exits 1.
 */
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>

/* Nish strings are `{ uint64_t len; char data[]; }`; getters return the pointer. */
typedef const void *nish_string;
static const struct { uint64_t len; char data[4]; } str_abc = { 3, "abc" };
static const struct { uint64_t len; char data[6]; } str_hello = { 5, "hello" };

struct A { int32_t a; };
struct B { int32_t a; double b; };
struct C { double a; int32_t b; };
struct D { bool a; int32_t b; bool c; };
struct E { bool a; bool b; bool c; };
struct F { nish_string a; int32_t b; };
struct G { int32_t a; nish_string b; bool c; double d; };
struct H { bool a; struct A *b; int32_t c; };
struct I { int32_t a; int32_t b; int32_t c; bool d; };
struct J { bool a; double b; bool c; int32_t d; bool e; nish_string f; };
/* Derived classes (WP2b) list the base's fields first, flattened: no nested
 * struct, so L's own field lands in C's tail padding and sizeof(L) stays 16. */
struct K { int32_t a; double b; bool c; };                /* extends B */
struct L { double a; int32_t b; int32_t c; };             /* extends C */
struct M { int32_t a; double b; bool c; nish_string d; };  /* extends K */
/* WP15: the unsigned widths. `e` cannot share `a`'s slot, so it lands after
   `d` and the struct is 24 bytes, not 16. */
struct N { uint8_t a; uint16_t b; uint32_t c; uint64_t d; uint8_t e; };
/* WP15: an f32 beside an f64. `a` is 4 bytes so `b` starts at 8, `c` at 16
   and `d` at 20: 24 bytes, where four doubles would have been 32. */
struct O { float a; double b; float c; bool d; };
/* WP15 section 2a: a record element type, so a `P[]` is a C array of these. */
struct P { double x; double y; int32_t tag; };

_Static_assert(sizeof(struct A) == 4, "A");
_Static_assert(sizeof(struct B) == 16, "B");
_Static_assert(sizeof(struct C) == 16, "C");
_Static_assert(sizeof(struct D) == 12, "D");
_Static_assert(sizeof(struct E) == 3, "E");
_Static_assert(sizeof(struct F) == 16, "F");
_Static_assert(sizeof(struct G) == 32, "G");
_Static_assert(sizeof(struct H) == 24, "H");
_Static_assert(sizeof(struct I) == 16, "I");
_Static_assert(sizeof(struct J) == 40, "J");
_Static_assert(sizeof(struct K) == 24, "K");
_Static_assert(sizeof(struct L) == 16, "L");
_Static_assert(sizeof(struct M) == 32, "M");
_Static_assert(sizeof(struct N) == 24, "N");
_Static_assert(sizeof(struct O) == 24, "O");
_Static_assert(sizeof(struct P) == 24, "P");

int32_t A_a(struct A *);
int32_t B_a(struct B *);
double B_b(struct B *);
double C_a(struct C *);
int32_t C_b(struct C *);
bool D_a(struct D *);
int32_t D_b(struct D *);
bool D_c(struct D *);
bool E_a(struct E *);
bool E_b(struct E *);
bool E_c(struct E *);
nish_string F_a(struct F *);
int32_t F_b(struct F *);
int32_t G_a(struct G *);
nish_string G_b(struct G *);
bool G_c(struct G *);
double G_d(struct G *);
bool H_a(struct H *);
struct A *H_b(struct H *);
int32_t H_c(struct H *);
int32_t I_a(struct I *);
int32_t I_b(struct I *);
int32_t I_c(struct I *);
bool I_d(struct I *);
bool J_a(struct J *);
double J_b(struct J *);
bool J_c(struct J *);
int32_t J_d(struct J *);
bool J_e(struct J *);
nish_string J_f(struct J *);
int32_t K_a(struct K *);
double K_b(struct K *);
bool K_c(struct K *);
double L_a(struct L *);
int32_t L_b(struct L *);
int32_t L_c(struct L *);
int32_t M_a(struct M *);
double M_b(struct M *);
bool M_c(struct M *);
nish_string M_d(struct M *);
double M_as_B_b(struct M *);
uint8_t N_a(struct N *);
uint16_t N_b(struct N *);
uint32_t N_c(struct N *);
uint64_t N_d(struct N *);
uint8_t N_e(struct N *);
float O_a(struct O *);
double O_b(struct O *);
float O_c(struct O *);
bool O_d(struct O *);
/* WP15 section 2a: the record element type and the array of it. `nish_array`
   comes from nish.h, which the runtime this links against defines. */
typedef struct nish_array { uint64_t len; uint64_t cap; char *data; } nish_array;
struct P *makeP(double, int32_t);
nish_array *buildPs(int32_t);
double P_x(struct P *);
double P_y(struct P *);
int32_t P_tag(struct P *);

static int failures = 0;
#define CHECK(name, cond)                              \
  do {                                                 \
    if (!(cond)) {                                     \
      printf("layout mismatch: %s\n", name);           \
      failures++;                                      \
    }                                                  \
  } while (0)

int main(void) {
  struct A a = { 0x11111111 };
  struct B b = { 0x22222222, 2.5 };
  struct C c = { -3.25, 0x33333333 };
  struct D d = { true, 0x44444444, true };
  struct E e = { true, false, true };
  struct F f = { &str_abc, 0x66666666 };
  struct G g = { 0x77777777, &str_hello, true, 7.75 };
  struct H h = { true, &a, 0x88888888 };
  struct I i = { 0x11, 0x22, 0x33, true };
  struct J j = { true, 10.5, true, 0x09999999, true, &str_abc };
  struct K k = { 0x0aaaaaaa, 11.5, true };
  struct L l = { -12.25, 0x0bbbbbbb, 0x0ccccccc };
  struct M m = { 0x0ddddddd, 13.5, true, &str_hello };
  struct N n = { 0xEE, 0xEEEE, 0xEEEEEEEE, 0xEEEEEEEEEEEEEEEEu, 0xDD };
  struct O o = { 1.5f, -2.25, 3.75f, true };

  CHECK("A.a", A_a(&a) == 0x11111111);
  CHECK("B.a", B_a(&b) == 0x22222222);
  CHECK("B.b", B_b(&b) == 2.5);
  CHECK("C.a", C_a(&c) == -3.25);
  CHECK("C.b", C_b(&c) == 0x33333333);
  CHECK("D.a", D_a(&d) == true);
  CHECK("D.b", D_b(&d) == 0x44444444);
  CHECK("D.c", D_c(&d) == true);
  CHECK("E.a", E_a(&e) == true);
  CHECK("E.b", E_b(&e) == false);
  CHECK("E.c", E_c(&e) == true);
  CHECK("F.a", F_a(&f) == (nish_string)&str_abc);
  CHECK("F.b", F_b(&f) == 0x66666666);
  CHECK("G.a", G_a(&g) == 0x77777777);
  CHECK("G.b", G_b(&g) == (nish_string)&str_hello);
  CHECK("G.c", G_c(&g) == true);
  CHECK("G.d", G_d(&g) == 7.75);
  CHECK("H.a", H_a(&h) == true);
  CHECK("H.b", H_b(&h) == &a);
  CHECK("H.c", H_c(&h) == (int32_t)0x88888888);
  CHECK("I.a", I_a(&i) == 0x11);
  CHECK("I.b", I_b(&i) == 0x22);
  CHECK("I.c", I_c(&i) == 0x33);
  CHECK("I.d", I_d(&i) == true);
  CHECK("J.a", J_a(&j) == true);
  CHECK("J.b", J_b(&j) == 10.5);
  CHECK("J.c", J_c(&j) == true);
  CHECK("J.d", J_d(&j) == 0x09999999);
  CHECK("J.e", J_e(&j) == true);
  CHECK("J.f", J_f(&j) == (nish_string)&str_abc);
  CHECK("K.a", K_a(&k) == 0x0aaaaaaa);
  CHECK("K.b", K_b(&k) == 11.5);
  CHECK("K.c", K_c(&k) == true);
  CHECK("L.a", L_a(&l) == -12.25);
  CHECK("L.b", L_b(&l) == 0x0bbbbbbb);
  CHECK("L.c", L_c(&l) == 0x0ccccccc);
  CHECK("M.a", M_a(&m) == 0x0ddddddd);
  CHECK("M.b", M_b(&m) == 13.5);
  CHECK("M.c", M_c(&m) == true);
  CHECK("M.d", M_d(&m) == (nish_string)&str_hello);
  CHECK("M as B: b", M_as_B_b(&m) == 13.5);
  /* Every one of these would read the wrong bytes if a narrow width were
     laid out at another offset, and the two u8s would collide if `e` were
     packed next to `a`. */
  CHECK("N.a", N_a(&n) == 0xEE);
  CHECK("N.b", N_b(&n) == 0xEEEE);
  CHECK("N.c", N_c(&n) == 0xEEEEEEEE);
  CHECK("N.d", N_d(&n) == 0xEEEEEEEEEEEEEEEEu);
  CHECK("N.e", N_e(&n) == 0xDD);
  /* Exact in a float, so the comparison needs no epsilon. */
  CHECK("O.a", O_a(&o) == 1.5f);
  CHECK("O.b", O_b(&o) == -2.25);
  CHECK("O.c", O_c(&o) == 3.75f);
  CHECK("O.d", O_d(&o) == true);

  /* WP15 section 2a: the array holds the records themselves, so `data` is a C
     array of `struct P` and the stride is `sizeof(struct P)`. Anything else --
     a block of pointers, or a stride rounded up to 8-byte multiples of
     something -- and every element but the first reads the wrong bytes.
     `buildPs` grows past the initial capacity of 4 twice, so this also checks
     that `nish_array_grow` relocated whole records. */
  {
    nish_array *ps = buildPs(9);
    struct P *data = (struct P *)ps->data;
    int32_t k;
    CHECK("P[] length", ps->len == 9);
    CHECK("P[] stride", (char *)&data[1] - (char *)&data[0] == (long)sizeof(struct P));
    for (k = 0; k < 9; k++) {
      CHECK("P[].x", data[k].x == (double)k);
      CHECK("P[].y", data[k].y == (double)k * 2.0);
      CHECK("P[].tag", data[k].tag == k);
      /* And the same element read back through the compiled getters, which go
         through the interior pointer `ps[k]` rather than through C's view. */
      CHECK("P[].x via getter", P_x(&data[k]) == (double)k);
      CHECK("P[].tag via getter", P_tag(&data[k]) == k);
    }
    CHECK("makeP.x", P_x(makeP(3.5, 7)) == 3.5);
    CHECK("makeP.y", P_y(makeP(3.5, 7)) == 7.0);
    CHECK("makeP.tag", P_tag(makeP(3.5, 7)) == 7);
  }

  if (failures == 0) printf("layout ok\n");
  return failures == 0 ? 0 : 1;
}

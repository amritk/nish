/* C twin of tests/layout/structs.ts.
 *
 * 1. The _Static_asserts pin each struct's size to what the compiler computes
 *    (tests/run.js cross-checks them against `sts_alloc_struct(i64 N)` in the
 *    IR), so both agree with clang's layout of the same fields.
 * 2. main() fills every struct through the C definition and reads each field
 *    back through the StaticTS getters, so every field offset is verified at
 *    run time as well. Any mismatch prints the field name and exits 1.
 */
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>

/* StaticTS strings are `{ uint64_t len; char data[]; }`; getters return the pointer. */
typedef const void *sts_string;
static const struct { uint64_t len; char data[4]; } str_abc = { 3, "abc" };
static const struct { uint64_t len; char data[6]; } str_hello = { 5, "hello" };

struct A { int32_t a; };
struct B { int32_t a; double b; };
struct C { double a; int32_t b; };
struct D { bool a; int32_t b; bool c; };
struct E { bool a; bool b; bool c; };
struct F { sts_string a; int32_t b; };
struct G { int32_t a; sts_string b; bool c; double d; };
struct H { bool a; struct A *b; int32_t c; };
struct I { int32_t a; int32_t b; int32_t c; bool d; };
struct J { bool a; double b; bool c; int32_t d; bool e; sts_string f; };

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
sts_string F_a(struct F *);
int32_t F_b(struct F *);
int32_t G_a(struct G *);
sts_string G_b(struct G *);
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
sts_string J_f(struct J *);

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
  CHECK("F.a", F_a(&f) == (sts_string)&str_abc);
  CHECK("F.b", F_b(&f) == 0x66666666);
  CHECK("G.a", G_a(&g) == 0x77777777);
  CHECK("G.b", G_b(&g) == (sts_string)&str_hello);
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
  CHECK("J.f", J_f(&j) == (sts_string)&str_abc);

  if (failures == 0) printf("layout ok\n");
  return failures == 0 ? 0 : 1;
}

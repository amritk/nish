#include <stddef.h>
typedef long long i64t;
enum color { RED, GREEN = 5, BLUE };
typedef enum { A1 = -1, A2 } anon_e;
enum big : long long { BIG = 1LL << 40 };
typedef struct point { int x; i64t y; double z; struct point *next; void (*cb)(int); } point;
struct opaque;
typedef struct opaque opaque_t;
struct bits { int a : 3; };
struct arr { int a[4]; };
union u { int a; float b; };
size_t f1(const char *s, char *buf, size_t n, int *out, opaque_t **pp, point *p, enum color c, anon_e e);
const char *f2(void);
int f3(int, ...);
void (*f4(int))(int);
int f5(void (*cb)(int), struct bits b);
#define K 42
#define KS "hello"
#define KL (1LL<<40)
#define KU 3000000000u
#define KF 1.5
#define FN(x) x
#define _PRIV 1
#define KE "a\"b"
#define KP "a" "b"
typedef i64t i64t;
i64t f6(void);

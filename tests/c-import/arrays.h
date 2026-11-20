/* Fixed-length array fields: bound where clang lays them out as Nish does. */
#include <stdint.h>
struct digest { uint32_t h[8]; uint64_t total; uint8_t block[64]; uint32_t used; };
struct mixed { int32_t s[3]; double d[2]; float f[1]; int64_t q[2]; uint16_t u[5]; };
void digest_init(struct digest *d);
double mixed_sum(const struct mixed *m);
/* A length a macro spells is the number clang reads. */
#define WIDTH 4
struct by_macro { int w[WIDTH]; };
void by_macro_fill(struct by_macro *b);

/* Each array a field cannot hold keeps its struct a CPtr, with the reason. */
struct of_ptrs { const char *names[4]; };
struct of_structs { struct digest parts[2]; };
struct of_arrays { int grid[2][3]; };
struct of_bools { _Bool flags[4]; };
struct of_chars { char name[16]; };
struct flexible { int n; int items[]; };
struct zero { int n; int none[0]; };
typedef int aligned_int __attribute__((aligned(4)));
struct of_aligned { aligned_int a[2]; };
union in_union { int a[4]; float f[4]; };
struct packed_arr { char c; int a[2]; } __attribute__((packed));
void use_all(struct of_ptrs *a, struct of_structs *b, struct of_arrays *c, struct of_bools *d,
             struct of_chars *e, struct flexible *f, struct zero *g,
             struct of_aligned *i, union in_union *j, struct packed_arr *k);

/* `(*` is read after `[`: an array of function pointers is an array, never one pointer. */
struct of_fnptrs { void (*cbs[4])(int); int n; };
typedef void (*cb_fn)(int);
struct of_typedef_fnptrs { cb_fn cbs[2]; int n; };
typedef void (*cb_table[3])(int);
struct of_table { cb_table t; int n; };
struct to_array { int (*row)[4]; int n; };
/* A single function pointer, even one returning another, is still a pointer field. */
struct one_fnptr { void (*(*pick)(int))(char); int n; };
/* An array of pointers to arrays, and a function pointer returning a pointer to an array. */
struct of_row_ptrs { int (*rows[2])[4]; int n; };
struct row_getter { int (*(*get)(void))[4]; int n; };
void use_fnptrs(struct of_fnptrs *a, struct of_typedef_fnptrs *b, struct of_table *c,
                struct to_array *d, struct one_fnptr *e, struct of_row_ptrs *f,
                struct row_getter *g);
int (*row_at(int i))[4];
void take_row(int (*row)[4]);

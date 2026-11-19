/* Declarations whose attributes a `declare function` cannot carry. */
_Noreturn void die(void);
void halt(void) __attribute__((noreturn));
int __attribute__((ms_abi)) win_call(int x);
int old_style();
int no_params(void);

/* An attribute's text is the header's: a comment closer in it is never copied. */
int tagged(int __attribute__((btf_type_tag("*/ export const pwned = 1 /*"))) *p);

typeof(int) typed(int x);
struct { int x; } *unnamed_result(void);

extern int counter;

/* An asm label or alias names another symbol: the call would miss it. */
int renamed(int x) __asm__("real_renamed");
int target_fn(int x);
int aliased(int x) __attribute__((alias("target_fn")));

/* A 16-byte integer macro: no Nish scalar holds it. */
#define WIDE_ONE ((__int128)1)
#define NARROW_ONE ((short)1)

/* An unnamed parameter beside one named `arg0`: the two stay distinct. */
int pair(int, int arg0);

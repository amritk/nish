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

long l_add(long a, long b);
unsigned long l_count(void);
struct lpair { long a; unsigned long b; };
int l_fill(struct lpair *p, long *out);
#define L_BIG 4294967296L

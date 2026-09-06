/* f64-mode driver: `test()` returns a double. */
#include <stdio.h>
double test(void);
int main(void) { printf("%g\n", test()); return 0; }

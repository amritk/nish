/* Default native driver for tests/cases/<name>.out: calls `test()` and prints it. */
#include <stdint.h>
#include <stdio.h>
int32_t test(void);
int main(void) { printf("%d\n", test()); return 0; }

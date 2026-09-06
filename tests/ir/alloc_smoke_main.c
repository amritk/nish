#include <stdint.h>
#include <stdio.h>
int64_t alloc_smoke(void);
int main(void) { printf("alloc_smoke delta = %lld\n", (long long)alloc_smoke()); return alloc_smoke() == 16 ? 0 : 1; }

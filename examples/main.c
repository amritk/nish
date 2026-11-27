/* Native driver that links against the compiled Nish module. */
#include <stdint.h>
#include <stdio.h>

/* `add` answers `Result<number, number>`, which fits a register, so it comes
 * back by value as this word: `ok`, then the arm it selects. It is the struct
 * `nish --emit-header` writes for the module. */
typedef struct nish_result_i32_i32_word {
  int32_t ok; /* 1 = value, 0 = error */
  union { int32_t value; int32_t error; } as;
} nish_result_i32_i32_word;

nish_result_i32_i32_word add(int32_t a, int32_t b);

int main(void) {
  nish_result_i32_i32_word r = add(2, 3);
  if (!r.ok) {
    fprintf(stderr, "add(2, 3) overflows int32_t\n");
    return 1;
  }
  printf("add(2, 3) = %d\n", r.as.value);
  return 0;
}

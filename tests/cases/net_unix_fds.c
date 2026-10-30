/* Driver for net_unix_fds: the number of open descriptors, read from
   `/proc/self/fd`, before and after each refused call, printed as the call's
   answer and the change, which must be 0. The directory's own descriptor is
   open in both counts, so it cancels. */
#include <dirent.h>
#include <stdint.h>
#include <stdio.h>

int32_t setUp(void);
int32_t attempt(int32_t k);
int32_t tearDown(int32_t live);

static int open_fds(void) {
  DIR *d = opendir("/proc/self/fd");
  int n = 0;
  if (d == NULL) {
    return -1;
  }
  while (readdir(d) != NULL) {
    n++;
  }
  closedir(d);
  return n;
}

int main(void) {
  int32_t live = setUp();
  printf("setUp %d\n", live >= 0);
  for (int32_t k = 0; k < 10; k++) {
    int before = open_fds();
    int32_t answer = attempt(k);
    printf("attempt %d: %d, descriptors %+d\n", k, answer, open_fds() - before);
  }
  printf("tearDown %d\n", tearDown(live));
  return 0;
}

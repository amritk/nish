/* Driver for net_unix_paths: `modeOf` answers the permission bits of the
   file at a path, in octal digits read as decimal (600 for 0600), or -1 when
   nothing is there, read with `lstat` so a socket is not followed. */
#include <stdint.h>
#include <sys/stat.h>

int32_t run(void);

int32_t modeOf(const char *path) {
  struct stat st;
  if (lstat(path, &st) != 0) {
    return -1;
  }
  unsigned m = st.st_mode & 0777;
  return (int32_t)((m >> 6) * 100 + ((m >> 3) & 7) * 10 + (m & 7));
}

int main(void) {
  return run();
}

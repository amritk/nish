/* Driver for net_unix_paths: `modeOf` answers the permission bits of the
   file at a path, in octal digits read as decimal (600 for 0600), or -1 when
   nothing is there, read with `lstat` so a socket is not followed; `sizeOf`
   answers a regular file's size, or -1 for anything else. The run is under
   umask 0, the widest, so the bind makes every socket file 0777 and only the
   runtime's chmod narrows it. `chmod` here takes the runtime's place: before
   it changes the mode it connects to the path, and counts a connect that
   succeeds, which is a listener already taking connections at the umask's
   mode. `listenedFirst` answers that count: 0 while the chmod comes between
   the bind and the listen (RT-34). */
#include <fcntl.h>
#include <stdint.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/stat.h>
#include <sys/un.h>
#include <unistd.h>

int32_t run(void);

static int32_t listened_first = 0;

int chmod(const char *path, mode_t mode) {
  struct sockaddr_un s;
  memset(&s, 0, sizeof s);
  s.sun_family = AF_UNIX;
  if (strlen(path) < sizeof s.sun_path) {
    strcpy(s.sun_path, path);
    int probe = socket(AF_UNIX, SOCK_STREAM, 0);
    if (probe >= 0) {
      if (connect(probe, (struct sockaddr *)&s, sizeof s) == 0) {
        listened_first++;
      }
      close(probe);
    }
  }
  return fchmodat(AT_FDCWD, path, mode, 0);
}

int32_t listenedFirst(void) {
  return listened_first;
}

int32_t modeOf(const char *path) {
  struct stat st;
  if (lstat(path, &st) != 0) {
    return -1;
  }
  unsigned m = st.st_mode & 0777;
  return (int32_t)((m >> 6) * 100 + ((m >> 3) & 7) * 10 + (m & 7));
}

int32_t sizeOf(const char *path) {
  struct stat st;
  if (lstat(path, &st) != 0 || !S_ISREG(st.st_mode)) {
    return -1;
  }
  return (int32_t)st.st_size;
}

int main(void) {
  umask(0);
  return run();
}

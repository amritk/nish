/* Library and driver for ffi_opaque_handle: two opaque C types the program
   names `Db` and `Stmt`, a `db_open` that answers NULL for flags 0, and a
   `stmt_prepare` that answers NULL for a negative count, which `broken` runs
   in a child whose stderr is this process's stdout, so the panic message and
   the exit status land in the .out file. */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/wait.h>
#include <unistd.h>

struct db {
  int32_t open;
};

struct stmt {
  struct db *db;
  int32_t left;
};

int32_t run(int32_t flags, int32_t n);
int32_t broken(void);

struct db *db_open(int32_t flags) {
  if (flags == 0) {
    return NULL;
  }
  struct db *db = malloc(sizeof *db);
  db->open = 1;
  return db;
}

void db_close(struct db *db) {
  printf("db_close open=%d\n", db->open);
  free(db);
}

struct stmt *stmt_prepare(struct db *db, int32_t n) {
  if (n < 0) {
    return NULL;
  }
  struct stmt *stmt = malloc(sizeof *stmt);
  stmt->db = db;
  stmt->left = n;
  return stmt;
}

int32_t stmt_step(struct stmt *stmt) {
  if (stmt->left == 0) {
    return 0;
  }
  return stmt->left--;
}

void stmt_close(struct stmt *stmt) {
  printf("stmt_close db=%d\n", stmt->db->open);
  free(stmt);
}

int main(void) {
  printf("%d\n", run(0, 3));
  printf("%d\n", run(1, 3));
  fflush(stdout);
  pid_t pid = fork();
  if (pid == 0) {
    dup2(1, 2);
    printf("broken returned %d\n", broken());
    fflush(stdout);
    _exit(0);
  }
  int status = 0;
  waitpid(pid, &status, 0);
  printf("broken exit %d\n", WIFEXITED(status) ? WEXITSTATUS(status) : -1);
  return 0;
}

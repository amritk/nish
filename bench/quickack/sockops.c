/* Runs a command with a BPF sockops program attached to its cgroup, the
   per-host lever Linux offers on delayed ACKs besides a socket option.

     cc -O2 -o build/bench/quickack/sockops bench/quickack/sockops.c
     sockops <cgroup2 dir> delack_max <us> <command> [args...]
     sockops <cgroup2 dir> quickack <0|1> <command> [args...]

   It loads a BPF_PROG_TYPE_SOCK_OPS program, attaches it to the cgroup v2
   directory with BPF_CGROUP_SOCK_OPS, moves itself into that cgroup and runs
   the command there, so every TCP socket the command opens passes through
   the program. On BPF_SOCK_OPS_ACTIVE_ESTABLISHED_CB (the connecting end)
   and BPF_SOCK_OPS_PASSIVE_ESTABLISHED_CB (the accepted end) the program
   calls bpf_setsockopt(skops, SOL_TCP, opt, &value, 4) with opt
   TCP_BPF_DELACK_MAX (the longest delayed-ACK timeout, in µs) or
   TCP_QUICKACK, and stores the helper's return value and a call count in an
   array map. When the command exits it prints, for each end, what the helper
   returned (0, or the errno it refused with) and how many times it ran, then
   detaches the program. It exits with the command's status, or 1 if the
   kernel refuses the load, the attach or the move, after printing the
   refusal: that line is the record when this box cannot run the program.

   The program is written as raw BPF instructions so the bench needs no
   libbpf, bpftool or BPF-target compiler, only the kernel's uapi headers. */
#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <linux/bpf.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/syscall.h>
#include <sys/wait.h>
#include <unistd.h>

#ifndef SOL_TCP
#define SOL_TCP 6
#endif
#define TCP_QUICKACK_OPT 12 /* TCP_QUICKACK in netinet/tcp.h */

static long bpf(int cmd, union bpf_attr *attr) {
  return syscall(SYS_bpf, cmd, attr, sizeof *attr);
}

#define INSN(c, d, s, o, i) ((struct bpf_insn){.code = (c), .dst_reg = (d), .src_reg = (s), .off = (o), .imm = (i)})

/* The map value: for each end, the helper's last return value and its call
   count, the connecting end at index 0 and the accepted end at index 1. */
struct result {
  int ret, calls;
};

static char verifier_log[65536];

int main(int argc, char **argv) {
  if (argc < 5 || (strcmp(argv[2], "delack_max") != 0 && strcmp(argv[2], "quickack") != 0)) {
    fprintf(stderr, "usage: sockops <cgroup2 dir> delack_max|quickack <value> <command> [args...]\n");
    return 2;
  }
  const char *cgroup = argv[1];
  int optname = strcmp(argv[2], "delack_max") == 0 ? TCP_BPF_DELACK_MAX : TCP_QUICKACK_OPT;
  int value = atoi(argv[3]);

  union bpf_attr attr;
  memset(&attr, 0, sizeof attr);
  attr.map_type = BPF_MAP_TYPE_ARRAY;
  attr.key_size = 4;
  attr.value_size = 2 * sizeof(struct result);
  attr.max_entries = 1;
  int map = (int)bpf(BPF_MAP_CREATE, &attr);
  if (map < 0) {
    printf("refused: bpf(BPF_MAP_CREATE): %s\n", strerror(errno));
    return 1;
  }

  /* r1 is the struct bpf_sock_ops context; its first field is `op`. */
  struct bpf_insn prog[] = {
      INSN(BPF_ALU64 | BPF_MOV | BPF_X, 6, 1, 0, 0),                     /* r6 = ctx */
      INSN(BPF_LDX | BPF_MEM | BPF_W, 7, 6, 0, 0),                       /* r7 = ctx->op */
      INSN(BPF_JMP | BPF_JEQ | BPF_K, 7, 0, 2, BPF_SOCK_OPS_ACTIVE_ESTABLISHED_CB),
      INSN(BPF_JMP | BPF_JEQ | BPF_K, 7, 0, 1, BPF_SOCK_OPS_PASSIVE_ESTABLISHED_CB),
      INSN(BPF_JMP | BPF_JA, 0, 0, 16, 0),                               /* not ours: to exit */
      INSN(BPF_ST | BPF_MEM | BPF_W, 10, 0, -4, value),                  /* *(u32 *)(fp - 4) = value */
      INSN(BPF_ALU64 | BPF_MOV | BPF_X, 1, 6, 0, 0),                     /* r1 = ctx */
      INSN(BPF_ALU64 | BPF_MOV | BPF_K, 2, 0, 0, SOL_TCP),               /* r2 = level */
      INSN(BPF_ALU64 | BPF_MOV | BPF_K, 3, 0, 0, optname),               /* r3 = optname */
      INSN(BPF_ALU64 | BPF_MOV | BPF_X, 4, 10, 0, 0),
      INSN(BPF_ALU64 | BPF_ADD | BPF_K, 4, 0, 0, -4),                    /* r4 = fp - 4 */
      INSN(BPF_ALU64 | BPF_MOV | BPF_K, 5, 0, 0, 4),                     /* r5 = optlen */
      INSN(BPF_JMP | BPF_CALL, 0, 0, 0, BPF_FUNC_setsockopt),            /* r0 = bpf_setsockopt(...) */
      INSN(BPF_LD | BPF_DW | BPF_IMM, 1, BPF_PSEUDO_MAP_VALUE, 0, map),  /* r1 = &value[0] */
      INSN(0, 0, 0, 0, 0),                                               /* offset 0 into it */
      INSN(BPF_ALU64 | BPF_SUB | BPF_K, 7, 0, 0, BPF_SOCK_OPS_ACTIVE_ESTABLISHED_CB),
      INSN(BPF_ALU64 | BPF_LSH | BPF_K, 7, 0, 0, 3),                     /* r7 = end * 8 */
      INSN(BPF_ALU64 | BPF_ADD | BPF_X, 1, 7, 0, 0),                     /* r1 = &value[end] */
      INSN(BPF_STX | BPF_MEM | BPF_W, 1, 0, 0, 0),                       /* ->ret = r0 */
      INSN(BPF_ALU64 | BPF_MOV | BPF_K, 2, 0, 0, 1),
      INSN(BPF_STX | BPF_ATOMIC | BPF_W, 1, 2, 4, BPF_ADD),              /* ->calls += 1 */
      INSN(BPF_ALU64 | BPF_MOV | BPF_K, 0, 0, 0, 1),                     /* exit: r0 = 1 */
      INSN(BPF_JMP | BPF_EXIT, 0, 0, 0, 0),
  };
  memset(&attr, 0, sizeof attr);
  attr.prog_type = BPF_PROG_TYPE_SOCK_OPS;
  attr.expected_attach_type = BPF_CGROUP_SOCK_OPS;
  attr.insns = (unsigned long)prog;
  attr.insn_cnt = sizeof prog / sizeof prog[0];
  attr.license = (unsigned long)"Dual MIT/GPL";
  attr.log_buf = (unsigned long)verifier_log;
  attr.log_size = sizeof verifier_log;
  attr.log_level = 1;
  int fd = (int)bpf(BPF_PROG_LOAD, &attr);
  if (fd < 0) {
    printf("refused: bpf(BPF_PROG_LOAD, BPF_PROG_TYPE_SOCK_OPS): %s\n%s", strerror(errno), verifier_log);
    return 1;
  }

  int dir = open(cgroup, O_RDONLY | O_DIRECTORY);
  if (dir < 0) {
    printf("refused: open(%s): %s\n", cgroup, strerror(errno));
    return 1;
  }
  memset(&attr, 0, sizeof attr);
  attr.target_fd = dir;
  attr.attach_bpf_fd = fd;
  attr.attach_type = BPF_CGROUP_SOCK_OPS;
  if (bpf(BPF_PROG_ATTACH, &attr) < 0) {
    printf("refused: bpf(BPF_PROG_ATTACH, BPF_CGROUP_SOCK_OPS): %s\n", strerror(errno));
    return 1;
  }

  char procs[4096];
  snprintf(procs, sizeof procs, "%s/cgroup.procs", cgroup);
  FILE *f = fopen(procs, "w");
  if (f == NULL || fprintf(f, "%d\n", (int)getpid()) < 0 || fclose(f) != 0) {
    printf("refused: writing this process to %s: %s\n", procs, strerror(errno));
    return 1;
  }

  fflush(stdout);
  pid_t child = fork();
  if (child < 0) {
    perror("fork");
    return 1;
  }
  if (child == 0) {
    execvp(argv[4], argv + 4);
    perror(argv[4]);
    _exit(127);
  }
  int status = 0;
  if (waitpid(child, &status, 0) < 0) {
    perror("waitpid");
    return 1;
  }

  struct result r[2];
  int key = 0;
  memset(&attr, 0, sizeof attr);
  attr.map_fd = map;
  attr.key = (unsigned long)&key;
  attr.value = (unsigned long)r;
  if (bpf(BPF_MAP_LOOKUP_ELEM, &attr) < 0) {
    perror("bpf(BPF_MAP_LOOKUP_ELEM)");
    return 1;
  }
  static const char *ends[] = {"connecting end (ACTIVE_ESTABLISHED)", "accepted end (PASSIVE_ESTABLISHED)"};
  for (int k = 0; k < 2; k++) {
    printf("bpf_setsockopt(SOL_TCP, %s, %d) on the %s: %s, %d calls\n",
           optname == TCP_BPF_DELACK_MAX ? "TCP_BPF_DELACK_MAX" : "TCP_QUICKACK", value, ends[k],
           r[k].calls == 0 ? "never called" : r[k].ret == 0 ? "returned 0" : strerror(-r[k].ret), r[k].calls);
  }

  memset(&attr, 0, sizeof attr);
  attr.target_fd = dir;
  attr.attach_bpf_fd = fd;
  attr.attach_type = BPF_CGROUP_SOCK_OPS;
  if (bpf(BPF_PROG_DETACH, &attr) < 0) perror("bpf(BPF_PROG_DETACH)");
  return WIFEXITED(status) ? WEXITSTATUS(status) : 1;
}

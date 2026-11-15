/* C twin of treesum.ts: the same tree, the same two walks, the same lines. */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define DEPTH 20 /* bench:n */
#define PASSES 60

typedef struct TreeNode {
  int32_t value;
  struct TreeNode *left;
  struct TreeNode *right;
} TreeNode;

/* The method kernel: TreeNode.sum() in treesum.ts. */
static int32_t node_sum(const TreeNode *self) {
  const TreeNode *left = self->left;
  const TreeNode *right = self->right;
  int32_t l = left == NULL ? 0 : node_sum(left);
  if (right == NULL) {
    return self->value + l;
  }
  return self->value + l + node_sum(right);
}

/* The fn kernel: sum in treesum.ts. */
static int32_t sum(const TreeNode *t) {
  if (t == NULL) {
    return 0;
  }
  return t->value + sum(t->left) + sum(t->right);
}

static TreeNode *build(int32_t depth, int32_t id) {
  TreeNode *left = depth > 1 ? build(depth - 1, id * 2) : NULL;
  TreeNode *right = depth > 1 ? build(depth - 1, id * 2 + 1) : NULL;
  TreeNode *n = malloc(sizeof *n);
  n->value = id & 1023;
  n->left = left;
  n->right = right;
  return n;
}

int main(int argc, char **argv) {
  const char *only = argc > 1 ? argv[1] : "";
  TreeNode *root = build(DEPTH, 1);

  if (only[0] == '\0' || strcmp(only, "fn") == 0) {
    int32_t h = 0;
    for (int32_t pass = 0; pass < PASSES; pass++) {
      root->value = pass;
      h = (int32_t)(((uint32_t)h << 5) | ((uint32_t)h >> 27)) ^ sum(root);
    }
    printf("fn %d\n", h);
  }
  if (only[0] == '\0' || strcmp(only, "method") == 0) {
    int32_t h = 0;
    for (int32_t pass = 0; pass < PASSES; pass++) {
      root->value = pass;
      h = (int32_t)(((uint32_t)h << 5) | ((uint32_t)h >> 27)) ^ node_sum(root);
    }
    printf("method %d\n", h);
  }
  return 0;
}

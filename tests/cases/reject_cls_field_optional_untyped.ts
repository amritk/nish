// The `?` rule is the checker's, but only for a member the parser can finish
// reading: `x? = 5` has no annotation, so stage1 stops at the missing type
// (`syntax error: a type annotation is required`) where stage0 names the
// optional field. The pinned wording is stage0's, and the case is here so the
// edge of `reject_cls_field_optional` is a file rather than a claim.
export class Point {
  x? = 5;
}

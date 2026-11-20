%struct.TallyOut = type { i64 }
%struct.tally = type {}

declare i8* @tally_new(i32)
declare void @tally_add(i8*, i64)
declare i32 @tally_get(i8*, %struct.TallyOut*)
declare void @tally_free(i8*)

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}

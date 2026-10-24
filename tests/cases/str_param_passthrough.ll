@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"done\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"pass\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"printed\00" }, align 8

declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1

define internal noundef nonnull align 8 i8* @passthrough(i8* noundef nonnull noalias readonly align 8 %s) #0 {
entry:
  ret i8* %s
}

define internal noundef nonnull align 8 i8* @wrapped(i8* noundef nonnull noalias readonly align 8 %s) #0 {
entry:
  ret i8* %s
}

define internal noundef nonnull align 8 i8* @printed(i8* noundef nonnull noalias readonly align 8 nocapture %s) #1 {
entry:
  call void @nish_print(i8* %s)
  ret i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*)
}

define noundef i32 @test() #1 {
entry:
  %0 = call i8* @passthrough(i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*))
  %1 = call i8* @wrapped(i8* %0)
  call void @nish_print(i8* %1)
  %2 = call i8* @printed(i8* bitcast ({ i64, [8 x i8] }* @.str.2 to i8*))
  call void @nish_print(i8* %2)
  ret i32 0
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}

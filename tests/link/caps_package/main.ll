@.str.0 = private unnamed_addr constant { i64, [35 x i8] } { i64 34, [35 x i8] c"tests/link/caps_package/config.txt\00" }, align 8

declare noundef i32 @pkg_caps.configSize(i8* noundef nonnull noalias readonly align 8) #0
declare void @nish_free_arena() #1

define noundef i32 @nish_main() #0 {
entry:
  %0 = call i32 @pkg_caps.configSize(i8* bitcast ({ i64, [35 x i8] }* @.str.0 to i8*))
  ret i32 %0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}

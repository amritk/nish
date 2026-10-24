@.str.0 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"exiting\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"not printed\00" }, align 8

declare void @nish_free_arena() #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_exit(i32 noundef) #2

define internal noundef i32 @finish(i32 noundef %code) #0 {
entry:
  call void @nish_print(i8* bitcast ({ i64, [8 x i8] }* @.str.0 to i8*))
  call void @nish_exit(i32 %code)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %0 = call i32 @finish(i32 0)
  call void @nish_print(i8* bitcast ({ i64, [12 x i8] }* @.str.1 to i8*))
  ret i32 1
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { noreturn nounwind "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}

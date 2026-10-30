@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"same\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1

define internal noundef nonnull align 8 i8* @first() #0 {
entry:
  ret i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*)
}

define internal noundef nonnull align 8 i8* @second() #0 {
entry:
  ret i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*)
}

define noundef i32 @test() #1 {
entry:
  %0 = call i8* @first()
  call void @nish_print(i8* %0)
  %1 = call i8* @second()
  call void @nish_print(i8* %1)
  %2 = call i8* @second()
  %3 = call zeroext i1 @nish_str_eq(i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* %2)
  %4 = select i1 %3, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  call void @nish_print(i8* %4)
  ret i32 0
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn memory(argmem: read) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}

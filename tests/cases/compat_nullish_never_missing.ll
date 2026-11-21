@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"ada\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2

define internal noundef double @keep(double noundef %k) #0 {
entry:
  ret double %k
}

define internal noundef nonnull align 8 i8* @name(i8* noundef nonnull noalias readonly align 8 %s) #0 {
entry:
  ret i8* %s
}

define void @nish_main() #1 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call double @keep(double 0x4010000000000000)
  %1 = call i8* @nish_str_from_f64(double %0)
  %2 = call i8* @nish_str_concat(i8* %1, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %3 = call double @keep(double 0x0000000000000000)
  %4 = call i8* @nish_str_from_f64(double %3)
  %5 = call i8* @nish_str_concat(i8* %2, i8* %4)
  %6 = call i8* @nish_str_concat(i8* %5, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %7 = call i8* @name(i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*))
  %8 = call i8* @nish_str_concat(i8* %6, i8* %7)
  %9 = call i8* @nish_str_concat(i8* %8, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %10 = call i8* @name(i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*))
  %11 = call i8* @nish_str_concat(i8* %9, i8* %10)
  call void @nish_print(i8* %11)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }

!nish.compat = !{!5}
!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}
!5 = !{!"f64", !"nullish", !"optional-chaining", !"string-switch", !"for-of-string", !"optional-params", !"overloads"}

@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"abc\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2

define internal noundef double @size(i8* noundef noalias readonly align 8 nocapture %p) #0 {
entry:
  %0 = icmp ne i8* %p, null
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = bitcast i8* %p to i64*
  %2 = load i64, i64* %1, align 8
  %3 = sitofp i64 %2 to double
  ret double %3

if.end:
  ret double 0x0000000000000000
}

define void @nish_main() #1 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call double @size(i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*))
  %1 = call i8* @nish_str_from_f64(double %0)
  %2 = call i8* @nish_str_concat(i8* %1, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %3 = call double @size(i8* null)
  %4 = call i8* @nish_str_from_f64(double %3)
  %5 = call i8* @nish_str_concat(i8* %2, i8* %4)
  call void @nish_print(i8* %5)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
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

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2

define internal noundef i32 @u1(i32 noundef %x) #0 {
entry:
  %0 = add nsw i32 %x, 1
  ret i32 %0
}

define internal noundef i32 @u2(i32 noundef %x) #0 {
entry:
  %0 = mul nsw i32 %x, 2
  ret i32 %0
}

define internal noundef i32 @u3(i32 noundef %x) #0 {
entry:
  %0 = add nsw i32 %x, 3
  ret i32 %0
}

define internal noundef i32 @run(i32 noundef %h, i32 noundef %x) #0 {
entry:
  %0 = call i32 @$ref.0.fr1.i32.i32.0(i32 %h, i32 %x)
  ret i32 %0
}

define void @nish_main() #1 {
entry:
  %other.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 2, i32* %other.addr, align 4
  %0 = call i32 @run(i32 1, i32 10)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  %2 = call i8* @nish_str_concat(i8* %1, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %3 = call i32 @run(i32 3, i32 10)
  %4 = call i8* @nish_str_from_i32(i32 %3)
  %5 = call i8* @nish_str_concat(i8* %2, i8* %4)
  %6 = call i8* @nish_str_concat(i8* %5, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %7 = load i32, i32* %other.addr, align 4
  %8 = call i32 @$ref.0.fr1.i32.i32.1(i32 %7, i32 10)
  %9 = call i8* @nish_str_from_i32(i32 %8)
  %10 = call i8* @nish_str_concat(i8* %6, i8* %9)
  call void @nish_print(i8* %10)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal noundef i32 @$ref.0.fr1.i32.i32.0(i32 noundef %$t, i32 noundef %$a0) #0 {
entry:
  switch i32 %$t, label %sw.default [
    i32 1, label %sw.case
  ]

sw.case:
  %0 = tail call i32 @u1(i32 %$a0)
  ret i32 %0

sw.default:
  %1 = tail call i32 @u3(i32 %$a0)
  ret i32 %1
}

define internal noundef i32 @$ref.0.fr1.i32.i32.1(i32 noundef %$t, i32 noundef %$a0) #0 {
entry:
  %0 = tail call i32 @u2(i32 %$a0)
  ret i32 %0
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

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}

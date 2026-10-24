declare i64 @labs(i64)
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #1

define internal noundef i64 @magnitude(i64 noundef %n) #0 {
entry:
  %0 = tail call i64 @labs(i64 %n)
  ret i64 %0
}

define noundef i32 @nish_main() #0 {
entry:
  %n.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i64 -9, i64* %n.addr, align 8
  %0 = load i64, i64* %n.addr, align 8
  %1 = call i64 @magnitude(i64 %0)
  %2 = call i8* @nish_str_from_i64(i64 %1)
  call void @nish_print(i8* %2)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
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

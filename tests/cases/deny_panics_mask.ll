declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1

define internal noundef i32 @low(i32 noundef %w) #0 {
entry:
  %0 = and i32 %w, 16777215
  %1 = sub nsw i32 %0, 1
  ret i32 %1
}

define internal noundef i32 @high(i32 noundef %w) #0 {
entry:
  %0 = lshr i32 %w, 8
  %1 = add nsw i32 %0, 1
  ret i32 %1
}

define noundef i32 @nish_main() #1 {
entry:
  %top.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 4294967295, i32* %top.addr, align 4
  %0 = load i32, i32* %top.addr, align 4
  %1 = call i32 @low(i32 %0)
  %2 = call i8* @nish_str_from_i32(i32 %1)
  call void @nish_print(i8* %2)
  %3 = call i32 @low(i32 0)
  %4 = call i8* @nish_str_from_i32(i32 %3)
  call void @nish_print(i8* %4)
  %5 = load i32, i32* %top.addr, align 4
  %6 = call i32 @high(i32 %5)
  %7 = call i8* @nish_str_from_i32(i32 %6)
  call void @nish_print(i8* %7)
  %8 = call i32 @high(i32 255)
  %9 = call i8* @nish_str_from_i32(i32 %8)
  call void @nish_print(i8* %9)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}

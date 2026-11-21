declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0

define internal noundef i32 @half(i32 noundef %n) #0 {
entry:
  %0 = sdiv i32 %n, 2
  ret i32 %0
}

define internal noundef i32 @third(i32 noundef %percent) #0 {
entry:
  %0 = sdiv i32 %percent, 3
  ret i32 %0
}

define noundef i32 @nish_main() #1 {
entry:
  %bytes.addr = alloca i8, align 1
  %count.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i8 200, i8* %bytes.addr, align 1
  %0 = load i8, i8* %bytes.addr, align 1
  %1 = udiv i8 %0, 3
  store i8 %1, i8* %bytes.addr, align 1
  store i32 10, i32* %count.addr, align 4
  %2 = load i32, i32* %count.addr, align 4
  %3 = udiv i32 %2, 4
  store i32 %3, i32* %count.addr, align 4
  %4 = call i32 @half(i32 7)
  %5 = call i8* @nish_str_from_i32(i32 %4)
  call void @nish_print(i8* %5)
  %6 = call i32 @third(i32 50)
  %7 = call i8* @nish_str_from_i32(i32 %6)
  call void @nish_print(i8* %7)
  %8 = sext i32 7 to i64
  %9 = sext i32 2 to i64
  %10 = sdiv i64 %8, %9
  %11 = trunc i64 %10 to i32
  %12 = call i8* @nish_str_from_i32(i32 %11)
  call void @nish_print(i8* %12)
  %13 = load i8, i8* %bytes.addr, align 1
  %14 = zext i8 %13 to i32
  %15 = load i32, i32* %count.addr, align 4
  %16 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %14, i32 %15)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok

ovf.ok:
  %19 = call i8* @nish_str_from_i32(i32 %17)
  call void @nish_print(i8* %19)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}

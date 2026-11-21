declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1

define internal noundef i32 @divI32(i32 noundef %a) #0 {
entry:
  %0 = sdiv i32 %a, 7
  ret i32 %0
}

define internal noundef i32 @remU32(i32 noundef %a) #0 {
entry:
  %0 = urem i32 %a, 3
  ret i32 %0
}

define internal noundef i64 @divI64(i64 noundef %a) #0 {
entry:
  %0 = sext i32 5 to i64
  %1 = sdiv i64 %a, %0
  ret i64 %1
}

define internal noundef i8 @remU8(i8 noundef %a) #0 {
entry:
  %0 = trunc i32 200 to i8
  %1 = urem i8 %a, %0
  ret i8 %1
}

define internal noundef i32 @lowByte(i32 noundef %w) #0 {
entry:
  %mask.addr = alloca i32, align 4
  store i32 255, i32* %mask.addr, align 4
  %0 = load i32, i32* %mask.addr, align 4
  %1 = and i32 %w, %0
  %2 = sub nsw i32 %1, 1
  ret i32 %2
}

define internal noundef i32 @topByte(i32 noundef %w) #0 {
entry:
  %shift.addr = alloca i32, align 4
  store i32 24, i32* %shift.addr, align 4
  %0 = load i32, i32* %shift.addr, align 4
  %1 = and i32 %0, 31
  %2 = lshr i32 %w, %1
  %3 = add nsw i32 %2, 1
  ret i32 %3
}

define noundef i32 @nish_main() #1 {
entry:
  %top.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 4294967295, i32* %top.addr, align 4
  %0 = call i32 @divI32(i32 -50)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  call void @nish_print(i8* %1)
  %2 = call i32 @remU32(i32 17)
  %3 = call i8* @nish_str_from_i32(i32 %2)
  call void @nish_print(i8* %3)
  %4 = sext i32 -26 to i64
  %5 = call i64 @divI64(i64 %4)
  %6 = trunc i64 %5 to i32
  %7 = call i8* @nish_str_from_i32(i32 %6)
  call void @nish_print(i8* %7)
  %8 = trunc i32 255 to i8
  %9 = call i8 @remU8(i8 %8)
  %10 = zext i8 %9 to i32
  %11 = call i8* @nish_str_from_i32(i32 %10)
  call void @nish_print(i8* %11)
  %12 = load i32, i32* %top.addr, align 4
  %13 = call i32 @lowByte(i32 %12)
  %14 = call i8* @nish_str_from_i32(i32 %13)
  call void @nish_print(i8* %14)
  %15 = call i32 @lowByte(i32 256)
  %16 = call i8* @nish_str_from_i32(i32 %15)
  call void @nish_print(i8* %16)
  %17 = load i32, i32* %top.addr, align 4
  %18 = call i32 @topByte(i32 %17)
  %19 = call i8* @nish_str_from_i32(i32 %18)
  call void @nish_print(i8* %19)
  %20 = call i32 @topByte(i32 0)
  %21 = call i8* @nish_str_from_i32(i32 %20)
  call void @nish_print(i8* %21)
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

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c": \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #1

define internal void @show(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = zext i32 %a to i64
  %1 = call i8* @nish_str_from_u64(i64 %0)
  %2 = call i8* @nish_str_concat(i8* %1, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %3 = zext i32 %b to i64
  %4 = call i8* @nish_str_from_u64(i64 %3)
  %5 = call i8* @nish_str_concat(i8* %2, i8* %4)
  %6 = call i8* @nish_str_concat(i8* %5, i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*))
  %7 = xor i32 %a, %b
  %8 = sub i32 0, %7
  %9 = or i32 %7, %8
  %10 = lshr i32 %9, 31
  %11 = sub i32 %10, 1
  %12 = call i32 asm "", "=r,0"(i32 %11) readnone nounwind
  %13 = zext i32 %12 to i64
  %14 = call i8* @nish_str_from_u64(i64 %13)
  %15 = call i8* @nish_str_concat(i8* %6, i8* %14)
  %16 = call i8* @nish_str_concat(i8* %15, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %17 = xor i32 %a, %b
  %18 = sub i32 0, %17
  %19 = or i32 %17, %18
  %20 = lshr i32 %19, 31
  %21 = sub i32 %20, 1
  %22 = call i32 asm "", "=r,0"(i32 %21) readnone nounwind
  %23 = call i32 asm "", "=r,0"(i32 %22) readnone nounwind
  %24 = and i32 1, %23
  %25 = xor i32 %23, -1
  %26 = and i32 2, %25
  %27 = or i32 %24, %26
  %28 = zext i32 %27 to i64
  %29 = call i8* @nish_str_from_u64(i64 %28)
  %30 = call i8* @nish_str_concat(i8* %16, i8* %29)
  call void @nish_print(i8* %30)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @nish_main() #0 {
entry:
  %ONES.addr = alloca i32, align 4
  %TOP.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 4294967295, i32* %ONES.addr, align 4
  store i32 2147483648, i32* %TOP.addr, align 4
  call void @show(i32 0, i32 0)
  call void @show(i32 0, i32 1)
  call void @show(i32 1, i32 0)
  %0 = load i32, i32* %ONES.addr, align 4
  %1 = load i32, i32* %ONES.addr, align 4
  call void @show(i32 %0, i32 %1)
  %2 = load i32, i32* %ONES.addr, align 4
  call void @show(i32 %2, i32 0)
  %3 = load i32, i32* %ONES.addr, align 4
  call void @show(i32 4294967294, i32 %3)
  %4 = load i32, i32* %TOP.addr, align 4
  %5 = load i32, i32* %TOP.addr, align 4
  call void @show(i32 %4, i32 %5)
  %6 = load i32, i32* %TOP.addr, align 4
  call void @show(i32 %6, i32 0)
  call void @show(i32 1, i32 2147483649)
  %7 = load i32, i32* %TOP.addr, align 4
  %8 = xor i32 0, %7
  %9 = sub i32 0, %8
  %10 = or i32 %8, %9
  %11 = lshr i32 %10, 31
  %12 = sub i32 %11, 1
  %13 = call i32 asm "", "=r,0"(i32 %12) readnone nounwind
  %14 = zext i32 %13 to i64
  %15 = call i8* @nish_str_from_u64(i64 %14)
  call void @nish_print(i8* %15)
  %16 = load i32, i32* %TOP.addr, align 4
  %17 = call i32 asm "", "=r,0"(i32 0) readnone nounwind
  %18 = and i32 %16, %17
  %19 = xor i32 %17, -1
  %20 = and i32 0, %19
  %21 = or i32 %18, %20
  %22 = xor i32 0, %21
  %23 = sub i32 0, %22
  %24 = or i32 %22, %23
  %25 = lshr i32 %24, 31
  %26 = sub i32 %25, 1
  %27 = call i32 asm "", "=r,0"(i32 %26) readnone nounwind
  %28 = zext i32 %27 to i64
  %29 = call i8* @nish_str_from_u64(i64 %28)
  call void @nish_print(i8* %29)
  %30 = load i32, i32* %ONES.addr, align 4
  %31 = call i32 asm "", "=r,0"(i32 0) readnone nounwind
  %32 = and i32 %30, %31
  %33 = xor i32 %31, -1
  %34 = and i32 0, %33
  %35 = or i32 %32, %34
  %36 = xor i32 0, %35
  %37 = sub i32 0, %36
  %38 = or i32 %36, %37
  %39 = lshr i32 %38, 31
  %40 = sub i32 %39, 1
  %41 = call i32 asm "", "=r,0"(i32 %40) readnone nounwind
  %42 = zext i32 %41 to i64
  %43 = call i8* @nish_str_from_u64(i64 %42)
  call void @nish_print(i8* %43)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }

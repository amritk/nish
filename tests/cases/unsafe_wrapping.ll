declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #1

define noundef i32 @addI32(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = add i32 %a, %b
  ret i32 %0
}

define noundef i32 @subI32(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = sub i32 %a, %b
  ret i32 %0
}

define noundef i32 @mulI32(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = mul i32 %a, %b
  ret i32 %0
}

define noundef i64 @addI64(i64 noundef %a, i64 noundef %b) #0 {
entry:
  %0 = add i64 %a, %b
  ret i64 %0
}

define noundef i64 @subI64(i64 noundef %a, i64 noundef %b) #0 {
entry:
  %0 = sub i64 %a, %b
  ret i64 %0
}

define noundef i64 @mulI64(i64 noundef %a, i64 noundef %b) #0 {
entry:
  %0 = mul i64 %a, %b
  ret i64 %0
}

define noundef i32 @nish_main() #1 {
entry:
  %max.addr = alloca i32, align 4
  %min.addr = alloca i32, align 4
  %quarter.addr = alloca i64, align 8
  %max64.addr = alloca i64, align 8
  %min64.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 2147483647, i32* %max.addr, align 4
  %0 = load i32, i32* %max.addr, align 4
  %1 = call i32 @subI32(i32 0, i32 %0)
  %2 = sub nsw i32 %1, 1
  store i32 %2, i32* %min.addr, align 4
  %3 = load i32, i32* %max.addr, align 4
  %4 = call i32 @addI32(i32 %3, i32 1)
  %5 = call i8* @nish_str_from_i32(i32 %4)
  call void @nish_print(i8* %5)
  %6 = load i32, i32* %min.addr, align 4
  %7 = call i32 @subI32(i32 %6, i32 1)
  %8 = call i8* @nish_str_from_i32(i32 %7)
  call void @nish_print(i8* %8)
  %9 = load i32, i32* %max.addr, align 4
  %10 = call i32 @mulI32(i32 %9, i32 2)
  %11 = call i8* @nish_str_from_i32(i32 %10)
  call void @nish_print(i8* %11)
  %12 = call i32 @mulI32(i32 65536, i32 65536)
  %13 = call i8* @nish_str_from_i32(i32 %12)
  call void @nish_print(i8* %13)
  %14 = call i8* @nish_str_from_i32(i32 -2147483648)
  call void @nish_print(i8* %14)
  %15 = sext i32 1 to i64
  %16 = sext i32 62 to i64
  %17 = and i64 %16, 63
  %18 = shl i64 %15, %17
  store i64 %18, i64* %quarter.addr, align 8
  %19 = load i64, i64* %quarter.addr, align 8
  %20 = sext i32 1 to i64
  %21 = call i64 @subI64(i64 %19, i64 %20)
  %22 = load i64, i64* %quarter.addr, align 8
  %23 = call i64 @addI64(i64 %21, i64 %22)
  store i64 %23, i64* %max64.addr, align 8
  %24 = sext i32 0 to i64
  %25 = load i64, i64* %max64.addr, align 8
  %26 = call i64 @subI64(i64 %24, i64 %25)
  %27 = sext i32 1 to i64
  %28 = call i64 @subI64(i64 %26, i64 %27)
  store i64 %28, i64* %min64.addr, align 8
  %29 = load i64, i64* %max64.addr, align 8
  %30 = call i8* @nish_str_from_i64(i64 %29)
  call void @nish_print(i8* %30)
  %31 = load i64, i64* %max64.addr, align 8
  %32 = sext i32 1 to i64
  %33 = call i64 @addI64(i64 %31, i64 %32)
  %34 = call i8* @nish_str_from_i64(i64 %33)
  call void @nish_print(i8* %34)
  %35 = load i64, i64* %min64.addr, align 8
  %36 = sext i32 1 to i64
  %37 = call i64 @subI64(i64 %35, i64 %36)
  %38 = call i8* @nish_str_from_i64(i64 %37)
  call void @nish_print(i8* %38)
  %39 = load i64, i64* %max64.addr, align 8
  %40 = sext i32 2 to i64
  %41 = call i64 @mulI64(i64 %39, i64 %40)
  %42 = call i8* @nish_str_from_i64(i64 %41)
  call void @nish_print(i8* %42)
  %43 = load i64, i64* %quarter.addr, align 8
  %44 = sext i32 4 to i64
  %45 = call i64 @mulI64(i64 %43, i64 %44)
  %46 = call i8* @nish_str_from_i64(i64 %45)
  call void @nish_print(i8* %46)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind }

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #0

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
  %2 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %3, i32* %min.addr, align 4
  %5 = load i32, i32* %max.addr, align 4
  %6 = call i32 @addI32(i32 %5, i32 1)
  %7 = call i8* @nish_str_from_i32(i32 %6)
  call void @nish_print(i8* %7)
  %8 = load i32, i32* %min.addr, align 4
  %9 = call i32 @subI32(i32 %8, i32 1)
  %10 = call i8* @nish_str_from_i32(i32 %9)
  call void @nish_print(i8* %10)
  %11 = load i32, i32* %max.addr, align 4
  %12 = call i32 @mulI32(i32 %11, i32 2)
  %13 = call i8* @nish_str_from_i32(i32 %12)
  call void @nish_print(i8* %13)
  %14 = call i32 @mulI32(i32 65536, i32 65536)
  %15 = call i8* @nish_str_from_i32(i32 %14)
  call void @nish_print(i8* %15)
  %16 = call i8* @nish_str_from_i32(i32 -2147483648)
  call void @nish_print(i8* %16)
  %17 = sext i32 1 to i64
  %18 = sext i32 62 to i64
  %19 = and i64 %18, 63
  %20 = shl i64 %17, %19
  store i64 %20, i64* %quarter.addr, align 8
  %21 = load i64, i64* %quarter.addr, align 8
  %22 = sext i32 1 to i64
  %23 = call i64 @subI64(i64 %21, i64 %22)
  %24 = load i64, i64* %quarter.addr, align 8
  %25 = call i64 @addI64(i64 %23, i64 %24)
  store i64 %25, i64* %max64.addr, align 8
  %26 = sext i32 0 to i64
  %27 = load i64, i64* %max64.addr, align 8
  %28 = call i64 @subI64(i64 %26, i64 %27)
  %29 = sext i32 1 to i64
  %30 = call i64 @subI64(i64 %28, i64 %29)
  store i64 %30, i64* %min64.addr, align 8
  %31 = load i64, i64* %max64.addr, align 8
  %32 = call i8* @nish_str_from_i64(i64 %31)
  call void @nish_print(i8* %32)
  %33 = load i64, i64* %max64.addr, align 8
  %34 = sext i32 1 to i64
  %35 = call i64 @addI64(i64 %33, i64 %34)
  %36 = call i8* @nish_str_from_i64(i64 %35)
  call void @nish_print(i8* %36)
  %37 = load i64, i64* %min64.addr, align 8
  %38 = sext i32 1 to i64
  %39 = call i64 @subI64(i64 %37, i64 %38)
  %40 = call i8* @nish_str_from_i64(i64 %39)
  call void @nish_print(i8* %40)
  %41 = load i64, i64* %max64.addr, align 8
  %42 = sext i32 2 to i64
  %43 = call i64 @mulI64(i64 %41, i64 %42)
  %44 = call i8* @nish_str_from_i64(i64 %43)
  call void @nish_print(i8* %44)
  %45 = load i64, i64* %quarter.addr, align 8
  %46 = sext i32 4 to i64
  %47 = call i64 @mulI64(i64 %45, i64 %46)
  %48 = call i8* @nish_str_from_i64(i64 %47)
  call void @nish_print(i8* %48)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare noundef i64 @sts_arena_mark() #0
declare void @sts_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @sts_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @sts_str_from_u64(i64 noundef) #0

define noundef i32 @test() #0 {
entry:
  %b.addr = alloca i8, align 1
  %h.addr = alloca i16, align 2
  %w.addr = alloca i32, align 4
  %q.addr = alloca i64, align 8
  %one.addr = alloca i64, align 8
  %arena.mark = call i64 @sts_arena_mark()
  store i8 255, i8* %b.addr, align 1
  store i16 65535, i16* %h.addr, align 2
  store i32 4294967295, i32* %w.addr, align 4
  store i64 0, i64* %q.addr, align 8
  store i64 1, i64* %one.addr, align 8
  %0 = load i8, i8* %b.addr, align 1
  %1 = add i8 %0, 1
  %2 = zext i8 %1 to i64
  %3 = call i8* @sts_str_from_u64(i64 %2)
  %4 = call i8* @sts_str_concat(i8* %3, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %5 = load i16, i16* %h.addr, align 2
  %6 = add i16 %5, 1
  %7 = zext i16 %6 to i64
  %8 = call i8* @sts_str_from_u64(i64 %7)
  %9 = call i8* @sts_str_concat(i8* %4, i8* %8)
  %10 = call i8* @sts_str_concat(i8* %9, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %11 = load i32, i32* %w.addr, align 4
  %12 = add i32 %11, 1
  %13 = zext i32 %12 to i64
  %14 = call i8* @sts_str_from_u64(i64 %13)
  %15 = call i8* @sts_str_concat(i8* %10, i8* %14)
  %16 = call i8* @sts_str_concat(i8* %15, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %17 = load i64, i64* %q.addr, align 8
  %18 = load i64, i64* %one.addr, align 8
  %19 = sub i64 %17, %18
  %20 = call i8* @sts_str_from_u64(i64 %19)
  %21 = call i8* @sts_str_concat(i8* %16, i8* %20)
  call void @sts_print(i8* %21)
  %22 = load i8, i8* %b.addr, align 1
  %23 = mul i8 %22, 2
  %24 = zext i8 %23 to i64
  %25 = call i8* @sts_str_from_u64(i64 %24)
  %26 = call i8* @sts_str_concat(i8* %25, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %27 = load i16, i16* %h.addr, align 2
  %28 = mul i16 %27, 3
  %29 = zext i16 %28 to i64
  %30 = call i8* @sts_str_from_u64(i64 %29)
  %31 = call i8* @sts_str_concat(i8* %26, i8* %30)
  %32 = call i8* @sts_str_concat(i8* %31, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %33 = load i32, i32* %w.addr, align 4
  %34 = mul i32 %33, 2
  %35 = zext i32 %34 to i64
  %36 = call i8* @sts_str_from_u64(i64 %35)
  %37 = call i8* @sts_str_concat(i8* %32, i8* %36)
  call void @sts_print(i8* %37)
  call void @sts_arena_release(i64 %arena.mark)
  ret i32 0
}

attributes #0 = { nounwind willreturn }

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
  %arena.mark = call i64 @sts_arena_mark()
  store i8 200, i8* %b.addr, align 1
  store i16 60000, i16* %h.addr, align 2
  store i32 4294967295, i32* %w.addr, align 4
  %0 = sext i32 0 to i64
  %1 = sext i32 1 to i64
  %2 = sub i64 %0, %1
  store i64 %2, i64* %q.addr, align 8
  %3 = load i32, i32* %w.addr, align 4
  %4 = zext i32 %3 to i64
  %5 = call i8* @sts_str_from_u64(i64 %4)
  call void @sts_print(i8* %5)
  %6 = load i8, i8* %b.addr, align 1
  %7 = zext i8 %6 to i64
  %8 = call i8* @sts_str_from_u64(i64 %7)
  %9 = call i8* @sts_str_concat(i8* %8, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %10 = load i16, i16* %h.addr, align 2
  %11 = zext i16 %10 to i64
  %12 = call i8* @sts_str_from_u64(i64 %11)
  %13 = call i8* @sts_str_concat(i8* %9, i8* %12)
  %14 = call i8* @sts_str_concat(i8* %13, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %15 = load i32, i32* %w.addr, align 4
  %16 = zext i32 %15 to i64
  %17 = call i8* @sts_str_from_u64(i64 %16)
  %18 = call i8* @sts_str_concat(i8* %14, i8* %17)
  %19 = call i8* @sts_str_concat(i8* %18, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %20 = load i64, i64* %q.addr, align 8
  %21 = call i8* @sts_str_from_u64(i64 %20)
  %22 = call i8* @sts_str_concat(i8* %19, i8* %21)
  call void @sts_print(i8* %22)
  call void @sts_arena_release(i64 %arena.mark)
  ret i32 0
}

attributes #0 = { nounwind willreturn }

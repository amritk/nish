declare noundef i64 @sts_arena_mark() #0
declare void @sts_arena_release(i64 noundef) #0
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #0

define noundef i32 @test() #0 {
entry:
  %negative.addr = alloca i32, align 4
  %arena.mark = call i64 @sts_arena_mark()
  %0 = sub i32 0, 16
  store i32 %0, i32* %negative.addr, align 4
  %1 = load i32, i32* %negative.addr, align 4
  %2 = ashr i32 %1, 2
  %3 = call i8* @sts_str_from_i32(i32 %2)
  call void @sts_print(i8* %3)
  %4 = load i32, i32* %negative.addr, align 4
  %5 = lshr i32 %4, 28
  %6 = call i8* @sts_str_from_i32(i32 %5)
  call void @sts_print(i8* %6)
  %7 = sub i32 0, 1
  %8 = lshr i32 %7, 0
  %9 = call i8* @sts_str_from_i32(i32 %8)
  call void @sts_print(i8* %9)
  %10 = shl i32 1, 0
  %11 = call i8* @sts_str_from_i32(i32 %10)
  call void @sts_print(i8* %11)
  %12 = shl i32 1, 1
  %13 = call i8* @sts_str_from_i32(i32 %12)
  call void @sts_print(i8* %13)
  %14 = load i32, i32* %negative.addr, align 4
  %15 = ashr i32 %14, 4
  call void @sts_arena_release(i64 %arena.mark)
  ret i32 %15
}

attributes #0 = { nounwind willreturn }

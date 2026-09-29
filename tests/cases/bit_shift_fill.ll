declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define noundef i32 @test() #0 {
entry:
  %negative.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 -16, i32* %negative.addr, align 4
  %0 = load i32, i32* %negative.addr, align 4
  %1 = ashr i32 %0, 2
  %2 = call i8* @nish_str_from_i32(i32 %1)
  call void @nish_print(i8* %2)
  %3 = load i32, i32* %negative.addr, align 4
  %4 = lshr i32 %3, 28
  %5 = call i8* @nish_str_from_i32(i32 %4)
  call void @nish_print(i8* %5)
  %6 = lshr i32 -1, 0
  %7 = call i8* @nish_str_from_i32(i32 %6)
  call void @nish_print(i8* %7)
  %8 = shl i32 1, 0
  %9 = call i8* @nish_str_from_i32(i32 %8)
  call void @nish_print(i8* %9)
  %10 = shl i32 1, 1
  %11 = call i8* @nish_str_from_i32(i32 %10)
  call void @nish_print(i8* %11)
  %12 = load i32, i32* %negative.addr, align 4
  %13 = ashr i32 %12, 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %13
}

attributes #0 = { nounwind willreturn }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #1

define noundef i32 @test() #0 {
entry:
  %big.addr = alloca i32, align 4
  %seven.addr = alloca i32, align 4
  %acc.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 4000000000, i32* %big.addr, align 4
  store i32 7, i32* %seven.addr, align 4
  %0 = load i32, i32* %big.addr, align 4
  %1 = load i32, i32* %seven.addr, align 4
  %2 = udiv i32 %0, %1
  %3 = zext i32 %2 to i64
  %4 = call i8* @nish_str_from_u64(i64 %3)
  %5 = call i8* @nish_str_concat(i8* %4, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %6 = load i32, i32* %big.addr, align 4
  %7 = load i32, i32* %seven.addr, align 4
  %8 = urem i32 %6, %7
  %9 = zext i32 %8 to i64
  %10 = call i8* @nish_str_from_u64(i64 %9)
  %11 = call i8* @nish_str_concat(i8* %5, i8* %10)
  call void @nish_print(i8* %11)
  store i32 4294967295, i32* %acc.addr, align 4
  %12 = load i32, i32* %acc.addr, align 4
  %13 = udiv i32 %12, 3
  store i32 %13, i32* %acc.addr, align 4
  %14 = load i32, i32* %acc.addr, align 4
  %15 = urem i32 %14, 1000
  store i32 %15, i32* %acc.addr, align 4
  %16 = load i32, i32* %acc.addr, align 4
  %17 = zext i32 %16 to i64
  %18 = call i8* @nish_str_from_u64(i64 %17)
  call void @nish_print(i8* %18)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }

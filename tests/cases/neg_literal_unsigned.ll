@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #1

define noundef i32 @nish_main() #0 {
entry:
  %a.addr = alloca i8, align 1
  %b.addr = alloca i16, align 2
  %c.addr = alloca i32, align 4
  %d.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i8 -1, i8* %a.addr, align 1
  store i16 -2, i16* %b.addr, align 2
  store i32 -2147483648, i32* %c.addr, align 4
  store i64 -1, i64* %d.addr, align 8
  %0 = load i8, i8* %a.addr, align 1
  %1 = zext i8 %0 to i64
  %2 = call i8* @nish_str_from_u64(i64 %1)
  %3 = call i8* @nish_str_concat(i8* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %4 = load i16, i16* %b.addr, align 2
  %5 = zext i16 %4 to i64
  %6 = call i8* @nish_str_from_u64(i64 %5)
  %7 = call i8* @nish_str_concat(i8* %3, i8* %6)
  %8 = call i8* @nish_str_concat(i8* %7, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %9 = load i32, i32* %c.addr, align 4
  %10 = zext i32 %9 to i64
  %11 = call i8* @nish_str_from_u64(i64 %10)
  %12 = call i8* @nish_str_concat(i8* %8, i8* %11)
  %13 = call i8* @nish_str_concat(i8* %12, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %14 = load i64, i64* %d.addr, align 8
  %15 = call i8* @nish_str_from_u64(i64 %14)
  %16 = call i8* @nish_str_concat(i8* %13, i8* %15)
  call void @nish_print(i8* %16)
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

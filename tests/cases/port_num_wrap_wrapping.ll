declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define noundef i32 @nish_main() #0 {
entry:
  %n.addr = alloca i32, align 4
  %square.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 2147483647, i32* %n.addr, align 4
  %0 = load i32, i32* %n.addr, align 4
  %1 = add i32 %0, 1
  store i32 %1, i32* %n.addr, align 4
  %2 = load i32, i32* %n.addr, align 4
  %3 = add i32 %2, 1
  store i32 %3, i32* %n.addr, align 4
  %4 = load i32, i32* %n.addr, align 4
  %5 = sub i32 %4, 3
  store i32 %5, i32* %n.addr, align 4
  %6 = mul i32 65536, 65536
  store i32 %6, i32* %square.addr, align 4
  %7 = load i32, i32* %n.addr, align 4
  %8 = call i8* @nish_str_from_i32(i32 %7)
  call void @nish_print(i8* %8)
  %9 = load i32, i32* %square.addr, align 4
  %10 = call i8* @nish_str_from_i32(i32 %9)
  call void @nish_print(i8* %10)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }

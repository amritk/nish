declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1

define internal noundef i32 @shift(i32 noundef %x, i32 noundef %n) #0 {
entry:
  %0 = and i32 %n, 31
  %1 = lshr i32 %x, %0
  ret i32 %1
}

define noundef i32 @nish_main() #1 {
entry:
  %y.addr = alloca i32, align 4
  %z.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 -8, i32* %y.addr, align 4
  %0 = load i32, i32* %y.addr, align 4
  %1 = lshr i32 %0, 0
  store i32 %1, i32* %y.addr, align 4
  %2 = load i32, i32* %y.addr, align 4
  %3 = and i32 0, 31
  %4 = lshr i32 %2, %3
  store i32 %4, i32* %z.addr, align 4
  %5 = call i32 @shift(i32 -8, i32 1)
  %6 = call i8* @nish_str_from_i32(i32 %5)
  call void @nish_print(i8* %6)
  %7 = load i32, i32* %y.addr, align 4
  %8 = call i8* @nish_str_from_i32(i32 %7)
  call void @nish_print(i8* %8)
  %9 = load i32, i32* %z.addr, align 4
  %10 = call i8* @nish_str_from_i32(i32 %9)
  call void @nish_print(i8* %10)
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

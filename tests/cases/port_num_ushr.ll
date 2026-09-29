declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define noundef i32 @nish_main() #0 {
entry:
  %x.addr = alloca i32, align 4
  %same.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 -8, i32* %x.addr, align 4
  %0 = load i32, i32* %x.addr, align 4
  %1 = lshr i32 %0, 0
  store i32 %1, i32* %same.addr, align 4
  store i32 -1, i32* %y.addr, align 4
  %2 = load i32, i32* %y.addr, align 4
  %3 = lshr i32 %2, 4
  store i32 %3, i32* %y.addr, align 4
  %4 = load i32, i32* %same.addr, align 4
  %5 = call i8* @nish_str_from_i32(i32 %4)
  call void @nish_print(i8* %5)
  %6 = load i32, i32* %y.addr, align 4
  %7 = call i8* @nish_str_from_i32(i32 %6)
  call void @nish_print(i8* %7)
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

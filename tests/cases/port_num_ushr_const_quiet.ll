declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define noundef i32 @nish_main() #0 {
entry:
  %x.addr = alloca i32, align 4
  %a.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
  %d.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 -16, i32* %x.addr, align 4
  %0 = load i32, i32* %x.addr, align 4
  %1 = lshr i32 %0, 2
  store i32 %1, i32* %a.addr, align 4
  %2 = load i32, i32* %x.addr, align 4
  %3 = and i32 5, 31
  %4 = lshr i32 %2, %3
  store i32 %4, i32* %b.addr, align 4
  %5 = load i32, i32* %x.addr, align 4
  %6 = lshr i32 %5, 3
  store i32 %6, i32* %c.addr, align 4
  store i32 -1, i32* %d.addr, align 4
  %7 = load i32, i32* %d.addr, align 4
  %8 = lshr i32 %7, 1
  store i32 %8, i32* %d.addr, align 4
  %9 = load i32, i32* %a.addr, align 4
  %10 = call i8* @nish_str_from_i32(i32 %9)
  call void @nish_print(i8* %10)
  %11 = load i32, i32* %b.addr, align 4
  %12 = call i8* @nish_str_from_i32(i32 %11)
  call void @nish_print(i8* %12)
  %13 = load i32, i32* %c.addr, align 4
  %14 = call i8* @nish_str_from_i32(i32 %13)
  call void @nish_print(i8* %14)
  %15 = load i32, i32* %d.addr, align 4
  %16 = call i8* @nish_str_from_i32(i32 %15)
  call void @nish_print(i8* %16)
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

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_panic_div(i1 noundef zeroext) #3

define internal noundef i32 @half(i32 noundef %n) #0 {
entry:
  %0 = sdiv i32 %n, 2
  ret i32 %0
}

define internal noundef i32 @third(i32 noundef %percent) #0 {
entry:
  %0 = sdiv i32 %percent, 3
  ret i32 %0
}

define noundef i32 @nish_main() #1 {
entry:
  %bytes.addr = alloca i8, align 1
  %count.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i8 200, i8* %bytes.addr, align 1
  %0 = load i8, i8* %bytes.addr, align 1
  %1 = udiv i8 %0, 3
  store i8 %1, i8* %bytes.addr, align 1
  store i32 10, i32* %count.addr, align 4
  %2 = load i32, i32* %count.addr, align 4
  %3 = udiv i32 %2, 4
  store i32 %3, i32* %count.addr, align 4
  %4 = call i32 @half(i32 7)
  %5 = call i8* @nish_str_from_i32(i32 %4)
  call void @nish_print(i8* %5)
  %6 = call i32 @third(i32 50)
  %7 = call i8* @nish_str_from_i32(i32 %6)
  call void @nish_print(i8* %7)
  %8 = sext i32 7 to i64
  %9 = sext i32 2 to i64
  %10 = icmp eq i64 %9, 0
  %11 = icmp eq i64 %8, -9223372036854775808
  %12 = icmp eq i64 %9, -1
  %13 = and i1 %11, %12
  %14 = or i1 %10, %13
  br i1 %14, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %10)
  unreachable

div.ok:
  %15 = sdiv i64 %8, %9
  %16 = trunc i64 %15 to i32
  %17 = call i8* @nish_str_from_i32(i32 %16)
  call void @nish_print(i8* %17)
  %18 = load i8, i8* %bytes.addr, align 1
  %19 = zext i8 %18 to i32
  %20 = load i32, i32* %count.addr, align 4
  %21 = add nsw i32 %19, %20
  %22 = call i8* @nish_str_from_i32(i32 %21)
  call void @nish_print(i8* %22)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }

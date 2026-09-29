declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_panic_div(i1 noundef zeroext) #2

define noundef i32 @nish_main() #0 {
entry:
  %m.addr = alloca i32, align 4
  %d.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 -2147483648, i32* %m.addr, align 4
  store i32 -1, i32* %d.addr, align 4
  %0 = load i32, i32* %m.addr, align 4
  %1 = load i32, i32* %d.addr, align 4
  %2 = icmp eq i32 %1, 0
  %3 = icmp eq i32 %0, -2147483648
  %4 = icmp eq i32 %1, -1
  %5 = and i1 %3, %4
  %6 = or i1 %2, %5
  br i1 %6, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %2)
  unreachable

div.ok:
  %7 = srem i32 %0, %1
  %8 = call i8* @nish_str_from_i32(i32 %7)
  call void @nish_print(i8* %8)
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
attributes #2 = { nounwind noreturn cold }

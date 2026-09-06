declare void @sts_free_arena() #1
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #1
declare void @sts_panic_div(i1 noundef zeroext) #2

define noundef i32 @sts_main() #0 {
entry:
  %m.addr = alloca i32, align 4
  %d.addr = alloca i32, align 4
  %0 = sub i32 0, -2147483648
  store i32 %0, i32* %m.addr, align 4
  %1 = sub i32 0, 1
  store i32 %1, i32* %d.addr, align 4
  %2 = load i32, i32* %m.addr, align 4
  %3 = load i32, i32* %d.addr, align 4
  %4 = icmp eq i32 %3, 0
  %5 = icmp eq i32 %2, -2147483648
  %6 = icmp eq i32 %3, -1
  %7 = and i1 %5, %6
  %8 = or i1 %4, %7
  br i1 %8, label %div.fail, label %div.ok

div.fail:
  call void @sts_panic_div(i1 zeroext %4)
  unreachable

div.ok:
  %9 = srem i32 %2, %3
  %10 = call i8* @sts_str_from_i32(i32 %9)
  call void @sts_print(i8* %10)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @sts_main()
  call void @sts_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }

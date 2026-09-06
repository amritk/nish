@.str.0 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"before\00" }, align 8

declare void @sts_free_arena() #1
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #1
declare void @sts_panic_div(i1 noundef zeroext) #2

define noundef i32 @sts_main() #0 {
entry:
  %n.addr = alloca i32, align 4
  store i32 0, i32* %n.addr, align 4
  call void @sts_print(i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*))
  %0 = load i32, i32* %n.addr, align 4
  %1 = icmp eq i32 %0, 0
  %2 = icmp eq i32 10, -2147483648
  %3 = icmp eq i32 %0, -1
  %4 = and i1 %2, %3
  %5 = or i1 %1, %4
  br i1 %5, label %div.fail, label %div.ok

div.fail:
  call void @sts_panic_div(i1 zeroext %1)
  unreachable

div.ok:
  %6 = sdiv i32 10, %0
  %7 = call i8* @sts_str_from_i32(i32 %6)
  call void @sts_print(i8* %7)
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

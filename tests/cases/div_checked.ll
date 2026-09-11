@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_panic_div(i1 noundef zeroext) #2

define internal noundef i32 @div(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = icmp eq i32 %b, 0
  %1 = icmp eq i32 %a, -2147483648
  %2 = icmp eq i32 %b, -1
  %3 = and i1 %1, %2
  %4 = or i1 %0, %3
  br i1 %4, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %0)
  unreachable

div.ok:
  %5 = sdiv i32 %a, %b
  ret i32 %5
}

define noundef i32 @nish_main() #0 {
entry:
  %acc.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 100, i32* %acc.addr, align 4
  %0 = load i32, i32* %acc.addr, align 4
  %1 = icmp eq i32 7, 0
  %2 = icmp eq i32 %0, -2147483648
  %3 = icmp eq i32 7, -1
  %4 = and i1 %2, %3
  %5 = or i1 %1, %4
  br i1 %5, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %1)
  unreachable

div.ok:
  %6 = sdiv i32 %0, 7
  store i32 %6, i32* %acc.addr, align 4
  %7 = load i32, i32* %acc.addr, align 4
  %8 = icmp eq i32 5, 0
  %9 = icmp eq i32 %7, -2147483648
  %10 = icmp eq i32 5, -1
  %11 = and i1 %9, %10
  %12 = or i1 %8, %11
  br i1 %12, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @nish_panic_div(i1 zeroext %8)
  unreachable

div.ok.1:
  %13 = srem i32 %7, 5
  store i32 %13, i32* %acc.addr, align 4
  %14 = sub nsw i32 0, 7
  %15 = call i32 @div(i32 %14, i32 2)
  %16 = call i8* @nish_str_from_i32(i32 %15)
  %17 = call i8* @nish_str_concat(i8* %16, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %18 = sub nsw i32 0, 2
  %19 = call i32 @div(i32 7, i32 %18)
  %20 = call i8* @nish_str_from_i32(i32 %19)
  %21 = call i8* @nish_str_concat(i8* %17, i8* %20)
  %22 = call i8* @nish_str_concat(i8* %21, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %23 = sub nsw i32 0, 7
  %24 = icmp eq i32 3, 0
  %25 = icmp eq i32 %23, -2147483648
  %26 = icmp eq i32 3, -1
  %27 = and i1 %25, %26
  %28 = or i1 %24, %27
  br i1 %28, label %div.fail.2, label %div.ok.2

div.fail.2:
  call void @nish_panic_div(i1 zeroext %24)
  unreachable

div.ok.2:
  %29 = srem i32 %23, 3
  %30 = call i8* @nish_str_from_i32(i32 %29)
  %31 = call i8* @nish_str_concat(i8* %22, i8* %30)
  %32 = call i8* @nish_str_concat(i8* %31, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %33 = load i32, i32* %acc.addr, align 4
  %34 = call i8* @nish_str_from_i32(i32 %33)
  %35 = call i8* @nish_str_concat(i8* %32, i8* %34)
  %36 = call i8* @nish_str_concat(i8* %35, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %37 = sub nsw i32 0, -2147483648
  %38 = call i32 @div(i32 %37, i32 1)
  %39 = call i8* @nish_str_from_i32(i32 %38)
  %40 = call i8* @nish_str_concat(i8* %36, i8* %39)
  call void @nish_print(i8* %40)
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

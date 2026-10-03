declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_panic_div(i1 noundef zeroext) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define internal noundef i32 @half(i32 noundef %n) #0 {
entry:
  %0 = icmp eq i32 2, 0
  %1 = icmp eq i32 %n, -2147483648
  %2 = icmp eq i32 2, -1
  %3 = and i1 %1, %2
  %4 = or i1 %0, %3
  br i1 %4, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %0)
  unreachable

div.ok:
  %5 = sdiv i32 %n, 2
  ret i32 %5
}

define internal noundef i32 @third(i32 noundef %percent) #0 {
entry:
  %0 = icmp eq i32 3, 0
  %1 = icmp eq i32 %percent, -2147483648
  %2 = icmp eq i32 3, -1
  %3 = and i1 %1, %2
  %4 = or i1 %0, %3
  br i1 %4, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %0)
  unreachable

div.ok:
  %5 = sdiv i32 %percent, 3
  ret i32 %5
}

define noundef i32 @nish_main() #0 {
entry:
  %bytes.addr = alloca i8, align 1
  %count.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i8 200, i8* %bytes.addr, align 1
  %0 = load i8, i8* %bytes.addr, align 1
  %1 = icmp eq i8 3, 0
  br i1 %1, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %1)
  unreachable

div.ok:
  %2 = udiv i8 %0, 3
  store i8 %2, i8* %bytes.addr, align 1
  store i32 10, i32* %count.addr, align 4
  %3 = load i32, i32* %count.addr, align 4
  %4 = icmp eq i32 4, 0
  br i1 %4, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @nish_panic_div(i1 zeroext %4)
  unreachable

div.ok.1:
  %5 = udiv i32 %3, 4
  store i32 %5, i32* %count.addr, align 4
  %6 = call i32 @half(i32 7)
  %7 = call i8* @nish_str_from_i32(i32 %6)
  call void @nish_print(i8* %7)
  %8 = call i32 @third(i32 50)
  %9 = call i8* @nish_str_from_i32(i32 %8)
  call void @nish_print(i8* %9)
  %10 = sext i32 7 to i64
  %11 = sext i32 2 to i64
  %12 = icmp eq i64 %11, 0
  %13 = icmp eq i64 %10, -9223372036854775808
  %14 = icmp eq i64 %11, -1
  %15 = and i1 %13, %14
  %16 = or i1 %12, %15
  br i1 %16, label %div.fail.2, label %div.ok.2

div.fail.2:
  call void @nish_panic_div(i1 zeroext %12)
  unreachable

div.ok.2:
  %17 = sdiv i64 %10, %11
  %18 = trunc i64 %17 to i32
  %19 = call i8* @nish_str_from_i32(i32 %18)
  call void @nish_print(i8* %19)
  %20 = load i8, i8* %bytes.addr, align 1
  %21 = zext i8 %20 to i32
  %22 = load i32, i32* %count.addr, align 4
  %23 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %21, i32 %22)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok

ovf.ok:
  %26 = call i8* @nish_str_from_i32(i32 %24)
  call void @nish_print(i8* %26)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
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
attributes #3 = { nounwind willreturn readnone }

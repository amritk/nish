@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare noundef i64 @sts_arena_mark() #1
declare void @sts_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @sts_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @sts_str_from_u64(i64 noundef) #1
declare void @sts_panic_div(i1 noundef zeroext) #2

define noundef i32 @test() #0 {
entry:
  %big.addr = alloca i32, align 4
  %seven.addr = alloca i32, align 4
  %acc.addr = alloca i32, align 4
  %arena.mark = call i64 @sts_arena_mark()
  store i32 4000000000, i32* %big.addr, align 4
  store i32 7, i32* %seven.addr, align 4
  %0 = load i32, i32* %big.addr, align 4
  %1 = load i32, i32* %seven.addr, align 4
  %2 = icmp eq i32 %1, 0
  br i1 %2, label %div.fail, label %div.ok

div.fail:
  call void @sts_panic_div(i1 zeroext %2)
  unreachable

div.ok:
  %3 = udiv i32 %0, %1
  %4 = zext i32 %3 to i64
  %5 = call i8* @sts_str_from_u64(i64 %4)
  %6 = call i8* @sts_str_concat(i8* %5, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %7 = load i32, i32* %big.addr, align 4
  %8 = load i32, i32* %seven.addr, align 4
  %9 = icmp eq i32 %8, 0
  br i1 %9, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @sts_panic_div(i1 zeroext %9)
  unreachable

div.ok.1:
  %10 = urem i32 %7, %8
  %11 = zext i32 %10 to i64
  %12 = call i8* @sts_str_from_u64(i64 %11)
  %13 = call i8* @sts_str_concat(i8* %6, i8* %12)
  call void @sts_print(i8* %13)
  store i32 4294967295, i32* %acc.addr, align 4
  %14 = load i32, i32* %acc.addr, align 4
  %15 = icmp eq i32 3, 0
  br i1 %15, label %div.fail.2, label %div.ok.2

div.fail.2:
  call void @sts_panic_div(i1 zeroext %15)
  unreachable

div.ok.2:
  %16 = udiv i32 %14, 3
  store i32 %16, i32* %acc.addr, align 4
  %17 = load i32, i32* %acc.addr, align 4
  %18 = icmp eq i32 1000, 0
  br i1 %18, label %div.fail.3, label %div.ok.3

div.fail.3:
  call void @sts_panic_div(i1 zeroext %18)
  unreachable

div.ok.3:
  %19 = urem i32 %17, 1000
  store i32 %19, i32* %acc.addr, align 4
  %20 = load i32, i32* %acc.addr, align 4
  %21 = zext i32 %20 to i64
  %22 = call i8* @sts_str_from_u64(i64 %21)
  call void @sts_print(i8* %22)
  call void @sts_arena_release(i64 %arena.mark)
  ret i32 0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }

@.str.0 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c" * 2 = \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare noalias noundef nonnull align 8 i8* @sts_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @sts_str_from_i64(i64 noundef) #2
declare void @sts_panic_div(i1 noundef zeroext) #3

define noundef i64 @square(i64 noundef %x) #0 {
entry:
  %0 = mul i64 %x, %x
  ret i64 %0
}

define noundef i32 @test() #1 {
entry:
  %big.addr = alloca i64, align 8
  %sq.addr = alloca i64, align 8
  %n.addr = alloca i32, align 4
  store i64 3000000000, i64* %big.addr, align 8
  %0 = load i64, i64* %big.addr, align 8
  %1 = call i64 @square(i64 %0)
  store i64 %1, i64* %sq.addr, align 8
  %2 = load i64, i64* %sq.addr, align 8
  %3 = call i8* @sts_str_from_i64(i64 %2)
  call void @sts_print(i8* %3)
  %4 = load i64, i64* %big.addr, align 8
  %5 = call i8* @sts_str_from_i64(i64 %4)
  %6 = call i8* @sts_str_concat(i8* %5, i8* bitcast ({ i64, [8 x i8] }* @.str.0 to i8*))
  %7 = load i64, i64* %big.addr, align 8
  %8 = mul i64 %7, 2
  %9 = call i8* @sts_str_from_i64(i64 %8)
  %10 = call i8* @sts_str_concat(i8* %6, i8* %9)
  call void @sts_print(i8* %10)
  %11 = load i64, i64* %big.addr, align 8
  %12 = icmp sgt i64 %11, 5
  %13 = select i1 %12, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  call void @sts_print(i8* %13)
  %14 = load i64, i64* %big.addr, align 8
  %15 = sub i64 0, %14
  %16 = call i8* @sts_str_from_i64(i64 %15)
  call void @sts_print(i8* %16)
  %17 = load i64, i64* %sq.addr, align 8
  %18 = mul i64 %17, 2
  %19 = call i8* @sts_str_from_i64(i64 %18)
  call void @sts_print(i8* %19)
  store i32 7, i32* %n.addr, align 4
  %20 = load i32, i32* %n.addr, align 4
  %21 = sext i32 %20 to i64
  %22 = add i64 %21, 1
  %23 = call i8* @sts_str_from_i64(i64 %22)
  call void @sts_print(i8* %23)
  %24 = load i64, i64* %sq.addr, align 8
  %25 = icmp eq i64 1000, 0
  %26 = icmp eq i64 %24, -9223372036854775808
  %27 = icmp eq i64 1000, -1
  %28 = and i1 %26, %27
  %29 = or i1 %25, %28
  br i1 %29, label %div.fail, label %div.ok

div.fail:
  call void @sts_panic_div(i1 zeroext %25)
  unreachable

div.ok:
  %30 = srem i64 %24, 1000
  %31 = trunc i64 %30 to i32
  ret i32 %31
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }

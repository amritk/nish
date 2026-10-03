declare void @nish_panic_div(i1 noundef zeroext) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #2

define noundef i32 @test() #0 {
entry:
  %a.addr = alloca i32, align 4
  %b.addr = alloca i32, align 4
  %wide.addr = alloca i64, align 8
  %n.addr = alloca i32, align 4
  %fits.addr = alloca i32, align 4
  %shifted.addr = alloca i32, align 4
  store i32 70000, i32* %a.addr, align 4
  store i32 40000, i32* %b.addr, align 4
  %0 = load i32, i32* %a.addr, align 4
  %1 = sext i32 %0 to i64
  %2 = load i32, i32* %b.addr, align 4
  %3 = sext i32 %2 to i64
  %4 = mul nsw i64 %1, %3
  store i64 %4, i64* %wide.addr, align 8
  store i32 3, i32* %n.addr, align 4
  %5 = load i32, i32* %n.addr, align 4
  %6 = mul nsw i32 %5, 2
  store i32 %6, i32* %n.addr, align 4
  %7 = add nsw i32 2147483646, 1
  store i32 %7, i32* %fits.addr, align 4
  %8 = shl i32 1, 31
  store i32 %8, i32* %shifted.addr, align 4
  %9 = load i64, i64* %wide.addr, align 8
  %10 = icmp eq i64 100000000, 0
  %11 = icmp eq i64 %9, -9223372036854775808
  %12 = icmp eq i64 100000000, -1
  %13 = and i1 %11, %12
  %14 = or i1 %10, %13
  br i1 %14, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %10)
  unreachable

div.ok:
  %15 = sdiv i64 %9, 100000000
  %16 = trunc i64 %15 to i32
  %17 = load i32, i32* %n.addr, align 4
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %16, i32 %17)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok

ovf.ok:
  %21 = load i32, i32* %fits.addr, align 4
  %22 = sub nsw i32 %21, 2147483646
  %23 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %19, i32 %22)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %26 = load i32, i32* %shifted.addr, align 4
  %27 = load i32, i32* %shifted.addr, align 4
  %28 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %26, i32 %27)
  %29 = extractvalue { i32, i1 } %28, 0
  %30 = extractvalue { i32, i1 } %28, 1
  br i1 %30, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %31 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %24, i32 %29)
  %32 = extractvalue { i32, i1 } %31, 0
  %33 = extractvalue { i32, i1 } %31, 1
  br i1 %33, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  ret i32 %32

ovf.fail:
  %ovf.op = phi i32 [ 0, %div.ok ], [ 0, %ovf.ok ], [ 1, %ovf.ok.1 ], [ 0, %ovf.ok.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
attributes #2 = { nounwind willreturn readnone }

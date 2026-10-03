declare void @nish_panic_div(i1 noundef zeroext) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2

define internal noundef i32 @sumDigits(i32 noundef %n) #0 {
entry:
  %sum.addr = alloca i32, align 4
  %rest.addr = alloca i32, align 4
  store i32 0, i32* %sum.addr, align 4
  store i32 %n, i32* %rest.addr, align 4
  br label %do.body

do.body:
  %0 = load i32, i32* %sum.addr, align 4
  %1 = load i32, i32* %rest.addr, align 4
  %2 = icmp eq i32 10, 0
  %3 = icmp eq i32 %1, -2147483648
  %4 = icmp eq i32 10, -1
  %5 = and i1 %3, %4
  %6 = or i1 %2, %5
  br i1 %6, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %2)
  unreachable

div.ok:
  %7 = srem i32 %1, 10
  %8 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 %7)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %9, i32* %sum.addr, align 4
  %11 = load i32, i32* %rest.addr, align 4
  %12 = icmp eq i32 10, 0
  %13 = icmp eq i32 %11, -2147483648
  %14 = icmp eq i32 10, -1
  %15 = and i1 %13, %14
  %16 = or i1 %12, %15
  br i1 %16, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @nish_panic_div(i1 zeroext %12)
  unreachable

div.ok.1:
  %17 = sdiv i32 %11, 10
  store i32 %17, i32* %rest.addr, align 4
  br label %do.cond

do.cond:
  %18 = load i32, i32* %rest.addr, align 4
  %19 = icmp sgt i32 %18, 0
  br i1 %19, label %do.body, label %do.end

do.end:
  %20 = load i32, i32* %sum.addr, align 4
  ret i32 %20

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @sumDigits(i32 0)
  %1 = call i32 @sumDigits(i32 9876)
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 %1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %3

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
attributes #2 = { nounwind willreturn readnone }

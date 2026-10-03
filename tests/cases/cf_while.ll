declare void @nish_panic_div(i1 noundef zeroext) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #2

define internal noundef i32 @countDigits(i32 noundef %n) #0 {
entry:
  %digits.addr = alloca i32, align 4
  %rest.addr = alloca i32, align 4
  store i32 0, i32* %digits.addr, align 4
  store i32 %n, i32* %rest.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %rest.addr, align 4
  %1 = icmp sgt i32 %0, 0
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %rest.addr, align 4
  %3 = icmp eq i32 10, 0
  %4 = icmp eq i32 %2, -2147483648
  %5 = icmp eq i32 10, -1
  %6 = and i1 %4, %5
  %7 = or i1 %3, %6
  br i1 %7, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %3)
  unreachable

div.ok:
  %8 = sdiv i32 %2, 10
  store i32 %8, i32* %rest.addr, align 4
  %9 = load i32, i32* %digits.addr, align 4
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 1)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %11, i32* %digits.addr, align 4
  br label %while.cond

while.end:
  %13 = load i32, i32* %digits.addr, align 4
  ret i32 %13

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @firstPowerOver(i32 noundef %limit) #0 {
entry:
  %x.addr = alloca i32, align 4
  store i32 1, i32* %x.addr, align 4
  br label %while.cond

while.cond:
  br i1 true, label %while.body, label %while.end

while.body:
  %0 = load i32, i32* %x.addr, align 4
  %1 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %0, i32 2)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %2, i32* %x.addr, align 4
  %4 = load i32, i32* %x.addr, align 4
  %5 = icmp sgt i32 %4, %limit
  br i1 %5, label %if.then, label %if.end

if.then:
  %6 = load i32, i32* %x.addr, align 4
  ret i32 %6

if.end:
  br label %while.cond

while.end:
  unreachable

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @countDigits(i32 12345)
  %1 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %0, i32 1000)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  %4 = call i32 @firstPowerOver(i32 100)
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %4)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %6

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
attributes #2 = { nounwind willreturn readnone }

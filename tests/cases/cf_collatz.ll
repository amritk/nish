declare void @nish_panic_div(i1 noundef zeroext) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #2

define internal noundef i32 @collatzSteps(i32 noundef %n) #0 {
entry:
  %steps.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  store i32 0, i32* %steps.addr, align 4
  store i32 %n, i32* %x.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %x.addr, align 4
  %1 = icmp ne i32 %0, 1
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %x.addr, align 4
  %3 = icmp eq i32 2, 0
  %4 = icmp eq i32 %2, -2147483648
  %5 = icmp eq i32 2, -1
  %6 = and i1 %4, %5
  %7 = or i1 %3, %6
  br i1 %7, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %3)
  unreachable

div.ok:
  %8 = srem i32 %2, 2
  %9 = icmp eq i32 %8, 0
  br i1 %9, label %if.then, label %if.else

if.then:
  %10 = load i32, i32* %x.addr, align 4
  %11 = icmp eq i32 2, 0
  %12 = icmp eq i32 %10, -2147483648
  %13 = icmp eq i32 2, -1
  %14 = and i1 %12, %13
  %15 = or i1 %11, %14
  br i1 %15, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @nish_panic_div(i1 zeroext %11)
  unreachable

div.ok.1:
  %16 = sdiv i32 %10, 2
  store i32 %16, i32* %x.addr, align 4
  br label %if.end

if.else:
  %17 = load i32, i32* %x.addr, align 4
  %18 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 3, i32 %17)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok

ovf.ok:
  %21 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %19, i32 1)
  %22 = extractvalue { i32, i1 } %21, 0
  %23 = extractvalue { i32, i1 } %21, 1
  br i1 %23, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %22, i32* %x.addr, align 4
  br label %if.end

if.end:
  %24 = load i32, i32* %steps.addr, align 4
  %25 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %24, i32 1)
  %26 = extractvalue { i32, i1 } %25, 0
  %27 = extractvalue { i32, i1 } %25, 1
  br i1 %27, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %26, i32* %steps.addr, align 4
  br label %while.cond

while.end:
  %28 = load i32, i32* %steps.addr, align 4
  ret i32 %28

ovf.fail:
  %ovf.op = phi i32 [ 2, %if.else ], [ 0, %ovf.ok ], [ 0, %if.end ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @test() #0 {
entry:
  %0 = tail call i32 @collatzSteps(i32 27)
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
attributes #2 = { nounwind willreturn readnone }

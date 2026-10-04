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
  %3 = srem i32 %2, 2
  %4 = icmp eq i32 %3, 0
  br i1 %4, label %if.then, label %if.else

if.then:
  %5 = load i32, i32* %x.addr, align 4
  %6 = sdiv i32 %5, 2
  store i32 %6, i32* %x.addr, align 4
  br label %if.end

if.else:
  %7 = load i32, i32* %x.addr, align 4
  %8 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 3, i32 %7)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok

ovf.ok:
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 1)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %12, i32* %x.addr, align 4
  br label %if.end

if.end:
  %14 = load i32, i32* %steps.addr, align 4
  %15 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %14, i32 1)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %16, i32* %steps.addr, align 4
  br label %while.cond

while.end:
  %18 = load i32, i32* %steps.addr, align 4
  ret i32 %18

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

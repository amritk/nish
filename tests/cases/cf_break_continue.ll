declare void @nish_panic_div(i1 noundef zeroext) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #2

define internal noundef i32 @firstMultipleOver(i32 noundef %n, i32 noundef %limit) #0 {
entry:
  %k.addr = alloca i32, align 4
  store i32 0, i32* %k.addr, align 4
  br label %while.cond

while.cond:
  br i1 true, label %while.body, label %while.end

while.body:
  %0 = load i32, i32* %k.addr, align 4
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 1)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %2, i32* %k.addr, align 4
  %4 = load i32, i32* %k.addr, align 4
  %5 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %4, i32 %n)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %8 = icmp sgt i32 %6, %limit
  br i1 %8, label %if.then, label %if.end

if.then:
  br label %while.end

if.end:
  br label %while.cond

while.end:
  %9 = load i32, i32* %k.addr, align 4
  ret i32 %9

ovf.fail:
  %ovf.op = phi i32 [ 0, %while.body ], [ 2, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @sumOdd(i32 noundef %n) #0 {
entry:
  %s.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %s.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
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
  br i1 %9, label %if.then, label %if.end

if.then:
  br label %for.inc

if.end:
  %10 = load i32, i32* %s.addr, align 4
  %11 = load i32, i32* %i.addr, align 4
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %10, i32 %11)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %13, i32* %s.addr, align 4
  br label %for.inc

for.inc:
  %15 = load i32, i32* %i.addr, align 4
  %16 = add nsw i32 %15, 1
  store i32 %16, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %17 = load i32, i32* %s.addr, align 4
  ret i32 %17

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @largestPowerOfTwo(i32 noundef %limit) #0 {
entry:
  %p.addr = alloca i32, align 4
  store i32 1, i32* %p.addr, align 4
  br label %for.body

for.body:
  %0 = load i32, i32* %p.addr, align 4
  %1 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %0, i32 2)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  %4 = icmp sgt i32 %2, %limit
  br i1 %4, label %if.then, label %if.end

if.then:
  br label %for.end

if.end:
  %5 = load i32, i32* %p.addr, align 4
  %6 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %5, i32 2)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %7, i32* %p.addr, align 4
  br label %for.body

for.end:
  %9 = load i32, i32* %p.addr, align 4
  ret i32 %9

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @firstMultipleOver(i32 7, i32 30)
  %1 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %0, i32 1000)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  %4 = call i32 @sumOdd(i32 10)
  %5 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %4, i32 10)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %8 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %6)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %11 = call i32 @largestPowerOfTwo(i32 100)
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 %11)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  ret i32 %13

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 2, %ovf.ok ], [ 0, %ovf.ok.1 ], [ 0, %ovf.ok.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
attributes #2 = { nounwind willreturn readnone }

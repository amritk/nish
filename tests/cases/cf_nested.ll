declare extern_weak void @nish_panic_overflow(i32 noundef) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #2

define internal noundef i32 @countPairs(i32 noundef %n) #0 {
entry:
  %count.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  store i32 0, i32* %count.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = add nsw i32 %2, 1
  store i32 %3, i32* %j.addr, align 4
  br label %for.cond.1

for.cond.1:
  %4 = load i32, i32* %j.addr, align 4
  %5 = icmp slt i32 %4, %n
  br i1 %5, label %for.body.1, label %for.end.1

for.body.1:
  %6 = load i32, i32* %i.addr, align 4
  %7 = load i32, i32* %j.addr, align 4
  %8 = add nsw i32 %6, %7
  %9 = srem i32 %8, 3
  %10 = icmp eq i32 %9, 0
  br i1 %10, label %if.then, label %if.end

if.then:
  %11 = load i32, i32* %count.addr, align 4
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %11, i32 1)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %13, i32* %count.addr, align 4
  br label %if.end

if.end:
  br label %for.inc.1

for.inc.1:
  %15 = load i32, i32* %j.addr, align 4
  %16 = add nsw i32 %15, 1
  store i32 %16, i32* %j.addr, align 4
  br label %for.cond.1

for.end.1:
  br label %for.inc

for.inc:
  %17 = load i32, i32* %i.addr, align 4
  %18 = add nsw i32 %17, 1
  store i32 %18, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %19 = load i32, i32* %count.addr, align 4
  ret i32 %19

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @search(i32 noundef %limit) #0 {
entry:
  %found.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  store i32 0, i32* %found.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %limit
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = add nsw i32 %2, 1
  store i32 %3, i32* %i.addr, align 4
  %4 = load i32, i32* %i.addr, align 4
  %5 = srem i32 %4, 2
  %6 = icmp eq i32 %5, 0
  br i1 %6, label %if.then, label %if.end

if.then:
  br label %while.cond

if.end:
  store i32 0, i32* %j.addr, align 4
  br label %while.cond.1

while.cond.1:
  br i1 true, label %while.body.1, label %while.end.1

while.body.1:
  %7 = load i32, i32* %j.addr, align 4
  %8 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 1)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %9, i32* %j.addr, align 4
  %11 = load i32, i32* %j.addr, align 4
  %12 = load i32, i32* %j.addr, align 4
  %13 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %11, i32 %12)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %16 = load i32, i32* %i.addr, align 4
  %17 = icmp sgt i32 %14, %16
  br i1 %17, label %if.then.1, label %if.end.1

if.then.1:
  br label %while.end.1

if.end.1:
  br label %while.cond.1

while.end.1:
  %18 = load i32, i32* %found.addr, align 4
  %19 = load i32, i32* %j.addr, align 4
  %20 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %18, i32 %19)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %21, i32* %found.addr, align 4
  br label %while.cond

while.end:
  %23 = load i32, i32* %found.addr, align 4
  ret i32 %23

ovf.fail:
  %ovf.op = phi i32 [ 0, %while.body.1 ], [ 2, %ovf.ok ], [ 0, %while.end.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @countPairs(i32 6)
  %1 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %0, i32 100)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  %4 = call i32 @search(i32 5)
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

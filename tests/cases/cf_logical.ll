declare void @nish_panic_div(i1 noundef zeroext) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1

define internal noundef zeroext i1 @quotientOver(i32 noundef %x, i32 noundef %k) #0 {
entry:
  %0 = icmp eq i32 %x, 0
  %1 = icmp eq i32 100, -2147483648
  %2 = icmp eq i32 %x, -1
  %3 = and i1 %1, %2
  %4 = or i1 %0, %3
  br i1 %4, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %0)
  unreachable

div.ok:
  %5 = sdiv i32 100, %x
  %6 = icmp sgt i32 %5, %k
  ret i1 %6
}

define internal noundef zeroext i1 @bigQuotient(i32 noundef %x) #0 {
entry:
  %0 = icmp ne i32 %x, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = call i1 @quotientOver(i32 %x, i32 3)
  br label %land.end

land.end:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs ]
  ret i1 %2
}

define internal noundef zeroext i1 @zeroOrSmallQuotient(i32 noundef %x) #0 {
entry:
  %0 = icmp eq i32 %x, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = icmp eq i32 %x, 0
  %2 = icmp eq i32 100, -2147483648
  %3 = icmp eq i32 %x, -1
  %4 = and i1 %2, %3
  %5 = or i1 %1, %4
  br i1 %5, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %1)
  unreachable

div.ok:
  %6 = sdiv i32 100, %x
  %7 = icmp slt i32 %6, 50
  br label %lor.end

lor.end:
  %8 = phi i1 [ true, %entry ], [ %7, %div.ok ]
  ret i1 %8
}

define internal noundef zeroext i1 @inRange(i32 noundef %x, i32 noundef %lo, i32 noundef %hi) #1 {
entry:
  %0 = icmp sle i32 %lo, %x
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = icmp sle i32 %x, %hi
  br label %land.end

land.end:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs ]
  ret i1 %2
}

define noundef i32 @test() #0 {
entry:
  %n.addr = alloca i32, align 4
  store i32 0, i32* %n.addr, align 4
  %0 = call i1 @bigQuotient(i32 0)
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = load i32, i32* %n.addr, align 4
  %2 = add nsw i32 %1, 1
  store i32 %2, i32* %n.addr, align 4
  br label %if.end

if.end:
  %3 = call i1 @bigQuotient(i32 10)
  br i1 %3, label %if.then.1, label %if.end.1

if.then.1:
  %4 = load i32, i32* %n.addr, align 4
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %4, i32 2)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %6, i32* %n.addr, align 4
  br label %if.end.1

if.end.1:
  %8 = call i1 @zeroOrSmallQuotient(i32 0)
  br i1 %8, label %if.then.2, label %if.end.2

if.then.2:
  %9 = load i32, i32* %n.addr, align 4
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 4)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %11, i32* %n.addr, align 4
  br label %if.end.2

if.end.2:
  %13 = call i1 @zeroOrSmallQuotient(i32 1)
  br i1 %13, label %if.then.3, label %if.end.3

if.then.3:
  %14 = load i32, i32* %n.addr, align 4
  %15 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %14, i32 8)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %16, i32* %n.addr, align 4
  br label %if.end.3

if.end.3:
  %18 = call i1 @inRange(i32 5, i32 1, i32 9)
  br i1 %18, label %land.rhs, label %land.end

land.rhs:
  %19 = call i1 @inRange(i32 0, i32 1, i32 9)
  %20 = xor i1 %19, true
  br label %land.end

land.end:
  %21 = phi i1 [ false, %if.end.3 ], [ %20, %land.rhs ]
  br i1 %21, label %if.then.4, label %if.end.4

if.then.4:
  %22 = load i32, i32* %n.addr, align 4
  %23 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %22, i32 16)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %24, i32* %n.addr, align 4
  br label %if.end.4

if.end.4:
  %26 = load i32, i32* %n.addr, align 4
  ret i32 %26

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind noreturn cold }

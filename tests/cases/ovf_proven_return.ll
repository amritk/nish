%struct.nish_result.i32.i32 = type { i1, i32, i32 }

declare void @nish_panic_div(i1 noundef zeroext) #3

define internal noundef i32 @clamp(i32 noundef %x) #0 {
entry:
  %0 = icmp slt i32 %x, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %1 = icmp sgt i32 %x, 1000
  br i1 %1, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 1000

if.end.1:
  ret i32 %x
}

define internal { i1, i32, i32 } @half(i32 noundef %n) #1 {
entry:
  %0 = icmp eq i32 2, 0
  %1 = icmp eq i32 %n, -2147483648
  %2 = icmp eq i32 2, -1
  %3 = and i1 %1, %2
  %4 = or i1 %0, %3
  br i1 %4, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %0)
  unreachable

div.ok:
  %5 = srem i32 %n, 2
  %6 = icmp ne i32 %5, 0
  br i1 %6, label %if.then, label %if.end

if.then:
  %7 = insertvalue { i1, i32, i32 } { i1 false, i32 undef, i32 undef }, i32 %n, 2
  ret { i1, i32, i32 } %7

if.end:
  %8 = icmp eq i32 2, 0
  %9 = icmp eq i32 %n, -2147483648
  %10 = icmp eq i32 2, -1
  %11 = and i1 %9, %10
  %12 = or i1 %8, %11
  br i1 %12, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @nish_panic_div(i1 zeroext %8)
  unreachable

div.ok.1:
  %13 = sdiv i32 %n, 2
  %14 = insertvalue { i1, i32, i32 } { i1 true, i32 undef, i32 undef }, i32 %13, 1
  ret { i1, i32, i32 } %14
}

define internal noundef i32 @orMinus({ i1, i32, i32 } %r) #2 {
entry:
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %0 = extractvalue { i1, i32, i32 } %r, 0
  %1 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 %0, i1* %1, align 1
  %2 = extractvalue { i1, i32, i32 } %r, 1
  %3 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %2, i32* %3, align 4
  %4 = extractvalue { i1, i32, i32 } %r, 2
  %5 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  store i32 %4, i32* %5, align 4
  %6 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  %7 = load i1, i1* %6, align 1
  %8 = xor i1 %7, true
  br i1 %8, label %if.then, label %if.end

if.then:
  ret i32 -1

if.end:
  %9 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  %10 = load i32, i32* %9, align 4
  ret i32 %10
}

define noundef i32 @test() #1 {
entry:
  %acc.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  store i32 0, i32* %acc.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 300
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %acc.addr, align 4
  %3 = call i32 @clamp(i32 %2)
  %4 = load i32, i32* %i.addr, align 4
  %5 = mul nsw i32 %4, 7
  %6 = call i32 @clamp(i32 %5)
  %7 = add nsw i32 %3, %6
  %8 = load i32, i32* %i.addr, align 4
  %9 = and i32 %8, 255
  %10 = call { i1, i32, i32 } @half(i32 %9)
  %11 = extractvalue { i1, i32, i32 } %10, 0
  %12 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 %11, i1* %12, align 1
  %13 = extractvalue { i1, i32, i32 } %10, 1
  %14 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %13, i32* %14, align 4
  %15 = extractvalue { i1, i32, i32 } %10, 2
  %16 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  store i32 %15, i32* %16, align 4
  %17 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  %18 = load i1, i1* %17, align 1
  %19 = insertvalue { i1, i32, i32 } undef, i1 %18, 0
  %20 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  %21 = load i32, i32* %20, align 4
  %22 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  %23 = load i32, i32* %22, align 4
  %24 = insertvalue { i1, i32, i32 } %19, i32 %23, 1
  %25 = insertvalue { i1, i32, i32 } %24, i32 %21, 2
  %26 = call i32 @orMinus({ i1, i32, i32 } %25)
  %27 = add nsw i32 %7, %26
  %28 = and i32 %27, 65535
  store i32 %28, i32* %acc.addr, align 4
  br label %for.inc

for.inc:
  %29 = load i32, i32* %i.addr, align 4
  %30 = add nsw i32 %29, 1
  store i32 %30, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %31 = load i32, i32* %acc.addr, align 4
  ret i32 %31
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn readonly }
attributes #3 = { nounwind noreturn cold }

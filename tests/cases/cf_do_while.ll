declare void @sts_panic_div(i1 noundef zeroext) #1

define noundef i32 @sumDigits(i32 noundef %n) #0 {
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
  call void @sts_panic_div(i1 zeroext %2)
  unreachable

div.ok:
  %7 = srem i32 %1, 10
  %8 = add i32 %0, %7
  store i32 %8, i32* %sum.addr, align 4
  %9 = load i32, i32* %rest.addr, align 4
  %10 = icmp eq i32 10, 0
  %11 = icmp eq i32 %9, -2147483648
  %12 = icmp eq i32 10, -1
  %13 = and i1 %11, %12
  %14 = or i1 %10, %13
  br i1 %14, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @sts_panic_div(i1 zeroext %10)
  unreachable

div.ok.1:
  %15 = sdiv i32 %9, 10
  store i32 %15, i32* %rest.addr, align 4
  br label %do.cond

do.cond:
  %16 = load i32, i32* %rest.addr, align 4
  %17 = icmp sgt i32 %16, 0
  br i1 %17, label %do.body, label %do.end

do.end:
  %18 = load i32, i32* %sum.addr, align 4
  ret i32 %18
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @sumDigits(i32 0)
  %1 = call i32 @sumDigits(i32 9876)
  %2 = add i32 %0, %1
  ret i32 %2
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }

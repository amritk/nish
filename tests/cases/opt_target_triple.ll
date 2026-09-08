target datalayout = "e-m:e-p270:32:32-p271:32:32-p272:64:64-i64:64-i128:128-f80:128-n8:16:32:64-S128"
target triple = "x86_64-unknown-linux-gnu"

declare void @amrit_panic_div(i1 noundef zeroext) #1

define noundef i32 @sumTo(i32 noundef %n) #0 {
entry:
  %sum.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %sum.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %sum.addr, align 4
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp eq i32 1000, 0
  %5 = icmp eq i32 %3, -2147483648
  %6 = icmp eq i32 1000, -1
  %7 = and i1 %5, %6
  %8 = or i1 %4, %7
  br i1 %8, label %div.fail, label %div.ok

div.fail:
  call void @amrit_panic_div(i1 zeroext %4)
  unreachable

div.ok:
  %9 = srem i32 %3, 1000
  %10 = add i32 %2, %9
  store i32 %10, i32* %sum.addr, align 4
  br label %for.inc

for.inc:
  %11 = load i32, i32* %i.addr, align 4
  %12 = add i32 %11, 1
  store i32 %12, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %13 = load i32, i32* %sum.addr, align 4
  ret i32 %13
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @sumTo(i32 1000)
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }

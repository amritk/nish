declare void @llvm.trap()
declare void @sts_panic_div(i1 noundef zeroext) #1

define noundef i32 @checkedDiv(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = icmp eq i32 %b, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  call void @llvm.trap()
  unreachable

if.end:
  %1 = icmp eq i32 %b, 0
  %2 = icmp eq i32 %a, -2147483648
  %3 = icmp eq i32 %b, -1
  %4 = and i1 %2, %3
  %5 = or i1 %1, %4
  br i1 %5, label %div.fail, label %div.ok

div.fail:
  call void @sts_panic_div(i1 zeroext %1)
  unreachable

div.ok:
  %6 = sdiv i32 %a, %b
  ret i32 %6
}

define noundef i32 @neverReturns() #0 {
entry:
  call void @llvm.trap()
  unreachable
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @checkedDiv(i32 84, i32 2)
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }

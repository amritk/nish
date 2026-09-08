declare void @amrit_panic_div(i1 noundef zeroext) #1

define noundef i32 @udiv(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = icmp eq i32 %b, 0
  br i1 %0, label %div.fail, label %div.ok

div.fail:
  call void @amrit_panic_div(i1 zeroext %0)
  unreachable

div.ok:
  %1 = udiv i32 %a, %b
  ret i32 %1
}

define noundef i32 @sdiv(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = icmp eq i32 %b, 0
  %1 = icmp eq i32 %a, -2147483648
  %2 = icmp eq i32 %b, -1
  %3 = and i1 %1, %2
  %4 = or i1 %0, %3
  br i1 %4, label %div.fail, label %div.ok

div.fail:
  call void @amrit_panic_div(i1 zeroext %0)
  unreachable

div.ok:
  %5 = sdiv i32 %a, %b
  ret i32 %5
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }

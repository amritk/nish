%struct.Box = type { i32 }

declare void @sts_panic_div(i1 noundef zeroext) #1

define noundef i32 @localDiv(i32 noundef %k) #0 {
entry:
  %x.addr = alloca i32, align 4
  store i32 10, i32* %x.addr, align 4
  %0 = load i32, i32* %x.addr, align 4
  %1 = icmp eq i32 %k, 0
  %2 = icmp eq i32 %0, -2147483648
  %3 = icmp eq i32 %k, -1
  %4 = and i1 %2, %3
  %5 = or i1 %1, %4
  br i1 %5, label %div.fail, label %div.ok

div.fail:
  call void @sts_panic_div(i1 zeroext %1)
  unreachable

div.ok:
  %6 = sdiv i32 %0, %k
  store i32 %6, i32* %x.addr, align 4
  %7 = load i32, i32* %x.addr, align 4
  ret i32 %7
}

define noundef i32 @fieldDiv(%struct.Box* noundef nonnull align 8 dereferenceable(4) nocapture %b, i32 noundef %k) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %b, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = icmp eq i32 %k, 0
  %3 = icmp eq i32 %1, -2147483648
  %4 = icmp eq i32 %k, -1
  %5 = and i1 %3, %4
  %6 = or i1 %2, %5
  br i1 %6, label %div.fail, label %div.ok

div.fail:
  call void @sts_panic_div(i1 zeroext %2)
  unreachable

div.ok:
  %7 = srem i32 %1, %k
  store i32 %7, i32* %0, align 4
  %8 = getelementptr inbounds %struct.Box, %struct.Box* %b, i32 0, i32 0
  %9 = load i32, i32* %8, align 4
  ret i32 %9
}

define noundef i32 @plainDiv(i32 noundef %a, i32 noundef %k) #0 {
entry:
  %0 = icmp eq i32 %k, 0
  %1 = icmp eq i32 %a, -2147483648
  %2 = icmp eq i32 %k, -1
  %3 = and i1 %1, %2
  %4 = or i1 %0, %3
  br i1 %4, label %div.fail, label %div.ok

div.fail:
  call void @sts_panic_div(i1 zeroext %0)
  unreachable

div.ok:
  %5 = sdiv i32 %a, %k
  ret i32 %5
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }

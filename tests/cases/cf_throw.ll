declare void @llvm.trap()

define noundef i32 @checkedDiv(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = icmp eq i32 %b, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  call void @llvm.trap()
  unreachable

if.end:
  %1 = sdiv i32 %a, %b
  ret i32 %1
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

declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0

define internal noundef i32 @cell(i32 noundef %row, i32 noundef %col) #0 {
entry:
  %0 = mul nsw i32 %row, 8
  %1 = add nsw i32 %0, %col
  ret i32 %1
}

define internal noundef i32 @place(i32 noundef %c) #1 {
entry:
  %0 = icmp eq i32 %c, 7
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = tail call i32 @cell(i32 %c, i32 %c)
  ret i32 %1

if.end:
  %2 = mul nsw i32 %c, %c
  %3 = add nsw i32 %c, 1
  %4 = call i32 @place(i32 %3)
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %4)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %6

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @test() #1 {
entry:
  %0 = call i32 @place(i32 0)
  %1 = call i32 @cell(i32 3, i32 4)
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 %1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %3

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }

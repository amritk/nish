declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0

define internal noundef i32 @cell(i32 noundef %row, i32 noundef %col) #0 {
entry:
  %0 = mul nsw i32 %row, 8
  %1 = add nsw i32 %0, %col
  ret i32 %1
}

define internal noundef i32 @place(i32 noundef %c.in) #1 {
entry:
  br label %rec.head

rec.head:
  %c = phi i32 [ %c.in, %entry ], [ %11, %if.end ]
  %rec.sum = phi i64 [ 0, %entry ], [ %17, %if.end ]
  %rec.min = phi i64 [ 0, %entry ], [ %14, %if.end ]
  %rec.max = phi i64 [ 0, %entry ], [ %16, %if.end ]
  %0 = icmp eq i32 %c, 7
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call i32 @cell(i32 %c, i32 %c)
  %2 = sext i32 %1 to i64
  %3 = add i64 %rec.sum, %2
  %4 = sub i64 %3, 2147483647
  %5 = add i64 %3, 2147483648
  %6 = icmp slt i64 %rec.min, %4
  %7 = icmp sgt i64 %rec.max, %5
  %8 = or i1 %6, %7
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  %9 = trunc i64 %3 to i32
  ret i32 %9

if.end:
  %10 = mul nsw i32 %c, %c
  %11 = add nsw i32 %c, 1
  %12 = sext i32 %10 to i64
  %13 = icmp slt i64 %rec.sum, %rec.min
  %14 = select i1 %13, i64 %rec.sum, i64 %rec.min
  %15 = icmp sgt i64 %rec.sum, %rec.max
  %16 = select i1 %15, i64 %rec.sum, i64 %rec.max
  %17 = add i64 %rec.sum, %12
  br label %rec.head

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

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}

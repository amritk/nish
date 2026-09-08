define internal noundef i32 @max(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = icmp sgt i32 %a, %b
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %1 = phi i32 [ %a, %cond.true ], [ %b, %cond.false ]
  ret i32 %1
}

define internal noundef i32 @sign(i32 noundef %x) #0 {
entry:
  %0 = icmp slt i32 %x, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = sub nsw i32 0, 1
  br label %cond.end

cond.false:
  %2 = icmp sgt i32 %x, 0
  br i1 %2, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %3 = phi i32 [ 1, %cond.true.1 ], [ 0, %cond.false.1 ]
  br label %cond.end

cond.end:
  %4 = phi i32 [ %1, %cond.true ], [ %3, %cond.end.1 ]
  ret i32 %4
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @max(i32 3, i32 8)
  %1 = mul nsw i32 %0, 10
  %2 = sub nsw i32 0, 5
  %3 = call i32 @sign(i32 %2)
  %4 = add nsw i32 %1, %3
  %5 = call i32 @sign(i32 0)
  %6 = add nsw i32 %4, %5
  %7 = call i32 @sign(i32 9)
  %8 = mul nsw i32 %7, 2
  %9 = add nsw i32 %6, %8
  ret i32 %9
}

attributes #0 = { nounwind willreturn readnone }

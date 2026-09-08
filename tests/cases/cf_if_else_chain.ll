define internal noundef i32 @grade(i32 noundef %score) #0 {
entry:
  %0 = icmp sge i32 %score, 90
  br i1 %0, label %if.then, label %if.else

if.then:
  ret i32 4

if.else:
  %1 = icmp sge i32 %score, 80
  br i1 %1, label %if.then.1, label %if.else.1

if.then.1:
  ret i32 3

if.else.1:
  %2 = icmp sge i32 %score, 70
  br i1 %2, label %if.then.2, label %if.else.2

if.then.2:
  ret i32 2

if.else.2:
  ret i32 1
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @grade(i32 95)
  %1 = mul nsw i32 %0, 1000
  %2 = call i32 @grade(i32 85)
  %3 = mul nsw i32 %2, 100
  %4 = add nsw i32 %1, %3
  %5 = call i32 @grade(i32 75)
  %6 = mul nsw i32 %5, 10
  %7 = add nsw i32 %4, %6
  %8 = call i32 @grade(i32 10)
  %9 = add nsw i32 %7, %8
  ret i32 %9
}

attributes #0 = { nounwind willreturn readnone }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"1\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"10\00" }, align 8

declare noundef double @nish_parse_number(i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #2
declare i32 @llvm.fptosi.sat.i32.f64(double) #3

define internal noundef i32 @spin(i32 noundef %x) #0 {
entry:
  %0 = tail call i32 @spin(i32 %x)
  ret i32 %0
}

define internal noundef i32 @ping(i32 noundef %x) #0 {
entry:
  %0 = tail call i32 @pong(i32 %x)
  ret i32 %0
}

define internal noundef i32 @pong(i32 noundef %x) #0 {
entry:
  %0 = tail call i32 @ping(i32 %x)
  ret i32 %0
}

define internal noundef i32 @fib(i32 noundef %n) #0 {
entry:
  %0 = icmp slt i32 %n, 2
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %1 = sub nsw i32 %n, 1
  %2 = call i32 @fib(i32 %1)
  %3 = sub nsw i32 %n, 2
  %4 = call i32 @fib(i32 %3)
  %5 = add nsw i32 %2, %4
  br label %cond.end

cond.end:
  %6 = phi i32 [ %n, %cond.true ], [ %5, %cond.false ]
  ret i32 %6
}

define noundef i32 @selfCall() #1 {
entry:
  %0 = call double @nish_parse_number(i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i32 2)
  %1 = call i32 @llvm.fptosi.sat.i32.f64(double %0)
  %2 = call i32 @spin(i32 %1)
  ret i32 7
}

define noundef i32 @mutualCall() #1 {
entry:
  %0 = call double @nish_parse_number(i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i32 2)
  %1 = call i32 @llvm.fptosi.sat.i32.f64(double %0)
  %2 = call i32 @ping(i32 %1)
  ret i32 7
}

define noundef i32 @test() #1 {
entry:
  %0 = call double @nish_parse_number(i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i32 2)
  %1 = call i32 @llvm.fptosi.sat.i32.f64(double %0)
  %2 = tail call i32 @fib(i32 %1)
  ret i32 %2
}

attributes #0 = { nounwind readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind willreturn readnone }

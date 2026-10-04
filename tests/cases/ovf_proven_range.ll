@.str.0 = private unnamed_addr constant { i64, [45 x i8] } { i64 44, [45 x i8] c"value out of range: expected integer<0, 100>\00" }, align 8

declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_exit(i32 noundef) #3

define noundef i32 @score(i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = icmp ult i32 %a, 101
  br i1 %0, label %rng.ok, label %rng.fail

rng.fail:
  call void @nish_write(i8* bitcast ({ i64, [45 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok:
  %1 = icmp ult i32 %b, 101
  br i1 %1, label %rng.ok.1, label %rng.fail.1

rng.fail.1:
  call void @nish_write(i8* bitcast ({ i64, [45 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok.1:
  %2 = add nsw i32 %a, %b
  %3 = sub nsw i32 %a, %b
  %4 = mul nsw i32 %2, %3
  %5 = mul nsw i32 %a, %b
  %6 = add nsw i32 %4, %5
  ret i32 %6
}

define noundef i32 @word(i8 noundef %hi, i8 noundef %lo) #1 {
entry:
  %0 = zext i8 %hi to i32
  %1 = mul nsw i32 %0, 256
  %2 = zext i8 %lo to i32
  %3 = add nsw i32 %1, %2
  ret i32 %3
}

define noundef i32 @test() #0 {
entry:
  %0 = call i32 @score(i32 7, i32 3)
  %1 = trunc i32 1 to i8
  %2 = trunc i32 2 to i8
  %3 = call i32 @word(i8 %1, i8 %2)
  %4 = add nsw i32 %0, %3
  ret i32 %4
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind willreturn }
attributes #3 = { noreturn nounwind }

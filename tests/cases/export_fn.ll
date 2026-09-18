define noundef i32 @double(i32 noundef %n) #0 {
entry:
  %0 = mul nsw i32 %n, 2
  ret i32 %0
}

define internal noundef i32 @helper(i32 noundef %n) #0 {
entry:
  %0 = add nsw i32 %n, 1
  ret i32 %0
}

define noundef i32 @next(i32 noundef %n) #0 {
entry:
  %0 = call i32 @double(i32 %n)
  %1 = tail call i32 @helper(i32 %0)
  ret i32 %1
}

attributes #0 = { nounwind willreturn readnone }

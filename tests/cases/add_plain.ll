define internal i32 @add(i32 %a, i32 %b) {
entry:
  %0 = add nsw i32 %a, %b
  ret i32 %0
}

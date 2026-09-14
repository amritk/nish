declare noundef i32 @pkg_bare.twice(i32 noundef) #0

define internal noundef i32 @pkg_bare.helper(i32 noundef %n) #0 {
entry:
  %0 = add nsw i32 %n, 1
  ret i32 %0
}

define noundef i32 @pkg_bare.scale(i32 noundef %n) #0 {
entry:
  %0 = call i32 @pkg_bare.helper(i32 %n)
  %1 = call i32 @pkg_bare.twice(i32 %0)
  ret i32 %1
}

attributes #0 = { nounwind willreturn readnone }

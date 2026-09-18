declare noundef i32 @pkg_bare.scale(i32 noundef) #0
declare noundef i32 @pkg_bare.twice(i32 noundef) #0
declare noundef i32 @scope_hash.seed() #0
declare void @nish_free_arena() #2

define internal noundef i32 @helper(i32 noundef %n) #0 {
entry:
  %0 = sub nsw i32 %n, 129
  ret i32 %0
}

define noundef i32 @nish_main() #0 {
entry:
  %0 = call i32 @pkg_bare.scale(i32 2)
  %1 = call i32 @pkg_bare.twice(i32 15)
  %2 = add nsw i32 %0, %1
  %3 = call i32 @scope_hash.seed()
  %4 = add nsw i32 %2, %3
  %5 = tail call i32 @helper(i32 %4)
  ret i32 %5
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }

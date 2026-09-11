declare void @nish_free_arena() #2

define internal noundef i32 @compute() #0 {
entry:
  %0 = add nsw i32 20, 22
  ret i32 %0
}

define noundef i32 @nish_main() #0 {
entry:
  %0 = call i32 @compute()
  %1 = sub nsw i32 %0, 42
  ret i32 %1
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

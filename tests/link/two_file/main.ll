declare noundef i32 @square(i32 noundef) #0
declare void @nish_free_arena() #2

define noundef i32 @nish_main() #0 {
entry:
  %0 = tail call i32 @square(i32 7)
  ret i32 %0
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

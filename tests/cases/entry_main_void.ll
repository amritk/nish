declare void @nish_free_arena() #2

define internal void @side() #0 {
entry:
  ret void
}

define void @nish_main() #0 {
entry:
  call void @side()
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }

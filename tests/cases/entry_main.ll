declare void @sts_free_arena() #1

define noundef i32 @compute() #0 {
entry:
  %0 = add i32 20, 22
  ret i32 %0
}

define noundef i32 @sts_main() #0 {
entry:
  %0 = call i32 @compute()
  %1 = sub i32 %0, 42
  ret i32 %1
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @sts_main()
  call void @sts_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }

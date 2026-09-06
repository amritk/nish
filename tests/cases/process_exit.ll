@.str.0 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"exiting\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"not printed\00" }, align 8

declare void @sts_free_arena() #0
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare void @sts_exit(i32 noundef) #1

define noundef i32 @finish(i32 noundef %code) #0 {
entry:
  call void @sts_print(i8* bitcast ({ i64, [8 x i8] }* @.str.0 to i8*))
  call void @sts_exit(i32 %code)
  unreachable
}

define noundef i32 @sts_main() #0 {
entry:
  %0 = call i32 @finish(i32 0)
  call void @sts_print(i8* bitcast ({ i64, [12 x i8] }* @.str.1 to i8*))
  ret i32 1
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @sts_main()
  call void @sts_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { noreturn nounwind }

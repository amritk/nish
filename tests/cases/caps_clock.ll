@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8

declare void @nish_free_arena() #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare i64 @nish_monotonic_nanos() #0

define internal noundef i64 @now() #0 {
entry:
  %0 = call i64 @nish_monotonic_nanos()
  ret i64 %0
}

define noundef i32 @nish_main() #0 {
entry:
  %start.addr = alloca i64, align 8
  %0 = call i64 @now()
  store i64 %0, i64* %start.addr, align 8
  %1 = call i64 @now()
  %2 = load i64, i64* %start.addr, align 8
  %3 = icmp sge i64 %1, %2
  %4 = select i1 %3, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %4)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }

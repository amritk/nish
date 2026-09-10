@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"big\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"small\00" }, align 8

declare void @amrit_free_arena() #1
declare noundef i64 @amrit_arena_mark() #1
declare void @amrit_arena_release(i64 noundef) #1
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @amrit_str_from_i32(i32 noundef) #1

define internal noundef i32 @double(i32 noundef %n) #0 {
entry:
  %0 = mul nsw i32 %n, 2
  ret i32 %0
}

define internal noundef nonnull align 8 i8* @describe(i32 noundef %n) #0 {
entry:
  %0 = icmp sgt i32 %n, 10
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*)

if.end:
  ret i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
}

define internal noundef i32 @sumTo(i32 noundef %n) #0 {
entry:
  %0 = icmp sle i32 %n, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %1 = sub nsw i32 %n, 1
  %2 = call i32 @sumTo(i32 %1)
  %3 = add nsw i32 %n, %2
  br label %cond.end

cond.end:
  %4 = phi i32 [ 0, %cond.true ], [ %3, %cond.false ]
  ret i32 %4
}

define noundef i32 @amrit_main() #1 {
entry:
  %arena.mark = call i64 @amrit_arena_mark()
  %0 = call i32 @double(i32 21)
  %1 = call i8* @amrit_str_from_i32(i32 %0)
  call void @amrit_print(i8* %1)
  %2 = call i8* @describe(i32 50)
  call void @amrit_print(i8* %2)
  %3 = call i8* @describe(i32 1)
  call void @amrit_print(i8* %3)
  %4 = call i32 @sumTo(i32 10)
  %5 = call i8* @amrit_str_from_i32(i32 %4)
  call void @amrit_print(i8* %5)
  call void @amrit_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @amrit_main()
  call void @amrit_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind }

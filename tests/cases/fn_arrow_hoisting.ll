@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"even\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"odd\00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define noundef i32 @nish_main() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i1 @isEven(i32 10)
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %1 = phi i8* [ bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), %cond.true ], [ bitcast ({ i64, [4 x i8] }* @.str.1 to i8*), %cond.false ]
  call void @nish_print(i8* %1)
  %2 = call i32 @countdown(i32 4)
  %3 = call i8* @nish_str_from_i32(i32 %2)
  call void @nish_print(i8* %3)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define internal noundef zeroext i1 @isEven(i32 noundef %n) #1 {
entry:
  %0 = icmp eq i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i1 true

if.end:
  %1 = sub nsw i32 %n, 1
  %2 = tail call i1 @isOdd(i32 %1)
  ret i1 %2
}

define internal noundef zeroext i1 @isOdd(i32 noundef %n) #1 {
entry:
  %0 = icmp eq i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i1 false

if.end:
  %1 = sub nsw i32 %n, 1
  %2 = tail call i1 @isEven(i32 %1)
  ret i1 %2
}

define internal noundef i32 @countdown(i32 noundef %n) #1 {
entry:
  %0 = icmp sle i32 %n, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %1 = sub nsw i32 %n, 1
  %2 = call i32 @countdown(i32 %1)
  %3 = add nsw i32 %n, %2
  br label %cond.end

cond.end:
  %4 = phi i32 [ 0, %cond.true ], [ %3, %cond.false ]
  ret i32 %4
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind }

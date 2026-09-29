@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"\C3\A91\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"accented\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"plain\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"lead\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"not a lead\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"digit\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"not a digit\00" }, align 8

declare void @nish_free_arena() #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2

define internal noundef zeroext i1 @isAccented(i8* noundef nonnull noalias readonly align 8 nocapture %s, i32 noundef %i) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = bitcast i8* %s to i64*
  %2 = load i64, i64* %1, align 8
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds i8, i8* %s, i64 8
  %5 = getelementptr inbounds i8, i8* %4, i64 %0
  %6 = load i8, i8* %5, align 1
  %7 = zext i8 %6 to i32
  %8 = icmp eq i32 %7, 233
  ret i1 %8
}

define internal noundef zeroext i1 @isLeadByte(i8* noundef nonnull noalias readonly align 8 nocapture %s, i32 noundef %i) #0 {
entry:
  %c.addr = alloca i32, align 4
  %0 = sext i32 %i to i64
  %1 = bitcast i8* %s to i64*
  %2 = load i64, i64* %1, align 8
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds i8, i8* %s, i64 8
  %5 = getelementptr inbounds i8, i8* %4, i64 %0
  %6 = load i8, i8* %5, align 1
  %7 = zext i8 %6 to i32
  store i32 %7, i32* %c.addr, align 4
  %8 = load i32, i32* %c.addr, align 4
  %9 = icmp sge i32 %8, 192
  ret i1 %9
}

define internal noundef zeroext i1 @isDigit(i8* noundef nonnull noalias readonly align 8 nocapture %s, i32 noundef %i) #0 {
entry:
  %c.addr = alloca i32, align 4
  %0 = sext i32 %i to i64
  %1 = bitcast i8* %s to i64*
  %2 = load i64, i64* %1, align 8
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds i8, i8* %s, i64 8
  %5 = getelementptr inbounds i8, i8* %4, i64 %0
  %6 = load i8, i8* %5, align 1
  %7 = zext i8 %6 to i32
  store i32 %7, i32* %c.addr, align 4
  %8 = load i32, i32* %c.addr, align 4
  %9 = icmp sge i32 %8, 48
  br i1 %9, label %land.rhs, label %land.end

land.rhs:
  %10 = load i32, i32* %c.addr, align 4
  %11 = icmp sle i32 %10, 57
  br label %land.end

land.end:
  %12 = phi i1 [ false, %bounds.ok ], [ %11, %land.rhs ]
  ret i1 %12
}

define noundef i32 @nish_main() #0 {
entry:
  %word.addr = alloca i8*, align 8
  store i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*), i8** %word.addr, align 8
  %0 = load i8*, i8** %word.addr, align 8
  %1 = call i1 @isAccented(i8* %0, i32 0)
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %2 = phi i8* [ bitcast ({ i64, [9 x i8] }* @.str.1 to i8*), %cond.true ], [ bitcast ({ i64, [6 x i8] }* @.str.2 to i8*), %cond.false ]
  call void @nish_print(i8* %2)
  %3 = load i8*, i8** %word.addr, align 8
  %4 = call i1 @isLeadByte(i8* %3, i32 0)
  br i1 %4, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %5 = phi i8* [ bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), %cond.true.1 ], [ bitcast ({ i64, [11 x i8] }* @.str.4 to i8*), %cond.false.1 ]
  call void @nish_print(i8* %5)
  %6 = load i8*, i8** %word.addr, align 8
  %7 = call i1 @isDigit(i8* %6, i32 2)
  br i1 %7, label %cond.true.2, label %cond.false.2

cond.true.2:
  br label %cond.end.2

cond.false.2:
  br label %cond.end.2

cond.end.2:
  %8 = phi i8* [ bitcast ({ i64, [6 x i8] }* @.str.5 to i8*), %cond.true.2 ], [ bitcast ({ i64, [12 x i8] }* @.str.6 to i8*), %cond.false.2 ]
  call void @nish_print(i8* %8)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }

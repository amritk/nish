@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"(a))\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"abc\00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2

define internal noundef i32 @walk(i8* noundef nonnull noalias readonly align 8 %text, i32 noundef %at, i32 noundef %depth) #0 {
entry:
  %j.addr = alloca i32, align 4
  %end.addr = alloca i32, align 4
  %0 = bitcast i8* %text to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  %3 = icmp sge i32 %at, %2
  br i1 %3, label %lor.end, label %lor.rhs

lor.rhs:
  %4 = icmp sgt i32 %depth, 1000
  br label %lor.end

lor.end:
  %5 = phi i1 [ true, %entry ], [ %4, %lor.rhs ]
  br i1 %5, label %if.then, label %if.end

if.then:
  ret i32 -1

if.end:
  store i32 %at, i32* %j.addr, align 4
  br label %while.cond

while.cond:
  %6 = load i32, i32* %j.addr, align 4
  %7 = icmp sge i32 %6, 0
  br i1 %7, label %land.rhs, label %land.end

land.rhs:
  %8 = load i32, i32* %j.addr, align 4
  %9 = bitcast i8* %text to i64*
  %10 = load i64, i64* %9, align 8
  %11 = trunc i64 %10 to i32
  %12 = icmp slt i32 %8, %11
  br label %land.end

land.end:
  %13 = phi i1 [ false, %while.cond ], [ %12, %land.rhs ]
  br i1 %13, label %while.body, label %while.end

while.body:
  %14 = load i32, i32* %j.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = getelementptr inbounds i8, i8* %text, i64 8
  %17 = getelementptr inbounds i8, i8* %16, i64 %15
  %18 = load i8, i8* %17, align 1
  %19 = zext i8 %18 to i32
  %20 = icmp eq i32 %19, 41
  br i1 %20, label %if.then.1, label %if.end.1

if.then.1:
  %21 = load i32, i32* %j.addr, align 4
  %22 = add nsw i32 %21, 1
  ret i32 %22

if.end.1:
  %23 = load i32, i32* %j.addr, align 4
  %24 = add nsw i32 %23, 1
  %25 = add nsw i32 %depth, 1
  %26 = call i32 @walk(i8* %text, i32 %24, i32 %25)
  store i32 %26, i32* %end.addr, align 4
  %27 = load i32, i32* %end.addr, align 4
  %28 = icmp slt i32 %27, 0
  br i1 %28, label %if.then.2, label %if.end.2

if.then.2:
  %29 = load i32, i32* %end.addr, align 4
  ret i32 %29

if.end.2:
  %30 = load i32, i32* %end.addr, align 4
  store i32 %30, i32* %j.addr, align 4
  br label %while.cond

while.end:
  %31 = load i32, i32* %j.addr, align 4
  ret i32 %31
}

define void @nish_main() #1 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @walk(i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i32 0, i32 0)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  %2 = call i8* @nish_str_concat(i8* %1, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %3 = call i32 @walk(i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*), i32 0, i32 1001)
  %4 = call i8* @nish_str_from_i32(i32 %3)
  %5 = call i8* @nish_str_concat(i8* %2, i8* %4)
  %6 = call i8* @nish_str_concat(i8* %5, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %7 = call i32 @walk(i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*), i32 0, i32 0)
  %8 = call i8* @nish_str_from_i32(i32 %7)
  %9 = call i8* @nish_str_concat(i8* %6, i8* %8)
  call void @nish_print(i8* %9)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind readonly "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}

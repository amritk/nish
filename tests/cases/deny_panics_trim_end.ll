@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"ab  \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"ab\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"   \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"  ab\00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2

define internal noundef i32 @trimmedEnd(i8* noundef nonnull noalias readonly align 8 nocapture %t) #0 {
entry:
  %end.addr = alloca i32, align 4
  %0 = bitcast i8* %t to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %end.addr, align 4
  br label %while.cond

while.cond:
  %3 = load i32, i32* %end.addr, align 4
  %4 = icmp sgt i32 %3, 0
  br i1 %4, label %land.rhs, label %land.end

land.rhs:
  %5 = load i32, i32* %end.addr, align 4
  %6 = sub nsw i32 %5, 1
  %7 = sext i32 %6 to i64
  %8 = getelementptr inbounds i8, i8* %t, i64 8
  %9 = getelementptr inbounds i8, i8* %8, i64 %7
  %10 = load i8, i8* %9, align 1
  %11 = zext i8 %10 to i32
  %12 = icmp eq i32 %11, 32
  br label %land.end

land.end:
  %13 = phi i1 [ false, %while.cond ], [ %12, %land.rhs ]
  br i1 %13, label %while.body, label %while.end

while.body:
  %14 = load i32, i32* %end.addr, align 4
  %15 = sub nsw i32 %14, 1
  store i32 %15, i32* %end.addr, align 4
  br label %while.cond

while.end:
  %16 = load i32, i32* %end.addr, align 4
  ret i32 %16
}

define internal noundef i32 @leading(i8* noundef nonnull noalias readonly align 8 nocapture %t) #0 {
entry:
  %start.addr = alloca i32, align 4
  store i32 0, i32* %start.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %start.addr, align 4
  %1 = bitcast i8* %t to i64*
  %2 = load i64, i64* %1, align 8
  %3 = trunc i64 %2 to i32
  %4 = icmp slt i32 %0, %3
  br i1 %4, label %land.rhs, label %land.end

land.rhs:
  %5 = load i32, i32* %start.addr, align 4
  %6 = sext i32 %5 to i64
  %7 = getelementptr inbounds i8, i8* %t, i64 8
  %8 = getelementptr inbounds i8, i8* %7, i64 %6
  %9 = load i8, i8* %8, align 1
  %10 = zext i8 %9 to i32
  %11 = icmp eq i32 %10, 32
  br label %land.end

land.end:
  %12 = phi i1 [ false, %while.cond ], [ %11, %land.rhs ]
  br i1 %12, label %while.body, label %while.end

while.body:
  %13 = load i32, i32* %start.addr, align 4
  %14 = add nsw i32 %13, 1
  store i32 %14, i32* %start.addr, align 4
  br label %while.cond

while.end:
  %15 = load i32, i32* %start.addr, align 4
  ret i32 %15
}

define noundef i32 @nish_main() #1 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @trimmedEnd(i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*))
  %1 = call i8* @nish_str_from_i32(i32 %0)
  call void @nish_print(i8* %1)
  %2 = call i32 @trimmedEnd(i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*))
  %3 = call i8* @nish_str_from_i32(i32 %2)
  call void @nish_print(i8* %3)
  %4 = call i32 @trimmedEnd(i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*))
  %5 = call i8* @nish_str_from_i32(i32 %4)
  call void @nish_print(i8* %5)
  %6 = call i32 @trimmedEnd(i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*))
  %7 = call i8* @nish_str_from_i32(i32 %6)
  call void @nish_print(i8* %7)
  %8 = call i32 @leading(i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*))
  %9 = call i8* @nish_str_from_i32(i32 %8)
  call void @nish_print(i8* %9)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
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

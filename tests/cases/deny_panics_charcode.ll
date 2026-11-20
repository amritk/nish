@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"a\C3\BF\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1

define internal noundef i32 @next(i8* noundef nonnull noalias readonly align 8 nocapture %t, i32 noundef %i) #0 {
entry:
  %0 = icmp slt i32 %i, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = bitcast i8* %t to i64*
  %2 = load i64, i64* %1, align 8
  %3 = trunc i64 %2 to i32
  %4 = icmp sge i32 %i, %3
  br label %lor.end

lor.end:
  %5 = phi i1 [ true, %entry ], [ %4, %lor.rhs ]
  br i1 %5, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %6 = sext i32 %i to i64
  %7 = getelementptr inbounds i8, i8* %t, i64 8
  %8 = getelementptr inbounds i8, i8* %7, i64 %6
  %9 = load i8, i8* %8, align 1
  %10 = zext i8 %9 to i32
  %11 = add nsw i32 %10, 1
  ret i32 %11
}

define noundef i32 @nish_main() #1 {
entry:
  %t.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*), i8** %t.addr, align 8
  %0 = load i8*, i8** %t.addr, align 8
  %1 = call i32 @next(i8* %0, i32 0)
  %2 = call i8* @nish_str_from_i32(i32 %1)
  call void @nish_print(i8* %2)
  %3 = load i8*, i8** %t.addr, align 8
  %4 = call i32 @next(i8* %3, i32 1)
  %5 = call i8* @nish_str_from_i32(i32 %4)
  call void @nish_print(i8* %5)
  %6 = load i8*, i8** %t.addr, align 8
  %7 = call i32 @next(i8* %6, i32 2)
  %8 = call i8* @nish_str_from_i32(i32 %7)
  call void @nish_print(i8* %8)
  %9 = load i8*, i8** %t.addr, align 8
  %10 = call i32 @next(i8* %9, i32 3)
  %11 = call i8* @nish_str_from_i32(i32 %10)
  call void @nish_print(i8* %11)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}

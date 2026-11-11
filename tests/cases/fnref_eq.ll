@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2

define internal noundef zeroext i1 @even(i32 noundef %x) #0 {
entry:
  %0 = srem i32 %x, 2
  %1 = icmp eq i32 %0, 0
  ret i1 %1
}

define internal noundef zeroext i1 @odd(i32 noundef %x) #0 {
entry:
  %0 = srem i32 %x, 2
  %1 = icmp ne i32 %0, 0
  ret i1 %1
}

define internal noundef i32 @pick(i1 noundef zeroext %wantEven) #0 {
entry:
  br i1 %wantEven, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %0 = phi i32 [ 1, %cond.true ], [ 2, %cond.false ]
  ret i32 %0
}

define void @nish_main() #1 {
entry:
  %p.addr = alloca i32, align 4
  %q.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @pick(i1 true)
  store i32 %0, i32* %p.addr, align 4
  %1 = call i32 @pick(i1 false)
  store i32 %1, i32* %q.addr, align 4
  %2 = load i32, i32* %p.addr, align 4
  %3 = icmp eq i32 %2, 1
  %4 = select i1 %3, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  %5 = call i8* @nish_str_concat(i8* %4, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %6 = load i32, i32* %p.addr, align 4
  %7 = icmp eq i32 %6, 2
  %8 = select i1 %7, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  %9 = call i8* @nish_str_concat(i8* %5, i8* %8)
  %10 = call i8* @nish_str_concat(i8* %9, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %11 = load i32, i32* %q.addr, align 4
  %12 = icmp ne i32 %11, 1
  %13 = select i1 %12, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  %14 = call i8* @nish_str_concat(i8* %10, i8* %13)
  %15 = call i8* @nish_str_concat(i8* %14, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %16 = load i32, i32* %p.addr, align 4
  %17 = call i32 @pick(i1 true)
  %18 = icmp eq i32 %16, %17
  %19 = select i1 %18, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  %20 = call i8* @nish_str_concat(i8* %15, i8* %19)
  %21 = call i8* @nish_str_concat(i8* %20, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %22 = load i32, i32* %p.addr, align 4
  %23 = call i1 @$ref.0.fr1.i32.bool.0(i32 %22, i32 4)
  %24 = select i1 %23, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  %25 = call i8* @nish_str_concat(i8* %21, i8* %24)
  %26 = call i8* @nish_str_concat(i8* %25, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %27 = load i32, i32* %q.addr, align 4
  %28 = call i1 @$ref.0.fr1.i32.bool.0(i32 %27, i32 4)
  %29 = select i1 %28, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  %30 = call i8* @nish_str_concat(i8* %26, i8* %29)
  call void @nish_print(i8* %30)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal noundef zeroext i1 @$ref.0.fr1.i32.bool.0(i32 noundef %$t, i32 noundef %$a0) #0 {
entry:
  switch i32 %$t, label %sw.default [
    i32 1, label %sw.case
  ]

sw.case:
  %0 = tail call i1 @even(i32 %$a0)
  ret i1 %0

sw.default:
  %1 = tail call i1 @odd(i32 %$a0)
  ret i1 %1
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}

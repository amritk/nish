@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #0

define internal noundef i32 @u1(i32 noundef %x) #0 {
entry:
  %0 = add nsw i32 %x, 1
  ret i32 %0
}

define internal noundef i32 @u2(i32 noundef %x) #0 {
entry:
  %0 = mul nsw i32 %x, 2
  ret i32 %0
}

define internal noundef i32 @u3(i32 noundef %x) #0 {
entry:
  %0 = add nsw i32 %x, 3
  ret i32 %0
}

define void @nish_main() #1 {
entry:
  %other.addr = alloca i32, align 4
  %n.addr = alloca i32, align 4
  %sum.addr = alloca i32, align 4
  %g.addr = alloca i32, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 2, i32* %other.addr, align 4
  store i32 0, i32* %n.addr, align 4
  store i32 0, i32* %sum.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %n.addr, align 4
  %1 = icmp slt i32 %0, 3
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %n.addr, align 4
  %3 = icmp eq i32 %2, 0
  br i1 %3, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %4 = load i32, i32* %n.addr, align 4
  %5 = icmp eq i32 %4, 1
  br i1 %5, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %6 = phi i32 [ 1, %cond.true.1 ], [ 3, %cond.false.1 ]
  br label %cond.end

cond.end:
  %7 = phi i32 [ 0, %cond.true ], [ %6, %cond.end.1 ]
  store i32 %7, i32* %g.addr, align 8
  %8 = load i32, i32* %g.addr, align 8
  %9 = icmp ne i32 %8, 0
  br i1 %9, label %if.then, label %if.end

if.then:
  %10 = load i32, i32* %sum.addr, align 4
  %11 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %10, i32 100)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok

ovf.ok:
  %14 = load i32, i32* %g.addr, align 8
  %15 = call i32 @$ref.0.fr1.i32.i32.0(i32 %14, i32 10)
  %16 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %12, i32 %15)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %17, i32* %sum.addr, align 4
  br label %if.end

if.end:
  %19 = load i32, i32* %n.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %n.addr, align 4
  br label %while.cond

while.end:
  %21 = load i32, i32* %sum.addr, align 4
  %22 = call i8* @nish_str_from_i32(i32 %21)
  %23 = call i8* @nish_str_concat(i8* %22, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %24 = load i32, i32* %other.addr, align 4
  %25 = call i32 @$ref.0.fr1.i32.i32.1(i32 %24, i32 10)
  %26 = call i8* @nish_str_from_i32(i32 %25)
  %27 = call i8* @nish_str_concat(i8* %23, i8* %26)
  call void @nish_print(i8* %27)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 2, %if.then ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @$ref.0.fr1.i32.i32.0(i32 noundef %$t, i32 noundef %$a0) #0 {
entry:
  switch i32 %$t, label %sw.default [
    i32 1, label %sw.case
  ]

sw.case:
  %0 = tail call i32 @u1(i32 %$a0)
  ret i32 %0

sw.default:
  %1 = tail call i32 @u3(i32 %$a0)
  ret i32 %1
}

define internal noundef i32 @$ref.0.fr1.i32.i32.1(i32 noundef %$t, i32 noundef %$a0) #0 {
entry:
  %0 = tail call i32 @u2(i32 %$a0)
  ret i32 %0
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
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}

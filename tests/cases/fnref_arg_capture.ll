@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #1

define internal noundef i32 @inc(i32 noundef %x) #0 {
entry:
  %0 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %x, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @dbl(i32 noundef %x) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 2)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal noundef i32 @pick(i32 noundef %k) #1 {
entry:
  %0 = icmp sgt i32 %k, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %1 = phi i32 [ 1, %cond.true ], [ 2, %cond.false ]
  ret i32 %1
}

define void @nish_main() #0 {
entry:
  %h.addr = alloca i32, align 4
  %g.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @pick(i32 1)
  store i32 %0, i32* %h.addr, align 4
  %1 = call i32 @pick(i32 0)
  store i32 %1, i32* %g.addr, align 4
  %2 = load i32, i32* %h.addr, align 4
  %3 = call i32 @apply$fn.16.nish_main$arrow0(i32 3, i32 %2)
  %4 = call i8* @nish_str_from_i32(i32 %3)
  call void @nish_print(i8* %4)
  %5 = load i32, i32* %g.addr, align 4
  %6 = icmp ne i32 %5, 0
  br i1 %6, label %if.then, label %if.end

if.then:
  %7 = load i32, i32* %g.addr, align 4
  %8 = call i32 @apply$fn.16.nish_main$arrow1(i32 5, i32 %7)
  %9 = call i8* @nish_str_from_i32(i32 %8)
  %10 = call i8* @nish_str_concat(i8* %9, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %11 = load i32, i32* %g.addr, align 4
  %12 = call i32 @apply$fn.16.nish_main$arrow2(i32 5, i32 %11)
  %13 = call i8* @nish_str_from_i32(i32 %12)
  %14 = call i8* @nish_str_concat(i8* %10, i8* %13)
  call void @nish_print(i8* %14)
  br label %if.end

if.end:
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal noundef i32 @nish_main$arrow0(i32 noundef %y, i32 noundef %h) #0 {
entry:
  %0 = call i32 @$ref.0.fr1.i32.i32.0(i32 %h, i32 %y)
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 1)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %2

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @nish_main$arrow1(i32 noundef %y, i32 noundef %g) #0 {
entry:
  %0 = call i32 @$ref.0.fr1.i32.i32.0(i32 %g, i32 %y)
  %1 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %0, i32 1)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %2

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal noundef i32 @nish_main$arrow2(i32 noundef %$a0, i32 noundef %g) #0 {
entry:
  %0 = call i32 @$ref.0.fr1.i32.i32.0(i32 %g, i32 %$a0)
  ret i32 %0
}

define internal noundef i32 @apply$fn.16.nish_main$arrow0(i32 noundef %x, i32 noundef %cap.0) #0 {
entry:
  %0 = call i32 @nish_main$arrow0(i32 %x, i32 %cap.0)
  ret i32 %0
}

define internal noundef i32 @apply$fn.16.nish_main$arrow1(i32 noundef %x, i32 noundef %cap.0) #0 {
entry:
  %0 = call i32 @nish_main$arrow1(i32 %x, i32 %cap.0)
  ret i32 %0
}

define internal noundef i32 @apply$fn.16.nish_main$arrow2(i32 noundef %x, i32 noundef %cap.0) #0 {
entry:
  %0 = call i32 @nish_main$arrow2(i32 %x, i32 %cap.0)
  ret i32 %0
}

define internal noundef i32 @$ref.0.fr1.i32.i32.0(i32 noundef %$t, i32 noundef %$a0) #0 {
entry:
  switch i32 %$t, label %sw.default [
    i32 1, label %sw.case
  ]

sw.case:
  %0 = tail call i32 @inc(i32 %$a0)
  ret i32 %0

sw.default:
  %1 = tail call i32 @dbl(i32 %$a0)
  ret i32 %1
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}

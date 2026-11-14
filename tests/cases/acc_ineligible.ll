%struct.nish_array = type { i64, i64, i8* }

@nish_argv = external global %struct.nish_array*, align 8
@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #2
declare void @nish_argv_init(i32 noundef, i8** noundef nocapture readonly) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #1
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #1
declare { i64, i1 } @llvm.sadd.with.overflow.i64(i64, i64) #1

define internal noundef i32 @afterLocal(i32 noundef %n) #0 {
entry:
  %y.addr = alloca i32, align 4
  %0 = icmp sle i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %1 = mul nsw i32 %n, 2
  store i32 %1, i32* %y.addr, align 4
  %2 = sub nsw i32 %n, 1
  %3 = call i32 @afterLocal(i32 %2)
  %4 = load i32, i32* %y.addr, align 4
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %3, i32 %4)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %6

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @product(i32 noundef %n) #0 {
entry:
  %0 = icmp sle i32 %n, 1
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 1

if.end:
  %1 = sub nsw i32 %n, 1
  %2 = call i32 @product(i32 %1)
  %3 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %n, i32 %2)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %4

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal noundef i64 @wide(i32 noundef %n) #0 {
entry:
  %0 = icmp sle i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = sext i32 0 to i64
  ret i64 %1

if.end:
  %2 = sext i32 %n to i64
  %3 = sub nsw i32 %n, 1
  %4 = call i64 @wide(i32 %3)
  %5 = call { i64, i1 } @llvm.sadd.with.overflow.i64(i64 %2, i64 %4)
  %6 = extractvalue { i64, i1 } %5, 0
  %7 = extractvalue { i64, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i64 %6

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @noBase(i32 noundef %n) #0 {
entry:
  %0 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %n, i32 1)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  %3 = call i32 @noBase(i32 %1)
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %n, i32 %3)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %5

ovf.fail:
  %ovf.op = phi i32 [ 1, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @looped(i32 noundef %n) #0 {
entry:
  %t.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = icmp sle i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  store i32 0, i32* %t.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %1 = load i32, i32* %i.addr, align 4
  %2 = icmp slt i32 %1, %n
  br i1 %2, label %for.body, label %for.end

for.body:
  %3 = load i32, i32* %t.addr, align 4
  %4 = load i32, i32* %i.addr, align 4
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %3, i32 %4)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %6, i32* %t.addr, align 4
  br label %for.inc

for.inc:
  %8 = load i32, i32* %i.addr, align 4
  %9 = add nsw i32 %8, 1
  store i32 %9, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %10 = load i32, i32* %t.addr, align 4
  %11 = sub nsw i32 %n, 1
  %12 = call i32 @looped(i32 %11)
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %10, i32 %12)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %14

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @lessSelf(i32 noundef %n) #0 {
entry:
  %0 = icmp sle i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %1 = sub nsw i32 %n, 1
  %2 = call i32 @lessSelf(i32 %1)
  %3 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %2, i32 %n)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %4

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal noundef i32 @selfLess(i32 noundef %n) #0 {
entry:
  %0 = icmp sle i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %1 = sub nsw i32 %n, 1
  %2 = call i32 @selfLess(i32 %1)
  %3 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %n, i32 %2)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %4

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define internal noundef i32 @twice(i32 noundef %n) #1 {
entry:
  %0 = mul nsw i32 %n, 2
  ret i32 %0
}

define internal noundef i32 @callAfter(i32 noundef %n) #0 {
entry:
  %0 = icmp sle i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %1 = sub nsw i32 %n, 1
  %2 = call i32 @callAfter(i32 %1)
  %3 = call i32 @twice(i32 %n)
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %3)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %5

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @digits(i32 noundef %n) #0 {
entry:
  %s.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = icmp sle i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

if.end:
  %1 = call i8* @nish_str_from_i32(i32 %n)
  store i8* %1, i8** %s.addr, align 8
  %2 = load i8*, i8** %s.addr, align 8
  %3 = bitcast i8* %2 to i64*
  %4 = load i64, i64* %3, align 8
  %5 = trunc i64 %4 to i32
  %6 = sub nsw i32 %n, 1
  %7 = call i32 @digits(i32 %6)
  %8 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %5, i32 %7)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok

ovf.ok:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %9

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %endless.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = trunc i64 %2 to i32
  %4 = icmp sgt i32 %3, 5
  br i1 %4, label %cond.true, label %cond.false

cond.true:
  %5 = call i32 @noBase(i32 1)
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %6 = phi i32 [ %5, %cond.true ], [ -1, %cond.false ]
  store i32 %6, i32* %endless.addr, align 4
  %7 = call i32 @afterLocal(i32 5)
  %8 = call i8* @nish_str_from_i32(i32 %7)
  %9 = call i8* @nish_str_concat(i8* %8, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %10 = call i32 @product(i32 5)
  %11 = call i8* @nish_str_from_i32(i32 %10)
  %12 = call i8* @nish_str_concat(i8* %9, i8* %11)
  %13 = call i8* @nish_str_concat(i8* %12, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %14 = call i64 @wide(i32 5)
  %15 = call i8* @nish_str_from_i64(i64 %14)
  %16 = call i8* @nish_str_concat(i8* %13, i8* %15)
  %17 = call i8* @nish_str_concat(i8* %16, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %18 = call i32 @looped(i32 5)
  %19 = call i8* @nish_str_from_i32(i32 %18)
  %20 = call i8* @nish_str_concat(i8* %17, i8* %19)
  %21 = call i8* @nish_str_concat(i8* %20, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %22 = load i32, i32* %endless.addr, align 4
  %23 = call i8* @nish_str_from_i32(i32 %22)
  %24 = call i8* @nish_str_concat(i8* %21, i8* %23)
  call void @nish_print(i8* %24)
  %25 = call i32 @lessSelf(i32 4)
  %26 = call i8* @nish_str_from_i32(i32 %25)
  %27 = call i8* @nish_str_concat(i8* %26, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %28 = call i32 @selfLess(i32 4)
  %29 = call i8* @nish_str_from_i32(i32 %28)
  %30 = call i8* @nish_str_concat(i8* %27, i8* %29)
  %31 = call i8* @nish_str_concat(i8* %30, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %32 = call i32 @callAfter(i32 4)
  %33 = call i8* @nish_str_from_i32(i32 %32)
  %34 = call i8* @nish_str_concat(i8* %31, i8* %33)
  %35 = call i8* @nish_str_concat(i8* %34, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %36 = call i32 @digits(i32 12)
  %37 = call i8* @nish_str_from_i32(i32 %36)
  %38 = call i8* @nish_str_concat(i8* %35, i8* %37)
  call void @nish_print(i8* %38)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_argv_init(i32 %argc, i8** %argv)
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!llvm.module.flags = !{!11, !12, !13, !14, !15}
!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{i32 8, !"cf-protection-branch", i32 1}
!12 = !{i32 8, !"cf-protection-return", i32 1}
!13 = !{i32 8, !"branch-target-enforcement", i32 1}
!14 = !{i32 8, !"sign-return-address", i32 1}
!15 = !{i32 4, !"probe-stack", !"inline-asm"}

%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"at \00" }, align 8
@nish_argv = external global %struct.nish_array*, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_argv_init(i32 noundef, i8** noundef nocapture readonly) #1
declare noundef double @nish_parse_number(i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare i32 @llvm.fptosi.sat.i32.f64(double) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #3

define internal void @trace(i32 noundef %n) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_from_i32(i32 %n)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*), i8* %0)
  call void @nish_print(i8* %1)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal noundef i32 @noisy(i32 noundef %n.in, i32 noundef %x.in) #0 {
entry:
  br label %rec.head

rec.head:
  %n = phi i32 [ %n.in, %entry ], [ %4, %if.end ]
  %x = phi i32 [ %x.in, %entry ], [ %x, %if.end ]
  %rec.prev = phi i32 [ 0, %entry ], [ %rec.sum, %if.end ]
  %rec.last = phi i32 [ 0, %entry ], [ %x, %if.end ]
  %rec.sum = add i32 %rec.prev, %rec.last
  %rec.signs = or i32 %rec.last, %rec.sum
  %rec.cold = icmp slt i32 %rec.signs, 0
  br i1 %rec.cold, label %rec.call, label %rec.body

rec.body:
  call void @trace(i32 %n)
  %0 = icmp sle i32 %n, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.sum, i32 0)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %2

if.end:
  %4 = sub nsw i32 %n, 1
  br label %rec.head

rec.call:
  %5 = call i32 @noisy(i32 %n, i32 %x)
  %6 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.last, i32 %5)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %9 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.prev, i32 %7)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  ret i32 %10

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @lower(i32 noundef %n.in, i32 noundef %step.in) #0 {
entry:
  %m.addr = alloca i32, align 4
  br label %rec.head

rec.head:
  %n = phi i32 [ %n.in, %entry ], [ %9, %if.end ]
  %step = phi i32 [ %step.in, %entry ], [ %step, %if.end ]
  %rec.prev = phi i32 [ 0, %entry ], [ %rec.sum, %if.end ]
  %rec.last = phi i32 [ 0, %entry ], [ %8, %if.end ]
  %rec.sum = add i32 %rec.prev, %rec.last
  %rec.signs = or i32 %rec.last, %rec.sum
  %rec.cold = icmp slt i32 %rec.signs, 0
  %0 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %n, i32 %step)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  %rec.leave = or i1 %2, %rec.cold
  br i1 %rec.leave, label %rec.exit, label %ovf.ok

ovf.ok:
  store i32 %1, i32* %m.addr, align 4
  %3 = load i32, i32* %m.addr, align 4
  %4 = icmp slt i32 %3, 0
  br i1 %4, label %if.then, label %if.end

if.then:
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.sum, i32 %n)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %6

if.end:
  %8 = load i32, i32* %m.addr, align 4
  %9 = load i32, i32* %m.addr, align 4
  br label %rec.head

rec.exit:
  br i1 %rec.cold, label %rec.call, label %ovf.fail

rec.call:
  %10 = call i32 @lower(i32 %n, i32 %step)
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.last, i32 %10)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.prev, i32 %12)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  ret i32 %15

ovf.fail:
  %ovf.op = phi i32 [ 1, %rec.exit ], [ 0, %if.then ], [ 0, %rec.call ], [ 0, %ovf.ok.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @swing(i32 noundef %n.in) #0 {
entry:
  br label %rec.head

rec.head:
  %n = phi i32 [ %n.in, %entry ], [ %8, %cond.end ]
  %rec.prev = phi i32 [ 0, %entry ], [ %rec.sum, %cond.end ]
  %rec.last = phi i32 [ 0, %entry ], [ %7, %cond.end ]
  %rec.sum = add i32 %rec.prev, %rec.last
  %rec.signs = or i32 %rec.last, %rec.sum
  %rec.cold = icmp slt i32 %rec.signs, 0
  %0 = icmp eq i32 %n, 0
  %rec.leave = or i1 %0, %rec.cold
  br i1 %rec.leave, label %rec.exit, label %if.end

if.then:
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.sum, i32 1)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %2

if.end:
  %4 = srem i32 %n, 3
  %5 = icmp eq i32 %4, 0
  br i1 %5, label %cond.true, label %cond.false

cond.true:
  %6 = sub nsw i32 0, %n
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %7 = phi i32 [ %6, %cond.true ], [ %n, %cond.false ]
  %8 = sub nsw i32 %n, 1
  br label %rec.head

rec.exit:
  br i1 %rec.cold, label %rec.call, label %if.then

rec.call:
  %9 = call i32 @swing(i32 %n)
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.last, i32 %9)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.prev, i32 %11)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  ret i32 %14

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %pick.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = trunc i64 %2 to i32
  %4 = icmp sgt i32 %3, 1
  br i1 %4, label %cond.true, label %cond.false

cond.true:
  %5 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = icmp ult i64 1, %7
  br i1 %8, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %7)
  unreachable

bounds.ok:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %11 = bitcast i8* %10 to i8**
  %12 = getelementptr inbounds i8*, i8** %11, i64 1
  %13 = load i8*, i8** %12, align 8, !alias.scope !4, !noalias !3, !tbaa !13
  %14 = call double @nish_parse_number(i8* %13, i32 2)
  %15 = call i32 @llvm.fptosi.sat.i32.f64(double %14)
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %16 = phi i32 [ %15, %bounds.ok ], [ 0, %cond.false ]
  store i32 %16, i32* %pick.addr, align 4
  %17 = load i32, i32* %pick.addr, align 4
  %18 = icmp eq i32 %17, 1
  br i1 %18, label %if.then, label %if.end

if.then:
  %19 = call i32 @noisy(i32 3, i32 1000000000)
  %20 = call i8* @nish_str_from_i32(i32 %19)
  call void @nish_print(i8* %20)
  br label %if.end

if.end:
  %21 = call i32 @noisy(i32 2, i32 -5)
  %22 = call i8* @nish_str_from_i32(i32 %21)
  call void @nish_print(i8* %22)
  %23 = call i32 @lower(i32 10, i32 3)
  %24 = call i8* @nish_str_from_i32(i32 %23)
  %25 = call i8* @nish_str_concat(i8* %24, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %26 = call i32 @lower(i32 -2147483646, i32 2)
  %27 = call i8* @nish_str_from_i32(i32 %26)
  %28 = call i8* @nish_str_concat(i8* %25, i8* %27)
  %29 = call i8* @nish_str_concat(i8* %28, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %30 = call i32 @lower(i32 5, i32 1)
  %31 = call i8* @nish_str_from_i32(i32 %30)
  %32 = call i8* @nish_str_concat(i8* %29, i8* %31)
  call void @nish_print(i8* %32)
  %33 = call i32 @swing(i32 10)
  %34 = call i8* @nish_str_from_i32(i32 %33)
  %35 = call i8* @nish_str_concat(i8* %34, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %36 = call i32 @swing(i32 1000)
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
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!14, !15, !16, !17, !18}
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
!11 = !{!9, !8, i64 16}
!12 = !{!"element ptr", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{i32 8, !"cf-protection-branch", i32 1}
!15 = !{i32 8, !"cf-protection-return", i32 1}
!16 = !{i32 8, !"branch-target-enforcement", i32 1}
!17 = !{i32 8, !"sign-return-address", i32 1}
!18 = !{i32 4, !"probe-stack", !"inline-asm"}

%struct.nish_array = type { i64, i64, i8* }

@nish_argv = external global %struct.nish_array*, align 8
@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_argv_init(i32 noundef, i8** noundef nocapture readonly) #2
declare noundef double @nish_parse_number(i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare i32 @llvm.fptosi.sat.i32.f64(double) #0
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0

define internal noundef i32 @bump(i32 noundef %c, i32 noundef %i) #0 {
entry:
  %0 = icmp eq i32 %c, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = icmp eq i32 %i, 1
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  %2 = sub nsw i32 2147483647, 1
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %3 = phi i32 [ %2, %cond.true ], [ 0, %cond.false ]
  ret i32 %3

if.end:
  %4 = icmp eq i32 %c, 1
  br i1 %4, label %if.then.1, label %if.end.1

if.then.1:
  %5 = icmp eq i32 %i, 2
  br i1 %5, label %cond.true.1, label %cond.false.1

cond.true.1:
  %6 = sub nsw i32 2147483647, 1
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %7 = phi i32 [ %6, %cond.true.1 ], [ 0, %cond.false.1 ]
  ret i32 %7

if.end.1:
  %8 = icmp eq i32 %c, 2
  br i1 %8, label %if.then.2, label %if.end.2

if.then.2:
  %9 = icmp eq i32 %i, 1
  br i1 %9, label %cond.true.2, label %cond.false.2

cond.true.2:
  %10 = sub nsw i32 2147483647, 3
  br label %cond.end.2

cond.false.2:
  br label %cond.end.2

cond.end.2:
  %11 = phi i32 [ %10, %cond.true.2 ], [ 0, %cond.false.2 ]
  ret i32 %11

if.end.2:
  ret i32 0
}

define internal noundef i32 @chain(i32 noundef %c.in, i32 noundef %i.in) #1 {
entry:
  %s.addr = alloca i8*, align 8
  %t.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  br label %rec.head

rec.head:
  %c = phi i32 [ %c.in, %entry ], [ %c, %ovf.ok.1 ]
  %i = phi i32 [ %i.in, %entry ], [ %16, %ovf.ok.1 ]
  %rec.prev = phi i32 [ 0, %entry ], [ %rec.sum, %ovf.ok.1 ]
  %rec.last = phi i32 [ 0, %entry ], [ %15, %ovf.ok.1 ]
  %rec.sum = add i32 %rec.prev, %rec.last
  %rec.signs = or i32 %rec.last, %rec.sum
  %rec.cold = icmp slt i32 %rec.signs, 0
  %0 = icmp eq i32 %i, 0
  %rec.leave = or i1 %0, %rec.cold
  br i1 %rec.leave, label %rec.exit, label %if.end

if.then:
  %1 = icmp eq i32 %c, 0
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %2 = phi i32 [ 1, %cond.true ], [ 0, %cond.false ]
  %3 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.sum, i32 %2)
  %4 = extractvalue { i32, i1 } %3, 0
  %5 = extractvalue { i32, i1 } %3, 1
  br i1 %5, label %ovf.fail, label %ovf.ok

ovf.ok:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %4

if.end:
  %6 = call i8* @nish_str_from_i32(i32 %i)
  store i8* %6, i8** %s.addr, align 8
  %7 = load i8*, i8** %s.addr, align 8
  %8 = bitcast i8* %7 to i64*
  %9 = load i64, i64* %8, align 8
  %10 = trunc i64 %9 to i32
  %11 = call i32 @bump(i32 %c, i32 %i)
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %10, i32 %11)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %13, i32* %t.addr, align 4
  %15 = load i32, i32* %t.addr, align 4
  %16 = sub nsw i32 %i, 1
  call void @nish_arena_release(i64 %arena.mark)
  br label %rec.head

rec.exit:
  br i1 %rec.cold, label %rec.call, label %if.then

rec.call:
  %17 = call i32 @chain(i32 %c, i32 %i)
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.last, i32 %17)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %21 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.prev, i32 %19)
  %22 = extractvalue { i32, i1 } %21, 0
  %23 = extractvalue { i32, i1 } %21, 1
  br i1 %23, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %22

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #1 {
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
  %16 = phi i32 [ %15, %bounds.ok ], [ -1, %cond.false ]
  store i32 %16, i32* %pick.addr, align 4
  %17 = load i32, i32* %pick.addr, align 4
  %18 = icmp sge i32 %17, 0
  br i1 %18, label %if.then, label %if.end

if.then:
  %19 = load i32, i32* %pick.addr, align 4
  %20 = call i32 @chain(i32 %19, i32 2)
  %21 = call i8* @nish_str_from_i32(i32 %20)
  call void @nish_print(i8* %21)
  br label %if.end

if.end:
  %22 = call i32 @chain(i32 2, i32 2)
  %23 = call i8* @nish_str_from_i32(i32 %22)
  %24 = call i8* @nish_str_concat(i8* %23, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %25 = call i32 @chain(i32 3, i32 1000)
  %26 = call i8* @nish_str_from_i32(i32 %25)
  %27 = call i8* @nish_str_concat(i8* %24, i8* %26)
  call void @nish_print(i8* %27)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_argv_init(i32 %argc, i8** %argv)
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }

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

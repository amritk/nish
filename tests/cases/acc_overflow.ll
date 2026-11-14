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
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #0

define internal noundef i32 @term(i32 noundef %c, i32 noundef %i) #0 {
entry:
  %0 = icmp eq i32 %c, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = icmp eq i32 %i, 1
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %2 = phi i32 [ 2147483647, %cond.true ], [ 1, %cond.false ]
  ret i32 %2

if.end:
  %3 = icmp eq i32 %c, 1
  br i1 %3, label %if.then.1, label %if.end.1

if.then.1:
  %4 = icmp eq i32 %i, 1
  br i1 %4, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %5 = phi i32 [ 2147483647, %cond.true.1 ], [ -1, %cond.false.1 ]
  ret i32 %5

if.end.1:
  %6 = icmp eq i32 %c, 2
  br i1 %6, label %if.then.2, label %if.end.2

if.then.2:
  %7 = icmp eq i32 %i, 2
  br i1 %7, label %cond.true.2, label %cond.false.2

cond.true.2:
  br label %cond.end.2

cond.false.2:
  br label %cond.end.2

cond.end.2:
  %8 = phi i32 [ 2147483647, %cond.true.2 ], [ 1, %cond.false.2 ]
  ret i32 %8

if.end.2:
  %9 = icmp eq i32 %c, 3
  br i1 %9, label %if.then.3, label %if.end.3

if.then.3:
  %10 = icmp eq i32 %i, 1
  br i1 %10, label %cond.true.3, label %cond.false.3

cond.true.3:
  %11 = sub nsw i32 0, 2147483647
  br label %cond.end.3

cond.false.3:
  br label %cond.end.3

cond.end.3:
  %12 = phi i32 [ %11, %cond.true.3 ], [ 2147483647, %cond.false.3 ]
  ret i32 %12

if.end.3:
  %13 = icmp eq i32 %c, 10
  br i1 %13, label %if.then.4, label %if.end.4

if.then.4:
  %14 = icmp eq i32 %i, 2
  br i1 %14, label %cond.true.4, label %cond.false.4

cond.true.4:
  br label %cond.end.4

cond.false.4:
  br label %cond.end.4

cond.end.4:
  %15 = phi i32 [ 2147483647, %cond.true.4 ], [ -1, %cond.false.4 ]
  ret i32 %15

if.end.4:
  %16 = icmp eq i32 %c, 11
  br i1 %16, label %if.then.5, label %if.end.5

if.then.5:
  %17 = icmp eq i32 %i, 1
  br i1 %17, label %cond.true.5, label %cond.false.5

cond.true.5:
  br label %cond.end.5

cond.false.5:
  br label %cond.end.5

cond.end.5:
  %18 = phi i32 [ 2147483647, %cond.true.5 ], [ 1, %cond.false.5 ]
  ret i32 %18

if.end.5:
  %19 = icmp eq i32 %c, 12
  br i1 %19, label %if.then.6, label %if.end.6

if.then.6:
  %20 = icmp eq i32 %i, 1
  br i1 %20, label %cond.true.6, label %cond.false.6

cond.true.6:
  %21 = sub nsw i32 0, 2147483647
  br label %cond.end.6

cond.false.6:
  br label %cond.end.6

cond.end.6:
  %22 = phi i32 [ %21, %cond.true.6 ], [ -1, %cond.false.6 ]
  ret i32 %22

if.end.6:
  ret i32 %i
}

define internal noundef i32 @last(i32 noundef %c) #0 {
entry:
  %0 = icmp eq i32 %c, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 1

if.end:
  %1 = icmp eq i32 %c, 1
  br i1 %1, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 1

if.end.1:
  %2 = icmp eq i32 %c, 10
  br i1 %2, label %if.then.2, label %if.end.2

if.then.2:
  ret i32 1

if.end.2:
  %3 = icmp eq i32 %c, 11
  br i1 %3, label %if.then.3, label %if.end.3

if.then.3:
  ret i32 -5

if.end.3:
  ret i32 0
}

define internal noundef i32 @chain(i32 noundef %c.in, i32 noundef %i.in) #1 {
entry:
  br label %rec.head

rec.head:
  %c = phi i32 [ %c.in, %entry ], [ %c, %ovf.ok.1 ]
  %i = phi i32 [ %i.in, %entry ], [ %12, %ovf.ok.1 ]
  %rec.sum = phi i64 [ 0, %entry ], [ %19, %ovf.ok.1 ]
  %rec.min = phi i64 [ 0, %entry ], [ %16, %ovf.ok.1 ]
  %rec.max = phi i64 [ 0, %entry ], [ %18, %ovf.ok.1 ]
  %0 = icmp eq i32 %i, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call i32 @last(i32 %c)
  %2 = sext i32 %1 to i64
  %3 = add i64 %rec.sum, %2
  %4 = sub i64 %3, 2147483647
  %5 = add i64 %3, 2147483648
  %6 = icmp slt i64 %rec.min, %4
  %7 = icmp sgt i64 %rec.max, %5
  %8 = or i1 %6, %7
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  %9 = trunc i64 %3 to i32
  ret i32 %9

if.end:
  %10 = call i32 @term(i32 %c, i32 %i)
  %11 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %i, i32 1)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %14 = sext i32 %10 to i64
  %15 = icmp slt i64 %rec.sum, %rec.min
  %16 = select i1 %15, i64 %rec.sum, i64 %rec.min
  %17 = icmp sgt i64 %rec.sum, %rec.max
  %18 = select i1 %17, i64 %rec.sum, i64 %rec.max
  %19 = add i64 %rec.sum, %14
  br label %rec.head

ovf.fail:
  %ovf.op = phi i32 [ 0, %if.then ], [ 1, %if.end ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @steps(i32 noundef %c) #0 {
entry:
  %0 = icmp eq i32 %c, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i32 1

if.end:
  %1 = icmp eq i32 %c, 3
  br i1 %1, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 4

if.end.1:
  ret i32 2
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
  %20 = load i32, i32* %pick.addr, align 4
  %21 = call i32 @steps(i32 %20)
  %22 = call i32 @chain(i32 %19, i32 %21)
  %23 = call i8* @nish_str_from_i32(i32 %22)
  call void @nish_print(i8* %23)
  br label %if.end

if.end:
  %24 = call i32 @chain(i32 10, i32 2)
  %25 = call i8* @nish_str_from_i32(i32 %24)
  %26 = call i8* @nish_str_concat(i8* %25, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %27 = call i32 @chain(i32 11, i32 2)
  %28 = call i8* @nish_str_from_i32(i32 %27)
  %29 = call i8* @nish_str_concat(i8* %26, i8* %28)
  %30 = call i8* @nish_str_concat(i8* %29, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %31 = call i32 @chain(i32 12, i32 2)
  %32 = call i8* @nish_str_from_i32(i32 %31)
  %33 = call i8* @nish_str_concat(i8* %30, i8* %32)
  %34 = call i8* @nish_str_concat(i8* %33, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %35 = call i32 @chain(i32 20, i32 1000)
  %36 = call i8* @nish_str_from_i32(i32 %35)
  %37 = call i8* @nish_str_concat(i8* %34, i8* %36)
  call void @nish_print(i8* %37)
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

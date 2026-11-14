%struct.Chain = type { i32 }
%struct.nish_array = type { i64, i64, i8* }

@nish_argv = external global %struct.nish_array*, align 8
@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_argv_init(i32 noundef, i8** noundef nocapture readonly) #0
declare noundef double @nish_parse_number(i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare i32 @llvm.fptosi.sat.i32.f64(double) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #3

define internal void @Chain.constructor(%struct.Chain* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %c) #0 {
entry:
  %0 = getelementptr inbounds %struct.Chain, %struct.Chain* %this, i32 0, i32 0
  store i32 %c, i32* %0, align 4, !tbaa !4
  ret void
}

define internal noundef i32 @Chain.term(%struct.Chain* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this, i32 noundef %i) #1 {
entry:
  %c.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Chain, %struct.Chain* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  store i32 %1, i32* %c.addr, align 4
  %2 = load i32, i32* %c.addr, align 4
  %3 = icmp eq i32 %2, 0
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = icmp eq i32 %i, 1
  br i1 %4, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %5 = phi i32 [ 2147483647, %cond.true ], [ 1, %cond.false ]
  ret i32 %5

if.end:
  %6 = load i32, i32* %c.addr, align 4
  %7 = icmp eq i32 %6, 1
  br i1 %7, label %if.then.1, label %if.end.1

if.then.1:
  %8 = icmp eq i32 %i, 1
  br i1 %8, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %9 = phi i32 [ 2147483647, %cond.true.1 ], [ -1, %cond.false.1 ]
  ret i32 %9

if.end.1:
  %10 = load i32, i32* %c.addr, align 4
  %11 = icmp eq i32 %10, 2
  br i1 %11, label %if.then.2, label %if.end.2

if.then.2:
  %12 = icmp eq i32 %i, 2
  br i1 %12, label %cond.true.2, label %cond.false.2

cond.true.2:
  br label %cond.end.2

cond.false.2:
  br label %cond.end.2

cond.end.2:
  %13 = phi i32 [ 2147483647, %cond.true.2 ], [ 1, %cond.false.2 ]
  ret i32 %13

if.end.2:
  %14 = load i32, i32* %c.addr, align 4
  %15 = icmp eq i32 %14, 3
  br i1 %15, label %if.then.3, label %if.end.3

if.then.3:
  %16 = icmp eq i32 %i, 1
  br i1 %16, label %cond.true.3, label %cond.false.3

cond.true.3:
  %17 = sub nsw i32 0, 2147483647
  br label %cond.end.3

cond.false.3:
  br label %cond.end.3

cond.end.3:
  %18 = phi i32 [ %17, %cond.true.3 ], [ 2147483647, %cond.false.3 ]
  ret i32 %18

if.end.3:
  %19 = load i32, i32* %c.addr, align 4
  %20 = icmp eq i32 %19, 10
  br i1 %20, label %if.then.4, label %if.end.4

if.then.4:
  %21 = icmp eq i32 %i, 2
  br i1 %21, label %cond.true.4, label %cond.false.4

cond.true.4:
  br label %cond.end.4

cond.false.4:
  br label %cond.end.4

cond.end.4:
  %22 = phi i32 [ 2147483647, %cond.true.4 ], [ -1, %cond.false.4 ]
  ret i32 %22

if.end.4:
  %23 = load i32, i32* %c.addr, align 4
  %24 = icmp eq i32 %23, 11
  br i1 %24, label %if.then.5, label %if.end.5

if.then.5:
  %25 = icmp eq i32 %i, 1
  br i1 %25, label %cond.true.5, label %cond.false.5

cond.true.5:
  br label %cond.end.5

cond.false.5:
  br label %cond.end.5

cond.end.5:
  %26 = phi i32 [ 2147483647, %cond.true.5 ], [ 1, %cond.false.5 ]
  ret i32 %26

if.end.5:
  %27 = load i32, i32* %c.addr, align 4
  %28 = icmp eq i32 %27, 12
  br i1 %28, label %if.then.6, label %if.end.6

if.then.6:
  %29 = icmp eq i32 %i, 1
  br i1 %29, label %cond.true.6, label %cond.false.6

cond.true.6:
  %30 = sub nsw i32 0, 2147483647
  br label %cond.end.6

cond.false.6:
  br label %cond.end.6

cond.end.6:
  %31 = phi i32 [ %30, %cond.true.6 ], [ -1, %cond.false.6 ]
  ret i32 %31

if.end.6:
  ret i32 %i
}

define internal noundef i32 @Chain.last(%struct.Chain* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this) #1 {
entry:
  %c.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Chain, %struct.Chain* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  store i32 %1, i32* %c.addr, align 4
  %2 = load i32, i32* %c.addr, align 4
  %3 = icmp eq i32 %2, 0
  br i1 %3, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %4 = load i32, i32* %c.addr, align 4
  %5 = icmp eq i32 %4, 1
  br label %lor.end.1

lor.end.1:
  %6 = phi i1 [ true, %entry ], [ %5, %lor.rhs.1 ]
  br i1 %6, label %lor.end, label %lor.rhs

lor.rhs:
  %7 = load i32, i32* %c.addr, align 4
  %8 = icmp eq i32 %7, 10
  br label %lor.end

lor.end:
  %9 = phi i1 [ true, %lor.end.1 ], [ %8, %lor.rhs ]
  br i1 %9, label %if.then, label %if.end

if.then:
  ret i32 1

if.end:
  %10 = load i32, i32* %c.addr, align 4
  %11 = icmp eq i32 %10, 11
  br i1 %11, label %if.then.1, label %if.end.1

if.then.1:
  ret i32 -5

if.end.1:
  ret i32 0
}

define internal noundef i32 @Chain.chain(%struct.Chain* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this.in, i32 noundef %i.in) #2 {
entry:
  br label %rec.head

rec.head:
  %this = phi %struct.Chain* [ %this.in, %entry ], [ %this, %ovf.ok.1 ]
  %i = phi i32 [ %i.in, %entry ], [ %7, %ovf.ok.1 ]
  %rec.prev = phi i32 [ 0, %entry ], [ %rec.sum, %ovf.ok.1 ]
  %rec.last = phi i32 [ 0, %entry ], [ %5, %ovf.ok.1 ]
  %rec.sum = add i32 %rec.prev, %rec.last
  %rec.signs = or i32 %rec.last, %rec.sum
  %rec.cold = icmp slt i32 %rec.signs, 0
  %0 = icmp eq i32 %i, 0
  %rec.leave = or i1 %0, %rec.cold
  br i1 %rec.leave, label %rec.exit, label %if.end

if.then:
  %1 = call i32 @Chain.last(%struct.Chain* %this)
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.sum, i32 %1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %3

if.end:
  %5 = call i32 @Chain.term(%struct.Chain* %this, i32 %i)
  %6 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %i, i32 1)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  br label %rec.head

rec.exit:
  br i1 %rec.cold, label %rec.call, label %if.then

rec.call:
  %9 = call i32 @Chain.chain(%struct.Chain* %this, i32 %i)
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.last, i32 %9)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.prev, i32 %11)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  ret i32 %14

ovf.fail:
  %ovf.op = phi i32 [ 0, %if.then ], [ 1, %if.end ], [ 0, %rec.call ], [ 0, %ovf.ok.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @steps(i32 noundef %c) #3 {
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

define noundef i32 @nish_main() #2 {
entry:
  %pick.addr = alloca i32, align 4
  %Chain.obj = alloca %struct.Chain, align 8
  %a.addr = alloca i32, align 4
  %Chain.obj.1 = alloca %struct.Chain, align 8
  %b.addr = alloca i32, align 4
  %Chain.obj.2 = alloca %struct.Chain, align 8
  %d.addr = alloca i32, align 4
  %Chain.obj.3 = alloca %struct.Chain, align 8
  %e.addr = alloca i32, align 4
  %Chain.obj.4 = alloca %struct.Chain, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %3 = trunc i64 %2 to i32
  %4 = icmp sgt i32 %3, 1
  br i1 %4, label %cond.true, label %cond.false

cond.true:
  %5 = load %struct.nish_array*, %struct.nish_array** @nish_argv, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %8 = icmp ult i64 1, %7
  br i1 %8, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %7)
  unreachable

bounds.ok:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %11 = bitcast i8* %10 to i8**
  %12 = getelementptr inbounds i8*, i8** %11, i64 1
  %13 = load i8*, i8** %12, align 8, !alias.scope !9, !noalias !8, !tbaa !16
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
  call void @Chain.constructor(%struct.Chain* %Chain.obj, i32 %19)
  %20 = load i32, i32* %pick.addr, align 4
  %21 = call i32 @steps(i32 %20)
  %22 = call i32 @Chain.chain(%struct.Chain* %Chain.obj, i32 %21)
  %23 = call i8* @nish_str_from_i32(i32 %22)
  call void @nish_print(i8* %23)
  br label %if.end

if.end:
  call void @Chain.constructor(%struct.Chain* %Chain.obj.1, i32 10)
  %24 = call i32 @Chain.chain(%struct.Chain* %Chain.obj.1, i32 2)
  store i32 %24, i32* %a.addr, align 4
  call void @Chain.constructor(%struct.Chain* %Chain.obj.2, i32 11)
  %25 = call i32 @Chain.chain(%struct.Chain* %Chain.obj.2, i32 2)
  store i32 %25, i32* %b.addr, align 4
  call void @Chain.constructor(%struct.Chain* %Chain.obj.3, i32 12)
  %26 = call i32 @Chain.chain(%struct.Chain* %Chain.obj.3, i32 2)
  store i32 %26, i32* %d.addr, align 4
  call void @Chain.constructor(%struct.Chain* %Chain.obj.4, i32 20)
  %27 = call i32 @Chain.chain(%struct.Chain* %Chain.obj.4, i32 1000)
  store i32 %27, i32* %e.addr, align 4
  %28 = load i32, i32* %a.addr, align 4
  %29 = call i8* @nish_str_from_i32(i32 %28)
  %30 = call i8* @nish_str_concat(i8* %29, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %31 = load i32, i32* %b.addr, align 4
  %32 = call i8* @nish_str_from_i32(i32 %31)
  %33 = call i8* @nish_str_concat(i8* %30, i8* %32)
  %34 = call i8* @nish_str_concat(i8* %33, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %35 = load i32, i32* %d.addr, align 4
  %36 = call i8* @nish_str_from_i32(i32 %35)
  %37 = call i8* @nish_str_concat(i8* %34, i8* %36)
  %38 = call i8* @nish_str_concat(i8* %37, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %39 = load i32, i32* %e.addr, align 4
  %40 = call i8* @nish_str_from_i32(i32 %39)
  %41 = call i8* @nish_str_concat(i8* %38, i8* %40)
  call void @nish_print(i8* %41)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  call void @nish_argv_init(i32 %argc, i8** %argv)
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #2 = { nounwind "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!llvm.module.flags = !{!17, !18, !19, !20, !21}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Chain", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"header i64", !1, i64 0}
!11 = !{!"header ptr", !1, i64 0}
!12 = !{!"array header", !10, i64 0, !10, i64 8, !11, i64 16}
!13 = !{!12, !10, i64 0}
!14 = !{!12, !11, i64 16}
!15 = !{!"element ptr", !1, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{i32 8, !"cf-protection-branch", i32 1}
!18 = !{i32 8, !"cf-protection-return", i32 1}
!19 = !{i32 8, !"branch-target-enforcement", i32 1}
!20 = !{i32 8, !"sign-return-address", i32 1}
!21 = !{i32 4, !"probe-stack", !"inline-asm"}

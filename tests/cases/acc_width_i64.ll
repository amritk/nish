%struct.nish_array = type { i64, i64, i8* }

@nish_argv = external global %struct.nish_array*, align 8
@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #2
declare void @nish_argv_init(i32 noundef, i8** noundef nocapture readonly) #2
declare noundef double @nish_parse_number(i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare i32 @llvm.fptosi.sat.i32.f64(double) #1
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #1
declare { i64, i1 } @llvm.sadd.with.overflow.i64(i64, i64) #1
declare { i64, i1 } @llvm.ssub.with.overflow.i64(i64, i64) #1
declare { i64, i1 } @llvm.smul.with.overflow.i64(i64, i64) #1

define internal noundef i64 @max64() #0 {
entry:
  %half.addr = alloca i64, align 8
  %0 = sext i32 1073741824 to i64
  %1 = sext i32 1073741824 to i64
  %2 = mul nsw i64 %0, %1
  %3 = sext i32 4 to i64
  %4 = call { i64, i1 } @llvm.smul.with.overflow.i64(i64 %2, i64 %3)
  %5 = extractvalue { i64, i1 } %4, 0
  %6 = extractvalue { i64, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i64 %5, i64* %half.addr, align 8
  %7 = load i64, i64* %half.addr, align 8
  %8 = sext i32 1 to i64
  %9 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %7, i64 %8)
  %10 = extractvalue { i64, i1 } %9, 0
  %11 = extractvalue { i64, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %12 = load i64, i64* %half.addr, align 8
  %13 = call { i64, i1 } @llvm.sadd.with.overflow.i64(i64 %10, i64 %12)
  %14 = extractvalue { i64, i1 } %13, 0
  %15 = extractvalue { i64, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  ret i64 %14

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 1, %ovf.ok ], [ 0, %ovf.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i64 @term(i32 noundef %c, i32 noundef %i) #0 {
entry:
  %max.addr = alloca i64, align 8
  %0 = call i64 @max64()
  store i64 %0, i64* %max.addr, align 8
  %1 = icmp eq i32 %c, 0
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = icmp eq i32 %i, 1
  br i1 %2, label %cond.true, label %cond.false

cond.true:
  %3 = load i64, i64* %max.addr, align 8
  br label %cond.end

cond.false:
  %4 = sext i32 1 to i64
  br label %cond.end

cond.end:
  %5 = phi i64 [ %3, %cond.true ], [ %4, %cond.false ]
  ret i64 %5

if.end:
  %6 = icmp eq i32 %c, 1
  br i1 %6, label %if.then.1, label %if.end.1

if.then.1:
  %7 = icmp eq i32 %i, 1
  br i1 %7, label %cond.true.1, label %cond.false.1

cond.true.1:
  %8 = load i64, i64* %max.addr, align 8
  br label %cond.end.1

cond.false.1:
  %9 = sext i32 -1 to i64
  br label %cond.end.1

cond.end.1:
  %10 = phi i64 [ %8, %cond.true.1 ], [ %9, %cond.false.1 ]
  ret i64 %10

if.end.1:
  %11 = icmp eq i32 %c, 2
  br i1 %11, label %if.then.2, label %if.end.2

if.then.2:
  %12 = icmp eq i32 %i, 2
  br i1 %12, label %cond.true.2, label %cond.false.2

cond.true.2:
  %13 = load i64, i64* %max.addr, align 8
  br label %cond.end.2

cond.false.2:
  %14 = sext i32 1 to i64
  br label %cond.end.2

cond.end.2:
  %15 = phi i64 [ %13, %cond.true.2 ], [ %14, %cond.false.2 ]
  ret i64 %15

if.end.2:
  %16 = icmp eq i32 %c, 3
  br i1 %16, label %if.then.3, label %if.end.3

if.then.3:
  %17 = icmp eq i32 %i, 1
  br i1 %17, label %cond.true.3, label %cond.false.3

cond.true.3:
  %18 = load i64, i64* %max.addr, align 8
  %19 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 0, i64 %18)
  %20 = extractvalue { i64, i1 } %19, 0
  %21 = extractvalue { i64, i1 } %19, 1
  br i1 %21, label %ovf.fail, label %ovf.ok

ovf.ok:
  br label %cond.end.3

cond.false.3:
  %22 = load i64, i64* %max.addr, align 8
  br label %cond.end.3

cond.end.3:
  %23 = phi i64 [ %20, %ovf.ok ], [ %22, %cond.false.3 ]
  ret i64 %23

if.end.3:
  %24 = icmp eq i32 %c, 10
  br i1 %24, label %if.then.4, label %if.end.4

if.then.4:
  %25 = icmp eq i32 %i, 2
  br i1 %25, label %cond.true.4, label %cond.false.4

cond.true.4:
  %26 = load i64, i64* %max.addr, align 8
  br label %cond.end.4

cond.false.4:
  %27 = sext i32 -1 to i64
  br label %cond.end.4

cond.end.4:
  %28 = phi i64 [ %26, %cond.true.4 ], [ %27, %cond.false.4 ]
  ret i64 %28

if.end.4:
  %29 = icmp eq i32 %c, 11
  br i1 %29, label %if.then.5, label %if.end.5

if.then.5:
  %30 = icmp eq i32 %i, 1
  br i1 %30, label %cond.true.5, label %cond.false.5

cond.true.5:
  %31 = load i64, i64* %max.addr, align 8
  br label %cond.end.5

cond.false.5:
  %32 = sext i32 1 to i64
  br label %cond.end.5

cond.end.5:
  %33 = phi i64 [ %31, %cond.true.5 ], [ %32, %cond.false.5 ]
  ret i64 %33

if.end.5:
  %34 = icmp eq i32 %c, 12
  br i1 %34, label %if.then.6, label %if.end.6

if.then.6:
  %35 = icmp eq i32 %i, 1
  br i1 %35, label %cond.true.6, label %cond.false.6

cond.true.6:
  %36 = load i64, i64* %max.addr, align 8
  %37 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 0, i64 %36)
  %38 = extractvalue { i64, i1 } %37, 0
  %39 = extractvalue { i64, i1 } %37, 1
  br i1 %39, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  br label %cond.end.6

cond.false.6:
  %40 = sext i32 -1 to i64
  br label %cond.end.6

cond.end.6:
  %41 = phi i64 [ %38, %ovf.ok.1 ], [ %40, %cond.false.6 ]
  ret i64 %41

if.end.6:
  %42 = sext i32 %i to i64
  %43 = sext i32 65536 to i64
  %44 = mul nsw i64 %42, %43
  %45 = sext i32 65536 to i64
  %46 = call { i64, i1 } @llvm.smul.with.overflow.i64(i64 %44, i64 %45)
  %47 = extractvalue { i64, i1 } %46, 0
  %48 = extractvalue { i64, i1 } %46, 1
  br i1 %48, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  ret i64 %47

ovf.fail:
  %ovf.op = phi i32 [ 3, %cond.true.3 ], [ 3, %cond.true.6 ], [ 2, %if.end.6 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i64 @last(i32 noundef %c) #1 {
entry:
  %0 = icmp eq i32 %c, 0
  br i1 %0, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %1 = icmp eq i32 %c, 1
  br label %lor.end.1

lor.end.1:
  %2 = phi i1 [ true, %entry ], [ %1, %lor.rhs.1 ]
  br i1 %2, label %lor.end, label %lor.rhs

lor.rhs:
  %3 = icmp eq i32 %c, 10
  br label %lor.end

lor.end:
  %4 = phi i1 [ true, %lor.end.1 ], [ %3, %lor.rhs ]
  br i1 %4, label %if.then, label %if.end

if.then:
  %5 = sext i32 1 to i64
  ret i64 %5

if.end:
  %6 = icmp eq i32 %c, 11
  br i1 %6, label %if.then.1, label %if.end.1

if.then.1:
  %7 = sext i32 -5 to i64
  ret i64 %7

if.end.1:
  %8 = sext i32 0 to i64
  ret i64 %8
}

define internal noundef i64 @chain(i32 noundef %c.in, i32 noundef %i.in) #0 {
entry:
  br label %rec.head

rec.head:
  %c = phi i32 [ %c.in, %entry ], [ %c, %ovf.ok.1 ]
  %i = phi i32 [ %i.in, %entry ], [ %7, %ovf.ok.1 ]
  %rec.prev = phi i64 [ 0, %entry ], [ %rec.sum, %ovf.ok.1 ]
  %rec.last = phi i64 [ 0, %entry ], [ %5, %ovf.ok.1 ]
  %rec.sum = add i64 %rec.prev, %rec.last
  %rec.signs = or i64 %rec.last, %rec.sum
  %rec.cold = icmp slt i64 %rec.signs, 0
  %0 = icmp eq i32 %i, 0
  %rec.leave = or i1 %0, %rec.cold
  br i1 %rec.leave, label %rec.exit, label %if.end

if.then:
  %1 = call i64 @last(i32 %c)
  %2 = call { i64, i1 } @llvm.sadd.with.overflow.i64(i64 %rec.sum, i64 %1)
  %3 = extractvalue { i64, i1 } %2, 0
  %4 = extractvalue { i64, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i64 %3

if.end:
  %5 = call i64 @term(i32 %c, i32 %i)
  %6 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %i, i32 1)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  br label %rec.head

rec.exit:
  br i1 %rec.cold, label %rec.call, label %if.then

rec.call:
  %9 = call i64 @chain(i32 %c, i32 %i)
  %10 = call { i64, i1 } @llvm.sadd.with.overflow.i64(i64 %rec.last, i64 %9)
  %11 = extractvalue { i64, i1 } %10, 0
  %12 = extractvalue { i64, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %13 = call { i64, i1 } @llvm.sadd.with.overflow.i64(i64 %rec.prev, i64 %11)
  %14 = extractvalue { i64, i1 } %13, 0
  %15 = extractvalue { i64, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  ret i64 %14

ovf.fail:
  %ovf.op = phi i32 [ 0, %if.then ], [ 1, %if.end ], [ 0, %rec.call ], [ 0, %ovf.ok.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i64 @after(i32 noundef %i.in, i64 noundef %y.in, i64 noundef %deep.in) #0 {
entry:
  br label %rec.head

rec.head:
  %i = phi i32 [ %i.in, %entry ], [ 0, %rec.true ], [ %6, %rec.false ]
  %y = phi i64 [ %y.in, %entry ], [ %y, %rec.true ], [ %y, %rec.false ]
  %deep = phi i64 [ %deep.in, %entry ], [ %deep, %rec.true ], [ %deep, %rec.false ]
  %rec.prev = phi i64 [ 0, %entry ], [ %rec.sum, %rec.true ], [ %rec.sum, %rec.false ]
  %rec.last = phi i64 [ 0, %entry ], [ %deep, %rec.true ], [ %y, %rec.false ]
  %rec.sum = add i64 %rec.prev, %rec.last
  %rec.signs = or i64 %rec.last, %rec.sum
  %rec.cold = icmp slt i64 %rec.signs, 0
  %0 = icmp eq i32 %i, 0
  %rec.leave = or i1 %0, %rec.cold
  br i1 %rec.leave, label %rec.exit, label %if.end

if.then:
  %1 = sext i32 0 to i64
  %2 = call { i64, i1 } @llvm.sadd.with.overflow.i64(i64 %rec.sum, i64 %1)
  %3 = extractvalue { i64, i1 } %2, 0
  %4 = extractvalue { i64, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i64 %3

if.end:
  %5 = icmp eq i32 %i, 1
  br i1 %5, label %rec.true, label %rec.false

rec.true:
  br label %rec.head

rec.false:
  %6 = sub nsw i32 %i, 1
  br label %rec.head

rec.exit:
  br i1 %rec.cold, label %rec.call, label %if.then

rec.call:
  %7 = call i64 @after(i32 %i, i64 %y, i64 %deep)
  %8 = call { i64, i1 } @llvm.sadd.with.overflow.i64(i64 %rec.last, i64 %7)
  %9 = extractvalue { i64, i1 } %8, 0
  %10 = extractvalue { i64, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %11 = call { i64, i1 } @llvm.sadd.with.overflow.i64(i64 %rec.prev, i64 %9)
  %12 = extractvalue { i64, i1 } %11, 0
  %13 = extractvalue { i64, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  ret i64 %12

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @steps(i32 noundef %c) #1 {
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

define internal noundef i64 @run(i32 noundef %pick) #0 {
entry:
  %0 = icmp eq i32 %pick, 4
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call i64 @max64()
  %2 = sext i32 1 to i64
  %3 = tail call i64 @after(i32 2, i64 %1, i64 %2)
  ret i64 %3

if.end:
  %4 = icmp eq i32 %pick, 5
  br i1 %4, label %if.then.1, label %if.end.1

if.then.1:
  %5 = sext i32 1 to i64
  %6 = call i64 @max64()
  %7 = tail call i64 @after(i32 3, i64 %5, i64 %6)
  ret i64 %7

if.end.1:
  %8 = call i32 @steps(i32 %pick)
  %9 = tail call i64 @chain(i32 %pick, i32 %8)
  ret i64 %9
}

define noundef i32 @nish_main() #0 {
entry:
  %pick.addr = alloca i32, align 4
  %big.addr = alloca i64, align 8
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
  %20 = call i64 @run(i32 %19)
  %21 = call i8* @nish_str_from_i64(i64 %20)
  call void @nish_print(i8* %21)
  br label %if.end

if.end:
  %22 = call i64 @chain(i32 10, i32 2)
  %23 = call i8* @nish_str_from_i64(i64 %22)
  %24 = call i8* @nish_str_concat(i8* %23, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %25 = call i64 @chain(i32 11, i32 2)
  %26 = call i8* @nish_str_from_i64(i64 %25)
  %27 = call i8* @nish_str_concat(i8* %24, i8* %26)
  %28 = call i8* @nish_str_concat(i8* %27, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %29 = call i64 @chain(i32 12, i32 2)
  %30 = call i8* @nish_str_from_i64(i64 %29)
  %31 = call i8* @nish_str_concat(i8* %28, i8* %30)
  %32 = call i8* @nish_str_concat(i8* %31, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %33 = call i64 @chain(i32 20, i32 1000)
  %34 = call i8* @nish_str_from_i64(i64 %33)
  %35 = call i8* @nish_str_concat(i8* %32, i8* %34)
  call void @nish_print(i8* %35)
  store i64 1099511627776, i64* %big.addr, align 8
  %36 = load i64, i64* %big.addr, align 8
  %37 = sext i32 7 to i64
  %38 = call i64 @after(i32 1001, i64 %36, i64 %37)
  %39 = call i8* @nish_str_from_i64(i64 %38)
  %40 = call i8* @nish_str_concat(i8* %39, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %41 = sext i32 1 to i64
  %42 = call i64 @max64()
  %43 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 0, i64 %42)
  %44 = extractvalue { i64, i1 } %43, 0
  %45 = extractvalue { i64, i1 } %43, 1
  br i1 %45, label %ovf.fail, label %ovf.ok

ovf.ok:
  %46 = call i64 @after(i32 4, i64 %41, i64 %44)
  %47 = call i8* @nish_str_from_i64(i64 %46)
  %48 = call i8* @nish_str_concat(i8* %40, i8* %47)
  call void @nish_print(i8* %48)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 3)
  unreachable
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

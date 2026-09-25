%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"parallelMapInto: dst has \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [23 x i8] } { i64 22, [23 x i8] c" elements and src has \00" }, align 8

declare noundef i32 @nish_main$arrow0(i32 noundef) #1
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_exit(i32 noundef) #3
declare void @nish_panic_div(i1 noundef zeroext) #4
declare void @nish_parallel_range(void (i64, i64, i8*)* noundef nonnull, i8* noundef, i64 noundef, i64 noundef) #0

define internal noundef i32 @nish.reduceBlockCount(i32 noundef %n) #0 {
entry:
  %wanted.addr = alloca i32, align 4
  %0 = sext i32 %n to i64
  %1 = sext i32 1048576 to i64
  %2 = add nsw i64 %0, %1
  %3 = sub nsw i64 %2, 1
  %4 = sext i32 1048576 to i64
  %5 = icmp eq i64 %4, 0
  %6 = icmp eq i64 %3, -9223372036854775808
  %7 = icmp eq i64 %4, -1
  %8 = and i1 %6, %7
  %9 = or i1 %5, %8
  br i1 %9, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %5)
  unreachable

div.ok:
  %10 = sdiv i64 %3, %4
  %11 = trunc i64 %10 to i32
  store i32 %11, i32* %wanted.addr, align 4
  %12 = load i32, i32* %wanted.addr, align 4
  %13 = icmp slt i32 %12, 64
  br i1 %13, label %cond.true, label %cond.false

cond.true:
  %14 = load i32, i32* %wanted.addr, align 4
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %15 = phi i32 [ %14, %cond.true ], [ 64, %cond.false ]
  ret i32 %15
}

define internal noundef i32 @nish.reduceBlockStart(i32 noundef %n, i32 noundef %blocks, i32 noundef %k) #0 {
entry:
  %0 = sext i32 %n to i64
  %1 = sext i32 %k to i64
  %2 = mul nsw i64 %0, %1
  %3 = sext i32 %blocks to i64
  %4 = icmp eq i64 %3, 0
  %5 = icmp eq i64 %2, -9223372036854775808
  %6 = icmp eq i64 %3, -1
  %7 = and i1 %5, %6
  %8 = or i1 %4, %7
  br i1 %8, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %4)
  unreachable

div.ok:
  %9 = sdiv i64 %2, %3
  %10 = trunc i64 %9 to i32
  ret i32 %10
}

define internal void @nish.parallelMapInto$i32$i32$fn.16.nish_main$arrow0$chunk(i64 noundef %lo, i64 noundef %hi, i8* noundef %ctx) #0 {
entry:
  %0 = bitcast i8* %ctx to { %struct.nish_array*, %struct.nish_array* }*
  %1 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array* }, { %struct.nish_array*, %struct.nish_array* }* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1
  %3 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array* }, { %struct.nish_array*, %struct.nish_array* }* %0, i32 0, i32 1
  %4 = load %struct.nish_array*, %struct.nish_array** %3
  %5 = trunc i64 %lo to i32
  %6 = trunc i64 %hi to i32
  call void @nish.mapRange$i32$i32$fn.16.nish_main$arrow0(%struct.nish_array* %2, %struct.nish_array* %4, i32 %5, i32 %6)
  ret void
}

define void @nish.parallelMapInto$i32$i32$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %dst) #0 {
entry:
  %n.addr = alloca i32, align 4
  %par.ctx = alloca { %struct.nish_array*, %struct.nish_array* }, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4
  %5 = trunc i64 %4 to i32
  %6 = load i32, i32* %n.addr, align 4
  %7 = icmp slt i32 %5, %6
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4
  %10 = trunc i64 %9 to i32
  %11 = call i8* @nish_str_from_i32(i32 %10)
  %12 = call i8* @nish_str_concat(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*), i8* %11)
  %13 = call i8* @nish_str_concat(i8* %12, i8* bitcast ({ i64, [23 x i8] }* @.str.1 to i8*))
  %14 = load i32, i32* %n.addr, align 4
  %15 = call i8* @nish_str_from_i32(i32 %14)
  %16 = call i8* @nish_str_concat(i8* %13, i8* %15)
  call void @nish_write(i8* %16, i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %17 = load i32, i32* %n.addr, align 4
  %18 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array* }, { %struct.nish_array*, %struct.nish_array* }* %par.ctx, i32 0, i32 0
  store %struct.nish_array* %src, %struct.nish_array** %18
  %19 = getelementptr inbounds { %struct.nish_array*, %struct.nish_array* }, { %struct.nish_array*, %struct.nish_array* }* %par.ctx, i32 0, i32 1
  store %struct.nish_array* %dst, %struct.nish_array** %19
  %20 = bitcast { %struct.nish_array*, %struct.nish_array* }* %par.ctx to i8*
  %21 = sext i32 %17 to i64
  call void @nish_parallel_range(void (i64, i64, i8*)* @nish.parallelMapInto$i32$i32$fn.16.nish_main$arrow0$chunk, i8* %20, i64 %21, i64 1048576)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal void @nish.mapRange$i32$i32$fn.16.nish_main$arrow0(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %src, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %dst, i32 noundef %lo, i32 noundef %hi) #0 {
entry:
  %i.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  store i32 %lo, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %src, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %dst, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = icmp sge i32 %8, 0
  br i1 %9, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %10 = load i32, i32* %i.addr, align 4
  %11 = icmp slt i32 %10, %hi
  br label %land.end.1

land.end.1:
  %12 = phi i1 [ false, %for.cond ], [ %11, %land.rhs.1 ]
  br i1 %12, label %land.rhs, label %land.end

land.rhs:
  %13 = load i32, i32* %i.addr, align 4
  %14 = trunc i64 %1 to i32
  %15 = icmp slt i32 %13, %14
  br label %land.end

land.end:
  %16 = phi i1 [ false, %land.end.1 ], [ %15, %land.rhs ]
  br i1 %16, label %for.body, label %for.end

for.body:
  %17 = load i32, i32* %i.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = bitcast i8* %3 to i32*
  %20 = getelementptr inbounds i32, i32* %19, i64 %18
  %21 = load i32, i32* %20, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  %22 = call i32 @nish_main$arrow0(i32 %21)
  store i32 %22, i32* %y.addr, align 4
  %23 = load i32, i32* %i.addr, align 4
  %24 = trunc i64 %5 to i32
  %25 = icmp slt i32 %23, %24
  br i1 %25, label %if.then, label %if.end

if.then:
  %26 = load i32, i32* %i.addr, align 4
  %27 = sext i32 %26 to i64
  %28 = load i32, i32* %y.addr, align 4
  %29 = bitcast i8* %7 to i32*
  %30 = getelementptr inbounds i32, i32* %29, i64 %27
  store i32 %28, i32* %30, align 4, !alias.scope !4, !noalias !3, !tbaa !8
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %31 = load i32, i32* %i.addr, align 4
  %32 = add nsw i32 %31, 1
  store i32 %32, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind willreturn }
attributes #3 = { noreturn nounwind }
attributes #4 = { nounwind noreturn cold }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"element i32", !6, i64 0}
!8 = !{!7, !7, i64 0}

%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_panic_div(i1 noundef zeroext) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define internal noundef i32 @sumOdd(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %s.addr = alloca i32, align 4
  %last.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %n.addr = alloca i32, align 4
  store i32 0, i32* %s.addr, align 4
  store i32 0, i32* %last.addr, align 4
  store i32 -1, i32* %i.addr, align 4
  store i32 0, i32* %n.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %4 = load i32, i32* %n.addr, align 4
  %5 = icmp slt i32 %4, 100
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = load i32, i32* %n.addr, align 4
  %7 = add nsw i32 %6, 1
  store i32 %7, i32* %n.addr, align 4
  %8 = load i32, i32* %i.addr, align 4
  %9 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %8, i32 1)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %10, i32* %i.addr, align 4
  %12 = load i32, i32* %i.addr, align 4
  %13 = icmp slt i32 %12, 0
  br i1 %13, label %lor.end, label %lor.rhs

lor.rhs:
  %14 = load i32, i32* %i.addr, align 4
  %15 = trunc i64 %1 to i32
  %16 = icmp sge i32 %14, %15
  br label %lor.end

lor.end:
  %17 = phi i1 [ true, %ovf.ok ], [ %16, %lor.rhs ]
  br i1 %17, label %if.then, label %if.end

if.then:
  br label %for.end

if.end:
  %18 = load i32, i32* %i.addr, align 4
  %19 = sext i32 %18 to i64
  %20 = bitcast i8* %3 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %19
  %22 = load i32, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %23 = icmp eq i32 2, 0
  %24 = icmp eq i32 %22, -2147483648
  %25 = icmp eq i32 2, -1
  %26 = and i1 %24, %25
  %27 = or i1 %23, %26
  br i1 %27, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %23)
  unreachable

div.ok:
  %28 = srem i32 %22, 2
  %29 = icmp eq i32 %28, 0
  br i1 %29, label %if.then.1, label %if.end.1

if.then.1:
  br label %for.inc

if.end.1:
  %30 = load i32, i32* %s.addr, align 4
  %31 = load i32, i32* %i.addr, align 4
  %32 = sext i32 %31 to i64
  %33 = bitcast i8* %3 to i32*
  %34 = getelementptr inbounds i32, i32* %33, i64 %32
  %35 = load i32, i32* %34, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %36 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %30, i32 %35)
  %37 = extractvalue { i32, i1 } %36, 0
  %38 = extractvalue { i32, i1 } %36, 1
  br i1 %38, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %37, i32* %s.addr, align 4
  br label %for.inc

for.inc:
  %39 = load i32, i32* %i.addr, align 4
  %40 = sext i32 %39 to i64
  %41 = bitcast i8* %3 to i32*
  %42 = getelementptr inbounds i32, i32* %41, i64 %40
  %43 = load i32, i32* %42, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store i32 %43, i32* %last.addr, align 4
  br label %for.cond

for.end:
  %44 = load i32, i32* %s.addr, align 4
  %45 = load i32, i32* %last.addr, align 4
  %46 = mul nsw i32 %45, 0
  %47 = add nsw i32 %44, %46
  ret i32 %47

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @countOdd(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %odd.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %odd.addr, align 4
  store i32 -1, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %do.body

do.body:
  %4 = load i32, i32* %i.addr, align 4
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %4, i32 1)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %6, i32* %i.addr, align 4
  %8 = load i32, i32* %i.addr, align 4
  %9 = icmp slt i32 %8, 0
  br i1 %9, label %lor.end, label %lor.rhs

lor.rhs:
  %10 = load i32, i32* %i.addr, align 4
  %11 = trunc i64 %1 to i32
  %12 = icmp sge i32 %10, %11
  br label %lor.end

lor.end:
  %13 = phi i1 [ true, %ovf.ok ], [ %12, %lor.rhs ]
  br i1 %13, label %if.then, label %if.end

if.then:
  br label %do.end

if.end:
  %14 = load i32, i32* %i.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = bitcast i8* %3 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %15
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %19 = icmp eq i32 2, 0
  %20 = icmp eq i32 %18, -2147483648
  %21 = icmp eq i32 2, -1
  %22 = and i1 %20, %21
  %23 = or i1 %19, %22
  br i1 %23, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %19)
  unreachable

div.ok:
  %24 = srem i32 %18, 2
  %25 = icmp eq i32 %24, 0
  br i1 %25, label %if.then.1, label %if.end.1

if.then.1:
  br label %do.cond

if.end.1:
  %26 = load i32, i32* %odd.addr, align 4
  %27 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %26, i32 1)
  %28 = extractvalue { i32, i1 } %27, 0
  %29 = extractvalue { i32, i1 } %27, 1
  br i1 %29, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %28, i32* %odd.addr, align 4
  br label %do.cond

do.cond:
  %30 = load i32, i32* %i.addr, align 4
  %31 = sext i32 %30 to i64
  %32 = bitcast i8* %3 to i32*
  %33 = getelementptr inbounds i32, i32* %32, i64 %31
  %34 = load i32, i32* %33, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %35 = icmp sgt i32 %34, 0
  br i1 %35, label %do.body, label %do.end

do.end:
  %36 = load i32, i32* %odd.addr, align 4
  ret i32 %36

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [7 x i32], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 7, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 7, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = bitcast [7 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 3, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 1, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 4, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %8 = getelementptr inbounds i32, i32* %4, i64 3
  store i32 1, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %9 = getelementptr inbounds i32, i32* %4, i64 4
  store i32 5, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %10 = getelementptr inbounds i32, i32* %4, i64 5
  store i32 0, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %11 = getelementptr inbounds i32, i32* %4, i64 6
  store i32 9, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %12 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %13 = call i32 @sumOdd(%struct.nish_array* %12)
  %14 = call i8* @nish_str_from_i32(i32 %13)
  %15 = call i8* @nish_str_concat(i8* %14, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %16 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %17 = call i32 @countOdd(%struct.nish_array* %16)
  %18 = call i8* @nish_str_from_i32(i32 %17)
  %19 = call i8* @nish_str_concat(i8* %15, i8* %18)
  call void @nish_print(i8* %19)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }

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
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}

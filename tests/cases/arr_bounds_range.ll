%struct.nish_array = type { i64, i64, i8* }

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #3

define internal noundef i32 @diagonals() #0 {
entry:
  %up.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [16 x i32], align 8
  %down.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [16 x i32], align 8
  %hits.addr = alloca i32, align 4
  %r.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 16, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 16, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = mul i64 16, 4
  %3 = bitcast [16 x i32]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %3, i8 0, i64 %2, i1 false), !alias.scope !4, !noalias !3
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %up.addr, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 16, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 16, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %7 = mul i64 16, 4
  %8 = bitcast [16 x i32]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %8, i8 0, i64 %7, i1 false), !alias.scope !4, !noalias !3
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %8, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %down.addr, align 8
  store i32 0, i32* %hits.addr, align 4
  store i32 0, i32* %r.addr, align 4
  %10 = load %struct.nish_array*, %struct.nish_array** %up.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = load %struct.nish_array*, %struct.nish_array** %down.addr, align 8
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %16 = load i32, i32* %r.addr, align 4
  %17 = icmp slt i32 %16, 8
  br i1 %17, label %for.body, label %for.end

for.body:
  store i32 0, i32* %c.addr, align 4
  %18 = load %struct.nish_array*, %struct.nish_array** %up.addr, align 8
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %21 = load %struct.nish_array*, %struct.nish_array** %down.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond.1

for.cond.1:
  %24 = load i32, i32* %c.addr, align 4
  %25 = icmp slt i32 %24, 8
  br i1 %25, label %for.body.1, label %for.end.1

for.body.1:
  %26 = load i32, i32* %c.addr, align 4
  %27 = load i32, i32* %r.addr, align 4
  %28 = add nsw i32 %26, %27
  %29 = sext i32 %28 to i64
  %30 = load i32, i32* %c.addr, align 4
  %31 = load i32, i32* %r.addr, align 4
  %32 = add nsw i32 %30, %31
  %33 = sext i32 %32 to i64
  %34 = bitcast i8* %20 to i32*
  %35 = getelementptr inbounds i32, i32* %34, i64 %33
  %36 = load i32, i32* %35, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %37 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %36, i32 1)
  %38 = extractvalue { i32, i1 } %37, 0
  %39 = extractvalue { i32, i1 } %37, 1
  br i1 %39, label %ovf.fail, label %ovf.ok

ovf.ok:
  %40 = bitcast i8* %20 to i32*
  %41 = getelementptr inbounds i32, i32* %40, i64 %29
  store i32 %38, i32* %41, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %42 = load i32, i32* %c.addr, align 4
  %43 = load i32, i32* %r.addr, align 4
  %44 = sub nsw i32 %42, %43
  %45 = add nsw i32 %44, 7
  %46 = sext i32 %45 to i64
  %47 = load i32, i32* %c.addr, align 4
  %48 = load i32, i32* %r.addr, align 4
  %49 = sub nsw i32 %47, %48
  %50 = add nsw i32 %49, 7
  %51 = sext i32 %50 to i64
  %52 = bitcast i8* %23 to i32*
  %53 = getelementptr inbounds i32, i32* %52, i64 %51
  %54 = load i32, i32* %53, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %55 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %54, i32 1)
  %56 = extractvalue { i32, i1 } %55, 0
  %57 = extractvalue { i32, i1 } %55, 1
  br i1 %57, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %58 = bitcast i8* %23 to i32*
  %59 = getelementptr inbounds i32, i32* %58, i64 %46
  store i32 %56, i32* %59, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %for.inc.1

for.inc.1:
  %60 = load i32, i32* %c.addr, align 4
  %61 = add nsw i32 %60, 1
  store i32 %61, i32* %c.addr, align 4
  br label %for.cond.1

for.end.1:
  br label %for.inc

for.inc:
  %62 = load i32, i32* %r.addr, align 4
  %63 = add nsw i32 %62, 1
  store i32 %63, i32* %r.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %k.addr, align 4
  %64 = load %struct.nish_array*, %struct.nish_array** %up.addr, align 8
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 2
  %66 = load i8*, i8** %65, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %67 = load %struct.nish_array*, %struct.nish_array** %down.addr, align 8
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %67, i64 0, i32 2
  %69 = load i8*, i8** %68, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond.2

for.cond.2:
  %70 = load i32, i32* %k.addr, align 4
  %71 = icmp slt i32 %70, 16
  br i1 %71, label %for.body.2, label %for.end.2

for.body.2:
  %72 = load i32, i32* %hits.addr, align 4
  %73 = load i32, i32* %k.addr, align 4
  %74 = sext i32 %73 to i64
  %75 = bitcast i8* %66 to i32*
  %76 = getelementptr inbounds i32, i32* %75, i64 %74
  %77 = load i32, i32* %76, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %78 = load i32, i32* %k.addr, align 4
  %79 = sext i32 %78 to i64
  %80 = bitcast i8* %69 to i32*
  %81 = getelementptr inbounds i32, i32* %80, i64 %79
  %82 = load i32, i32* %81, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %83 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %77, i32 %82)
  %84 = extractvalue { i32, i1 } %83, 0
  %85 = extractvalue { i32, i1 } %83, 1
  br i1 %85, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %86 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %72, i32 %84)
  %87 = extractvalue { i32, i1 } %86, 0
  %88 = extractvalue { i32, i1 } %86, 1
  br i1 %88, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %87, i32* %hits.addr, align 4
  br label %for.inc.2

for.inc.2:
  %89 = load i32, i32* %k.addr, align 4
  %90 = add nsw i32 %89, 1
  store i32 %90, i32* %k.addr, align 4
  br label %for.cond.2

for.end.2:
  %91 = load i32, i32* %hits.addr, align 4
  ret i32 %91

ovf.fail:
  %ovf.op = phi i32 [ 0, %for.body.1 ], [ 0, %ovf.ok ], [ 2, %for.body.2 ], [ 0, %ovf.ok.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal noundef i32 @board() #0 {
entry:
  %cells.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [16 x i32], align 8
  %r.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
  %total.addr = alloca i32, align 4
  %r.addr.1 = alloca i32, align 4
  %c.addr.1 = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 16, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 16, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = mul i64 16, 4
  %3 = bitcast [16 x i32]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %3, i8 0, i64 %2, i1 false), !alias.scope !4, !noalias !3
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %cells.addr, align 8
  store i32 0, i32* %r.addr, align 4
  %5 = load %struct.nish_array*, %struct.nish_array** %cells.addr, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %8 = load i32, i32* %r.addr, align 4
  %9 = icmp slt i32 %8, 4
  br i1 %9, label %for.body, label %for.end

for.body:
  store i32 0, i32* %c.addr, align 4
  %10 = load %struct.nish_array*, %struct.nish_array** %cells.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond.1

for.cond.1:
  %13 = load i32, i32* %c.addr, align 4
  %14 = icmp slt i32 %13, 4
  br i1 %14, label %for.body.1, label %for.end.1

for.body.1:
  %15 = load i32, i32* %r.addr, align 4
  %16 = mul nsw i32 %15, 4
  %17 = load i32, i32* %c.addr, align 4
  %18 = add nsw i32 %16, %17
  %19 = sext i32 %18 to i64
  %20 = load i32, i32* %r.addr, align 4
  %21 = load i32, i32* %c.addr, align 4
  %22 = sub nsw i32 %20, %21
  %23 = bitcast i8* %12 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 %19
  store i32 %22, i32* %24, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %for.inc.1

for.inc.1:
  %25 = load i32, i32* %c.addr, align 4
  %26 = add nsw i32 %25, 1
  store i32 %26, i32* %c.addr, align 4
  br label %for.cond.1

for.end.1:
  br label %for.inc

for.inc:
  %27 = load i32, i32* %r.addr, align 4
  %28 = add nsw i32 %27, 1
  store i32 %28, i32* %r.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %r.addr.1, align 4
  %29 = load %struct.nish_array*, %struct.nish_array** %cells.addr, align 8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond.2

for.cond.2:
  %32 = load i32, i32* %r.addr.1, align 4
  %33 = icmp slt i32 %32, 4
  br i1 %33, label %for.body.2, label %for.end.2

for.body.2:
  store i32 0, i32* %c.addr.1, align 4
  %34 = load %struct.nish_array*, %struct.nish_array** %cells.addr, align 8
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond.3

for.cond.3:
  %37 = load i32, i32* %c.addr.1, align 4
  %38 = icmp slt i32 %37, 4
  br i1 %38, label %for.body.3, label %for.end.3

for.body.3:
  %39 = load i32, i32* %total.addr, align 4
  %40 = load i32, i32* %r.addr.1, align 4
  %41 = mul nsw i32 %40, 4
  %42 = load i32, i32* %c.addr.1, align 4
  %43 = add nsw i32 %41, %42
  %44 = sext i32 %43 to i64
  %45 = bitcast i8* %36 to i32*
  %46 = getelementptr inbounds i32, i32* %45, i64 %44
  %47 = load i32, i32* %46, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %48 = load i32, i32* %c.addr.1, align 4
  %49 = mul nsw i32 %48, 4
  %50 = load i32, i32* %r.addr.1, align 4
  %51 = add nsw i32 %49, %50
  %52 = sext i32 %51 to i64
  %53 = bitcast i8* %36 to i32*
  %54 = getelementptr inbounds i32, i32* %53, i64 %52
  %55 = load i32, i32* %54, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %56 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %47, i32 %55)
  %57 = extractvalue { i32, i1 } %56, 0
  %58 = extractvalue { i32, i1 } %56, 1
  br i1 %58, label %ovf.fail, label %ovf.ok

ovf.ok:
  %59 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %39, i32 %57)
  %60 = extractvalue { i32, i1 } %59, 0
  %61 = extractvalue { i32, i1 } %59, 1
  br i1 %61, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %60, i32* %total.addr, align 4
  br label %for.inc.3

for.inc.3:
  %62 = load i32, i32* %c.addr.1, align 4
  %63 = add nsw i32 %62, 1
  store i32 %63, i32* %c.addr.1, align 4
  br label %for.cond.3

for.end.3:
  br label %for.inc.2

for.inc.2:
  %64 = load i32, i32* %r.addr.1, align 4
  %65 = add nsw i32 %64, 1
  store i32 %65, i32* %r.addr.1, align 4
  br label %for.cond.2

for.end.2:
  %66 = load i32, i32* %total.addr, align 4
  ret i32 %66

ovf.fail:
  %ovf.op = phi i32 [ 2, %for.body.3 ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @diagonals()
  %1 = call i8* @nish_str_from_i32(i32 %0)
  call void @nish_print(i8* %1)
  %2 = call i32 @board()
  %3 = call i8* @nish_str_from_i32(i32 %2)
  call void @nish_print(i8* %3)
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
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}

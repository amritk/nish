%struct.nish_array = type { i64, i64, i8* }

declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define noundef i32 @test() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %ys.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [3 x i32], align 8
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %zs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [3 x i32], align 8
  %j.addr = alloca i32, align 4
  %ws.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %arr.data.3 = alloca [2 x i32], align 8
  %k.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [3 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 1, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 2, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 3, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 3, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 3, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %10 = bitcast [3 x i32]* %arr.data.1 to i8*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %12 = bitcast i8* %10 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 0
  store i32 4, i32* %13, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %14 = getelementptr inbounds i32, i32* %12, i64 1
  store i32 5, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %15 = getelementptr inbounds i32, i32* %12, i64 2
  store i32 6, i32* %15, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %ys.addr, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %16 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %24 = load i32, i32* %i.addr, align 4
  %25 = trunc i64 %18 to i32
  %26 = icmp slt i32 %24, %25
  br i1 %26, label %for.body, label %for.end

for.body:
  %27 = load i32, i32* %total.addr, align 4
  %28 = load i32, i32* %i.addr, align 4
  %29 = sext i32 %28 to i64
  %30 = icmp ult i64 %29, %21
  br i1 %30, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %29, i64 %21)
  unreachable

bounds.ok:
  %31 = bitcast i8* %23 to i32*
  %32 = getelementptr inbounds i32, i32* %31, i64 %29
  %33 = load i32, i32* %32, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %34 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %27, i32 %33)
  %35 = extractvalue { i32, i1 } %34, 0
  %36 = extractvalue { i32, i1 } %34, 1
  br i1 %36, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %35, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %37 = load i32, i32* %i.addr, align 4
  %38 = add nsw i32 %37, 1
  store i32 %38, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 3, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 3, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %41 = bitcast [3 x i32]* %arr.data.2 to i8*
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %41, i8** %42, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %43 = bitcast i8* %41 to i32*
  %44 = getelementptr inbounds i32, i32* %43, i64 0
  store i32 7, i32* %44, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %45 = getelementptr inbounds i32, i32* %43, i64 1
  store i32 8, i32* %45, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %46 = getelementptr inbounds i32, i32* %43, i64 2
  store i32 9, i32* %46, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %zs.addr, align 8
  store i32 0, i32* %j.addr, align 4
  br label %while.cond

while.cond:
  %47 = load i32, i32* %j.addr, align 4
  %48 = load %struct.nish_array*, %struct.nish_array** %zs.addr, align 8
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 0
  %50 = load i64, i64* %49, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %51 = trunc i64 %50 to i32
  %52 = icmp slt i32 %47, %51
  br i1 %52, label %while.body, label %while.end

while.body:
  %53 = load i32, i32* %total.addr, align 4
  %54 = load %struct.nish_array*, %struct.nish_array** %zs.addr, align 8
  %55 = call i32 @weigh(%struct.nish_array* %54)
  %56 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %53, i32 %55)
  %57 = extractvalue { i32, i1 } %56, 0
  %58 = extractvalue { i32, i1 } %56, 1
  br i1 %58, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %59 = load %struct.nish_array*, %struct.nish_array** %zs.addr, align 8
  %60 = load i32, i32* %j.addr, align 4
  %61 = sext i32 %60 to i64
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 0
  %63 = load i64, i64* %62, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %64 = icmp ult i64 %61, %63
  br i1 %64, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %61, i64 %63)
  unreachable

bounds.ok.1:
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 2
  %66 = load i8*, i8** %65, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %67 = bitcast i8* %66 to i32*
  %68 = getelementptr inbounds i32, i32* %67, i64 %61
  %69 = load i32, i32* %68, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %70 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %57, i32 %69)
  %71 = extractvalue { i32, i1 } %70, 0
  %72 = extractvalue { i32, i1 } %70, 1
  br i1 %72, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %71, i32* %total.addr, align 4
  %73 = load i32, i32* %j.addr, align 4
  %74 = add nsw i32 %73, 1
  store i32 %74, i32* %j.addr, align 4
  br label %while.cond

while.end:
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 2, i64* %75, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 2, i64* %76, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %77 = bitcast [2 x i32]* %arr.data.3 to i8*
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %77, i8** %78, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %79 = bitcast i8* %77 to i32*
  %80 = getelementptr inbounds i32, i32* %79, i64 0
  store i32 1, i32* %80, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %81 = getelementptr inbounds i32, i32* %79, i64 1
  store i32 2, i32* %81, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %ws.addr, align 8
  %82 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %82, i64 0, i32 0
  %84 = load i64, i64* %83, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %85 = trunc i64 %84 to i32
  %86 = sub nsw i32 %85, 1
  store i32 %86, i32* %k.addr, align 4
  %87 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %87, i64 0, i32 0
  %89 = load i64, i64* %88, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %87, i64 0, i32 2
  %91 = load i8*, i8** %90, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond.1

while.cond.1:
  %92 = load i32, i32* %k.addr, align 4
  %93 = icmp ne i32 %92, 0
  br i1 %93, label %while.body.1, label %while.end.1

while.body.1:
  %94 = load i32, i32* %total.addr, align 4
  %95 = load i32, i32* %k.addr, align 4
  %96 = sext i32 %95 to i64
  %97 = icmp ult i64 %96, %89
  br i1 %97, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %96, i64 %89)
  unreachable

bounds.ok.2:
  %98 = bitcast i8* %91 to i32*
  %99 = getelementptr inbounds i32, i32* %98, i64 %96
  %100 = load i32, i32* %99, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %101 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %94, i32 %100)
  %102 = extractvalue { i32, i1 } %101, 0
  %103 = extractvalue { i32, i1 } %101, 1
  br i1 %103, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %102, i32* %total.addr, align 4
  %104 = load i32, i32* %k.addr, align 4
  %105 = sub nsw i32 %104, 1
  store i32 %105, i32* %k.addr, align 4
  br label %while.cond.1

while.end.1:
  %106 = load i32, i32* %total.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %106

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @weigh(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %ys) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ys, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ys, i64 0, i32 1
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = icmp eq i64 %1, %3
  br i1 %4, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %ys, i64 4)
  br label %push.store

push.store:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ys, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 %1
  store i32 0, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = add i64 %1, 1
  store i64 %9, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = trunc i64 %9 to i32
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ys, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = icmp eq i64 %12, 0
  br i1 %13, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %14 = sub i64 %12, 1
  store i64 %14, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ys, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %17 = bitcast i8* %16 to i32*
  %18 = getelementptr inbounds i32, i32* %17, i64 %14
  %19 = load i32, i32* %18, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %ys, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = trunc i64 %21 to i32
  ret i32 %22
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

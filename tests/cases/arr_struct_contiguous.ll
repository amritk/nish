%struct.Point = type { i32, i32 }
%struct.nish_array = type { i64, i64, i8* }

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)

define noundef i32 @test() #0 {
entry:
  %ps.addr = alloca %struct.nish_array*, align 8
  %Point.obj = alloca %struct.Point, align 8
  %Point.obj.1 = alloca %struct.Point, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x %struct.Point], align 8
  %sum.addr = alloca i32, align 4
  %p.addr = alloca %struct.Point*, align 8
  %forof.idx = alloca i64, align 8
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 0
  store i32 1, i32* %0, align 4
  %1 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 1
  store i32 2, i32* %1, align 4
  %2 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.1, i32 0, i32 0
  store i32 3, i32* %2, align 4
  %3 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj.1, i32 0, i32 1
  store i32 4, i32* %3, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast [2 x %struct.Point]* %arr.data to i8*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %8 = bitcast i8* %6 to %struct.Point*
  %9 = getelementptr inbounds %struct.Point, %struct.Point* %8, i64 0
  %10 = bitcast %struct.Point* %9 to i8*
  %11 = bitcast %struct.Point* %Point.obj to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %10, i8* align 4 %11, i64 8, i1 false), !alias.scope !4, !noalias !3
  %12 = getelementptr inbounds %struct.Point, %struct.Point* %8, i64 1
  %13 = bitcast %struct.Point* %12 to i8*
  %14 = bitcast %struct.Point* %Point.obj.1 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %13, i8* align 4 %14, i64 8, i1 false), !alias.scope !4, !noalias !3
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %ps.addr, align 8
  %15 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %18 = bitcast i8* %17 to %struct.Point*
  %19 = getelementptr inbounds %struct.Point, %struct.Point* %18, i64 1
  %20 = getelementptr inbounds %struct.Point, %struct.Point* %19, i32 0, i32 0
  store i32 10, i32* %20, align 4
  store i32 0, i32* %sum.addr, align 4
  %21 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %22 = load i64, i64* %forof.idx, align 8
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = icmp ult i64 %22, %24
  br i1 %25, label %forof.body, label %forof.end

forof.body:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %28 = bitcast i8* %27 to %struct.Point*
  %29 = getelementptr inbounds %struct.Point, %struct.Point* %28, i64 %22
  store %struct.Point* %29, %struct.Point** %p.addr, align 8
  %30 = load i32, i32* %sum.addr, align 4
  %31 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %32 = getelementptr inbounds %struct.Point, %struct.Point* %31, i32 0, i32 0
  %33 = load i32, i32* %32, align 4
  %34 = add nsw i32 %30, %33
  %35 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %36 = getelementptr inbounds %struct.Point, %struct.Point* %35, i32 0, i32 1
  %37 = load i32, i32* %36, align 4
  %38 = add nsw i32 %34, %37
  store i32 %38, i32* %sum.addr, align 4
  br label %forof.inc

forof.inc:
  %39 = load i64, i64* %forof.idx, align 8
  %40 = add i64 %39, 1
  store i64 %40, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %41 = load i32, i32* %sum.addr, align 4
  ret i32 %41
}

attributes #0 = { nounwind willreturn }

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

%struct.Point = type { i32, i32 }
%struct.nish_array = type { i64, i64, i8* }

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @nish_panic_index(i64 noundef, i64 noundef) #1

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
  store i64 2, i64* %4, align 8, !alias.scope !3, !noalias !4
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %5, align 8, !alias.scope !3, !noalias !4
  %6 = bitcast [2 x %struct.Point]* %arr.data to i8*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !3, !noalias !4
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
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4
  %18 = icmp ult i64 1, %17
  br i1 %18, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %17)
  unreachable

bounds.ok:
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4
  %21 = bitcast i8* %20 to %struct.Point*
  %22 = getelementptr inbounds %struct.Point, %struct.Point* %21, i64 1
  %23 = getelementptr inbounds %struct.Point, %struct.Point* %22, i32 0, i32 0
  store i32 10, i32* %23, align 4
  store i32 0, i32* %sum.addr, align 4
  %24 = load %struct.nish_array*, %struct.nish_array** %ps.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %25 = load i64, i64* %forof.idx, align 8
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4
  %28 = icmp ult i64 %25, %27
  br i1 %28, label %forof.body, label %forof.end

forof.body:
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !3, !noalias !4
  %31 = bitcast i8* %30 to %struct.Point*
  %32 = getelementptr inbounds %struct.Point, %struct.Point* %31, i64 %25
  store %struct.Point* %32, %struct.Point** %p.addr, align 8
  %33 = load i32, i32* %sum.addr, align 4
  %34 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %35 = getelementptr inbounds %struct.Point, %struct.Point* %34, i32 0, i32 0
  %36 = load i32, i32* %35, align 4
  %37 = add nsw i32 %33, %36
  %38 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %39 = getelementptr inbounds %struct.Point, %struct.Point* %38, i32 0, i32 1
  %40 = load i32, i32* %39, align 4
  %41 = add nsw i32 %37, %40
  store i32 %41, i32* %sum.addr, align 4
  br label %forof.inc

forof.inc:
  %42 = load i64, i64* %forof.idx, align 8
  %43 = add i64 %42, 1
  store i64 %43, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %44 = load i32, i32* %sum.addr, align 4
  ret i32 %44
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}

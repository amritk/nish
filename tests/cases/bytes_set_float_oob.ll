%struct.nish_array = type { i64, i64, i8* }

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @nish_panic_index(i64 noundef, i64 noundef) #1
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #1
declare i64 @llvm.fptosi.sat.i64.f64(double) #2

define internal noundef i32 @into(double noundef %at) #0 {
entry:
  %dst.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x i8], align 8
  %src.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [1 x i8], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [4 x i8]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i8*
  %5 = getelementptr inbounds i8, i8* %4, i64 0
  store i8 0, i8* %5, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i8, i8* %4, i64 1
  store i8 0, i8* %6, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i8, i8* %4, i64 2
  store i8 0, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i8, i8* %4, i64 3
  store i8 0, i8* %8, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %dst.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 1, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 1, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %11 = bitcast [1 x i8]* %arr.data.1 to i8*
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %11 to i8*
  %14 = getelementptr inbounds i8, i8* %13, i64 0
  store i8 7, i8* %14, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %src.addr, align 8
  %15 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  %17 = call i64 @llvm.fptosi.sat.i64.f64(double %at)
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = add i64 %17, %19
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = icmp ule i64 %17, %20
  %24 = icmp ule i64 %20, %22
  %25 = and i1 %23, %24
  br i1 %25, label %set.ok, label %set.fail

set.fail:
  call void @nish_panic_slice(i64 %17, i64 %20, i64 %22)
  unreachable

set.ok:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %28 = bitcast i8* %27 to i8*
  %29 = getelementptr inbounds i8, i8* %28, i64 %17
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %32 = bitcast i8* %31 to i8*
  %33 = getelementptr inbounds i8, i8* %32, i64 0
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %29, i8* %33, i64 %19, i1 false), !alias.scope !4, !noalias !3
  %34 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %35 = fptosi double 0x0000000000000000 to i64
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = icmp ult i64 %35, %37
  br i1 %38, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %35, i64 %37)
  unreachable

bounds.ok:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %41 = bitcast i8* %40 to i8*
  %42 = getelementptr inbounds i8, i8* %41, i64 %35
  %43 = load i8, i8* %42, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %44 = zext i8 %43 to i32
  ret i32 %44
}

define noundef i32 @huge() #0 {
entry:
  %0 = tail call i32 @into(double 0x7E37E43C8800759C)
  ret i32 %0
}

define noundef i32 @infinite() #0 {
entry:
  %0 = fdiv double 0x3FF0000000000000, 0x0000000000000000
  %1 = tail call i32 @into(double %0)
  ret i32 %1
}

define noundef i32 @negativeInfinite() #0 {
entry:
  %0 = fneg double 0x3FF0000000000000
  %1 = fdiv double %0, 0x0000000000000000
  %2 = tail call i32 @into(double %1)
  ret i32 %2
}

define noundef i32 @test() #0 {
entry:
  %0 = fdiv double 0x0000000000000000, 0x0000000000000000
  %1 = tail call i32 @into(double %0)
  ret i32 %1
}

attributes #0 = { nounwind }
attributes #1 = { nounwind noreturn cold }
attributes #2 = { nounwind willreturn readnone }

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
!13 = !{!"element i8", !6, i64 0}
!14 = !{!13, !13, i64 0}

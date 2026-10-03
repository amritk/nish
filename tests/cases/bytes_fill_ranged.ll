%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [43 x i8] } { i64 42, [43 x i8] c"value out of range: expected integer<0, 9>\00" }, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #1
declare void @nish_exit(i32 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare i64 @llvm.smin.i64(i64, i64) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #4

define void @put(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs, i32 noundef %v) #0 {
entry:
  %fill.at = alloca i64, align 8
  %0 = icmp ult i32 %v, 10
  br i1 %0, label %rng.ok, label %rng.fail

rng.fail:
  call void @nish_write(i8* bitcast ({ i64, [43 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

rng.ok:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = call i64 @llvm.smin.i64(i64 1, i64 %2)
  store i64 %3, i64* %fill.at, align 8
  br label %fill.cond

fill.cond:
  %4 = load i64, i64* %fill.at, align 8
  %5 = icmp slt i64 %4, %2
  br i1 %5, label %fill.body, label %fill.end

fill.body:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %4
  store i32 %v, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %10 = add i64 %4, 1
  store i64 %10, i64* %fill.at, align 8
  br label %fill.cond

fill.end:
  ret void
}

define noundef i32 @test() #0 {
entry:
  %a.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %b.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [1 x i32], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = bitcast [3 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 1, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 2, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 3, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %a.addr, align 8
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 1, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 1, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %10 = bitcast [1 x i32]* %arr.data.1 to i8*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %12 = bitcast i8* %10 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 0
  store i32 7, i32* %13, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %b.addr, align 8
  %14 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  call void @put(%struct.nish_array* %14, i32 4)
  %15 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = add i64 2, %18
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = icmp ule i64 2, %19
  %23 = icmp ule i64 %19, %21
  %24 = and i1 %22, %23
  br i1 %24, label %set.ok, label %set.fail

set.fail:
  call void @nish_panic_slice(i64 2, i64 %19, i64 %21)
  unreachable

set.ok:
  %25 = mul i64 %18, 4
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %28 = bitcast i8* %27 to i32*
  %29 = getelementptr inbounds i32, i32* %28, i64 2
  %30 = bitcast i32* %29 to i8*
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %33 = bitcast i8* %32 to i32*
  %34 = getelementptr inbounds i32, i32* %33, i64 0
  %35 = bitcast i32* %34 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %30, i8* %35, i64 %25, i1 false), !alias.scope !4, !noalias !3
  %36 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = icmp ult i64 0, %38
  br i1 %39, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %38)
  unreachable

bounds.ok:
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %42 = bitcast i8* %41 to i32*
  %43 = getelementptr inbounds i32, i32* %42, i64 0
  %44 = load i32, i32* %43, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %45 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %44, i32 100)
  %46 = extractvalue { i32, i1 } %45, 0
  %47 = extractvalue { i32, i1 } %45, 1
  br i1 %47, label %ovf.fail, label %ovf.ok

ovf.ok:
  %48 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 0
  %50 = load i64, i64* %49, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %51 = icmp ult i64 1, %50
  br i1 %51, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %50)
  unreachable

bounds.ok.1:
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 2
  %53 = load i8*, i8** %52, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %54 = bitcast i8* %53 to i32*
  %55 = getelementptr inbounds i32, i32* %54, i64 1
  %56 = load i32, i32* %55, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %57 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %56, i32 10)
  %58 = extractvalue { i32, i1 } %57, 0
  %59 = extractvalue { i32, i1 } %57, 1
  br i1 %59, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %60 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %46, i32 %58)
  %61 = extractvalue { i32, i1 } %60, 0
  %62 = extractvalue { i32, i1 } %60, 1
  br i1 %62, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %63 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 0
  %65 = load i64, i64* %64, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %66 = icmp ult i64 2, %65
  br i1 %66, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 2, i64 %65)
  unreachable

bounds.ok.2:
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 2
  %68 = load i8*, i8** %67, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %69 = bitcast i8* %68 to i32*
  %70 = getelementptr inbounds i32, i32* %69, i64 2
  %71 = load i32, i32* %70, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %72 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %61, i32 %71)
  %73 = extractvalue { i32, i1 } %72, 0
  %74 = extractvalue { i32, i1 } %72, 1
  br i1 %74, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  ret i32 %73

ovf.fail:
  %ovf.op = phi i32 [ 2, %bounds.ok ], [ 2, %bounds.ok.1 ], [ 0, %ovf.ok.1 ], [ 0, %bounds.ok.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { noreturn nounwind }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }

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

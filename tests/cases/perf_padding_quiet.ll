%struct.Packed = type { double, i32, i1 }
%struct.Uniform = type { i32, i32, i32 }
%struct.Single = type { i1 }
%struct.Unavoidable = type { i1, i32 }
%struct.Header = type { i1, double }
%struct.Entry = type { i1, double, i32 }
%struct.Cell$f64 = type { i1, double, i32 }

declare i32 @llvm.fptosi.sat.i32.f64(double) #1

define noundef i32 @test() #0 {
entry:
  %p.addr = alloca %struct.Packed*, align 8
  %Packed.obj = alloca %struct.Packed, align 8
  %u.addr = alloca %struct.Uniform*, align 8
  %Uniform.obj = alloca %struct.Uniform, align 8
  %s.addr = alloca %struct.Single*, align 8
  %Single.obj = alloca %struct.Single, align 8
  %v.addr = alloca %struct.Unavoidable*, align 8
  %Unavoidable.obj = alloca %struct.Unavoidable, align 8
  %e.addr = alloca %struct.Entry*, align 8
  %Entry.obj = alloca %struct.Entry, align 8
  %c.addr = alloca %struct.Cell$f64*, align 8
  %Cell$f64.obj = alloca %struct.Cell$f64, align 8
  %0 = getelementptr inbounds %struct.Packed, %struct.Packed* %Packed.obj, i32 0, i32 0
  store double 0x0000000000000000, double* %0, align 8, !tbaa !6
  %1 = getelementptr inbounds %struct.Packed, %struct.Packed* %Packed.obj, i32 0, i32 1
  store i32 0, i32* %1, align 4, !tbaa !7
  %2 = getelementptr inbounds %struct.Packed, %struct.Packed* %Packed.obj, i32 0, i32 2
  store i1 false, i1* %2, align 1, !tbaa !8
  store %struct.Packed* %Packed.obj, %struct.Packed** %p.addr, align 8
  %3 = getelementptr inbounds %struct.Uniform, %struct.Uniform* %Uniform.obj, i32 0, i32 0
  store i32 0, i32* %3, align 4, !tbaa !10
  %4 = getelementptr inbounds %struct.Uniform, %struct.Uniform* %Uniform.obj, i32 0, i32 1
  store i32 0, i32* %4, align 4, !tbaa !11
  %5 = getelementptr inbounds %struct.Uniform, %struct.Uniform* %Uniform.obj, i32 0, i32 2
  store i32 0, i32* %5, align 4, !tbaa !12
  store %struct.Uniform* %Uniform.obj, %struct.Uniform** %u.addr, align 8
  %6 = getelementptr inbounds %struct.Single, %struct.Single* %Single.obj, i32 0, i32 0
  store i1 false, i1* %6, align 1, !tbaa !14
  store %struct.Single* %Single.obj, %struct.Single** %s.addr, align 8
  %7 = getelementptr inbounds %struct.Unavoidable, %struct.Unavoidable* %Unavoidable.obj, i32 0, i32 0
  store i1 false, i1* %7, align 1, !tbaa !16
  %8 = getelementptr inbounds %struct.Unavoidable, %struct.Unavoidable* %Unavoidable.obj, i32 0, i32 1
  store i32 0, i32* %8, align 4, !tbaa !17
  store %struct.Unavoidable* %Unavoidable.obj, %struct.Unavoidable** %v.addr, align 8
  %9 = getelementptr inbounds %struct.Entry, %struct.Entry* %Entry.obj, i32 0, i32 0
  store i1 false, i1* %9, align 1
  %10 = getelementptr inbounds %struct.Entry, %struct.Entry* %Entry.obj, i32 0, i32 1
  store double 0x0000000000000000, double* %10, align 8
  %11 = getelementptr inbounds %struct.Entry, %struct.Entry* %Entry.obj, i32 0, i32 2
  store i32 0, i32* %11, align 4
  store %struct.Entry* %Entry.obj, %struct.Entry** %e.addr, align 8
  call void @Cell$f64.constructor(%struct.Cell$f64* %Cell$f64.obj, double 0x4010000000000000)
  store %struct.Cell$f64* %Cell$f64.obj, %struct.Cell$f64** %c.addr, align 8
  %12 = load %struct.Packed*, %struct.Packed** %p.addr, align 8
  %13 = getelementptr inbounds %struct.Packed, %struct.Packed* %12, i32 0, i32 1
  %14 = load i32, i32* %13, align 4, !tbaa !7
  %15 = load %struct.Uniform*, %struct.Uniform** %u.addr, align 8
  %16 = getelementptr inbounds %struct.Uniform, %struct.Uniform* %15, i32 0, i32 2
  %17 = load i32, i32* %16, align 4, !tbaa !12
  %18 = add nsw i32 %14, %17
  %19 = load %struct.Unavoidable*, %struct.Unavoidable** %v.addr, align 8
  %20 = getelementptr inbounds %struct.Unavoidable, %struct.Unavoidable* %19, i32 0, i32 1
  %21 = load i32, i32* %20, align 4, !tbaa !17
  %22 = add nsw i32 %18, %21
  %23 = load %struct.Entry*, %struct.Entry** %e.addr, align 8
  %24 = getelementptr inbounds %struct.Entry, %struct.Entry* %23, i32 0, i32 2
  %25 = load i32, i32* %24, align 4
  %26 = add nsw i32 %22, %25
  %27 = load %struct.Cell$f64*, %struct.Cell$f64** %c.addr, align 8
  %28 = getelementptr inbounds %struct.Cell$f64, %struct.Cell$f64* %27, i32 0, i32 2
  %29 = load i32, i32* %28, align 4, !tbaa !19
  %30 = add nsw i32 %26, %29
  %31 = load %struct.Single*, %struct.Single** %s.addr, align 8
  %32 = getelementptr inbounds %struct.Single, %struct.Single* %31, i32 0, i32 0
  %33 = load i1, i1* %32, align 1, !tbaa !14
  br i1 %33, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %34 = phi i32 [ 1, %cond.true ], [ 2, %cond.false ]
  %35 = add nsw i32 %30, %34
  %36 = load %struct.Cell$f64*, %struct.Cell$f64** %c.addr, align 8
  %37 = getelementptr inbounds %struct.Cell$f64, %struct.Cell$f64* %36, i32 0, i32 1
  %38 = load double, double* %37, align 8, !tbaa !20
  %39 = call i32 @llvm.fptosi.sat.i32.f64(double %38)
  %40 = add nsw i32 %35, %39
  ret i32 %40
}

define void @Cell$f64.constructor(%struct.Cell$f64* noundef nonnull noalias align 8 dereferenceable(24) nocapture %this, double noundef %value) #0 {
entry:
  %0 = getelementptr inbounds %struct.Cell$f64, %struct.Cell$f64* %this, i32 0, i32 0
  store i1 false, i1* %0, align 1, !tbaa !21
  %1 = getelementptr inbounds %struct.Cell$f64, %struct.Cell$f64* %this, i32 0, i32 2
  store i32 0, i32* %1, align 4, !tbaa !19
  %2 = getelementptr inbounds %struct.Cell$f64, %struct.Cell$f64* %this, i32 0, i32 1
  store double %value, double* %2, align 8, !tbaa !20
  ret void
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readnone }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"double", !1, i64 0}
!3 = !{!"i32", !1, i64 0}
!4 = !{!"i1", !1, i64 0}
!5 = !{!"Packed", !2, i64 0, !3, i64 8, !4, i64 12}
!6 = !{!5, !2, i64 0}
!7 = !{!5, !3, i64 8}
!8 = !{!5, !4, i64 12}
!9 = !{!"Uniform", !3, i64 0, !3, i64 4, !3, i64 8}
!10 = !{!9, !3, i64 0}
!11 = !{!9, !3, i64 4}
!12 = !{!9, !3, i64 8}
!13 = !{!"Single", !4, i64 0}
!14 = !{!13, !4, i64 0}
!15 = !{!"Unavoidable", !4, i64 0, !3, i64 4}
!16 = !{!15, !4, i64 0}
!17 = !{!15, !3, i64 4}
!18 = !{!"Cell$f64", !4, i64 0, !2, i64 8, !3, i64 16}
!19 = !{!18, !3, i64 16}
!20 = !{!18, !2, i64 8}
!21 = !{!18, !4, i64 0}

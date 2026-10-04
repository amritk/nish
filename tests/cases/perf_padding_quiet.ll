%struct.Packed = type { double, i32, i1 }
%struct.Uniform = type { i32, i32, i32 }
%struct.Single = type { i1 }
%struct.Unavoidable = type { i1, i32 }
%struct.Header = type { i1, double }
%struct.Entry = type { i1, double, i32 }
%struct.Cell$f64 = type { i1, double, i32 }

declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare i32 @llvm.fptosi.sat.i32.f64(double) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

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
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %14, i32 %17)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok

ovf.ok:
  %21 = load %struct.Unavoidable*, %struct.Unavoidable** %v.addr, align 8
  %22 = getelementptr inbounds %struct.Unavoidable, %struct.Unavoidable* %21, i32 0, i32 1
  %23 = load i32, i32* %22, align 4, !tbaa !17
  %24 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %19, i32 %23)
  %25 = extractvalue { i32, i1 } %24, 0
  %26 = extractvalue { i32, i1 } %24, 1
  br i1 %26, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %27 = load %struct.Entry*, %struct.Entry** %e.addr, align 8
  %28 = getelementptr inbounds %struct.Entry, %struct.Entry* %27, i32 0, i32 2
  %29 = load i32, i32* %28, align 4
  %30 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %25, i32 %29)
  %31 = extractvalue { i32, i1 } %30, 0
  %32 = extractvalue { i32, i1 } %30, 1
  br i1 %32, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %33 = load %struct.Cell$f64*, %struct.Cell$f64** %c.addr, align 8
  %34 = getelementptr inbounds %struct.Cell$f64, %struct.Cell$f64* %33, i32 0, i32 2
  %35 = load i32, i32* %34, align 4, !tbaa !19
  %36 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %31, i32 %35)
  %37 = extractvalue { i32, i1 } %36, 0
  %38 = extractvalue { i32, i1 } %36, 1
  br i1 %38, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %39 = load %struct.Single*, %struct.Single** %s.addr, align 8
  %40 = getelementptr inbounds %struct.Single, %struct.Single* %39, i32 0, i32 0
  %41 = load i1, i1* %40, align 1, !tbaa !14
  br i1 %41, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %42 = phi i32 [ 1, %cond.true ], [ 2, %cond.false ]
  %43 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %37, i32 %42)
  %44 = extractvalue { i32, i1 } %43, 0
  %45 = extractvalue { i32, i1 } %43, 1
  br i1 %45, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %46 = load %struct.Cell$f64*, %struct.Cell$f64** %c.addr, align 8
  %47 = getelementptr inbounds %struct.Cell$f64, %struct.Cell$f64* %46, i32 0, i32 1
  %48 = load double, double* %47, align 8, !tbaa !20
  %49 = call i32 @llvm.fptosi.sat.i32.f64(double %48)
  %50 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %44, i32 %49)
  %51 = extractvalue { i32, i1 } %50, 0
  %52 = extractvalue { i32, i1 } %50, 1
  br i1 %52, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  ret i32 %51

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define void @Cell$f64.constructor(%struct.Cell$f64* noundef nonnull noalias align 8 dereferenceable(24) nocapture %this, double noundef %value) #1 {
entry:
  %0 = getelementptr inbounds %struct.Cell$f64, %struct.Cell$f64* %this, i32 0, i32 0
  store i1 false, i1* %0, align 1, !tbaa !21
  %1 = getelementptr inbounds %struct.Cell$f64, %struct.Cell$f64* %this, i32 0, i32 2
  store i32 0, i32* %1, align 4, !tbaa !19
  %2 = getelementptr inbounds %struct.Cell$f64, %struct.Cell$f64* %this, i32 0, i32 1
  store double %value, double* %2, align 8, !tbaa !20
  ret void
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }

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

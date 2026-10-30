%struct.Particle = type { i32, <2 x double>, <2 x double> }
%struct.nish_array = type { i64, i64, i8* }

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define internal void @Particle.constructor(%struct.Particle* noundef nonnull noalias align 8 dereferenceable(48) nocapture %this, i32 noundef %id, <2 x double> noundef %pos, <2 x double> noundef %vel) #0 {
entry:
  %0 = getelementptr inbounds %struct.Particle, %struct.Particle* %this, i32 0, i32 0
  store i32 %id, i32* %0, align 4, !tbaa !5
  %1 = getelementptr inbounds %struct.Particle, %struct.Particle* %this, i32 0, i32 1
  store <2 x double> %pos, <2 x double>* %1, align 8, !tbaa !6
  %2 = getelementptr inbounds %struct.Particle, %struct.Particle* %this, i32 0, i32 2
  store <2 x double> %vel, <2 x double>* %2, align 8, !tbaa !7
  ret void
}

define internal noundef i32 @sum4(<4 x i32> noundef %v) #1 {
entry:
  %0 = extractelement <4 x i32> %v, i32 0
  %1 = extractelement <4 x i32> %v, i32 1
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 %1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = extractelement <4 x i32> %v, i32 2
  %6 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %3, i32 %5)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %9 = extractelement <4 x i32> %v, i32 3
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 %9)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  ret i32 %11

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef <4 x i32> @bump(<4 x i32> noundef %v) #1 {
entry:
  %0 = extractelement <4 x i32> %v, i32 0
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 1)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  %4 = insertelement <4 x i32> %v, i32 %2, i32 0
  ret <4 x i32> %4

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #1 {
entry:
  %rows.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %total.addr = alloca i32, align 4
  %r.addr = alloca <4 x i32>, align 8
  %forof.idx = alloca i64, align 8
  %p.addr = alloca %struct.Particle*, align 8
  %Particle.obj = alloca %struct.Particle, align 8
  %v.addr = alloca <4 x i32>, align 8
  %kept.addr = alloca <4 x i32>, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %rows.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, 3
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = insertelement <4 x i32> undef, i32 %6, i32 0
  %8 = load i32, i32* %i.addr, align 4
  %9 = mul nsw i32 %8, 2
  %10 = insertelement <4 x i32> %7, i32 %9, i32 1
  %11 = load i32, i32* %i.addr, align 4
  %12 = mul nsw i32 %11, 3
  %13 = insertelement <4 x i32> %10, i32 %12, i32 2
  %14 = load i32, i32* %i.addr, align 4
  %15 = mul nsw i32 %14, 4
  %16 = insertelement <4 x i32> %13, i32 %15, i32 3
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %20 = load i64, i64* %19, align 8, !alias.scope !11, !noalias !12, !tbaa !17
  %21 = icmp eq i64 %18, %20
  br i1 %21, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 16)
  br label %push.store

push.store:
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %24 = bitcast i8* %23 to <4 x i32>*
  %25 = getelementptr inbounds <4 x i32>, <4 x i32>* %24, i64 %18
  store <4 x i32> %16, <4 x i32>* %25, align 8, !alias.scope !12, !noalias !11, !tbaa !20
  %26 = add i64 %18, 1
  store i64 %26, i64* %17, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %27 = trunc i64 %26 to i32
  br label %for.inc

for.inc:
  %28 = load i32, i32* %i.addr, align 4
  %29 = add nsw i32 %28, 1
  store i32 %29, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %30 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %31 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 0
  %33 = load i64, i64* %32, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %34 = icmp ult i64 1, %33
  br i1 %34, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %33)
  unreachable

bounds.ok:
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %37 = bitcast i8* %36 to <4 x i32>*
  %38 = getelementptr inbounds <4 x i32>, <4 x i32>* %37, i64 1
  %39 = load <4 x i32>, <4 x i32>* %38, align 8, !alias.scope !12, !noalias !11, !tbaa !20
  %40 = call <4 x i32> @bump(<4 x i32> %39)
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 0
  %42 = load i64, i64* %41, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %43 = icmp ult i64 1, %42
  br i1 %43, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %42)
  unreachable

bounds.ok.1:
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %46 = bitcast i8* %45 to <4 x i32>*
  %47 = getelementptr inbounds <4 x i32>, <4 x i32>* %46, i64 1
  store <4 x i32> %40, <4 x i32>* %47, align 8, !alias.scope !12, !noalias !11, !tbaa !20
  store i32 0, i32* %total.addr, align 4
  %48 = load %struct.nish_array*, %struct.nish_array** %rows.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %49 = load i64, i64* %forof.idx, align 8
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 0
  %51 = load i64, i64* %50, align 8, !alias.scope !11, !noalias !12, !tbaa !16
  %52 = icmp ult i64 %49, %51
  br i1 %52, label %forof.body, label %forof.end

forof.body:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !11, !noalias !12, !tbaa !18
  %55 = bitcast i8* %54 to <4 x i32>*
  %56 = getelementptr inbounds <4 x i32>, <4 x i32>* %55, i64 %49
  %57 = load <4 x i32>, <4 x i32>* %56, align 8, !alias.scope !12, !noalias !11, !tbaa !20
  store <4 x i32> %57, <4 x i32>* %r.addr, align 8
  %58 = load i32, i32* %total.addr, align 4
  %59 = load <4 x i32>, <4 x i32>* %r.addr, align 8
  %60 = call i32 @sum4(<4 x i32> %59)
  %61 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %58, i32 %60)
  %62 = extractvalue { i32, i1 } %61, 0
  %63 = extractvalue { i32, i1 } %61, 1
  br i1 %63, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %62, i32* %total.addr, align 4
  br label %forof.inc

forof.inc:
  %64 = load i64, i64* %forof.idx, align 8
  %65 = add i64 %64, 1
  store i64 %65, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %66 = load i32, i32* %total.addr, align 4
  %67 = call i8* @nish_str_from_i32(i32 %66)
  call void @nish_print(i8* %67)
  %68 = insertelement <2 x double> undef, double 0x3FE0000000000000, i32 0
  %69 = insertelement <2 x double> %68, double 0x3FF8000000000000, i32 1
  %70 = insertelement <2 x double> undef, double 0x3FD0000000000000, i32 0
  %71 = fneg double 0x3FD0000000000000
  %72 = insertelement <2 x double> %70, double %71, i32 1
  call void @Particle.constructor(%struct.Particle* %Particle.obj, i32 1, <2 x double> %69, <2 x double> %72)
  store %struct.Particle* %Particle.obj, %struct.Particle** %p.addr, align 8
  %73 = load %struct.Particle*, %struct.Particle** %p.addr, align 8
  %74 = load %struct.Particle*, %struct.Particle** %p.addr, align 8
  %75 = getelementptr inbounds %struct.Particle, %struct.Particle* %74, i32 0, i32 1
  %76 = load <2 x double>, <2 x double>* %75, align 8, !tbaa !6
  %77 = extractelement <2 x double> %76, i32 0
  %78 = load %struct.Particle*, %struct.Particle** %p.addr, align 8
  %79 = getelementptr inbounds %struct.Particle, %struct.Particle* %78, i32 0, i32 2
  %80 = load <2 x double>, <2 x double>* %79, align 8, !tbaa !7
  %81 = extractelement <2 x double> %80, i32 0
  %82 = fadd double %77, %81
  %83 = insertelement <2 x double> undef, double %82, i32 0
  %84 = load %struct.Particle*, %struct.Particle** %p.addr, align 8
  %85 = getelementptr inbounds %struct.Particle, %struct.Particle* %84, i32 0, i32 1
  %86 = load <2 x double>, <2 x double>* %85, align 8, !tbaa !6
  %87 = extractelement <2 x double> %86, i32 1
  %88 = load %struct.Particle*, %struct.Particle** %p.addr, align 8
  %89 = getelementptr inbounds %struct.Particle, %struct.Particle* %88, i32 0, i32 2
  %90 = load <2 x double>, <2 x double>* %89, align 8, !tbaa !7
  %91 = extractelement <2 x double> %90, i32 1
  %92 = fadd double %87, %91
  %93 = insertelement <2 x double> %83, double %92, i32 1
  %94 = getelementptr inbounds %struct.Particle, %struct.Particle* %73, i32 0, i32 1
  store <2 x double> %93, <2 x double>* %94, align 8, !tbaa !6
  %95 = load %struct.Particle*, %struct.Particle** %p.addr, align 8
  %96 = getelementptr inbounds %struct.Particle, %struct.Particle* %95, i32 0, i32 1
  %97 = load <2 x double>, <2 x double>* %96, align 8, !tbaa !6
  %98 = extractelement <2 x double> %97, i32 0
  %99 = call i8* @nish_str_from_f64(double %98)
  call void @nish_print(i8* %99)
  %100 = load %struct.Particle*, %struct.Particle** %p.addr, align 8
  %101 = getelementptr inbounds %struct.Particle, %struct.Particle* %100, i32 0, i32 1
  %102 = load <2 x double>, <2 x double>* %101, align 8, !tbaa !6
  %103 = extractelement <2 x double> %102, i32 1
  %104 = call i8* @nish_str_from_f64(double %103)
  call void @nish_print(i8* %104)
  %105 = insertelement <4 x i32> undef, i32 9, i32 0
  %106 = shufflevector <4 x i32> %105, <4 x i32> undef, <4 x i32> zeroinitializer
  store <4 x i32> %106, <4 x i32>* %v.addr, align 8
  %107 = load <4 x i32>, <4 x i32>* %v.addr, align 8
  store <4 x i32> %107, <4 x i32>* %kept.addr, align 8
  %108 = load <4 x i32>, <4 x i32>* %v.addr, align 8
  %109 = call <4 x i32> @bump(<4 x i32> %108)
  store <4 x i32> %109, <4 x i32>* %v.addr, align 8
  %110 = load <4 x i32>, <4 x i32>* %kept.addr, align 8
  %111 = call i32 @sum4(<4 x i32> %110)
  %112 = call i8* @nish_str_from_i32(i32 %111)
  call void @nish_print(i8* %112)
  %113 = load <4 x i32>, <4 x i32>* %v.addr, align 8
  %114 = call i32 @sum4(<4 x i32> %113)
  %115 = call i8* @nish_str_from_i32(i32 %114)
  call void @nish_print(i8* %115)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!21, !22, !23, !24, !25}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"<2 x double>", !1, i64 0}
!4 = !{!"Particle", !2, i64 0, !3, i64 16, !3, i64 32}
!5 = !{!4, !2, i64 0}
!6 = !{!4, !3, i64 16}
!7 = !{!4, !3, i64 32}
!8 = !{!"nish array"}
!9 = !{!"header", !8}
!10 = !{!"elements", !8}
!11 = !{!9}
!12 = !{!10}
!13 = !{!"header i64", !1, i64 0}
!14 = !{!"header ptr", !1, i64 0}
!15 = !{!"array header", !13, i64 0, !13, i64 8, !14, i64 16}
!16 = !{!15, !13, i64 0}
!17 = !{!15, !13, i64 8}
!18 = !{!15, !14, i64 16}
!19 = !{!"element <4 x i32>", !1, i64 0}
!20 = !{!19, !19, i64 0}
!21 = !{i32 8, !"cf-protection-branch", i32 1}
!22 = !{i32 8, !"cf-protection-return", i32 1}
!23 = !{i32 8, !"branch-target-enforcement", i32 1}
!24 = !{i32 8, !"sign-return-address", i32 1}
!25 = !{i32 4, !"probe-stack", !"inline-asm"}

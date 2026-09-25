%struct.Vec3 = type { float, float, float, i32 }
%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #1

define internal noundef float @dot(%struct.Vec3* noundef nonnull readonly align 8 dereferenceable(16) nocapture %a, %struct.Vec3* noundef nonnull readonly align 8 dereferenceable(16) nocapture %b) #0 {
entry:
  %0 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %a, i32 0, i32 0
  %1 = load float, float* %0, align 4, !tbaa !5
  %2 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %b, i32 0, i32 0
  %3 = load float, float* %2, align 4, !tbaa !5
  %4 = fmul float %1, %3
  %5 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %a, i32 0, i32 1
  %6 = load float, float* %5, align 4, !tbaa !6
  %7 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %b, i32 0, i32 1
  %8 = load float, float* %7, align 4, !tbaa !6
  %9 = fmul float %6, %8
  %10 = fadd float %4, %9
  %11 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %a, i32 0, i32 2
  %12 = load float, float* %11, align 4, !tbaa !7
  %13 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %b, i32 0, i32 2
  %14 = load float, float* %13, align 4, !tbaa !7
  %15 = fmul float %12, %14
  %16 = fadd float %10, %15
  ret float %16
}

define noundef i32 @test() #1 {
entry:
  %v.addr = alloca %struct.Vec3*, align 8
  %Vec3.obj = alloca %struct.Vec3, align 8
  %w.addr = alloca %struct.Vec3*, align 8
  %Vec3.obj.1 = alloca %struct.Vec3, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x float], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %Vec3.obj, i32 0, i32 0
  store float 0x0000000000000000, float* %0, align 4, !tbaa !5
  %1 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %Vec3.obj, i32 0, i32 1
  store float 0x0000000000000000, float* %1, align 4, !tbaa !6
  %2 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %Vec3.obj, i32 0, i32 2
  store float 0x0000000000000000, float* %2, align 4, !tbaa !7
  %3 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %Vec3.obj, i32 0, i32 3
  store i32 0, i32* %3, align 4, !tbaa !8
  store %struct.Vec3* %Vec3.obj, %struct.Vec3** %v.addr, align 8
  %4 = load %struct.Vec3*, %struct.Vec3** %v.addr, align 8
  %5 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %4, i32 0, i32 0
  store float 0x3FB99999A0000000, float* %5, align 4, !tbaa !5
  %6 = load %struct.Vec3*, %struct.Vec3** %v.addr, align 8
  %7 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %6, i32 0, i32 1
  store float 0x3FD0000000000000, float* %7, align 4, !tbaa !6
  %8 = load %struct.Vec3*, %struct.Vec3** %v.addr, align 8
  %9 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %8, i32 0, i32 2
  store float 0x4000000000000000, float* %9, align 4, !tbaa !7
  %10 = load %struct.Vec3*, %struct.Vec3** %v.addr, align 8
  %11 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %10, i32 0, i32 3
  %12 = load i32, i32* %11, align 4
  %13 = add i32 %12, 1
  store i32 %13, i32* %11, align 4
  %14 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %Vec3.obj.1, i32 0, i32 0
  store float 0x0000000000000000, float* %14, align 4, !tbaa !5
  %15 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %Vec3.obj.1, i32 0, i32 1
  store float 0x0000000000000000, float* %15, align 4, !tbaa !6
  %16 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %Vec3.obj.1, i32 0, i32 2
  store float 0x0000000000000000, float* %16, align 4, !tbaa !7
  %17 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %Vec3.obj.1, i32 0, i32 3
  store i32 0, i32* %17, align 4, !tbaa !8
  store %struct.Vec3* %Vec3.obj.1, %struct.Vec3** %w.addr, align 8
  %18 = load %struct.Vec3*, %struct.Vec3** %w.addr, align 8
  %19 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %18, i32 0, i32 0
  store float 0x4008000000000000, float* %19, align 4, !tbaa !5
  %20 = load %struct.Vec3*, %struct.Vec3** %w.addr, align 8
  %21 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %20, i32 0, i32 1
  store float 0x4010000000000000, float* %21, align 4, !tbaa !6
  %22 = load %struct.Vec3*, %struct.Vec3** %w.addr, align 8
  %23 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %22, i32 0, i32 2
  store float 0x3FE0000000000000, float* %23, align 4, !tbaa !7
  %24 = load %struct.Vec3*, %struct.Vec3** %v.addr, align 8
  %25 = load %struct.Vec3*, %struct.Vec3** %w.addr, align 8
  %26 = call float @dot(%struct.Vec3* %24, %struct.Vec3* %25)
  %27 = fpext float %26 to double
  %28 = call i8* @nish_str_from_f64(double %27)
  %29 = call i8* @nish_str_concat(i8* %28, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %30 = load %struct.Vec3*, %struct.Vec3** %v.addr, align 8
  %31 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %30, i32 0, i32 3
  %32 = load i32, i32* %31, align 4, !tbaa !8
  %33 = zext i32 %32 to i64
  %34 = call i8* @nish_str_from_u64(i64 %33)
  %35 = call i8* @nish_str_concat(i8* %29, i8* %34)
  call void @nish_print(i8* %35)
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %36, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %37, align 8, !alias.scope !12, !noalias !13, !tbaa !18
  %38 = mul i64 2, 4
  %39 = bitcast [2 x float]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %39, i8 0, i64 %38, i1 false), !alias.scope !13, !noalias !12
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %39, i8** %40, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %41 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 2
  %43 = load i8*, i8** %42, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %44 = bitcast i8* %43 to float*
  %45 = getelementptr inbounds float, float* %44, i64 0
  store float 0x3FB99999A0000000, float* %45, align 4, !alias.scope !13, !noalias !12, !tbaa !21
  %46 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %47 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %50 = bitcast i8* %49 to float*
  %51 = getelementptr inbounds float, float* %50, i64 0
  %52 = load float, float* %51, align 4, !alias.scope !13, !noalias !12, !tbaa !21
  %53 = fmul float %52, 0x4008000000000000
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  %55 = load i8*, i8** %54, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %56 = bitcast i8* %55 to float*
  %57 = getelementptr inbounds float, float* %56, i64 1
  store float %53, float* %57, align 4, !alias.scope !13, !noalias !12, !tbaa !21
  %58 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 2
  %60 = load i8*, i8** %59, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %61 = bitcast i8* %60 to float*
  %62 = getelementptr inbounds float, float* %61, i64 0
  %63 = load float, float* %62, align 4, !alias.scope !13, !noalias !12, !tbaa !21
  %64 = fpext float %63 to double
  %65 = call i8* @nish_str_from_f64(double %64)
  %66 = call i8* @nish_str_concat(i8* %65, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %67 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %67, i64 0, i32 2
  %69 = load i8*, i8** %68, align 8, !alias.scope !12, !noalias !13, !tbaa !19
  %70 = bitcast i8* %69 to float*
  %71 = getelementptr inbounds float, float* %70, i64 1
  %72 = load float, float* %71, align 4, !alias.scope !13, !noalias !12, !tbaa !21
  %73 = fpext float %72 to double
  %74 = call i8* @nish_str_from_f64(double %73)
  %75 = call i8* @nish_str_concat(i8* %66, i8* %74)
  %76 = call i8* @nish_str_concat(i8* %75, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %77 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %77, i64 0, i32 0
  %79 = load i64, i64* %78, align 8, !alias.scope !12, !noalias !13, !tbaa !17
  %80 = trunc i64 %79 to i32
  %81 = call i8* @nish_str_from_i32(i32 %80)
  %82 = call i8* @nish_str_concat(i8* %76, i8* %81)
  call void @nish_print(i8* %82)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind willreturn }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"float", !1, i64 0}
!3 = !{!"i32", !1, i64 0}
!4 = !{!"Vec3", !2, i64 0, !2, i64 4, !2, i64 8, !3, i64 12}
!5 = !{!4, !2, i64 0}
!6 = !{!4, !2, i64 4}
!7 = !{!4, !2, i64 8}
!8 = !{!4, !3, i64 12}
!9 = !{!"nish array"}
!10 = !{!"header", !9}
!11 = !{!"elements", !9}
!12 = !{!10}
!13 = !{!11}
!14 = !{!"header i64", !1, i64 0}
!15 = !{!"header ptr", !1, i64 0}
!16 = !{!"array header", !14, i64 0, !14, i64 8, !15, i64 16}
!17 = !{!16, !14, i64 0}
!18 = !{!16, !14, i64 8}
!19 = !{!16, !15, i64 16}
!20 = !{!"element float", !1, i64 0}
!21 = !{!20, !20, i64 0}

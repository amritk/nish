%struct.Vec3 = type { float, float, float, i32 }
%struct.amrit_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noundef i64 @amrit_arena_mark() #2
declare void @amrit_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @amrit_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @amrit_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @amrit_str_from_f64(double noundef) #2
declare noalias noundef nonnull align 8 i8* @amrit_str_from_u64(i64 noundef) #2
declare void @amrit_panic_index(i64 noundef, i64 noundef) #3

define internal noundef float @dot(%struct.Vec3* noundef nonnull readonly align 8 dereferenceable(16) nocapture %a, %struct.Vec3* noundef nonnull readonly align 8 dereferenceable(16) nocapture %b) #0 {
entry:
  %0 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %a, i32 0, i32 0
  %1 = load float, float* %0, align 4
  %2 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %b, i32 0, i32 0
  %3 = load float, float* %2, align 4
  %4 = fmul float %1, %3
  %5 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %a, i32 0, i32 1
  %6 = load float, float* %5, align 4
  %7 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %b, i32 0, i32 1
  %8 = load float, float* %7, align 4
  %9 = fmul float %6, %8
  %10 = fadd float %4, %9
  %11 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %a, i32 0, i32 2
  %12 = load float, float* %11, align 4
  %13 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %b, i32 0, i32 2
  %14 = load float, float* %13, align 4
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
  %xs.addr = alloca %struct.amrit_array*, align 8
  %arr.hdr = alloca %struct.amrit_array, align 8
  %arr.data = alloca [2 x float], align 8
  %arena.mark = call i64 @amrit_arena_mark()
  %0 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %Vec3.obj, i32 0, i32 0
  store float 0x0000000000000000, float* %0, align 4
  %1 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %Vec3.obj, i32 0, i32 1
  store float 0x0000000000000000, float* %1, align 4
  %2 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %Vec3.obj, i32 0, i32 2
  store float 0x0000000000000000, float* %2, align 4
  %3 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %Vec3.obj, i32 0, i32 3
  store i32 0, i32* %3, align 4
  store %struct.Vec3* %Vec3.obj, %struct.Vec3** %v.addr, align 8
  %4 = load %struct.Vec3*, %struct.Vec3** %v.addr, align 8
  %5 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %4, i32 0, i32 0
  store float 0x3FB99999A0000000, float* %5, align 4
  %6 = load %struct.Vec3*, %struct.Vec3** %v.addr, align 8
  %7 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %6, i32 0, i32 1
  store float 0x3FD0000000000000, float* %7, align 4
  %8 = load %struct.Vec3*, %struct.Vec3** %v.addr, align 8
  %9 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %8, i32 0, i32 2
  store float 0x4000000000000000, float* %9, align 4
  %10 = load %struct.Vec3*, %struct.Vec3** %v.addr, align 8
  %11 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %10, i32 0, i32 3
  %12 = load i32, i32* %11, align 4
  %13 = add i32 %12, 1
  store i32 %13, i32* %11, align 4
  %14 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %Vec3.obj.1, i32 0, i32 0
  store float 0x0000000000000000, float* %14, align 4
  %15 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %Vec3.obj.1, i32 0, i32 1
  store float 0x0000000000000000, float* %15, align 4
  %16 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %Vec3.obj.1, i32 0, i32 2
  store float 0x0000000000000000, float* %16, align 4
  %17 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %Vec3.obj.1, i32 0, i32 3
  store i32 0, i32* %17, align 4
  store %struct.Vec3* %Vec3.obj.1, %struct.Vec3** %w.addr, align 8
  %18 = load %struct.Vec3*, %struct.Vec3** %w.addr, align 8
  %19 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %18, i32 0, i32 0
  store float 0x4008000000000000, float* %19, align 4
  %20 = load %struct.Vec3*, %struct.Vec3** %w.addr, align 8
  %21 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %20, i32 0, i32 1
  store float 0x4010000000000000, float* %21, align 4
  %22 = load %struct.Vec3*, %struct.Vec3** %w.addr, align 8
  %23 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %22, i32 0, i32 2
  store float 0x3FE0000000000000, float* %23, align 4
  %24 = load %struct.Vec3*, %struct.Vec3** %v.addr, align 8
  %25 = load %struct.Vec3*, %struct.Vec3** %w.addr, align 8
  %26 = call float @dot(%struct.Vec3* %24, %struct.Vec3* %25)
  %27 = fpext float %26 to double
  %28 = call i8* @amrit_str_from_f64(double %27)
  %29 = call i8* @amrit_str_concat(i8* %28, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %30 = load %struct.Vec3*, %struct.Vec3** %v.addr, align 8
  %31 = getelementptr inbounds %struct.Vec3, %struct.Vec3* %30, i32 0, i32 3
  %32 = load i32, i32* %31, align 4
  %33 = zext i32 %32 to i64
  %34 = call i8* @amrit_str_from_u64(i64 %33)
  %35 = call i8* @amrit_str_concat(i8* %29, i8* %34)
  call void @amrit_print(i8* %35)
  %36 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %36, align 8
  %37 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %37, align 8
  %38 = mul i64 2, 4
  %39 = bitcast [2 x float]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %39, i8 0, i64 %38, i1 false)
  %40 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 2
  store i8* %39, i8** %40, align 8
  store %struct.amrit_array* %arr.hdr, %struct.amrit_array** %xs.addr, align 8
  %41 = load %struct.amrit_array*, %struct.amrit_array** %xs.addr, align 8
  %42 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %41, i64 0, i32 0
  %43 = load i64, i64* %42, align 8
  %44 = icmp ult i64 0, %43
  br i1 %44, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @amrit_panic_index(i64 0, i64 %43)
  unreachable

bounds.ok:
  %45 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %41, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8
  %47 = bitcast i8* %46 to float*
  %48 = getelementptr inbounds float, float* %47, i64 0
  store float 0x3FB99999A0000000, float* %48, align 4
  %49 = load %struct.amrit_array*, %struct.amrit_array** %xs.addr, align 8
  %50 = load %struct.amrit_array*, %struct.amrit_array** %xs.addr, align 8
  %51 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %50, i64 0, i32 0
  %52 = load i64, i64* %51, align 8
  %53 = icmp ult i64 0, %52
  br i1 %53, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @amrit_panic_index(i64 0, i64 %52)
  unreachable

bounds.ok.1:
  %54 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %50, i64 0, i32 2
  %55 = load i8*, i8** %54, align 8
  %56 = bitcast i8* %55 to float*
  %57 = getelementptr inbounds float, float* %56, i64 0
  %58 = load float, float* %57, align 4
  %59 = fmul float %58, 0x4008000000000000
  %60 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %49, i64 0, i32 0
  %61 = load i64, i64* %60, align 8
  %62 = icmp ult i64 1, %61
  br i1 %62, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @amrit_panic_index(i64 1, i64 %61)
  unreachable

bounds.ok.2:
  %63 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %49, i64 0, i32 2
  %64 = load i8*, i8** %63, align 8
  %65 = bitcast i8* %64 to float*
  %66 = getelementptr inbounds float, float* %65, i64 1
  store float %59, float* %66, align 4
  %67 = load %struct.amrit_array*, %struct.amrit_array** %xs.addr, align 8
  %68 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %67, i64 0, i32 0
  %69 = load i64, i64* %68, align 8
  %70 = icmp ult i64 0, %69
  br i1 %70, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @amrit_panic_index(i64 0, i64 %69)
  unreachable

bounds.ok.3:
  %71 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %67, i64 0, i32 2
  %72 = load i8*, i8** %71, align 8
  %73 = bitcast i8* %72 to float*
  %74 = getelementptr inbounds float, float* %73, i64 0
  %75 = load float, float* %74, align 4
  %76 = fpext float %75 to double
  %77 = call i8* @amrit_str_from_f64(double %76)
  %78 = call i8* @amrit_str_concat(i8* %77, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %79 = load %struct.amrit_array*, %struct.amrit_array** %xs.addr, align 8
  %80 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %79, i64 0, i32 0
  %81 = load i64, i64* %80, align 8
  %82 = icmp ult i64 1, %81
  br i1 %82, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @amrit_panic_index(i64 1, i64 %81)
  unreachable

bounds.ok.4:
  %83 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %79, i64 0, i32 2
  %84 = load i8*, i8** %83, align 8
  %85 = bitcast i8* %84 to float*
  %86 = getelementptr inbounds float, float* %85, i64 1
  %87 = load float, float* %86, align 4
  %88 = fpext float %87 to double
  %89 = call i8* @amrit_str_from_f64(double %88)
  %90 = call i8* @amrit_str_concat(i8* %78, i8* %89)
  %91 = call i8* @amrit_str_concat(i8* %90, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %92 = load %struct.amrit_array*, %struct.amrit_array** %xs.addr, align 8
  %93 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %92, i64 0, i32 0
  %94 = load i64, i64* %93, align 8
  %95 = trunc i64 %94 to i32
  %96 = call i8* @amrit_str_from_i32(i32 %95)
  %97 = call i8* @amrit_str_concat(i8* %91, i8* %96)
  call void @amrit_print(i8* %97)
  call void @amrit_arena_release(i64 %arena.mark)
  ret i32 0
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }

%struct.nish_array = type { i64, i64, i8* }

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #0

define internal noundef float @scale(float noundef %k) #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x float], align 8
  %0 = fptosi double 0x4000000000000000 to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 %0, i64* %1, align 8, !alias.scope !3, !noalias !4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 %0, i64* %2, align 8, !alias.scope !3, !noalias !4
  %3 = mul i64 %0, 4
  %4 = bitcast [2 x float]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %4, i8 0, i64 %3, i1 false), !alias.scope !4, !noalias !3
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %6 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %7 = fptosi double 0x0000000000000000 to i64
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4
  %10 = bitcast i8* %9 to float*
  %11 = getelementptr inbounds float, float* %10, i64 %7
  store float 0x3FE0000000000000, float* %11, align 4, !alias.scope !4, !noalias !3
  %12 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %13 = fptosi double 0x3FF0000000000000 to i64
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4
  %16 = bitcast i8* %15 to float*
  %17 = getelementptr inbounds float, float* %16, i64 %13
  store float 0x3FF4000000000000, float* %17, align 4, !alias.scope !4, !noalias !3
  %18 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %19 = fptosi double 0x0000000000000000 to i64
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4
  %22 = bitcast i8* %21 to float*
  %23 = getelementptr inbounds float, float* %22, i64 %19
  %24 = load float, float* %23, align 4, !alias.scope !4, !noalias !3
  %25 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %26 = fptosi double 0x3FF0000000000000 to i64
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !3, !noalias !4
  %29 = bitcast i8* %28 to float*
  %30 = getelementptr inbounds float, float* %29, i64 %26
  %31 = load float, float* %30, align 4, !alias.scope !4, !noalias !3
  %32 = fadd float %24, %31
  %33 = fmul float %32, %k
  ret float %33
}

define void @nish_main() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call float @scale(float 0x4010000000000000)
  %1 = fpext float %0 to double
  %2 = call i8* @nish_str_from_f64(double %1)
  call void @nish_print(i8* %2)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}

%struct.amrit_array = type { i64, i64, i8* }

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @amrit_free_arena() #1
declare noundef i64 @amrit_arena_mark() #1
declare void @amrit_arena_release(i64 noundef) #1
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @amrit_str_from_f64(double noundef) #1
declare void @amrit_panic_index(i64 noundef, i64 noundef) #2

define internal noundef float @scale(float noundef %k) #0 {
entry:
  %xs.addr = alloca %struct.amrit_array*, align 8
  %arr.hdr = alloca %struct.amrit_array, align 8
  %arr.data = alloca [2 x float], align 8
  %0 = fptosi double 0x4000000000000000 to i64
  %1 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 0
  store i64 %0, i64* %1, align 8, !alias.scope !3, !noalias !4
  %2 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 1
  store i64 %0, i64* %2, align 8, !alias.scope !3, !noalias !4
  %3 = mul i64 %0, 4
  %4 = bitcast [2 x float]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %4, i8 0, i64 %3, i1 false), !alias.scope !4, !noalias !3
  %5 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4
  store %struct.amrit_array* %arr.hdr, %struct.amrit_array** %xs.addr, align 8
  %6 = load %struct.amrit_array*, %struct.amrit_array** %xs.addr, align 8
  %7 = fptosi double 0x0000000000000000 to i64
  %8 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %6, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4
  %10 = icmp ult i64 %7, %9
  br i1 %10, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @amrit_panic_index(i64 %7, i64 %9)
  unreachable

bounds.ok:
  %11 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %6, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4
  %13 = bitcast i8* %12 to float*
  %14 = getelementptr inbounds float, float* %13, i64 %7
  store float 0x3FE0000000000000, float* %14, align 4, !alias.scope !4, !noalias !3
  %15 = load %struct.amrit_array*, %struct.amrit_array** %xs.addr, align 8
  %16 = fptosi double 0x3FF0000000000000 to i64
  %17 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %15, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4
  %19 = icmp ult i64 %16, %18
  br i1 %19, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @amrit_panic_index(i64 %16, i64 %18)
  unreachable

bounds.ok.1:
  %20 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %15, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !3, !noalias !4
  %22 = bitcast i8* %21 to float*
  %23 = getelementptr inbounds float, float* %22, i64 %16
  store float 0x3FF4000000000000, float* %23, align 4, !alias.scope !4, !noalias !3
  %24 = load %struct.amrit_array*, %struct.amrit_array** %xs.addr, align 8
  %25 = fptosi double 0x0000000000000000 to i64
  %26 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %24, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4
  %28 = icmp ult i64 %25, %27
  br i1 %28, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @amrit_panic_index(i64 %25, i64 %27)
  unreachable

bounds.ok.2:
  %29 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %24, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !3, !noalias !4
  %31 = bitcast i8* %30 to float*
  %32 = getelementptr inbounds float, float* %31, i64 %25
  %33 = load float, float* %32, align 4, !alias.scope !4, !noalias !3
  %34 = load %struct.amrit_array*, %struct.amrit_array** %xs.addr, align 8
  %35 = fptosi double 0x3FF0000000000000 to i64
  %36 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %34, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4
  %38 = icmp ult i64 %35, %37
  br i1 %38, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @amrit_panic_index(i64 %35, i64 %37)
  unreachable

bounds.ok.3:
  %39 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %34, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4
  %41 = bitcast i8* %40 to float*
  %42 = getelementptr inbounds float, float* %41, i64 %35
  %43 = load float, float* %42, align 4, !alias.scope !4, !noalias !3
  %44 = fadd float %33, %43
  %45 = fmul float %44, %k
  ret float %45
}

define void @amrit_main() #0 {
entry:
  %arena.mark = call i64 @amrit_arena_mark()
  %0 = call float @scale(float 0x4010000000000000)
  %1 = fpext float %0 to double
  %2 = call i8* @amrit_str_from_f64(double %1)
  call void @amrit_print(i8* %2)
  call void @amrit_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @amrit_main()
  call void @amrit_free_arena()
  ret i32 0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }

!0 = !{!"amritc array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}

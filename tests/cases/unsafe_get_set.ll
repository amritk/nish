%struct.nish_array = type { i64, i64, i8* }

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

define noundef i32 @getI32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %i) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %2 = load i8*, i8** %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = bitcast i8* %2 to i32*
  %4 = getelementptr inbounds i32, i32* %3, i64 %0
  %5 = load i32, i32* %4, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  ret i32 %5
}

define void @setI32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs, i32 noundef %i, i32 noundef %v) #1 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %2 = load i8*, i8** %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = bitcast i8* %2 to i32*
  %4 = getelementptr inbounds i32, i32* %3, i64 %0
  store i32 %v, i32* %4, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  ret void
}

define noundef i8 @getU8(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %i) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %2 = load i8*, i8** %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = bitcast i8* %2 to i8*
  %4 = getelementptr inbounds i8, i8* %3, i64 %0
  %5 = load i8, i8* %4, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  ret i8 %5
}

define void @setU8(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %bytes, i32 noundef %i, i8 noundef %v) #1 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %2 = load i8*, i8** %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = bitcast i8* %2 to i8*
  %4 = getelementptr inbounds i8, i8* %3, i64 %0
  store i8 %v, i8* %4, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  ret void
}

define noundef double @getF64(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %i) #0 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %2 = load i8*, i8** %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = bitcast i8* %2 to double*
  %4 = getelementptr inbounds double, double* %3, i64 %0
  %5 = load double, double* %4, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  ret double %5
}

define void @setF64(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs, i32 noundef %i, double noundef %v) #1 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %2 = load i8*, i8** %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = bitcast i8* %2 to double*
  %4 = getelementptr inbounds double, double* %3, i64 %0
  store double %v, double* %4, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  ret void
}

define noundef i32 @nish_main() #2 {
entry:
  %words.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %bytes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [4 x i8], align 8
  %halves.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [2 x double], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !17
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !18
  %2 = bitcast [3 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 10, i32* %5, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 20, i32* %6, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 30, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %words.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %10 = call i32 @getI32(%struct.nish_array* %9, i32 0)
  %11 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %12 = call i32 @getI32(%struct.nish_array* %11, i32 1)
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %10, i32 %12)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok

ovf.ok:
  call void @setI32(%struct.nish_array* %8, i32 2, i32 %14)
  %16 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %17 = call i32 @getI32(%struct.nish_array* %16, i32 2)
  %18 = call i8* @nish_str_from_i32(i32 %17)
  call void @nish_print(i8* %18)
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 4, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !17
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 4, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !18
  %21 = bitcast [4 x i8]* %arr.data.1 to i8*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %21, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = bitcast i8* %21 to i8*
  %24 = getelementptr inbounds i8, i8* %23, i64 0
  store i8 1, i8* %24, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %25 = getelementptr inbounds i8, i8* %23, i64 1
  store i8 2, i8* %25, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %26 = getelementptr inbounds i8, i8* %23, i64 2
  store i8 3, i8* %26, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %27 = getelementptr inbounds i8, i8* %23, i64 3
  store i8 4, i8* %27, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %bytes.addr, align 8
  %28 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %29 = trunc i32 255 to i8
  call void @setU8(%struct.nish_array* %28, i32 0, i8 %29)
  %30 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %31 = call i8 @getU8(%struct.nish_array* %30, i32 0)
  %32 = zext i8 %31 to i64
  %33 = call i8* @nish_str_from_u64(i64 %32)
  call void @nish_print(i8* %33)
  %34 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %35 = call i8 @getU8(%struct.nish_array* %34, i32 3)
  %36 = zext i8 %35 to i64
  %37 = call i8* @nish_str_from_u64(i64 %36)
  call void @nish_print(i8* %37)
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 2, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !17
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 2, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !18
  %40 = bitcast [2 x double]* %arr.data.2 to i8*
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %40, i8** %41, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %42 = bitcast i8* %40 to double*
  %43 = getelementptr inbounds double, double* %42, i64 0
  store double 0x3FE0000000000000, double* %43, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %44 = getelementptr inbounds double, double* %42, i64 1
  store double 0x3FF8000000000000, double* %44, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %halves.addr, align 8
  %45 = load %struct.nish_array*, %struct.nish_array** %halves.addr, align 8
  %46 = load %struct.nish_array*, %struct.nish_array** %halves.addr, align 8
  %47 = call double @getF64(%struct.nish_array* %46, i32 0)
  %48 = fmul double %47, 0x4014000000000000
  call void @setF64(%struct.nish_array* %45, i32 1, double %48)
  %49 = load %struct.nish_array*, %struct.nish_array** %halves.addr, align 8
  %50 = call double @getF64(%struct.nish_array* %49, i32 1)
  %51 = call i8* @nish_str_from_f64(double %50)
  call void @nish_print(i8* %51)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind }
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
!10 = !{!9, !8, i64 16}
!11 = !{!"element i32", !6, i64 0}
!12 = !{!11, !11, i64 0}
!13 = !{!"element i8", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"element double", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{!9, !7, i64 0}
!18 = !{!9, !7, i64 8}

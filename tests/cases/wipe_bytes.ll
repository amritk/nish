%struct.nish_array = type { i64, i64, i8* }

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_wipe(%struct.nish_array* noundef nonnull align 8 nocapture) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare i64 @llvm.smax.i64(i64, i64) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define internal noundef i32 @sum(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b) #0 {
entry:
  %s.addr = alloca i32, align 4
  %x.addr = alloca i8, align 1
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %s.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to i8*
  %7 = getelementptr inbounds i8, i8* %6, i64 %0
  %8 = load i8, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  store i8 %8, i8* %x.addr, align 1
  %9 = load i32, i32* %s.addr, align 4
  %10 = load i8, i8* %x.addr, align 1
  %11 = zext i8 %10 to i32
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 %11)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %13, i32* %s.addr, align 4
  br label %forof.inc

forof.inc:
  %15 = load i64, i64* %forof.idx, align 8
  %16 = add i64 %15, 1
  store i64 %16, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %17 = load i32, i32* %s.addr, align 4
  ret i32 %17

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @forget(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %key) #1 {
entry:
  call void @nish_wipe(%struct.nish_array* %key)
  ret void
}

define noundef i32 @nish_main() #0 {
entry:
  %key.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [6 x i8], align 8
  %scalar.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [32 x i8], align 8
  %empty.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [0 x i8], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 6, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 6, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %2 = bitcast [6 x i8]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = bitcast i8* %2 to i8*
  %5 = getelementptr inbounds i8, i8* %4, i64 0
  store i8 1, i8* %5, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %6 = getelementptr inbounds i8, i8* %4, i64 1
  store i8 2, i8* %6, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %7 = getelementptr inbounds i8, i8* %4, i64 2
  store i8 3, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %8 = getelementptr inbounds i8, i8* %4, i64 3
  store i8 250, i8* %8, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %9 = getelementptr inbounds i8, i8* %4, i64 4
  store i8 251, i8* %9, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %10 = getelementptr inbounds i8, i8* %4, i64 5
  store i8 252, i8* %10, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %key.addr, align 8
  %11 = load %struct.nish_array*, %struct.nish_array** %key.addr, align 8
  %12 = call i32 @sum(%struct.nish_array* %11)
  %13 = call i8* @nish_str_from_i32(i32 %12)
  call void @nish_print(i8* %13)
  %14 = load %struct.nish_array*, %struct.nish_array** %key.addr, align 8
  call void @forget(%struct.nish_array* %14)
  %15 = load %struct.nish_array*, %struct.nish_array** %key.addr, align 8
  %16 = call i32 @sum(%struct.nish_array* %15)
  %17 = call i8* @nish_str_from_i32(i32 %16)
  call void @nish_print(i8* %17)
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 32, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 32, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %20 = bitcast [32 x i8]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %20, i8 0, i64 32, i1 false), !alias.scope !4, !noalias !3
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %20, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %scalar.addr, align 8
  %22 = load %struct.nish_array*, %struct.nish_array** %scalar.addr, align 8
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = sub i64 %24, 0
  %26 = call i64 @llvm.smax.i64(i64 %25, i64 0)
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %29 = bitcast i8* %28 to i8*
  %30 = getelementptr inbounds i8, i8* %29, i64 0
  call void @llvm.memset.p0i8.i64(i8* %30, i8 165, i64 %26, i1 false), !alias.scope !4, !noalias !3
  %31 = load %struct.nish_array*, %struct.nish_array** %scalar.addr, align 8
  %32 = call i32 @sum(%struct.nish_array* %31)
  %33 = call i8* @nish_str_from_i32(i32 %32)
  call void @nish_print(i8* %33)
  %34 = load %struct.nish_array*, %struct.nish_array** %scalar.addr, align 8
  call void @nish_wipe(%struct.nish_array* %34)
  %35 = load %struct.nish_array*, %struct.nish_array** %scalar.addr, align 8
  %36 = call i32 @sum(%struct.nish_array* %35)
  %37 = call i8* @nish_str_from_i32(i32 %36)
  call void @nish_print(i8* %37)
  %38 = load %struct.nish_array*, %struct.nish_array** %scalar.addr, align 8
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 0
  %40 = load i64, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = trunc i64 %40 to i32
  %42 = call i8* @nish_str_from_i32(i32 %41)
  call void @nish_print(i8* %42)
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 0, i64* %43, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 0, i64* %44, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %45 = bitcast [0 x i8]* %arr.data.2 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %45, i8 0, i64 0, i1 false), !alias.scope !4, !noalias !3
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %45, i8** %46, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %empty.addr, align 8
  %47 = load %struct.nish_array*, %struct.nish_array** %empty.addr, align 8
  call void @nish_wipe(%struct.nish_array* %47)
  %48 = load %struct.nish_array*, %struct.nish_array** %empty.addr, align 8
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 0
  %50 = load i64, i64* %49, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %51 = trunc i64 %50 to i32
  %52 = call i8* @nish_str_from_i32(i32 %51)
  call void @nish_print(i8* %52)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { nounwind willreturn readnone }

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
!12 = !{!"element i8", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}

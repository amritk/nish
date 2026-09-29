%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"unreachable\00" }, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #2
declare i64 @llvm.fptosi.sat.i64.f64(double) #3

define noundef i32 @nish_main() #0 {
entry:
  %dst.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x i8], align 8
  %src.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [1 x i8], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [4 x i8]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i8*
  %5 = getelementptr inbounds i8, i8* %4, i64 0
  store i8 0, i8* %5, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i8, i8* %4, i64 1
  store i8 0, i8* %6, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i8, i8* %4, i64 2
  store i8 0, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i8, i8* %4, i64 3
  store i8 0, i8* %8, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %dst.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 1, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 1, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %11 = bitcast [1 x i8]* %arr.data.1 to i8*
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %11 to i8*
  %14 = getelementptr inbounds i8, i8* %13, i64 0
  store i8 1, i8* %14, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %src.addr, align 8
  %15 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  %17 = call i64 @llvm.fptosi.sat.i64.f64(double 0x400C000000000000)
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = add i64 %17, %19
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = icmp ule i64 %17, %20
  %24 = icmp ule i64 %20, %22
  %25 = and i1 %23, %24
  br i1 %25, label %set.ok, label %set.fail

set.fail:
  call void @nish_panic_slice(i64 %17, i64 %20, i64 %22)
  unreachable

set.ok:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %28 = bitcast i8* %27 to i8*
  %29 = getelementptr inbounds i8, i8* %28, i64 %17
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %32 = bitcast i8* %31 to i8*
  %33 = getelementptr inbounds i8, i8* %32, i64 0
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %29, i8* %33, i64 %19, i1 false), !alias.scope !4, !noalias !3
  %34 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %35 = fptosi double 0x4008000000000000 to i64
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = icmp ult i64 %35, %37
  br i1 %38, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %35, i64 %37)
  unreachable

bounds.ok:
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %40 = load i8*, i8** %39, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %41 = bitcast i8* %40 to i8*
  %42 = getelementptr inbounds i8, i8* %41, i64 %35
  %43 = load i8, i8* %42, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %44 = zext i8 %43 to i64
  %45 = call i8* @nish_str_from_u64(i64 %44)
  call void @nish_print(i8* %45)
  %46 = load %struct.nish_array*, %struct.nish_array** %dst.addr, align 8
  %47 = load %struct.nish_array*, %struct.nish_array** %src.addr, align 8
  %48 = call i64 @llvm.fptosi.sat.i64.f64(double 0x7E37E43C8800759C)
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 0
  %50 = load i64, i64* %49, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %51 = add i64 %48, %50
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %53 = load i64, i64* %52, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %54 = icmp ule i64 %48, %51
  %55 = icmp ule i64 %51, %53
  %56 = and i1 %54, %55
  br i1 %56, label %set.ok.1, label %set.fail.1

set.fail.1:
  call void @nish_panic_slice(i64 %48, i64 %51, i64 %53)
  unreachable

set.ok.1:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %59 = bitcast i8* %58 to i8*
  %60 = getelementptr inbounds i8, i8* %59, i64 %48
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %63 = bitcast i8* %62 to i8*
  %64 = getelementptr inbounds i8, i8* %63, i64 0
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %60, i8* %64, i64 %50, i1 false), !alias.scope !4, !noalias !3
  call void @nish_print(i8* bitcast ({ i64, [12 x i8] }* @.str.0 to i8*))
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
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i8", !6, i64 0}
!14 = !{!13, !13, i64 0}

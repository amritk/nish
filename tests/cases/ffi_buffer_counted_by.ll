%struct.OutLen = type { i64 }
%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"z_fill: \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"z_sum: \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [70 x i8] } { i64 69, [70 x i8] c"`z_sum`: argument 1 (n) counts more bytes than argument 2 (src) holds\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [78 x i8] } { i64 77, [78 x i8] c"`z_copy`: argument 2 (destLen) counts more bytes than argument 1 (dest) holds\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"z_copy: \00" }, align 8

declare i32 @z_fill(i8*, i32, i8 zeroext)
declare i32 @z_sum(i16 zeroext, i8*)
declare i32 @z_copy(i8*, %struct.OutLen*, i8*, i64)
declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #1
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #2

define noundef i32 @run() #0 {
entry:
  %buf.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [6 x i8], align 8
  %dest.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [8 x i8], align 8
  %destLen.addr = alloca %struct.OutLen*, align 8
  %OutLen.obj = alloca %struct.OutLen, align 8
  %source.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [3 x i8], align 8
  %status.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 6, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 6, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [6 x i8]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %2, i8 0, i64 6, i1 false), !alias.scope !4, !noalias !3
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %buf.addr, align 8
  %4 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %5 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = trunc i64 %7 to i32
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %11 = call i32 @z_fill(i8* %10, i32 %8, i8 zeroext 7)
  %12 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = icmp ult i64 0, %14
  br i1 %15, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %14)
  unreachable

bounds.ok:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %18 = bitcast i8* %17 to i8*
  %19 = getelementptr inbounds i8, i8* %18, i64 0
  %20 = load i8, i8* %19, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %21 = zext i8 %20 to i64
  %22 = call i8* @nish_str_from_u64(i64 %21)
  %23 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.0 to i8*), i8* %22)
  %24 = call i8* @nish_str_concat(i8* %23, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %25 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = icmp ult i64 5, %27
  br i1 %28, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 5, i64 %27)
  unreachable

bounds.ok.1:
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %31 = bitcast i8* %30 to i8*
  %32 = getelementptr inbounds i8, i8* %31, i64 5
  %33 = load i8, i8* %32, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %34 = zext i8 %33 to i64
  %35 = call i8* @nish_str_from_u64(i64 %34)
  %36 = call i8* @nish_str_concat(i8* %24, i8* %35)
  call void @nish_print(i8* %36)
  %37 = trunc i32 4 to i16
  %38 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %39 = zext i16 %37 to i64
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 0
  %41 = load i64, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %42 = icmp ule i64 %39, %41
  br i1 %42, label %ffi.ok, label %ffi.length

ffi.length:
  call void @nish_panic(i8* bitcast ({ i64, [70 x i8] }* @.str.3 to i8*))
  unreachable

ffi.ok:
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 2
  %44 = load i8*, i8** %43, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %45 = call i32 @z_sum(i16 zeroext %37, i8* %44)
  %46 = zext i32 %45 to i64
  %47 = call i8* @nish_str_from_u64(i64 %46)
  %48 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.2 to i8*), i8* %47)
  call void @nish_print(i8* %48)
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 8, i64* %49, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 8, i64* %50, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %51 = bitcast [8 x i8]* %arr.data.1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %51, i8 0, i64 8, i1 false), !alias.scope !4, !noalias !3
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %51, i8** %52, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %dest.addr, align 8
  %53 = bitcast %struct.OutLen* %OutLen.obj to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %53, i8 0, i64 8, i1 false)
  store %struct.OutLen* %OutLen.obj, %struct.OutLen** %destLen.addr, align 8
  %54 = load %struct.OutLen*, %struct.OutLen** %destLen.addr, align 8
  %55 = load %struct.nish_array*, %struct.nish_array** %dest.addr, align 8
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 0
  %57 = load i64, i64* %56, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %58 = trunc i64 %57 to i32
  %59 = sext i32 %58 to i64
  %60 = getelementptr inbounds %struct.OutLen, %struct.OutLen* %54, i32 0, i32 0
  store i64 %59, i64* %60, align 8
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 3, i64* %61, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 3, i64* %62, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %63 = bitcast [3 x i8]* %arr.data.2 to i8*
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %63, i8** %64, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %65 = bitcast i8* %63 to i8*
  %66 = getelementptr inbounds i8, i8* %65, i64 0
  store i8 104, i8* %66, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %67 = getelementptr inbounds i8, i8* %65, i64 1
  store i8 105, i8* %67, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %68 = getelementptr inbounds i8, i8* %65, i64 2
  store i8 33, i8* %68, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %source.addr, align 8
  %69 = load %struct.nish_array*, %struct.nish_array** %dest.addr, align 8
  %70 = load %struct.OutLen*, %struct.OutLen** %destLen.addr, align 8
  %71 = load %struct.nish_array*, %struct.nish_array** %source.addr, align 8
  %72 = load %struct.nish_array*, %struct.nish_array** %source.addr, align 8
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %75 = trunc i64 %74 to i32
  %76 = sext i32 %75 to i64
  %77 = getelementptr inbounds %struct.OutLen, %struct.OutLen* %70, i32 0, i32 0
  %78 = load i64, i64* %77, align 8
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %69, i64 0, i32 0
  %80 = load i64, i64* %79, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %81 = icmp ule i64 %78, %80
  br i1 %81, label %ffi.ok.1, label %ffi.length.1

ffi.length.1:
  call void @nish_panic(i8* bitcast ({ i64, [78 x i8] }* @.str.4 to i8*))
  unreachable

ffi.ok.1:
  %82 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %69, i64 0, i32 2
  %83 = load i8*, i8** %82, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %71, i64 0, i32 2
  %85 = load i8*, i8** %84, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %86 = call i32 @z_copy(i8* %83, %struct.OutLen* %70, i8* %85, i64 %76)
  store i32 %86, i32* %status.addr, align 4
  %87 = load i32, i32* %status.addr, align 4
  %88 = call i8* @nish_str_from_i32(i32 %87)
  %89 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.5 to i8*), i8* %88)
  %90 = call i8* @nish_str_concat(i8* %89, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %91 = load %struct.OutLen*, %struct.OutLen** %destLen.addr, align 8
  %92 = getelementptr inbounds %struct.OutLen, %struct.OutLen* %91, i32 0, i32 0
  %93 = load i64, i64* %92, align 8
  %94 = call i8* @nish_str_from_u64(i64 %93)
  %95 = call i8* @nish_str_concat(i8* %90, i8* %94)
  %96 = call i8* @nish_str_concat(i8* %95, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %97 = load %struct.nish_array*, %struct.nish_array** %dest.addr, align 8
  %98 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %97, i64 0, i32 0
  %99 = load i64, i64* %98, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %100 = icmp ult i64 0, %99
  br i1 %100, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %99)
  unreachable

bounds.ok.2:
  %101 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %97, i64 0, i32 2
  %102 = load i8*, i8** %101, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %103 = bitcast i8* %102 to i8*
  %104 = getelementptr inbounds i8, i8* %103, i64 0
  %105 = load i8, i8* %104, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %106 = zext i8 %105 to i64
  %107 = call i8* @nish_str_from_u64(i64 %106)
  %108 = call i8* @nish_str_concat(i8* %96, i8* %107)
  %109 = call i8* @nish_str_concat(i8* %108, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %110 = load %struct.nish_array*, %struct.nish_array** %dest.addr, align 8
  %111 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %110, i64 0, i32 0
  %112 = load i64, i64* %111, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %113 = icmp ult i64 2, %112
  br i1 %113, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 2, i64 %112)
  unreachable

bounds.ok.3:
  %114 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %110, i64 0, i32 2
  %115 = load i8*, i8** %114, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %116 = bitcast i8* %115 to i8*
  %117 = getelementptr inbounds i8, i8* %116, i64 2
  %118 = load i8, i8* %117, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %119 = zext i8 %118 to i64
  %120 = call i8* @nish_str_from_u64(i64 %119)
  %121 = call i8* @nish_str_concat(i8* %109, i8* %120)
  call void @nish_print(i8* %121)
  %122 = load i32, i32* %status.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %122
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!llvm.module.flags = !{!15, !16, !17, !18, !19}
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
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}

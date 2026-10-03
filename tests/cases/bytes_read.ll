%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [27 x i8] } { i64 26, [27 x i8] c"tests/cases/bytes_read.bin\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"missing\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c": \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [31 x i8] } { i64 30, [31 x i8] c"tests/cases/bytes_read.missing\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"null\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"bytes\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"tests/cases\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #2
declare noalias align 8 %struct.nish_array* @nish_read_file_bytes(i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #3 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @nish_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define noundef i32 @nish_main() #0 {
entry:
  %bytes.addr = alloca %struct.nish_array*, align 8
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %b.addr = alloca i8, align 1
  %forof.idx = alloca i64, align 8
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %gone.addr = alloca %struct.nish_array*, align 8
  %dir.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @nish_read_file_bytes(i8* bitcast ({ i64, [27 x i8] }* @.str.0 to i8*))
  store %struct.nish_array* %0, %struct.nish_array** %bytes.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %2 = icmp eq %struct.nish_array* %1, null
  br i1 %2, label %if.then, label %if.end

if.then:
  call void @nish_print(i8* bitcast ({ i64, [8 x i8] }* @.str.1 to i8*))
  ret i32 1

if.end:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %parts.addr, align 8
  %6 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %7 = load i64, i64* %forof.idx, align 8
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = icmp ult i64 %7, %9
  br i1 %10, label %forof.body, label %forof.end

forof.body:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %12 to i8*
  %14 = getelementptr inbounds i8, i8* %13, i64 %7
  %15 = load i8, i8* %14, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store i8 %15, i8* %b.addr, align 1
  %16 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %17 = load i8, i8* %b.addr, align 1
  %18 = zext i8 %17 to i64
  %19 = call i8* @nish_str_from_u64(i64 %18)
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 1
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %24 = icmp eq i64 %21, %23
  br i1 %24, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %16, i64 8)
  br label %push.store

push.store:
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %27 = bitcast i8* %26 to i8**
  %28 = getelementptr inbounds i8*, i8** %27, i64 %21
  store i8* %19, i8** %28, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %29 = add i64 %21, 1
  store i64 %29, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = sitofp i64 %29 to double
  br label %forof.inc

forof.inc:
  %31 = load i64, i64* %forof.idx, align 8
  %32 = add i64 %31, 1
  store i64 %32, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %33 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = sitofp i64 %35 to double
  %37 = call i8* @nish_str_from_f64(double %36)
  %38 = call i8* @nish_str_concat(i8* %37, i8* bitcast ({ i64, [3 x i8] }* @.str.2 to i8*))
  %39 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 0
  %41 = load i64, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %42 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*) to i64*
  %43 = load i64, i64* %42, align 8
  %44 = sub i64 %41, 1
  %45 = mul i64 %43, %44
  %46 = icmp eq i64 %41, 0
  %47 = select i1 %46, i64 0, i64 %45
  store i64 %47, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %48 = load i64, i64* %join.at, align 8
  %49 = icmp ult i64 %48, %41
  br i1 %49, label %join.sum.body, label %join.copy

join.sum.body:
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 2
  %51 = load i8*, i8** %50, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %52 = bitcast i8* %51 to i8**
  %53 = getelementptr inbounds i8*, i8** %52, i64 %48
  %54 = load i8*, i8** %53, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %55 = load i64, i64* %join.total, align 8
  %56 = bitcast i8* %54 to i64*
  %57 = load i64, i64* %56, align 8
  %58 = add i64 %55, %57
  store i64 %58, i64* %join.total, align 8
  %59 = add i64 %48, 1
  store i64 %59, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %60 = load i64, i64* %join.total, align 8
  %61 = icmp ugt i64 %60, 2147483647
  %62 = add i64 %60, 9
  %63 = select i1 %61, i64 4611686018427387904, i64 %62
  %64 = call i8* @nish_alloc_struct(i64 %63)
  %65 = bitcast i8* %64 to i64*
  store i64 %60, i64* %65, align 8
  %66 = getelementptr inbounds i8, i8* %64, i64 8
  store i8* %66, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %67 = load i64, i64* %join.at, align 8
  %68 = icmp ult i64 %67, %41
  br i1 %68, label %join.part, label %join.end

join.part:
  %69 = load i8*, i8** %join.p, align 8
  %70 = icmp eq i64 %67, 0
  %71 = select i1 %70, i64 0, i64 %43
  %72 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %69, i8* %72, i64 %71, i1 false)
  %73 = getelementptr inbounds i8, i8* %69, i64 %71
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 2
  %75 = load i8*, i8** %74, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %76 = bitcast i8* %75 to i8**
  %77 = getelementptr inbounds i8*, i8** %76, i64 %67
  %78 = load i8*, i8** %77, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %79 = bitcast i8* %78 to i64*
  %80 = load i64, i64* %79, align 8
  %81 = getelementptr inbounds i8, i8* %78, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %73, i8* %81, i64 %80, i1 false)
  %82 = getelementptr inbounds i8, i8* %73, i64 %80
  store i8* %82, i8** %join.p, align 8
  %83 = add i64 %67, 1
  store i64 %83, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %84 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %84, align 1
  %85 = call i8* @nish_str_concat(i8* %38, i8* %64)
  call void @nish_print(i8* %85)
  %86 = call %struct.nish_array* @nish_read_file_bytes(i8* bitcast ({ i64, [31 x i8] }* @.str.4 to i8*))
  store %struct.nish_array* %86, %struct.nish_array** %gone.addr, align 8
  %87 = load %struct.nish_array*, %struct.nish_array** %gone.addr, align 8
  %88 = icmp eq %struct.nish_array* %87, null
  br i1 %88, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %89 = phi i8* [ bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), %cond.true ], [ bitcast ({ i64, [6 x i8] }* @.str.6 to i8*), %cond.false ]
  call void @nish_print(i8* %89)
  %90 = call %struct.nish_array* @nish_read_file_bytes(i8* bitcast ({ i64, [12 x i8] }* @.str.7 to i8*))
  store %struct.nish_array* %90, %struct.nish_array** %dir.addr, align 8
  %91 = load %struct.nish_array*, %struct.nish_array** %dir.addr, align 8
  %92 = icmp eq %struct.nish_array* %91, null
  br i1 %92, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %93 = phi i8* [ bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), %cond.true.1 ], [ bitcast ({ i64, [6 x i8] }* @.str.6 to i8*), %cond.false.1 ]
  call void @nish_print(i8* %93)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) }

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
!15 = !{!"element ptr", !6, i64 0}
!16 = !{!15, !15, i64 0}

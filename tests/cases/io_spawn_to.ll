%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"build\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"build/io_spawn_to\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"/out.txt\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"/err.txt\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"sh\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"-c\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [43 x i8] } { i64 42, [43 x i8] c"echo to-stdout; echo to-stderr >&2; exit 3\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"nothing captured\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c": \00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c" / \00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"echo second\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [23 x i8] } { i64 22, [23 x i8] c"nothing captured twice\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"again: \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef align 8 i8* @nish_read_file_or_null(i8* noundef nonnull readonly align 8 nocapture) #2
declare zeroext i1 @nish_mkdir(i8* noundef nonnull readonly align 8 nocapture) #2
declare noundef i32 @nish_spawn_to(%struct.nish_array* noundef nonnull align 8, i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare i64 @llvm.smin.i64(i64, i64) #3
declare i64 @llvm.smax.i64(i64, i64) #3

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
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
  %dir.addr = alloca i8*, align 8
  %out.addr = alloca i8*, align 8
  %err.addr = alloca i8*, align 8
  %status.addr = alloca i32, align 4
  %captured.addr = alloca i8*, align 8
  %diagnostic.addr = alloca i8*, align 8
  %again.addr = alloca i8*, align 8
  %0 = call zeroext i1 @nish_mkdir(i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*))
  store i8* bitcast ({ i64, [18 x i8] }* @.str.1 to i8*), i8** %dir.addr, align 8
  %1 = load i8*, i8** %dir.addr, align 8
  %2 = call zeroext i1 @nish_mkdir(i8* %1)
  %3 = load i8*, i8** %dir.addr, align 8
  %4 = call i8* @nish_str_concat(i8* %3, i8* bitcast ({ i64, [9 x i8] }* @.str.2 to i8*))
  store i8* %4, i8** %out.addr, align 8
  %5 = load i8*, i8** %dir.addr, align 8
  %6 = call i8* @nish_str_concat(i8* %5, i8* bitcast ({ i64, [9 x i8] }* @.str.3 to i8*))
  store i8* %6, i8** %err.addr, align 8
  %7 = call i8* @nish_alloc_struct(i64 24)
  %8 = bitcast i8* %7 to %struct.nish_array*
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  store i64 3, i64* %9, align 8, !alias.scope !3, !noalias !4
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 1
  store i64 3, i64* %10, align 8, !alias.scope !3, !noalias !4
  %11 = call i8* @nish_alloc_struct(i64 24)
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  store i8* %11, i8** %12, align 8, !alias.scope !3, !noalias !4
  %13 = bitcast i8* %11 to i8**
  %14 = getelementptr inbounds i8*, i8** %13, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.4 to i8*), i8** %14, align 8, !alias.scope !4, !noalias !3, !tbaa !8
  %15 = getelementptr inbounds i8*, i8** %13, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.5 to i8*), i8** %15, align 8, !alias.scope !4, !noalias !3, !tbaa !8
  %16 = getelementptr inbounds i8*, i8** %13, i64 2
  store i8* bitcast ({ i64, [43 x i8] }* @.str.6 to i8*), i8** %16, align 8, !alias.scope !4, !noalias !3, !tbaa !8
  %17 = load i8*, i8** %out.addr, align 8
  %18 = load i8*, i8** %err.addr, align 8
  %19 = call i32 @nish_spawn_to(%struct.nish_array* %8, i8* %17, i8* %18)
  store i32 %19, i32* %status.addr, align 4
  %20 = load i8*, i8** %out.addr, align 8
  %21 = call i8* @nish_read_file_or_null(i8* %20)
  store i8* %21, i8** %captured.addr, align 8
  %22 = load i8*, i8** %err.addr, align 8
  %23 = call i8* @nish_read_file_or_null(i8* %22)
  store i8* %23, i8** %diagnostic.addr, align 8
  %24 = load i8*, i8** %captured.addr, align 8
  %25 = icmp eq i8* %24, null
  br i1 %25, label %lor.end, label %lor.rhs

lor.rhs:
  %26 = load i8*, i8** %diagnostic.addr, align 8
  %27 = icmp eq i8* %26, null
  br label %lor.end

lor.end:
  %28 = phi i1 [ true, %entry ], [ %27, %lor.rhs ]
  br i1 %28, label %if.then, label %if.end

if.then:
  call void @nish_print(i8* bitcast ({ i64, [17 x i8] }* @.str.7 to i8*))
  ret i32 1

if.end:
  %29 = load i32, i32* %status.addr, align 4
  %30 = call i8* @nish_str_from_i32(i32 %29)
  %31 = call i8* @nish_str_concat(i8* %30, i8* bitcast ({ i64, [3 x i8] }* @.str.8 to i8*))
  %32 = load i8*, i8** %captured.addr, align 8
  %33 = bitcast i8* %32 to i64*
  %34 = load i64, i64* %33, align 8
  %35 = load i8*, i8** %captured.addr, align 8
  %36 = bitcast i8* %35 to i64*
  %37 = load i64, i64* %36, align 8
  %38 = trunc i64 %37 to i32
  %39 = sub nsw i32 %38, 1
  %40 = sext i32 %39 to i64
  %41 = call i64 @llvm.smin.i64(i64 %40, i64 %34)
  %42 = call i64 @llvm.smax.i64(i64 %41, i64 0)
  %43 = call i64 @llvm.smin.i64(i64 0, i64 %42)
  %44 = call i64 @llvm.smax.i64(i64 0, i64 %42)
  %45 = sub i64 %44, %43
  %46 = getelementptr inbounds i8, i8* %32, i64 8
  %47 = getelementptr inbounds i8, i8* %46, i64 %43
  %48 = call i8* @nish_str_new(i8* %47, i64 %45)
  %49 = call i8* @nish_str_concat(i8* %31, i8* %48)
  %50 = call i8* @nish_str_concat(i8* %49, i8* bitcast ({ i64, [4 x i8] }* @.str.9 to i8*))
  %51 = load i8*, i8** %diagnostic.addr, align 8
  %52 = bitcast i8* %51 to i64*
  %53 = load i64, i64* %52, align 8
  %54 = load i8*, i8** %diagnostic.addr, align 8
  %55 = bitcast i8* %54 to i64*
  %56 = load i64, i64* %55, align 8
  %57 = trunc i64 %56 to i32
  %58 = sub nsw i32 %57, 1
  %59 = sext i32 %58 to i64
  %60 = call i64 @llvm.smin.i64(i64 %59, i64 %53)
  %61 = call i64 @llvm.smax.i64(i64 %60, i64 0)
  %62 = call i64 @llvm.smin.i64(i64 0, i64 %61)
  %63 = call i64 @llvm.smax.i64(i64 0, i64 %61)
  %64 = sub i64 %63, %62
  %65 = getelementptr inbounds i8, i8* %51, i64 8
  %66 = getelementptr inbounds i8, i8* %65, i64 %62
  %67 = call i8* @nish_str_new(i8* %66, i64 %64)
  %68 = call i8* @nish_str_concat(i8* %50, i8* %67)
  call void @nish_print(i8* %68)
  %69 = call i8* @nish_alloc_struct(i64 24)
  %70 = bitcast i8* %69 to %struct.nish_array*
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 0
  store i64 3, i64* %71, align 8, !alias.scope !3, !noalias !4
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 1
  store i64 3, i64* %72, align 8, !alias.scope !3, !noalias !4
  %73 = call i8* @nish_alloc_struct(i64 24)
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 2
  store i8* %73, i8** %74, align 8, !alias.scope !3, !noalias !4
  %75 = bitcast i8* %73 to i8**
  %76 = getelementptr inbounds i8*, i8** %75, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.4 to i8*), i8** %76, align 8, !alias.scope !4, !noalias !3, !tbaa !8
  %77 = getelementptr inbounds i8*, i8** %75, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.5 to i8*), i8** %77, align 8, !alias.scope !4, !noalias !3, !tbaa !8
  %78 = getelementptr inbounds i8*, i8** %75, i64 2
  store i8* bitcast ({ i64, [12 x i8] }* @.str.10 to i8*), i8** %78, align 8, !alias.scope !4, !noalias !3, !tbaa !8
  %79 = load i8*, i8** %out.addr, align 8
  %80 = load i8*, i8** %err.addr, align 8
  %81 = call i32 @nish_spawn_to(%struct.nish_array* %70, i8* %79, i8* %80)
  %82 = load i8*, i8** %out.addr, align 8
  %83 = call i8* @nish_read_file_or_null(i8* %82)
  store i8* %83, i8** %again.addr, align 8
  %84 = load i8*, i8** %again.addr, align 8
  %85 = icmp eq i8* %84, null
  br i1 %85, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_print(i8* bitcast ({ i64, [23 x i8] }* @.str.11 to i8*))
  ret i32 1

if.end.1:
  %86 = load i8*, i8** %again.addr, align 8
  %87 = bitcast i8* %86 to i64*
  %88 = load i64, i64* %87, align 8
  %89 = load i8*, i8** %again.addr, align 8
  %90 = bitcast i8* %89 to i64*
  %91 = load i64, i64* %90, align 8
  %92 = trunc i64 %91 to i32
  %93 = sub nsw i32 %92, 1
  %94 = sext i32 %93 to i64
  %95 = call i64 @llvm.smin.i64(i64 %94, i64 %88)
  %96 = call i64 @llvm.smax.i64(i64 %95, i64 0)
  %97 = call i64 @llvm.smin.i64(i64 0, i64 %96)
  %98 = call i64 @llvm.smax.i64(i64 0, i64 %96)
  %99 = sub i64 %98, %97
  %100 = getelementptr inbounds i8, i8* %86, i64 8
  %101 = getelementptr inbounds i8, i8* %100, i64 %97
  %102 = call i8* @nish_str_new(i8* %101, i64 %99)
  %103 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.12 to i8*), i8* %102)
  call void @nish_print(i8* %103)
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
attributes #3 = { nounwind willreturn readnone }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"element ptr", !6, i64 0}
!8 = !{!7, !7, i64 0}

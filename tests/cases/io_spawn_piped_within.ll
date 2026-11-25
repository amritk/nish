%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"sh\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"-c\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [16 x i8] } { i64 15, [16 x i8] c"exec sleep 1000\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"sleep: \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [44 x i8] } { i64 43, [44 x i8] c"printf out; printf err >&2; exec sleep 1000\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"partial: \00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"exit 0: \00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"printf done\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"exit 3: \00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [20 x i8] } { i64 19, [20 x i8] c"printf more; exit 3\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"output: \00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"flood: \00" }, align 8
@.str.15 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"yes\00" }, align 8
@.str.16 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"stdin unread: \00" }, align 8
@.str.17 = private unnamed_addr constant { i64, [16 x i8] } { i64 15, [16 x i8] c"stdin ignored: \00" }, align 8
@.str.18 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"exit 5\00" }, align 8
@.str.19 = private unnamed_addr constant { i64, [31 x i8] } { i64 30, [31 x i8] c"exec >&- 2>&-; exec sleep 1000\00" }, align 8
@.str.20 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"closed streams: \00" }, align 8
@.str.21 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"zero: \00" }, align 8
@.str.22 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"grandchild: \00" }, align 8
@.str.23 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"sleep 5 & exit 0\00" }, align 8
@.str.24 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"no deadline: \00" }, align 8
@.str.25 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"printf plain; exit 4\00" }, align 8
@.str.26 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"missing: \00" }, align 8
@.str.27 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"nish-no-such-program\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noundef i32 @nish_spawn_piped_within(%struct.nish_array* noundef nonnull align 8, %struct.nish_array* noundef nonnull align 8 nocapture readonly, %struct.nish_array* noundef nonnull align 8 nocapture, %struct.nish_array* noundef nonnull align 8 nocapture, i32 noundef) #0
declare i64 @nish_monotonic_nanos() #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i64, i1 } @llvm.ssub.with.overflow.i64(i64, i64) #4

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #5 {
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

define internal noundef zeroext i1 @prompt(i64 noundef %start) #0 {
entry:
  %0 = call i64 @nish_monotonic_nanos()
  %1 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %0, i64 %start)
  %2 = extractvalue { i64, i1 } %1, 0
  %3 = extractvalue { i64, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  %4 = icmp slt i64 %2, 20000000000
  ret i1 %4

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %none.addr = alloca %struct.nish_array*, align 8
  %out.addr = alloca %struct.nish_array*, align 8
  %err.addr = alloca %struct.nish_array*, align 8
  %start.addr = alloca i64, align 8
  %slept.addr = alloca i32, align 4
  %partial.addr = alloca i32, align 4
  %done.addr = alloca %struct.nish_array*, align 8
  %quiet.addr = alloca %struct.nish_array*, align 8
  %flood.addr = alloca %struct.nish_array*, align 8
  %big.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %unread.addr = alloca i32, align 4
  %closed.addr = alloca i32, align 4
  %plain.addr = alloca %struct.nish_array*, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %none.addr, align 8
  %5 = call i8* @nish_alloc_struct(i64 24)
  %6 = bitcast i8* %5 to %struct.nish_array*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 0, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 0, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* null, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %6, %struct.nish_array** %out.addr, align 8
  %10 = call i8* @nish_alloc_struct(i64 24)
  %11 = bitcast i8* %10 to %struct.nish_array*
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  store i64 0, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 1
  store i64 0, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  store i8* null, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %11, %struct.nish_array** %err.addr, align 8
  %15 = call i64 @nish_monotonic_nanos()
  store i64 %15, i64* %start.addr, align 8
  %16 = call i8* @nish_alloc_struct(i64 24)
  %17 = bitcast i8* %16 to %struct.nish_array*
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  store i64 3, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 1
  store i64 3, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  store i8* %20, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %22 = bitcast i8* %20 to i8**
  %23 = getelementptr inbounds i8*, i8** %22, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8** %23, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %24 = getelementptr inbounds i8*, i8** %22, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i8** %24, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %25 = getelementptr inbounds i8*, i8** %22, i64 2
  store i8* bitcast ({ i64, [16 x i8] }* @.str.2 to i8*), i8** %25, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %26 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %27 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %28 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %29 = call i32 @nish_spawn_piped_within(%struct.nish_array* %17, %struct.nish_array* %26, %struct.nish_array* %27, %struct.nish_array* %28, i32 200)
  store i32 %29, i32* %slept.addr, align 4
  %30 = load i32, i32* %slept.addr, align 4
  %31 = call i8* @nish_str_from_i32(i32 %30)
  %32 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.3 to i8*), i8* %31)
  %33 = call i8* @nish_str_concat(i8* %32, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %34 = load i64, i64* %start.addr, align 8
  %35 = call i1 @prompt(i64 %34)
  %36 = select i1 %35, i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*)
  %37 = call i8* @nish_str_concat(i8* %33, i8* %36)
  call void @nish_print(i8* %37)
  %38 = call i64 @nish_monotonic_nanos()
  store i64 %38, i64* %start.addr, align 8
  %39 = call i8* @nish_alloc_struct(i64 24)
  %40 = bitcast i8* %39 to %struct.nish_array*
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 0
  store i64 3, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 1
  store i64 3, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %43 = call i8* @nish_alloc_struct(i64 24)
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 2
  store i8* %43, i8** %44, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %45 = bitcast i8* %43 to i8**
  %46 = getelementptr inbounds i8*, i8** %45, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8** %46, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %47 = getelementptr inbounds i8*, i8** %45, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i8** %47, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %48 = getelementptr inbounds i8*, i8** %45, i64 2
  store i8* bitcast ({ i64, [44 x i8] }* @.str.7 to i8*), i8** %48, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %49 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %50 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %51 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %52 = call i32 @nish_spawn_piped_within(%struct.nish_array* %40, %struct.nish_array* %49, %struct.nish_array* %50, %struct.nish_array* %51, i32 2000)
  store i32 %52, i32* %partial.addr, align 4
  %53 = load i32, i32* %partial.addr, align 4
  %54 = call i8* @nish_str_from_i32(i32 %53)
  %55 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.8 to i8*), i8* %54)
  %56 = call i8* @nish_str_concat(i8* %55, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %57 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %58 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %58, i64 0, i32 0
  %60 = load i64, i64* %59, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %61 = trunc i64 %60 to i32
  %62 = sext i32 %61 to i64
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %57, i64 0, i32 2
  %64 = load i8*, i8** %63, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %65 = getelementptr inbounds i8, i8* %64, i64 0
  %66 = sub i64 %62, 0
  %67 = call i8* @nish_str_new(i8* %65, i64 %66)
  %68 = call i8* @nish_str_concat(i8* %56, i8* %67)
  %69 = call i8* @nish_str_concat(i8* %68, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %70 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %71 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %71, i64 0, i32 0
  %73 = load i64, i64* %72, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %74 = trunc i64 %73 to i32
  %75 = sext i32 %74 to i64
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 2
  %77 = load i8*, i8** %76, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %78 = getelementptr inbounds i8, i8* %77, i64 0
  %79 = sub i64 %75, 0
  %80 = call i8* @nish_str_new(i8* %78, i64 %79)
  %81 = call i8* @nish_str_concat(i8* %69, i8* %80)
  %82 = call i8* @nish_str_concat(i8* %81, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %83 = load i64, i64* %start.addr, align 8
  %84 = call i1 @prompt(i64 %83)
  %85 = select i1 %84, i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*)
  %86 = call i8* @nish_str_concat(i8* %82, i8* %85)
  call void @nish_print(i8* %86)
  %87 = call i8* @nish_alloc_struct(i64 24)
  %88 = bitcast i8* %87 to %struct.nish_array*
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %88, i64 0, i32 0
  store i64 0, i64* %89, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %88, i64 0, i32 1
  store i64 0, i64* %90, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %91 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %88, i64 0, i32 2
  store i8* null, i8** %91, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %88, %struct.nish_array** %done.addr, align 8
  %92 = call i8* @nish_alloc_struct(i64 24)
  %93 = bitcast i8* %92 to %struct.nish_array*
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 0
  store i64 0, i64* %94, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %95 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 1
  store i64 0, i64* %95, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %93, i64 0, i32 2
  store i8* null, i8** %96, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %93, %struct.nish_array** %quiet.addr, align 8
  %97 = call i8* @nish_alloc_struct(i64 24)
  %98 = bitcast i8* %97 to %struct.nish_array*
  %99 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %98, i64 0, i32 0
  store i64 3, i64* %99, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %100 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %98, i64 0, i32 1
  store i64 3, i64* %100, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %101 = call i8* @nish_alloc_struct(i64 24)
  %102 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %98, i64 0, i32 2
  store i8* %101, i8** %102, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %103 = bitcast i8* %101 to i8**
  %104 = getelementptr inbounds i8*, i8** %103, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8** %104, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %105 = getelementptr inbounds i8*, i8** %103, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i8** %105, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %106 = getelementptr inbounds i8*, i8** %103, i64 2
  store i8* bitcast ({ i64, [12 x i8] }* @.str.10 to i8*), i8** %106, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %107 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %108 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %109 = load %struct.nish_array*, %struct.nish_array** %quiet.addr, align 8
  %110 = call i32 @nish_spawn_piped_within(%struct.nish_array* %98, %struct.nish_array* %107, %struct.nish_array* %108, %struct.nish_array* %109, i32 20000)
  %111 = call i8* @nish_str_from_i32(i32 %110)
  %112 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.9 to i8*), i8* %111)
  call void @nish_print(i8* %112)
  %113 = call i8* @nish_alloc_struct(i64 24)
  %114 = bitcast i8* %113 to %struct.nish_array*
  %115 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %114, i64 0, i32 0
  store i64 3, i64* %115, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %116 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %114, i64 0, i32 1
  store i64 3, i64* %116, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %117 = call i8* @nish_alloc_struct(i64 24)
  %118 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %114, i64 0, i32 2
  store i8* %117, i8** %118, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %119 = bitcast i8* %117 to i8**
  %120 = getelementptr inbounds i8*, i8** %119, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8** %120, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %121 = getelementptr inbounds i8*, i8** %119, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i8** %121, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %122 = getelementptr inbounds i8*, i8** %119, i64 2
  store i8* bitcast ({ i64, [20 x i8] }* @.str.12 to i8*), i8** %122, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %123 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %124 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %125 = load %struct.nish_array*, %struct.nish_array** %quiet.addr, align 8
  %126 = call i32 @nish_spawn_piped_within(%struct.nish_array* %114, %struct.nish_array* %123, %struct.nish_array* %124, %struct.nish_array* %125, i32 20000)
  %127 = call i8* @nish_str_from_i32(i32 %126)
  %128 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.11 to i8*), i8* %127)
  call void @nish_print(i8* %128)
  %129 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %130 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %131 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %130, i64 0, i32 0
  %132 = load i64, i64* %131, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %133 = trunc i64 %132 to i32
  %134 = sext i32 %133 to i64
  %135 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %129, i64 0, i32 2
  %136 = load i8*, i8** %135, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %137 = getelementptr inbounds i8, i8* %136, i64 0
  %138 = sub i64 %134, 0
  %139 = call i8* @nish_str_new(i8* %137, i64 %138)
  %140 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.13 to i8*), i8* %139)
  %141 = call i8* @nish_str_concat(i8* %140, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %142 = load %struct.nish_array*, %struct.nish_array** %quiet.addr, align 8
  %143 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %142, i64 0, i32 0
  %144 = load i64, i64* %143, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %145 = trunc i64 %144 to i32
  %146 = call i8* @nish_str_from_i32(i32 %145)
  %147 = call i8* @nish_str_concat(i8* %141, i8* %146)
  call void @nish_print(i8* %147)
  %148 = call i8* @nish_alloc_struct(i64 24)
  %149 = bitcast i8* %148 to %struct.nish_array*
  %150 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %149, i64 0, i32 0
  store i64 0, i64* %150, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %151 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %149, i64 0, i32 1
  store i64 0, i64* %151, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %152 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %149, i64 0, i32 2
  store i8* null, i8** %152, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %149, %struct.nish_array** %flood.addr, align 8
  %153 = call i8* @nish_alloc_struct(i64 24)
  %154 = bitcast i8* %153 to %struct.nish_array*
  %155 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %154, i64 0, i32 0
  store i64 1, i64* %155, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %156 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %154, i64 0, i32 1
  store i64 1, i64* %156, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %157 = call i8* @nish_alloc_struct(i64 8)
  %158 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %154, i64 0, i32 2
  store i8* %157, i8** %158, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %159 = bitcast i8* %157 to i8**
  %160 = getelementptr inbounds i8*, i8** %159, i64 0
  store i8* bitcast ({ i64, [4 x i8] }* @.str.15 to i8*), i8** %160, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %161 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %162 = load %struct.nish_array*, %struct.nish_array** %flood.addr, align 8
  %163 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %164 = call i32 @nish_spawn_piped_within(%struct.nish_array* %154, %struct.nish_array* %161, %struct.nish_array* %162, %struct.nish_array* %163, i32 20000)
  %165 = call i8* @nish_str_from_i32(i32 %164)
  %166 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.14 to i8*), i8* %165)
  %167 = call i8* @nish_str_concat(i8* %166, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %168 = load %struct.nish_array*, %struct.nish_array** %flood.addr, align 8
  %169 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %168, i64 0, i32 0
  %170 = load i64, i64* %169, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %171 = trunc i64 %170 to i32
  %172 = call i8* @nish_str_from_i32(i32 %171)
  %173 = call i8* @nish_str_concat(i8* %167, i8* %172)
  call void @nish_print(i8* %173)
  %174 = call i8* @nish_alloc_struct(i64 24)
  %175 = bitcast i8* %174 to %struct.nish_array*
  %176 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %175, i64 0, i32 0
  store i64 0, i64* %176, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %177 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %175, i64 0, i32 1
  store i64 0, i64* %177, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %178 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %175, i64 0, i32 2
  store i8* null, i8** %178, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %175, %struct.nish_array** %big.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %179 = load i32, i32* %i.addr, align 4
  %180 = mul nsw i32 256, 1024
  %181 = icmp slt i32 %179, %180
  br i1 %181, label %for.body, label %for.end

for.body:
  %182 = load %struct.nish_array*, %struct.nish_array** %big.addr, align 8
  %183 = load i32, i32* %i.addr, align 4
  %184 = trunc i32 %183 to i8
  %185 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %182, i64 0, i32 0
  %186 = load i64, i64* %185, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %187 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %182, i64 0, i32 1
  %188 = load i64, i64* %187, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %189 = icmp eq i64 %186, %188
  br i1 %189, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %182, i64 1)
  br label %push.store

push.store:
  %190 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %182, i64 0, i32 2
  %191 = load i8*, i8** %190, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %192 = bitcast i8* %191 to i8*
  %193 = getelementptr inbounds i8, i8* %192, i64 %186
  store i8 %184, i8* %193, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %194 = add i64 %186, 1
  store i64 %194, i64* %185, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %195 = trunc i64 %194 to i32
  br label %for.inc

for.inc:
  %196 = load i32, i32* %i.addr, align 4
  %197 = add nsw i32 %196, 1
  store i32 %197, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %198 = call i64 @nish_monotonic_nanos()
  store i64 %198, i64* %start.addr, align 8
  %199 = call i8* @nish_alloc_struct(i64 24)
  %200 = bitcast i8* %199 to %struct.nish_array*
  %201 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %200, i64 0, i32 0
  store i64 3, i64* %201, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %202 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %200, i64 0, i32 1
  store i64 3, i64* %202, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %203 = call i8* @nish_alloc_struct(i64 24)
  %204 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %200, i64 0, i32 2
  store i8* %203, i8** %204, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %205 = bitcast i8* %203 to i8**
  %206 = getelementptr inbounds i8*, i8** %205, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8** %206, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %207 = getelementptr inbounds i8*, i8** %205, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i8** %207, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %208 = getelementptr inbounds i8*, i8** %205, i64 2
  store i8* bitcast ({ i64, [16 x i8] }* @.str.2 to i8*), i8** %208, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %209 = load %struct.nish_array*, %struct.nish_array** %big.addr, align 8
  %210 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %211 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %212 = call i32 @nish_spawn_piped_within(%struct.nish_array* %200, %struct.nish_array* %209, %struct.nish_array* %210, %struct.nish_array* %211, i32 200)
  store i32 %212, i32* %unread.addr, align 4
  %213 = load i32, i32* %unread.addr, align 4
  %214 = call i8* @nish_str_from_i32(i32 %213)
  %215 = call i8* @nish_str_concat(i8* bitcast ({ i64, [15 x i8] }* @.str.16 to i8*), i8* %214)
  %216 = call i8* @nish_str_concat(i8* %215, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %217 = load i64, i64* %start.addr, align 8
  %218 = call i1 @prompt(i64 %217)
  %219 = select i1 %218, i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*)
  %220 = call i8* @nish_str_concat(i8* %216, i8* %219)
  call void @nish_print(i8* %220)
  %221 = call i8* @nish_alloc_struct(i64 24)
  %222 = bitcast i8* %221 to %struct.nish_array*
  %223 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %222, i64 0, i32 0
  store i64 3, i64* %223, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %224 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %222, i64 0, i32 1
  store i64 3, i64* %224, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %225 = call i8* @nish_alloc_struct(i64 24)
  %226 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %222, i64 0, i32 2
  store i8* %225, i8** %226, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %227 = bitcast i8* %225 to i8**
  %228 = getelementptr inbounds i8*, i8** %227, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8** %228, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %229 = getelementptr inbounds i8*, i8** %227, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i8** %229, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %230 = getelementptr inbounds i8*, i8** %227, i64 2
  store i8* bitcast ({ i64, [7 x i8] }* @.str.18 to i8*), i8** %230, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %231 = load %struct.nish_array*, %struct.nish_array** %big.addr, align 8
  %232 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %233 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %234 = call i32 @nish_spawn_piped_within(%struct.nish_array* %222, %struct.nish_array* %231, %struct.nish_array* %232, %struct.nish_array* %233, i32 20000)
  %235 = call i8* @nish_str_from_i32(i32 %234)
  %236 = call i8* @nish_str_concat(i8* bitcast ({ i64, [16 x i8] }* @.str.17 to i8*), i8* %235)
  call void @nish_print(i8* %236)
  %237 = call i64 @nish_monotonic_nanos()
  store i64 %237, i64* %start.addr, align 8
  %238 = call i8* @nish_alloc_struct(i64 24)
  %239 = bitcast i8* %238 to %struct.nish_array*
  %240 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %239, i64 0, i32 0
  store i64 3, i64* %240, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %241 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %239, i64 0, i32 1
  store i64 3, i64* %241, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %242 = call i8* @nish_alloc_struct(i64 24)
  %243 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %239, i64 0, i32 2
  store i8* %242, i8** %243, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %244 = bitcast i8* %242 to i8**
  %245 = getelementptr inbounds i8*, i8** %244, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8** %245, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %246 = getelementptr inbounds i8*, i8** %244, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i8** %246, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %247 = getelementptr inbounds i8*, i8** %244, i64 2
  store i8* bitcast ({ i64, [31 x i8] }* @.str.19 to i8*), i8** %247, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %248 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %249 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %250 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %251 = call i32 @nish_spawn_piped_within(%struct.nish_array* %239, %struct.nish_array* %248, %struct.nish_array* %249, %struct.nish_array* %250, i32 200)
  store i32 %251, i32* %closed.addr, align 4
  %252 = load i32, i32* %closed.addr, align 4
  %253 = call i8* @nish_str_from_i32(i32 %252)
  %254 = call i8* @nish_str_concat(i8* bitcast ({ i64, [17 x i8] }* @.str.20 to i8*), i8* %253)
  %255 = call i8* @nish_str_concat(i8* %254, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %256 = load i64, i64* %start.addr, align 8
  %257 = call i1 @prompt(i64 %256)
  %258 = select i1 %257, i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*)
  %259 = call i8* @nish_str_concat(i8* %255, i8* %258)
  call void @nish_print(i8* %259)
  %260 = call i8* @nish_alloc_struct(i64 24)
  %261 = bitcast i8* %260 to %struct.nish_array*
  %262 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %261, i64 0, i32 0
  store i64 3, i64* %262, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %263 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %261, i64 0, i32 1
  store i64 3, i64* %263, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %264 = call i8* @nish_alloc_struct(i64 24)
  %265 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %261, i64 0, i32 2
  store i8* %264, i8** %265, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %266 = bitcast i8* %264 to i8**
  %267 = getelementptr inbounds i8*, i8** %266, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8** %267, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %268 = getelementptr inbounds i8*, i8** %266, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i8** %268, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %269 = getelementptr inbounds i8*, i8** %266, i64 2
  store i8* bitcast ({ i64, [16 x i8] }* @.str.2 to i8*), i8** %269, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %270 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %271 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %272 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %273 = call i32 @nish_spawn_piped_within(%struct.nish_array* %261, %struct.nish_array* %270, %struct.nish_array* %271, %struct.nish_array* %272, i32 0)
  %274 = call i8* @nish_str_from_i32(i32 %273)
  %275 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.21 to i8*), i8* %274)
  call void @nish_print(i8* %275)
  %276 = call i8* @nish_alloc_struct(i64 24)
  %277 = bitcast i8* %276 to %struct.nish_array*
  %278 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %277, i64 0, i32 0
  store i64 3, i64* %278, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %279 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %277, i64 0, i32 1
  store i64 3, i64* %279, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %280 = call i8* @nish_alloc_struct(i64 24)
  %281 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %277, i64 0, i32 2
  store i8* %280, i8** %281, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %282 = bitcast i8* %280 to i8**
  %283 = getelementptr inbounds i8*, i8** %282, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8** %283, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %284 = getelementptr inbounds i8*, i8** %282, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i8** %284, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %285 = getelementptr inbounds i8*, i8** %282, i64 2
  store i8* bitcast ({ i64, [17 x i8] }* @.str.23 to i8*), i8** %285, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %286 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %287 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %288 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %289 = call i32 @nish_spawn_piped_within(%struct.nish_array* %277, %struct.nish_array* %286, %struct.nish_array* %287, %struct.nish_array* %288, i32 200)
  %290 = call i8* @nish_str_from_i32(i32 %289)
  %291 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.22 to i8*), i8* %290)
  call void @nish_print(i8* %291)
  %292 = call i8* @nish_alloc_struct(i64 24)
  %293 = bitcast i8* %292 to %struct.nish_array*
  %294 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %293, i64 0, i32 0
  store i64 0, i64* %294, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %295 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %293, i64 0, i32 1
  store i64 0, i64* %295, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %296 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %293, i64 0, i32 2
  store i8* null, i8** %296, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %293, %struct.nish_array** %plain.addr, align 8
  %297 = call i8* @nish_alloc_struct(i64 24)
  %298 = bitcast i8* %297 to %struct.nish_array*
  %299 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %298, i64 0, i32 0
  store i64 3, i64* %299, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %300 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %298, i64 0, i32 1
  store i64 3, i64* %300, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %301 = call i8* @nish_alloc_struct(i64 24)
  %302 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %298, i64 0, i32 2
  store i8* %301, i8** %302, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %303 = bitcast i8* %301 to i8**
  %304 = getelementptr inbounds i8*, i8** %303, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8** %304, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %305 = getelementptr inbounds i8*, i8** %303, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i8** %305, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %306 = getelementptr inbounds i8*, i8** %303, i64 2
  store i8* bitcast ({ i64, [21 x i8] }* @.str.25 to i8*), i8** %306, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %307 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %308 = load %struct.nish_array*, %struct.nish_array** %plain.addr, align 8
  %309 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %310 = call i32 @nish_spawn_piped_within(%struct.nish_array* %298, %struct.nish_array* %307, %struct.nish_array* %308, %struct.nish_array* %309, i32 -1)
  %311 = call i8* @nish_str_from_i32(i32 %310)
  %312 = call i8* @nish_str_concat(i8* bitcast ({ i64, [14 x i8] }* @.str.24 to i8*), i8* %311)
  %313 = call i8* @nish_str_concat(i8* %312, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %314 = load %struct.nish_array*, %struct.nish_array** %plain.addr, align 8
  %315 = load %struct.nish_array*, %struct.nish_array** %plain.addr, align 8
  %316 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %315, i64 0, i32 0
  %317 = load i64, i64* %316, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %318 = trunc i64 %317 to i32
  %319 = sext i32 %318 to i64
  %320 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %314, i64 0, i32 2
  %321 = load i8*, i8** %320, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %322 = getelementptr inbounds i8, i8* %321, i64 0
  %323 = sub i64 %319, 0
  %324 = call i8* @nish_str_new(i8* %322, i64 %323)
  %325 = call i8* @nish_str_concat(i8* %313, i8* %324)
  call void @nish_print(i8* %325)
  %326 = call i8* @nish_alloc_struct(i64 24)
  %327 = bitcast i8* %326 to %struct.nish_array*
  %328 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %327, i64 0, i32 0
  store i64 1, i64* %328, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %329 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %327, i64 0, i32 1
  store i64 1, i64* %329, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %330 = call i8* @nish_alloc_struct(i64 8)
  %331 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %327, i64 0, i32 2
  store i8* %330, i8** %331, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %332 = bitcast i8* %330 to i8**
  %333 = getelementptr inbounds i8*, i8** %332, i64 0
  store i8* bitcast ({ i64, [21 x i8] }* @.str.27 to i8*), i8** %333, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %334 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %335 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %336 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %337 = call i32 @nish_spawn_piped_within(%struct.nish_array* %327, %struct.nish_array* %334, %struct.nish_array* %335, %struct.nish_array* %336, i32 1000)
  %338 = call i8* @nish_str_from_i32(i32 %337)
  %339 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.26 to i8*), i8* %338)
  call void @nish_print(i8* %339)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!17, !18, !19, !20, !21}
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
!13 = !{!"element ptr", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"element i8", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{i32 8, !"cf-protection-branch", i32 1}
!18 = !{i32 8, !"cf-protection-return", i32 1}
!19 = !{i32 8, !"branch-target-enforcement", i32 1}
!20 = !{i32 8, !"sign-return-address", i32 1}
!21 = !{i32 4, !"probe-stack", !"inline-asm"}

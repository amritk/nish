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
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #3
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
  %52 = call i32 @nish_spawn_piped_within(%struct.nish_array* %40, %struct.nish_array* %49, %struct.nish_array* %50, %struct.nish_array* %51, i32 300)
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
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %57, i64 0, i32 0
  %64 = load i64, i64* %63, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %65 = icmp ule i64 0, %62
  %66 = icmp ule i64 %62, %64
  %67 = and i1 %65, %66
  br i1 %67, label %bytes.ok, label %bytes.fail

bytes.fail:
  call void @nish_panic_slice(i64 0, i64 %62, i64 %64)
  unreachable

bytes.ok:
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %57, i64 0, i32 2
  %69 = load i8*, i8** %68, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %70 = getelementptr inbounds i8, i8* %69, i64 0
  %71 = sub i64 %62, 0
  %72 = call i8* @nish_str_new(i8* %70, i64 %71)
  %73 = call i8* @nish_str_concat(i8* %56, i8* %72)
  %74 = call i8* @nish_str_concat(i8* %73, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %75 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %76 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %76, i64 0, i32 0
  %78 = load i64, i64* %77, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %79 = trunc i64 %78 to i32
  %80 = sext i32 %79 to i64
  %81 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 0
  %82 = load i64, i64* %81, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %83 = icmp ule i64 0, %80
  %84 = icmp ule i64 %80, %82
  %85 = and i1 %83, %84
  br i1 %85, label %bytes.ok.1, label %bytes.fail.1

bytes.fail.1:
  call void @nish_panic_slice(i64 0, i64 %80, i64 %82)
  unreachable

bytes.ok.1:
  %86 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 2
  %87 = load i8*, i8** %86, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %88 = getelementptr inbounds i8, i8* %87, i64 0
  %89 = sub i64 %80, 0
  %90 = call i8* @nish_str_new(i8* %88, i64 %89)
  %91 = call i8* @nish_str_concat(i8* %74, i8* %90)
  %92 = call i8* @nish_str_concat(i8* %91, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %93 = load i64, i64* %start.addr, align 8
  %94 = call i1 @prompt(i64 %93)
  %95 = select i1 %94, i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*)
  %96 = call i8* @nish_str_concat(i8* %92, i8* %95)
  call void @nish_print(i8* %96)
  %97 = call i8* @nish_alloc_struct(i64 24)
  %98 = bitcast i8* %97 to %struct.nish_array*
  %99 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %98, i64 0, i32 0
  store i64 0, i64* %99, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %100 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %98, i64 0, i32 1
  store i64 0, i64* %100, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %101 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %98, i64 0, i32 2
  store i8* null, i8** %101, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %98, %struct.nish_array** %done.addr, align 8
  %102 = call i8* @nish_alloc_struct(i64 24)
  %103 = bitcast i8* %102 to %struct.nish_array*
  %104 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %103, i64 0, i32 0
  store i64 0, i64* %104, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %105 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %103, i64 0, i32 1
  store i64 0, i64* %105, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %106 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %103, i64 0, i32 2
  store i8* null, i8** %106, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %103, %struct.nish_array** %quiet.addr, align 8
  %107 = call i8* @nish_alloc_struct(i64 24)
  %108 = bitcast i8* %107 to %struct.nish_array*
  %109 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %108, i64 0, i32 0
  store i64 3, i64* %109, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %110 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %108, i64 0, i32 1
  store i64 3, i64* %110, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %111 = call i8* @nish_alloc_struct(i64 24)
  %112 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %108, i64 0, i32 2
  store i8* %111, i8** %112, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %113 = bitcast i8* %111 to i8**
  %114 = getelementptr inbounds i8*, i8** %113, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8** %114, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %115 = getelementptr inbounds i8*, i8** %113, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i8** %115, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %116 = getelementptr inbounds i8*, i8** %113, i64 2
  store i8* bitcast ({ i64, [12 x i8] }* @.str.10 to i8*), i8** %116, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %117 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %118 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %119 = load %struct.nish_array*, %struct.nish_array** %quiet.addr, align 8
  %120 = call i32 @nish_spawn_piped_within(%struct.nish_array* %108, %struct.nish_array* %117, %struct.nish_array* %118, %struct.nish_array* %119, i32 20000)
  %121 = call i8* @nish_str_from_i32(i32 %120)
  %122 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.9 to i8*), i8* %121)
  call void @nish_print(i8* %122)
  %123 = call i8* @nish_alloc_struct(i64 24)
  %124 = bitcast i8* %123 to %struct.nish_array*
  %125 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %124, i64 0, i32 0
  store i64 3, i64* %125, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %126 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %124, i64 0, i32 1
  store i64 3, i64* %126, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %127 = call i8* @nish_alloc_struct(i64 24)
  %128 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %124, i64 0, i32 2
  store i8* %127, i8** %128, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %129 = bitcast i8* %127 to i8**
  %130 = getelementptr inbounds i8*, i8** %129, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8** %130, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %131 = getelementptr inbounds i8*, i8** %129, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i8** %131, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %132 = getelementptr inbounds i8*, i8** %129, i64 2
  store i8* bitcast ({ i64, [20 x i8] }* @.str.12 to i8*), i8** %132, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %133 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %134 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %135 = load %struct.nish_array*, %struct.nish_array** %quiet.addr, align 8
  %136 = call i32 @nish_spawn_piped_within(%struct.nish_array* %124, %struct.nish_array* %133, %struct.nish_array* %134, %struct.nish_array* %135, i32 20000)
  %137 = call i8* @nish_str_from_i32(i32 %136)
  %138 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.11 to i8*), i8* %137)
  call void @nish_print(i8* %138)
  %139 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %140 = load %struct.nish_array*, %struct.nish_array** %done.addr, align 8
  %141 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %140, i64 0, i32 0
  %142 = load i64, i64* %141, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %143 = trunc i64 %142 to i32
  %144 = sext i32 %143 to i64
  %145 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %139, i64 0, i32 0
  %146 = load i64, i64* %145, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %147 = icmp ule i64 0, %144
  %148 = icmp ule i64 %144, %146
  %149 = and i1 %147, %148
  br i1 %149, label %bytes.ok.2, label %bytes.fail.2

bytes.fail.2:
  call void @nish_panic_slice(i64 0, i64 %144, i64 %146)
  unreachable

bytes.ok.2:
  %150 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %139, i64 0, i32 2
  %151 = load i8*, i8** %150, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %152 = getelementptr inbounds i8, i8* %151, i64 0
  %153 = sub i64 %144, 0
  %154 = call i8* @nish_str_new(i8* %152, i64 %153)
  %155 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.13 to i8*), i8* %154)
  %156 = call i8* @nish_str_concat(i8* %155, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %157 = load %struct.nish_array*, %struct.nish_array** %quiet.addr, align 8
  %158 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %157, i64 0, i32 0
  %159 = load i64, i64* %158, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %160 = trunc i64 %159 to i32
  %161 = call i8* @nish_str_from_i32(i32 %160)
  %162 = call i8* @nish_str_concat(i8* %156, i8* %161)
  call void @nish_print(i8* %162)
  %163 = call i8* @nish_alloc_struct(i64 24)
  %164 = bitcast i8* %163 to %struct.nish_array*
  %165 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %164, i64 0, i32 0
  store i64 0, i64* %165, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %166 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %164, i64 0, i32 1
  store i64 0, i64* %166, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %167 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %164, i64 0, i32 2
  store i8* null, i8** %167, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %164, %struct.nish_array** %flood.addr, align 8
  %168 = call i8* @nish_alloc_struct(i64 24)
  %169 = bitcast i8* %168 to %struct.nish_array*
  %170 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %169, i64 0, i32 0
  store i64 1, i64* %170, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %171 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %169, i64 0, i32 1
  store i64 1, i64* %171, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %172 = call i8* @nish_alloc_struct(i64 8)
  %173 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %169, i64 0, i32 2
  store i8* %172, i8** %173, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %174 = bitcast i8* %172 to i8**
  %175 = getelementptr inbounds i8*, i8** %174, i64 0
  store i8* bitcast ({ i64, [4 x i8] }* @.str.15 to i8*), i8** %175, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %176 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %177 = load %struct.nish_array*, %struct.nish_array** %flood.addr, align 8
  %178 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %179 = call i32 @nish_spawn_piped_within(%struct.nish_array* %169, %struct.nish_array* %176, %struct.nish_array* %177, %struct.nish_array* %178, i32 20000)
  %180 = call i8* @nish_str_from_i32(i32 %179)
  %181 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.14 to i8*), i8* %180)
  %182 = call i8* @nish_str_concat(i8* %181, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %183 = load %struct.nish_array*, %struct.nish_array** %flood.addr, align 8
  %184 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %183, i64 0, i32 0
  %185 = load i64, i64* %184, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %186 = trunc i64 %185 to i32
  %187 = call i8* @nish_str_from_i32(i32 %186)
  %188 = call i8* @nish_str_concat(i8* %182, i8* %187)
  call void @nish_print(i8* %188)
  %189 = call i8* @nish_alloc_struct(i64 24)
  %190 = bitcast i8* %189 to %struct.nish_array*
  %191 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %190, i64 0, i32 0
  store i64 0, i64* %191, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %192 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %190, i64 0, i32 1
  store i64 0, i64* %192, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %193 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %190, i64 0, i32 2
  store i8* null, i8** %193, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %190, %struct.nish_array** %big.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %194 = load i32, i32* %i.addr, align 4
  %195 = mul nsw i32 256, 1024
  %196 = icmp slt i32 %194, %195
  br i1 %196, label %for.body, label %for.end

for.body:
  %197 = load %struct.nish_array*, %struct.nish_array** %big.addr, align 8
  %198 = load i32, i32* %i.addr, align 4
  %199 = trunc i32 %198 to i8
  %200 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %197, i64 0, i32 0
  %201 = load i64, i64* %200, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %202 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %197, i64 0, i32 1
  %203 = load i64, i64* %202, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %204 = icmp eq i64 %201, %203
  br i1 %204, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %197, i64 1)
  br label %push.store

push.store:
  %205 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %197, i64 0, i32 2
  %206 = load i8*, i8** %205, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %207 = bitcast i8* %206 to i8*
  %208 = getelementptr inbounds i8, i8* %207, i64 %201
  store i8 %199, i8* %208, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %209 = add i64 %201, 1
  store i64 %209, i64* %200, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %210 = trunc i64 %209 to i32
  br label %for.inc

for.inc:
  %211 = load i32, i32* %i.addr, align 4
  %212 = add nsw i32 %211, 1
  store i32 %212, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %213 = call i64 @nish_monotonic_nanos()
  store i64 %213, i64* %start.addr, align 8
  %214 = call i8* @nish_alloc_struct(i64 24)
  %215 = bitcast i8* %214 to %struct.nish_array*
  %216 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %215, i64 0, i32 0
  store i64 3, i64* %216, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %217 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %215, i64 0, i32 1
  store i64 3, i64* %217, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %218 = call i8* @nish_alloc_struct(i64 24)
  %219 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %215, i64 0, i32 2
  store i8* %218, i8** %219, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %220 = bitcast i8* %218 to i8**
  %221 = getelementptr inbounds i8*, i8** %220, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8** %221, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %222 = getelementptr inbounds i8*, i8** %220, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i8** %222, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %223 = getelementptr inbounds i8*, i8** %220, i64 2
  store i8* bitcast ({ i64, [16 x i8] }* @.str.2 to i8*), i8** %223, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %224 = load %struct.nish_array*, %struct.nish_array** %big.addr, align 8
  %225 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %226 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %227 = call i32 @nish_spawn_piped_within(%struct.nish_array* %215, %struct.nish_array* %224, %struct.nish_array* %225, %struct.nish_array* %226, i32 200)
  store i32 %227, i32* %unread.addr, align 4
  %228 = load i32, i32* %unread.addr, align 4
  %229 = call i8* @nish_str_from_i32(i32 %228)
  %230 = call i8* @nish_str_concat(i8* bitcast ({ i64, [15 x i8] }* @.str.16 to i8*), i8* %229)
  %231 = call i8* @nish_str_concat(i8* %230, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %232 = load i64, i64* %start.addr, align 8
  %233 = call i1 @prompt(i64 %232)
  %234 = select i1 %233, i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*)
  %235 = call i8* @nish_str_concat(i8* %231, i8* %234)
  call void @nish_print(i8* %235)
  %236 = call i8* @nish_alloc_struct(i64 24)
  %237 = bitcast i8* %236 to %struct.nish_array*
  %238 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %237, i64 0, i32 0
  store i64 3, i64* %238, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %239 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %237, i64 0, i32 1
  store i64 3, i64* %239, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %240 = call i8* @nish_alloc_struct(i64 24)
  %241 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %237, i64 0, i32 2
  store i8* %240, i8** %241, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %242 = bitcast i8* %240 to i8**
  %243 = getelementptr inbounds i8*, i8** %242, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8** %243, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %244 = getelementptr inbounds i8*, i8** %242, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i8** %244, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %245 = getelementptr inbounds i8*, i8** %242, i64 2
  store i8* bitcast ({ i64, [7 x i8] }* @.str.18 to i8*), i8** %245, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %246 = load %struct.nish_array*, %struct.nish_array** %big.addr, align 8
  %247 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %248 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %249 = call i32 @nish_spawn_piped_within(%struct.nish_array* %237, %struct.nish_array* %246, %struct.nish_array* %247, %struct.nish_array* %248, i32 20000)
  %250 = call i8* @nish_str_from_i32(i32 %249)
  %251 = call i8* @nish_str_concat(i8* bitcast ({ i64, [16 x i8] }* @.str.17 to i8*), i8* %250)
  call void @nish_print(i8* %251)
  %252 = call i64 @nish_monotonic_nanos()
  store i64 %252, i64* %start.addr, align 8
  %253 = call i8* @nish_alloc_struct(i64 24)
  %254 = bitcast i8* %253 to %struct.nish_array*
  %255 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %254, i64 0, i32 0
  store i64 3, i64* %255, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %256 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %254, i64 0, i32 1
  store i64 3, i64* %256, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %257 = call i8* @nish_alloc_struct(i64 24)
  %258 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %254, i64 0, i32 2
  store i8* %257, i8** %258, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %259 = bitcast i8* %257 to i8**
  %260 = getelementptr inbounds i8*, i8** %259, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8** %260, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %261 = getelementptr inbounds i8*, i8** %259, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i8** %261, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %262 = getelementptr inbounds i8*, i8** %259, i64 2
  store i8* bitcast ({ i64, [31 x i8] }* @.str.19 to i8*), i8** %262, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %263 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %264 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %265 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %266 = call i32 @nish_spawn_piped_within(%struct.nish_array* %254, %struct.nish_array* %263, %struct.nish_array* %264, %struct.nish_array* %265, i32 200)
  store i32 %266, i32* %closed.addr, align 4
  %267 = load i32, i32* %closed.addr, align 4
  %268 = call i8* @nish_str_from_i32(i32 %267)
  %269 = call i8* @nish_str_concat(i8* bitcast ({ i64, [17 x i8] }* @.str.20 to i8*), i8* %268)
  %270 = call i8* @nish_str_concat(i8* %269, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %271 = load i64, i64* %start.addr, align 8
  %272 = call i1 @prompt(i64 %271)
  %273 = select i1 %272, i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*)
  %274 = call i8* @nish_str_concat(i8* %270, i8* %273)
  call void @nish_print(i8* %274)
  %275 = call i8* @nish_alloc_struct(i64 24)
  %276 = bitcast i8* %275 to %struct.nish_array*
  %277 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %276, i64 0, i32 0
  store i64 3, i64* %277, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %278 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %276, i64 0, i32 1
  store i64 3, i64* %278, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %279 = call i8* @nish_alloc_struct(i64 24)
  %280 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %276, i64 0, i32 2
  store i8* %279, i8** %280, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %281 = bitcast i8* %279 to i8**
  %282 = getelementptr inbounds i8*, i8** %281, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8** %282, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %283 = getelementptr inbounds i8*, i8** %281, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i8** %283, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %284 = getelementptr inbounds i8*, i8** %281, i64 2
  store i8* bitcast ({ i64, [16 x i8] }* @.str.2 to i8*), i8** %284, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %285 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %286 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %287 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %288 = call i32 @nish_spawn_piped_within(%struct.nish_array* %276, %struct.nish_array* %285, %struct.nish_array* %286, %struct.nish_array* %287, i32 0)
  %289 = call i8* @nish_str_from_i32(i32 %288)
  %290 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.21 to i8*), i8* %289)
  call void @nish_print(i8* %290)
  %291 = call i8* @nish_alloc_struct(i64 24)
  %292 = bitcast i8* %291 to %struct.nish_array*
  %293 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %292, i64 0, i32 0
  store i64 3, i64* %293, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %294 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %292, i64 0, i32 1
  store i64 3, i64* %294, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %295 = call i8* @nish_alloc_struct(i64 24)
  %296 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %292, i64 0, i32 2
  store i8* %295, i8** %296, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %297 = bitcast i8* %295 to i8**
  %298 = getelementptr inbounds i8*, i8** %297, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8** %298, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %299 = getelementptr inbounds i8*, i8** %297, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i8** %299, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %300 = getelementptr inbounds i8*, i8** %297, i64 2
  store i8* bitcast ({ i64, [17 x i8] }* @.str.23 to i8*), i8** %300, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %301 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %302 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %303 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %304 = call i32 @nish_spawn_piped_within(%struct.nish_array* %292, %struct.nish_array* %301, %struct.nish_array* %302, %struct.nish_array* %303, i32 200)
  %305 = call i8* @nish_str_from_i32(i32 %304)
  %306 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.22 to i8*), i8* %305)
  call void @nish_print(i8* %306)
  %307 = call i8* @nish_alloc_struct(i64 24)
  %308 = bitcast i8* %307 to %struct.nish_array*
  %309 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %308, i64 0, i32 0
  store i64 0, i64* %309, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %310 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %308, i64 0, i32 1
  store i64 0, i64* %310, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %311 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %308, i64 0, i32 2
  store i8* null, i8** %311, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %308, %struct.nish_array** %plain.addr, align 8
  %312 = call i8* @nish_alloc_struct(i64 24)
  %313 = bitcast i8* %312 to %struct.nish_array*
  %314 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %313, i64 0, i32 0
  store i64 3, i64* %314, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %315 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %313, i64 0, i32 1
  store i64 3, i64* %315, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %316 = call i8* @nish_alloc_struct(i64 24)
  %317 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %313, i64 0, i32 2
  store i8* %316, i8** %317, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %318 = bitcast i8* %316 to i8**
  %319 = getelementptr inbounds i8*, i8** %318, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8** %319, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %320 = getelementptr inbounds i8*, i8** %318, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i8** %320, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %321 = getelementptr inbounds i8*, i8** %318, i64 2
  store i8* bitcast ({ i64, [21 x i8] }* @.str.25 to i8*), i8** %321, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %322 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %323 = load %struct.nish_array*, %struct.nish_array** %plain.addr, align 8
  %324 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %325 = call i32 @nish_spawn_piped_within(%struct.nish_array* %313, %struct.nish_array* %322, %struct.nish_array* %323, %struct.nish_array* %324, i32 -1)
  %326 = call i8* @nish_str_from_i32(i32 %325)
  %327 = call i8* @nish_str_concat(i8* bitcast ({ i64, [14 x i8] }* @.str.24 to i8*), i8* %326)
  %328 = call i8* @nish_str_concat(i8* %327, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %329 = load %struct.nish_array*, %struct.nish_array** %plain.addr, align 8
  %330 = load %struct.nish_array*, %struct.nish_array** %plain.addr, align 8
  %331 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %330, i64 0, i32 0
  %332 = load i64, i64* %331, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %333 = trunc i64 %332 to i32
  %334 = sext i32 %333 to i64
  %335 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %329, i64 0, i32 0
  %336 = load i64, i64* %335, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %337 = icmp ule i64 0, %334
  %338 = icmp ule i64 %334, %336
  %339 = and i1 %337, %338
  br i1 %339, label %bytes.ok.3, label %bytes.fail.3

bytes.fail.3:
  call void @nish_panic_slice(i64 0, i64 %334, i64 %336)
  unreachable

bytes.ok.3:
  %340 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %329, i64 0, i32 2
  %341 = load i8*, i8** %340, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %342 = getelementptr inbounds i8, i8* %341, i64 0
  %343 = sub i64 %334, 0
  %344 = call i8* @nish_str_new(i8* %342, i64 %343)
  %345 = call i8* @nish_str_concat(i8* %328, i8* %344)
  call void @nish_print(i8* %345)
  %346 = call i8* @nish_alloc_struct(i64 24)
  %347 = bitcast i8* %346 to %struct.nish_array*
  %348 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %347, i64 0, i32 0
  store i64 1, i64* %348, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %349 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %347, i64 0, i32 1
  store i64 1, i64* %349, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %350 = call i8* @nish_alloc_struct(i64 8)
  %351 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %347, i64 0, i32 2
  store i8* %350, i8** %351, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %352 = bitcast i8* %350 to i8**
  %353 = getelementptr inbounds i8*, i8** %352, i64 0
  store i8* bitcast ({ i64, [21 x i8] }* @.str.27 to i8*), i8** %353, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %354 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %355 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %356 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %357 = call i32 @nish_spawn_piped_within(%struct.nish_array* %347, %struct.nish_array* %354, %struct.nish_array* %355, %struct.nish_array* %356, i32 1000)
  %358 = call i8* @nish_str_from_i32(i32 %357)
  %359 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.26 to i8*), i8* %358)
  call void @nish_print(i8* %359)
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

%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c":\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"bcd\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"e\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"fg\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"h\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"[\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"] [\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"|\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"]\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c", \00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"-\00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"] \00" }, align 8
@.str.15 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"z\00" }, align 8
@.str.16 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"--\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1

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

define internal noundef nonnull align 8 i8* @codes(i8* noundef nonnull noalias readonly align 8 nocapture %s) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %out.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = bitcast i8* %s to i64*
  %5 = load i64, i64* %4, align 8
  %6 = trunc i64 %5 to i32
  %7 = icmp slt i32 %3, %6
  br i1 %7, label %for.body, label %for.end

for.body:
  %8 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %9 = load i32, i32* %i.addr, align 4
  %10 = sext i32 %9 to i64
  %11 = getelementptr inbounds i8, i8* %s, i64 8
  %12 = getelementptr inbounds i8, i8* %11, i64 %10
  %13 = load i8, i8* %12, align 1
  %14 = zext i8 %13 to i32
  %15 = call i8* @nish_str_from_i32(i32 %14)
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 1
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %20 = icmp eq i64 %17, %19
  br i1 %20, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %8, i64 8)
  br label %push.store

push.store:
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %23 = bitcast i8* %22 to i8**
  %24 = getelementptr inbounds i8*, i8** %23, i64 %17
  store i8* %15, i8** %24, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %25 = add i64 %17, 1
  store i64 %25, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = trunc i64 %25 to i32
  br label %for.inc

for.inc:
  %27 = load i32, i32* %i.addr, align 4
  %28 = add nsw i32 %27, 1
  store i32 %28, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %29 = bitcast i8* %s to i64*
  %30 = load i64, i64* %29, align 8
  %31 = trunc i64 %30 to i32
  %32 = call i8* @nish_str_from_i32(i32 %31)
  %33 = call i8* @nish_str_concat(i8* %32, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %34 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %37 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*) to i64*
  %38 = load i64, i64* %37, align 8
  %39 = sub i64 %36, 1
  %40 = mul i64 %38, %39
  %41 = icmp eq i64 %36, 0
  %42 = select i1 %41, i64 0, i64 %40
  store i64 %42, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %43 = load i64, i64* %join.at, align 8
  %44 = icmp ult i64 %43, %36
  br i1 %44, label %join.sum.body, label %join.copy

join.sum.body:
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %46 = load i8*, i8** %45, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %47 = bitcast i8* %46 to i8**
  %48 = getelementptr inbounds i8*, i8** %47, i64 %43
  %49 = load i8*, i8** %48, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %50 = load i64, i64* %join.total, align 8
  %51 = bitcast i8* %49 to i64*
  %52 = load i64, i64* %51, align 8
  %53 = add i64 %50, %52
  store i64 %53, i64* %join.total, align 8
  %54 = add i64 %43, 1
  store i64 %54, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %55 = load i64, i64* %join.total, align 8
  %56 = icmp ugt i64 %55, 2147483647
  %57 = add i64 %55, 9
  %58 = select i1 %56, i64 4611686018427387904, i64 %57
  %59 = call i8* @nish_alloc_struct(i64 %58)
  %60 = bitcast i8* %59 to i64*
  store i64 %55, i64* %60, align 8
  %61 = getelementptr inbounds i8, i8* %59, i64 8
  store i8* %61, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %62 = load i64, i64* %join.at, align 8
  %63 = icmp ult i64 %62, %36
  br i1 %63, label %join.part, label %join.end

join.part:
  %64 = load i8*, i8** %join.p, align 8
  %65 = icmp eq i64 %62, 0
  %66 = select i1 %65, i64 0, i64 %38
  %67 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %64, i8* %67, i64 %66, i1 false)
  %68 = getelementptr inbounds i8, i8* %64, i64 %66
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %70 = load i8*, i8** %69, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %71 = bitcast i8* %70 to i8**
  %72 = getelementptr inbounds i8*, i8** %71, i64 %62
  %73 = load i8*, i8** %72, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %74 = bitcast i8* %73 to i64*
  %75 = load i64, i64* %74, align 8
  %76 = getelementptr inbounds i8, i8* %73, i64 8
  %77 = icmp eq i64 %75, 1
  br i1 %77, label %join.byte, label %join.bulk

join.byte:
  %78 = load i8, i8* %76, align 1
  store i8 %78, i8* %68, align 1
  br label %join.next

join.bulk:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %68, i8* %76, i64 %75, i1 false)
  br label %join.next

join.next:
  %79 = getelementptr inbounds i8, i8* %68, i64 %75
  store i8* %79, i8** %join.p, align 8
  %80 = add i64 %62, 1
  store i64 %80, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %81 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %81, align 1
  %82 = call i8* @nish_str_concat(i8* %33, i8* %59)
  ret i8* %82
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @bytes(i32 noundef %n, i32 noundef %from) #1 {
entry:
  %parts.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %chr = alloca i8, align 1
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %parts.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp slt i32 %5, %n
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %8 = load i32, i32* %i.addr, align 4
  %9 = add nsw i32 %from, %8
  %10 = sext i32 %9 to i64
  %11 = trunc i64 %10 to i8
  store i8 %11, i8* %chr, align 1
  %12 = call i8* @nish_str_new(i8* %chr, i64 1)
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %17 = icmp eq i64 %14, %16
  br i1 %17, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %7, i64 8)
  br label %push.store

push.store:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %20 = bitcast i8* %19 to i8**
  %21 = getelementptr inbounds i8*, i8** %20, i64 %14
  store i8* %12, i8** %21, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %22 = add i64 %14, 1
  store i64 %22, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = trunc i64 %22 to i32
  br label %for.inc

for.inc:
  %24 = load i32, i32* %i.addr, align 4
  %25 = add nsw i32 %24, 1
  store i32 %25, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %26 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  ret %struct.nish_array* %26
}

define noundef i32 @nish_main() #0 {
entry:
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %mixed.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [8 x i8*], align 8
  %join.total.1 = alloca i64, align 8
  %join.at.1 = alloca i64, align 8
  %join.p.1 = alloca i8*, align 8
  %join.total.2 = alloca i64, align 8
  %join.at.2 = alloca i64, align 8
  %join.p.2 = alloca i8*, align 8
  %join.total.3 = alloca i64, align 8
  %join.at.3 = alloca i64, align 8
  %join.p.3 = alloca i8*, align 8
  %high.addr = alloca %struct.nish_array*, align 8
  %chr = alloca i8, align 1
  %chr.1 = alloca i8, align 1
  %chr.2 = alloca i8, align 1
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [3 x i8*], align 8
  %join.total.4 = alloca i64, align 8
  %join.at.4 = alloca i64, align 8
  %join.p.4 = alloca i8*, align 8
  %join.total.5 = alloca i64, align 8
  %join.at.5 = alloca i64, align 8
  %join.p.5 = alloca i8*, align 8
  %empty.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %join.total.6 = alloca i64, align 8
  %join.at.6 = alloca i64, align 8
  %join.p.6 = alloca i8*, align 8
  %join.total.7 = alloca i64, align 8
  %join.at.7 = alloca i64, align 8
  %join.p.7 = alloca i8*, align 8
  %lone.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [1 x i8*], align 8
  %join.total.8 = alloca i64, align 8
  %join.at.8 = alloca i64, align 8
  %join.p.8 = alloca i8*, align 8
  %join.total.9 = alloca i64, align 8
  %join.at.9 = alloca i64, align 8
  %join.p.9 = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.nish_array* @bytes(i32 5, i32 97)
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*) to i64*
  %4 = load i64, i64* %3, align 8
  %5 = sub i64 %2, 1
  %6 = mul i64 %4, %5
  %7 = icmp eq i64 %2, 0
  %8 = select i1 %7, i64 0, i64 %6
  store i64 %8, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %9 = load i64, i64* %join.at, align 8
  %10 = icmp ult i64 %9, %2
  br i1 %10, label %join.sum.body, label %join.copy

join.sum.body:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %12 to i8**
  %14 = getelementptr inbounds i8*, i8** %13, i64 %9
  %15 = load i8*, i8** %14, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %16 = load i64, i64* %join.total, align 8
  %17 = bitcast i8* %15 to i64*
  %18 = load i64, i64* %17, align 8
  %19 = add i64 %16, %18
  store i64 %19, i64* %join.total, align 8
  %20 = add i64 %9, 1
  store i64 %20, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %21 = load i64, i64* %join.total, align 8
  %22 = icmp ugt i64 %21, 2147483647
  %23 = add i64 %21, 9
  %24 = select i1 %22, i64 4611686018427387904, i64 %23
  %25 = call i8* @nish_alloc_struct(i64 %24)
  %26 = bitcast i8* %25 to i64*
  store i64 %21, i64* %26, align 8
  %27 = getelementptr inbounds i8, i8* %25, i64 8
  store i8* %27, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %28 = load i64, i64* %join.at, align 8
  %29 = icmp ult i64 %28, %2
  br i1 %29, label %join.part, label %join.end

join.part:
  %30 = load i8*, i8** %join.p, align 8
  %31 = icmp eq i64 %28, 0
  %32 = select i1 %31, i64 0, i64 %4
  %33 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %30, i8* %33, i64 %32, i1 false)
  %34 = getelementptr inbounds i8, i8* %30, i64 %32
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %37 = bitcast i8* %36 to i8**
  %38 = getelementptr inbounds i8*, i8** %37, i64 %28
  %39 = load i8*, i8** %38, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %40 = bitcast i8* %39 to i64*
  %41 = load i64, i64* %40, align 8
  %42 = getelementptr inbounds i8, i8* %39, i64 8
  %43 = icmp eq i64 %41, 1
  br i1 %43, label %join.byte, label %join.bulk

join.byte:
  %44 = load i8, i8* %42, align 1
  store i8 %44, i8* %34, align 1
  br label %join.next

join.bulk:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %34, i8* %42, i64 %41, i1 false)
  br label %join.next

join.next:
  %45 = getelementptr inbounds i8, i8* %34, i64 %41
  store i8* %45, i8** %join.p, align 8
  %46 = add i64 %28, 1
  store i64 %46, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %47 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %47, align 1
  call void @nish_print(i8* %25)
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 8, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 8, i64* %49, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %50 = bitcast [8 x i8*]* %arr.data to i8*
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %50, i8** %51, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %52 = bitcast i8* %50 to i8**
  %53 = getelementptr inbounds i8*, i8** %52, i64 0
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %53, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %54 = getelementptr inbounds i8*, i8** %52, i64 1
  store i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*), i8** %54, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %55 = getelementptr inbounds i8*, i8** %52, i64 2
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %55, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %56 = getelementptr inbounds i8*, i8** %52, i64 3
  store i8* bitcast ({ i64, [4 x i8] }* @.str.4 to i8*), i8** %56, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %57 = getelementptr inbounds i8*, i8** %52, i64 4
  store i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*), i8** %57, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %58 = getelementptr inbounds i8*, i8** %52, i64 5
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %58, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %59 = getelementptr inbounds i8*, i8** %52, i64 6
  store i8* bitcast ({ i64, [3 x i8] }* @.str.6 to i8*), i8** %59, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %60 = getelementptr inbounds i8*, i8** %52, i64 7
  store i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*), i8** %60, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %mixed.addr, align 8
  %61 = load %struct.nish_array*, %struct.nish_array** %mixed.addr, align 8
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 0
  %63 = load i64, i64* %62, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %64 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*) to i64*
  %65 = load i64, i64* %64, align 8
  %66 = sub i64 %63, 1
  %67 = mul i64 %65, %66
  %68 = icmp eq i64 %63, 0
  %69 = select i1 %68, i64 0, i64 %67
  store i64 %69, i64* %join.total.1, align 8
  store i64 0, i64* %join.at.1, align 8
  br label %join.sum.1

join.sum.1:
  %70 = load i64, i64* %join.at.1, align 8
  %71 = icmp ult i64 %70, %63
  br i1 %71, label %join.sum.body.1, label %join.copy.1

join.sum.body.1:
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 2
  %73 = load i8*, i8** %72, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %74 = bitcast i8* %73 to i8**
  %75 = getelementptr inbounds i8*, i8** %74, i64 %70
  %76 = load i8*, i8** %75, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %77 = load i64, i64* %join.total.1, align 8
  %78 = bitcast i8* %76 to i64*
  %79 = load i64, i64* %78, align 8
  %80 = add i64 %77, %79
  store i64 %80, i64* %join.total.1, align 8
  %81 = add i64 %70, 1
  store i64 %81, i64* %join.at.1, align 8
  br label %join.sum.1

join.copy.1:
  %82 = load i64, i64* %join.total.1, align 8
  %83 = icmp ugt i64 %82, 2147483647
  %84 = add i64 %82, 9
  %85 = select i1 %83, i64 4611686018427387904, i64 %84
  %86 = call i8* @nish_alloc_struct(i64 %85)
  %87 = bitcast i8* %86 to i64*
  store i64 %82, i64* %87, align 8
  %88 = getelementptr inbounds i8, i8* %86, i64 8
  store i8* %88, i8** %join.p.1, align 8
  store i64 0, i64* %join.at.1, align 8
  br label %join.copy.body.1

join.copy.body.1:
  %89 = load i64, i64* %join.at.1, align 8
  %90 = icmp ult i64 %89, %63
  br i1 %90, label %join.part.1, label %join.end.1

join.part.1:
  %91 = load i8*, i8** %join.p.1, align 8
  %92 = icmp eq i64 %89, 0
  %93 = select i1 %92, i64 0, i64 %65
  %94 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %91, i8* %94, i64 %93, i1 false)
  %95 = getelementptr inbounds i8, i8* %91, i64 %93
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %61, i64 0, i32 2
  %97 = load i8*, i8** %96, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %98 = bitcast i8* %97 to i8**
  %99 = getelementptr inbounds i8*, i8** %98, i64 %89
  %100 = load i8*, i8** %99, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %101 = bitcast i8* %100 to i64*
  %102 = load i64, i64* %101, align 8
  %103 = getelementptr inbounds i8, i8* %100, i64 8
  %104 = icmp eq i64 %102, 1
  br i1 %104, label %join.byte.1, label %join.bulk.1

join.byte.1:
  %105 = load i8, i8* %103, align 1
  store i8 %105, i8* %95, align 1
  br label %join.next.1

join.bulk.1:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %95, i8* %103, i64 %102, i1 false)
  br label %join.next.1

join.next.1:
  %106 = getelementptr inbounds i8, i8* %95, i64 %102
  store i8* %106, i8** %join.p.1, align 8
  %107 = add i64 %89, 1
  store i64 %107, i64* %join.at.1, align 8
  br label %join.copy.body.1

join.end.1:
  %108 = load i8*, i8** %join.p.1, align 8
  store i8 0, i8* %108, align 1
  %109 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*), i8* %86)
  %110 = call i8* @nish_str_concat(i8* %109, i8* bitcast ({ i64, [4 x i8] }* @.str.9 to i8*))
  %111 = load %struct.nish_array*, %struct.nish_array** %mixed.addr, align 8
  %112 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %111, i64 0, i32 0
  %113 = load i64, i64* %112, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %114 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.10 to i8*) to i64*
  %115 = load i64, i64* %114, align 8
  %116 = sub i64 %113, 1
  %117 = mul i64 %115, %116
  %118 = icmp eq i64 %113, 0
  %119 = select i1 %118, i64 0, i64 %117
  store i64 %119, i64* %join.total.2, align 8
  store i64 0, i64* %join.at.2, align 8
  br label %join.sum.2

join.sum.2:
  %120 = load i64, i64* %join.at.2, align 8
  %121 = icmp ult i64 %120, %113
  br i1 %121, label %join.sum.body.2, label %join.copy.2

join.sum.body.2:
  %122 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %111, i64 0, i32 2
  %123 = load i8*, i8** %122, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %124 = bitcast i8* %123 to i8**
  %125 = getelementptr inbounds i8*, i8** %124, i64 %120
  %126 = load i8*, i8** %125, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %127 = load i64, i64* %join.total.2, align 8
  %128 = bitcast i8* %126 to i64*
  %129 = load i64, i64* %128, align 8
  %130 = add i64 %127, %129
  store i64 %130, i64* %join.total.2, align 8
  %131 = add i64 %120, 1
  store i64 %131, i64* %join.at.2, align 8
  br label %join.sum.2

join.copy.2:
  %132 = load i64, i64* %join.total.2, align 8
  %133 = icmp ugt i64 %132, 2147483647
  %134 = add i64 %132, 9
  %135 = select i1 %133, i64 4611686018427387904, i64 %134
  %136 = call i8* @nish_alloc_struct(i64 %135)
  %137 = bitcast i8* %136 to i64*
  store i64 %132, i64* %137, align 8
  %138 = getelementptr inbounds i8, i8* %136, i64 8
  store i8* %138, i8** %join.p.2, align 8
  store i64 0, i64* %join.at.2, align 8
  br label %join.copy.body.2

join.copy.body.2:
  %139 = load i64, i64* %join.at.2, align 8
  %140 = icmp ult i64 %139, %113
  br i1 %140, label %join.part.2, label %join.end.2

join.part.2:
  %141 = load i8*, i8** %join.p.2, align 8
  %142 = icmp eq i64 %139, 0
  %143 = select i1 %142, i64 0, i64 %115
  %144 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.10 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %141, i8* %144, i64 %143, i1 false)
  %145 = getelementptr inbounds i8, i8* %141, i64 %143
  %146 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %111, i64 0, i32 2
  %147 = load i8*, i8** %146, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %148 = bitcast i8* %147 to i8**
  %149 = getelementptr inbounds i8*, i8** %148, i64 %139
  %150 = load i8*, i8** %149, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %151 = bitcast i8* %150 to i64*
  %152 = load i64, i64* %151, align 8
  %153 = getelementptr inbounds i8, i8* %150, i64 8
  %154 = icmp eq i64 %152, 1
  br i1 %154, label %join.byte.2, label %join.bulk.2

join.byte.2:
  %155 = load i8, i8* %153, align 1
  store i8 %155, i8* %145, align 1
  br label %join.next.2

join.bulk.2:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %145, i8* %153, i64 %152, i1 false)
  br label %join.next.2

join.next.2:
  %156 = getelementptr inbounds i8, i8* %145, i64 %152
  store i8* %156, i8** %join.p.2, align 8
  %157 = add i64 %139, 1
  store i64 %157, i64* %join.at.2, align 8
  br label %join.copy.body.2

join.end.2:
  %158 = load i8*, i8** %join.p.2, align 8
  store i8 0, i8* %158, align 1
  %159 = call i8* @nish_str_concat(i8* %110, i8* %136)
  %160 = call i8* @nish_str_concat(i8* %159, i8* bitcast ({ i64, [2 x i8] }* @.str.11 to i8*))
  call void @nish_print(i8* %160)
  %161 = call %struct.nish_array* @bytes(i32 4, i32 65)
  %162 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %161, i64 0, i32 0
  %163 = load i64, i64* %162, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %164 = bitcast i8* bitcast ({ i64, [3 x i8] }* @.str.12 to i8*) to i64*
  %165 = load i64, i64* %164, align 8
  %166 = sub i64 %163, 1
  %167 = mul i64 %165, %166
  %168 = icmp eq i64 %163, 0
  %169 = select i1 %168, i64 0, i64 %167
  store i64 %169, i64* %join.total.3, align 8
  store i64 0, i64* %join.at.3, align 8
  br label %join.sum.3

join.sum.3:
  %170 = load i64, i64* %join.at.3, align 8
  %171 = icmp ult i64 %170, %163
  br i1 %171, label %join.sum.body.3, label %join.copy.3

join.sum.body.3:
  %172 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %161, i64 0, i32 2
  %173 = load i8*, i8** %172, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %174 = bitcast i8* %173 to i8**
  %175 = getelementptr inbounds i8*, i8** %174, i64 %170
  %176 = load i8*, i8** %175, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %177 = load i64, i64* %join.total.3, align 8
  %178 = bitcast i8* %176 to i64*
  %179 = load i64, i64* %178, align 8
  %180 = add i64 %177, %179
  store i64 %180, i64* %join.total.3, align 8
  %181 = add i64 %170, 1
  store i64 %181, i64* %join.at.3, align 8
  br label %join.sum.3

join.copy.3:
  %182 = load i64, i64* %join.total.3, align 8
  %183 = icmp ugt i64 %182, 2147483647
  %184 = add i64 %182, 9
  %185 = select i1 %183, i64 4611686018427387904, i64 %184
  %186 = call i8* @nish_alloc_struct(i64 %185)
  %187 = bitcast i8* %186 to i64*
  store i64 %182, i64* %187, align 8
  %188 = getelementptr inbounds i8, i8* %186, i64 8
  store i8* %188, i8** %join.p.3, align 8
  store i64 0, i64* %join.at.3, align 8
  br label %join.copy.body.3

join.copy.body.3:
  %189 = load i64, i64* %join.at.3, align 8
  %190 = icmp ult i64 %189, %163
  br i1 %190, label %join.part.3, label %join.end.3

join.part.3:
  %191 = load i8*, i8** %join.p.3, align 8
  %192 = icmp eq i64 %189, 0
  %193 = select i1 %192, i64 0, i64 %165
  %194 = getelementptr inbounds i8, i8* bitcast ({ i64, [3 x i8] }* @.str.12 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %191, i8* %194, i64 %193, i1 false)
  %195 = getelementptr inbounds i8, i8* %191, i64 %193
  %196 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %161, i64 0, i32 2
  %197 = load i8*, i8** %196, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %198 = bitcast i8* %197 to i8**
  %199 = getelementptr inbounds i8*, i8** %198, i64 %189
  %200 = load i8*, i8** %199, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %201 = bitcast i8* %200 to i64*
  %202 = load i64, i64* %201, align 8
  %203 = getelementptr inbounds i8, i8* %200, i64 8
  %204 = icmp eq i64 %202, 1
  br i1 %204, label %join.byte.3, label %join.bulk.3

join.byte.3:
  %205 = load i8, i8* %203, align 1
  store i8 %205, i8* %195, align 1
  br label %join.next.3

join.bulk.3:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %195, i8* %203, i64 %202, i1 false)
  br label %join.next.3

join.next.3:
  %206 = getelementptr inbounds i8, i8* %195, i64 %202
  store i8* %206, i8** %join.p.3, align 8
  %207 = add i64 %189, 1
  store i64 %207, i64* %join.at.3, align 8
  br label %join.copy.body.3

join.end.3:
  %208 = load i8*, i8** %join.p.3, align 8
  store i8 0, i8* %208, align 1
  call void @nish_print(i8* %186)
  %209 = trunc i64 127 to i8
  store i8 %209, i8* %chr, align 1
  %210 = call i8* @nish_str_new(i8* %chr, i64 1)
  %211 = trunc i64 0 to i8
  store i8 %211, i8* %chr.1, align 1
  %212 = call i8* @nish_str_new(i8* %chr.1, i64 1)
  %213 = trunc i64 126 to i8
  store i8 %213, i8* %chr.2, align 1
  %214 = call i8* @nish_str_new(i8* %chr.2, i64 1)
  %215 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 3, i64* %215, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %216 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 3, i64* %216, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %217 = bitcast [3 x i8*]* %arr.data.1 to i8*
  %218 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %217, i8** %218, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %219 = bitcast i8* %217 to i8**
  %220 = getelementptr inbounds i8*, i8** %219, i64 0
  store i8* %210, i8** %220, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %221 = getelementptr inbounds i8*, i8** %219, i64 1
  store i8* %212, i8** %221, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %222 = getelementptr inbounds i8*, i8** %219, i64 2
  store i8* %214, i8** %222, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %high.addr, align 8
  %223 = load %struct.nish_array*, %struct.nish_array** %high.addr, align 8
  %224 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %223, i64 0, i32 0
  %225 = load i64, i64* %224, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %226 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*) to i64*
  %227 = load i64, i64* %226, align 8
  %228 = sub i64 %225, 1
  %229 = mul i64 %227, %228
  %230 = icmp eq i64 %225, 0
  %231 = select i1 %230, i64 0, i64 %229
  store i64 %231, i64* %join.total.4, align 8
  store i64 0, i64* %join.at.4, align 8
  br label %join.sum.4

join.sum.4:
  %232 = load i64, i64* %join.at.4, align 8
  %233 = icmp ult i64 %232, %225
  br i1 %233, label %join.sum.body.4, label %join.copy.4

join.sum.body.4:
  %234 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %223, i64 0, i32 2
  %235 = load i8*, i8** %234, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %236 = bitcast i8* %235 to i8**
  %237 = getelementptr inbounds i8*, i8** %236, i64 %232
  %238 = load i8*, i8** %237, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %239 = load i64, i64* %join.total.4, align 8
  %240 = bitcast i8* %238 to i64*
  %241 = load i64, i64* %240, align 8
  %242 = add i64 %239, %241
  store i64 %242, i64* %join.total.4, align 8
  %243 = add i64 %232, 1
  store i64 %243, i64* %join.at.4, align 8
  br label %join.sum.4

join.copy.4:
  %244 = load i64, i64* %join.total.4, align 8
  %245 = icmp ugt i64 %244, 2147483647
  %246 = add i64 %244, 9
  %247 = select i1 %245, i64 4611686018427387904, i64 %246
  %248 = call i8* @nish_alloc_struct(i64 %247)
  %249 = bitcast i8* %248 to i64*
  store i64 %244, i64* %249, align 8
  %250 = getelementptr inbounds i8, i8* %248, i64 8
  store i8* %250, i8** %join.p.4, align 8
  store i64 0, i64* %join.at.4, align 8
  br label %join.copy.body.4

join.copy.body.4:
  %251 = load i64, i64* %join.at.4, align 8
  %252 = icmp ult i64 %251, %225
  br i1 %252, label %join.part.4, label %join.end.4

join.part.4:
  %253 = load i8*, i8** %join.p.4, align 8
  %254 = icmp eq i64 %251, 0
  %255 = select i1 %254, i64 0, i64 %227
  %256 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %253, i8* %256, i64 %255, i1 false)
  %257 = getelementptr inbounds i8, i8* %253, i64 %255
  %258 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %223, i64 0, i32 2
  %259 = load i8*, i8** %258, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %260 = bitcast i8* %259 to i8**
  %261 = getelementptr inbounds i8*, i8** %260, i64 %251
  %262 = load i8*, i8** %261, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %263 = bitcast i8* %262 to i64*
  %264 = load i64, i64* %263, align 8
  %265 = getelementptr inbounds i8, i8* %262, i64 8
  %266 = icmp eq i64 %264, 1
  br i1 %266, label %join.byte.4, label %join.bulk.4

join.byte.4:
  %267 = load i8, i8* %265, align 1
  store i8 %267, i8* %257, align 1
  br label %join.next.4

join.bulk.4:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %257, i8* %265, i64 %264, i1 false)
  br label %join.next.4

join.next.4:
  %268 = getelementptr inbounds i8, i8* %257, i64 %264
  store i8* %268, i8** %join.p.4, align 8
  %269 = add i64 %251, 1
  store i64 %269, i64* %join.at.4, align 8
  br label %join.copy.body.4

join.end.4:
  %270 = load i8*, i8** %join.p.4, align 8
  store i8 0, i8* %270, align 1
  %271 = call i64 @nish_arena_mark()
  %272 = call i8* @codes(i8* %248)
  %273 = call i8* @nish_arena_keep(i64 %271, i8* %272)
  call void @nish_print(i8* %273)
  %274 = load %struct.nish_array*, %struct.nish_array** %high.addr, align 8
  %275 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %274, i64 0, i32 0
  %276 = load i64, i64* %275, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %277 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.13 to i8*) to i64*
  %278 = load i64, i64* %277, align 8
  %279 = sub i64 %276, 1
  %280 = mul i64 %278, %279
  %281 = icmp eq i64 %276, 0
  %282 = select i1 %281, i64 0, i64 %280
  store i64 %282, i64* %join.total.5, align 8
  store i64 0, i64* %join.at.5, align 8
  br label %join.sum.5

join.sum.5:
  %283 = load i64, i64* %join.at.5, align 8
  %284 = icmp ult i64 %283, %276
  br i1 %284, label %join.sum.body.5, label %join.copy.5

join.sum.body.5:
  %285 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %274, i64 0, i32 2
  %286 = load i8*, i8** %285, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %287 = bitcast i8* %286 to i8**
  %288 = getelementptr inbounds i8*, i8** %287, i64 %283
  %289 = load i8*, i8** %288, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %290 = load i64, i64* %join.total.5, align 8
  %291 = bitcast i8* %289 to i64*
  %292 = load i64, i64* %291, align 8
  %293 = add i64 %290, %292
  store i64 %293, i64* %join.total.5, align 8
  %294 = add i64 %283, 1
  store i64 %294, i64* %join.at.5, align 8
  br label %join.sum.5

join.copy.5:
  %295 = load i64, i64* %join.total.5, align 8
  %296 = icmp ugt i64 %295, 2147483647
  %297 = add i64 %295, 9
  %298 = select i1 %296, i64 4611686018427387904, i64 %297
  %299 = call i8* @nish_alloc_struct(i64 %298)
  %300 = bitcast i8* %299 to i64*
  store i64 %295, i64* %300, align 8
  %301 = getelementptr inbounds i8, i8* %299, i64 8
  store i8* %301, i8** %join.p.5, align 8
  store i64 0, i64* %join.at.5, align 8
  br label %join.copy.body.5

join.copy.body.5:
  %302 = load i64, i64* %join.at.5, align 8
  %303 = icmp ult i64 %302, %276
  br i1 %303, label %join.part.5, label %join.end.5

join.part.5:
  %304 = load i8*, i8** %join.p.5, align 8
  %305 = icmp eq i64 %302, 0
  %306 = select i1 %305, i64 0, i64 %278
  %307 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.13 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %304, i8* %307, i64 %306, i1 false)
  %308 = getelementptr inbounds i8, i8* %304, i64 %306
  %309 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %274, i64 0, i32 2
  %310 = load i8*, i8** %309, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %311 = bitcast i8* %310 to i8**
  %312 = getelementptr inbounds i8*, i8** %311, i64 %302
  %313 = load i8*, i8** %312, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %314 = bitcast i8* %313 to i64*
  %315 = load i64, i64* %314, align 8
  %316 = getelementptr inbounds i8, i8* %313, i64 8
  %317 = icmp eq i64 %315, 1
  br i1 %317, label %join.byte.5, label %join.bulk.5

join.byte.5:
  %318 = load i8, i8* %316, align 1
  store i8 %318, i8* %308, align 1
  br label %join.next.5

join.bulk.5:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %308, i8* %316, i64 %315, i1 false)
  br label %join.next.5

join.next.5:
  %319 = getelementptr inbounds i8, i8* %308, i64 %315
  store i8* %319, i8** %join.p.5, align 8
  %320 = add i64 %302, 1
  store i64 %320, i64* %join.at.5, align 8
  br label %join.copy.body.5

join.end.5:
  %321 = load i8*, i8** %join.p.5, align 8
  store i8 0, i8* %321, align 1
  %322 = call i64 @nish_arena_mark()
  %323 = call i8* @codes(i8* %299)
  %324 = call i8* @nish_arena_keep(i64 %322, i8* %323)
  call void @nish_print(i8* %324)
  %325 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 0, i64* %325, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %326 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 0, i64* %326, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %327 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* null, i8** %327, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %empty.addr, align 8
  %328 = load %struct.nish_array*, %struct.nish_array** %empty.addr, align 8
  %329 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %328, i64 0, i32 0
  %330 = load i64, i64* %329, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %331 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*) to i64*
  %332 = load i64, i64* %331, align 8
  %333 = sub i64 %330, 1
  %334 = mul i64 %332, %333
  %335 = icmp eq i64 %330, 0
  %336 = select i1 %335, i64 0, i64 %334
  store i64 %336, i64* %join.total.6, align 8
  store i64 0, i64* %join.at.6, align 8
  br label %join.sum.6

join.sum.6:
  %337 = load i64, i64* %join.at.6, align 8
  %338 = icmp ult i64 %337, %330
  br i1 %338, label %join.sum.body.6, label %join.copy.6

join.sum.body.6:
  %339 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %328, i64 0, i32 2
  %340 = load i8*, i8** %339, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %341 = bitcast i8* %340 to i8**
  %342 = getelementptr inbounds i8*, i8** %341, i64 %337
  %343 = load i8*, i8** %342, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %344 = load i64, i64* %join.total.6, align 8
  %345 = bitcast i8* %343 to i64*
  %346 = load i64, i64* %345, align 8
  %347 = add i64 %344, %346
  store i64 %347, i64* %join.total.6, align 8
  %348 = add i64 %337, 1
  store i64 %348, i64* %join.at.6, align 8
  br label %join.sum.6

join.copy.6:
  %349 = load i64, i64* %join.total.6, align 8
  %350 = icmp ugt i64 %349, 2147483647
  %351 = add i64 %349, 9
  %352 = select i1 %350, i64 4611686018427387904, i64 %351
  %353 = call i8* @nish_alloc_struct(i64 %352)
  %354 = bitcast i8* %353 to i64*
  store i64 %349, i64* %354, align 8
  %355 = getelementptr inbounds i8, i8* %353, i64 8
  store i8* %355, i8** %join.p.6, align 8
  store i64 0, i64* %join.at.6, align 8
  br label %join.copy.body.6

join.copy.body.6:
  %356 = load i64, i64* %join.at.6, align 8
  %357 = icmp ult i64 %356, %330
  br i1 %357, label %join.part.6, label %join.end.6

join.part.6:
  %358 = load i8*, i8** %join.p.6, align 8
  %359 = icmp eq i64 %356, 0
  %360 = select i1 %359, i64 0, i64 %332
  %361 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %358, i8* %361, i64 %360, i1 false)
  %362 = getelementptr inbounds i8, i8* %358, i64 %360
  %363 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %328, i64 0, i32 2
  %364 = load i8*, i8** %363, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %365 = bitcast i8* %364 to i8**
  %366 = getelementptr inbounds i8*, i8** %365, i64 %356
  %367 = load i8*, i8** %366, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %368 = bitcast i8* %367 to i64*
  %369 = load i64, i64* %368, align 8
  %370 = getelementptr inbounds i8, i8* %367, i64 8
  %371 = icmp eq i64 %369, 1
  br i1 %371, label %join.byte.6, label %join.bulk.6

join.byte.6:
  %372 = load i8, i8* %370, align 1
  store i8 %372, i8* %362, align 1
  br label %join.next.6

join.bulk.6:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %362, i8* %370, i64 %369, i1 false)
  br label %join.next.6

join.next.6:
  %373 = getelementptr inbounds i8, i8* %362, i64 %369
  store i8* %373, i8** %join.p.6, align 8
  %374 = add i64 %356, 1
  store i64 %374, i64* %join.at.6, align 8
  br label %join.copy.body.6

join.end.6:
  %375 = load i8*, i8** %join.p.6, align 8
  store i8 0, i8* %375, align 1
  %376 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*), i8* %353)
  %377 = call i8* @nish_str_concat(i8* %376, i8* bitcast ({ i64, [3 x i8] }* @.str.14 to i8*))
  %378 = load %struct.nish_array*, %struct.nish_array** %empty.addr, align 8
  %379 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %378, i64 0, i32 0
  %380 = load i64, i64* %379, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %381 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*) to i64*
  %382 = load i64, i64* %381, align 8
  %383 = sub i64 %380, 1
  %384 = mul i64 %382, %383
  %385 = icmp eq i64 %380, 0
  %386 = select i1 %385, i64 0, i64 %384
  store i64 %386, i64* %join.total.7, align 8
  store i64 0, i64* %join.at.7, align 8
  br label %join.sum.7

join.sum.7:
  %387 = load i64, i64* %join.at.7, align 8
  %388 = icmp ult i64 %387, %380
  br i1 %388, label %join.sum.body.7, label %join.copy.7

join.sum.body.7:
  %389 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %378, i64 0, i32 2
  %390 = load i8*, i8** %389, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %391 = bitcast i8* %390 to i8**
  %392 = getelementptr inbounds i8*, i8** %391, i64 %387
  %393 = load i8*, i8** %392, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %394 = load i64, i64* %join.total.7, align 8
  %395 = bitcast i8* %393 to i64*
  %396 = load i64, i64* %395, align 8
  %397 = add i64 %394, %396
  store i64 %397, i64* %join.total.7, align 8
  %398 = add i64 %387, 1
  store i64 %398, i64* %join.at.7, align 8
  br label %join.sum.7

join.copy.7:
  %399 = load i64, i64* %join.total.7, align 8
  %400 = icmp ugt i64 %399, 2147483647
  %401 = add i64 %399, 9
  %402 = select i1 %400, i64 4611686018427387904, i64 %401
  %403 = call i8* @nish_alloc_struct(i64 %402)
  %404 = bitcast i8* %403 to i64*
  store i64 %399, i64* %404, align 8
  %405 = getelementptr inbounds i8, i8* %403, i64 8
  store i8* %405, i8** %join.p.7, align 8
  store i64 0, i64* %join.at.7, align 8
  br label %join.copy.body.7

join.copy.body.7:
  %406 = load i64, i64* %join.at.7, align 8
  %407 = icmp ult i64 %406, %380
  br i1 %407, label %join.part.7, label %join.end.7

join.part.7:
  %408 = load i8*, i8** %join.p.7, align 8
  %409 = icmp eq i64 %406, 0
  %410 = select i1 %409, i64 0, i64 %382
  %411 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %408, i8* %411, i64 %410, i1 false)
  %412 = getelementptr inbounds i8, i8* %408, i64 %410
  %413 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %378, i64 0, i32 2
  %414 = load i8*, i8** %413, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %415 = bitcast i8* %414 to i8**
  %416 = getelementptr inbounds i8*, i8** %415, i64 %406
  %417 = load i8*, i8** %416, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %418 = bitcast i8* %417 to i64*
  %419 = load i64, i64* %418, align 8
  %420 = getelementptr inbounds i8, i8* %417, i64 8
  %421 = icmp eq i64 %419, 1
  br i1 %421, label %join.byte.7, label %join.bulk.7

join.byte.7:
  %422 = load i8, i8* %420, align 1
  store i8 %422, i8* %412, align 1
  br label %join.next.7

join.bulk.7:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %412, i8* %420, i64 %419, i1 false)
  br label %join.next.7

join.next.7:
  %423 = getelementptr inbounds i8, i8* %412, i64 %419
  store i8* %423, i8** %join.p.7, align 8
  %424 = add i64 %406, 1
  store i64 %424, i64* %join.at.7, align 8
  br label %join.copy.body.7

join.end.7:
  %425 = load i8*, i8** %join.p.7, align 8
  store i8 0, i8* %425, align 1
  %426 = bitcast i8* %403 to i64*
  %427 = load i64, i64* %426, align 8
  %428 = trunc i64 %427 to i32
  %429 = call i8* @nish_str_from_i32(i32 %428)
  %430 = call i8* @nish_str_concat(i8* %377, i8* %429)
  call void @nish_print(i8* %430)
  %431 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 1, i64* %431, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %432 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 1, i64* %432, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %433 = bitcast [1 x i8*]* %arr.data.2 to i8*
  %434 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %433, i8** %434, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %435 = bitcast i8* %433 to i8**
  %436 = getelementptr inbounds i8*, i8** %435, i64 0
  store i8* bitcast ({ i64, [2 x i8] }* @.str.15 to i8*), i8** %436, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.3, %struct.nish_array** %lone.addr, align 8
  %437 = load %struct.nish_array*, %struct.nish_array** %lone.addr, align 8
  %438 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %437, i64 0, i32 0
  %439 = load i64, i64* %438, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %440 = bitcast i8* bitcast ({ i64, [3 x i8] }* @.str.16 to i8*) to i64*
  %441 = load i64, i64* %440, align 8
  %442 = sub i64 %439, 1
  %443 = mul i64 %441, %442
  %444 = icmp eq i64 %439, 0
  %445 = select i1 %444, i64 0, i64 %443
  store i64 %445, i64* %join.total.8, align 8
  store i64 0, i64* %join.at.8, align 8
  br label %join.sum.8

join.sum.8:
  %446 = load i64, i64* %join.at.8, align 8
  %447 = icmp ult i64 %446, %439
  br i1 %447, label %join.sum.body.8, label %join.copy.8

join.sum.body.8:
  %448 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %437, i64 0, i32 2
  %449 = load i8*, i8** %448, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %450 = bitcast i8* %449 to i8**
  %451 = getelementptr inbounds i8*, i8** %450, i64 %446
  %452 = load i8*, i8** %451, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %453 = load i64, i64* %join.total.8, align 8
  %454 = bitcast i8* %452 to i64*
  %455 = load i64, i64* %454, align 8
  %456 = add i64 %453, %455
  store i64 %456, i64* %join.total.8, align 8
  %457 = add i64 %446, 1
  store i64 %457, i64* %join.at.8, align 8
  br label %join.sum.8

join.copy.8:
  %458 = load i64, i64* %join.total.8, align 8
  %459 = icmp ugt i64 %458, 2147483647
  %460 = add i64 %458, 9
  %461 = select i1 %459, i64 4611686018427387904, i64 %460
  %462 = call i8* @nish_alloc_struct(i64 %461)
  %463 = bitcast i8* %462 to i64*
  store i64 %458, i64* %463, align 8
  %464 = getelementptr inbounds i8, i8* %462, i64 8
  store i8* %464, i8** %join.p.8, align 8
  store i64 0, i64* %join.at.8, align 8
  br label %join.copy.body.8

join.copy.body.8:
  %465 = load i64, i64* %join.at.8, align 8
  %466 = icmp ult i64 %465, %439
  br i1 %466, label %join.part.8, label %join.end.8

join.part.8:
  %467 = load i8*, i8** %join.p.8, align 8
  %468 = icmp eq i64 %465, 0
  %469 = select i1 %468, i64 0, i64 %441
  %470 = getelementptr inbounds i8, i8* bitcast ({ i64, [3 x i8] }* @.str.16 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %467, i8* %470, i64 %469, i1 false)
  %471 = getelementptr inbounds i8, i8* %467, i64 %469
  %472 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %437, i64 0, i32 2
  %473 = load i8*, i8** %472, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %474 = bitcast i8* %473 to i8**
  %475 = getelementptr inbounds i8*, i8** %474, i64 %465
  %476 = load i8*, i8** %475, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %477 = bitcast i8* %476 to i64*
  %478 = load i64, i64* %477, align 8
  %479 = getelementptr inbounds i8, i8* %476, i64 8
  %480 = icmp eq i64 %478, 1
  br i1 %480, label %join.byte.8, label %join.bulk.8

join.byte.8:
  %481 = load i8, i8* %479, align 1
  store i8 %481, i8* %471, align 1
  br label %join.next.8

join.bulk.8:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %471, i8* %479, i64 %478, i1 false)
  br label %join.next.8

join.next.8:
  %482 = getelementptr inbounds i8, i8* %471, i64 %478
  store i8* %482, i8** %join.p.8, align 8
  %483 = add i64 %465, 1
  store i64 %483, i64* %join.at.8, align 8
  br label %join.copy.body.8

join.end.8:
  %484 = load i8*, i8** %join.p.8, align 8
  store i8 0, i8* %484, align 1
  %485 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*), i8* %462)
  %486 = call i8* @nish_str_concat(i8* %485, i8* bitcast ({ i64, [2 x i8] }* @.str.11 to i8*))
  call void @nish_print(i8* %486)
  %487 = call %struct.nish_array* @bytes(i32 64, i32 48)
  %488 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %487, i64 0, i32 0
  %489 = load i64, i64* %488, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %490 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*) to i64*
  %491 = load i64, i64* %490, align 8
  %492 = sub i64 %489, 1
  %493 = mul i64 %491, %492
  %494 = icmp eq i64 %489, 0
  %495 = select i1 %494, i64 0, i64 %493
  store i64 %495, i64* %join.total.9, align 8
  store i64 0, i64* %join.at.9, align 8
  br label %join.sum.9

join.sum.9:
  %496 = load i64, i64* %join.at.9, align 8
  %497 = icmp ult i64 %496, %489
  br i1 %497, label %join.sum.body.9, label %join.copy.9

join.sum.body.9:
  %498 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %487, i64 0, i32 2
  %499 = load i8*, i8** %498, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %500 = bitcast i8* %499 to i8**
  %501 = getelementptr inbounds i8*, i8** %500, i64 %496
  %502 = load i8*, i8** %501, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %503 = load i64, i64* %join.total.9, align 8
  %504 = bitcast i8* %502 to i64*
  %505 = load i64, i64* %504, align 8
  %506 = add i64 %503, %505
  store i64 %506, i64* %join.total.9, align 8
  %507 = add i64 %496, 1
  store i64 %507, i64* %join.at.9, align 8
  br label %join.sum.9

join.copy.9:
  %508 = load i64, i64* %join.total.9, align 8
  %509 = icmp ugt i64 %508, 2147483647
  %510 = add i64 %508, 9
  %511 = select i1 %509, i64 4611686018427387904, i64 %510
  %512 = call i8* @nish_alloc_struct(i64 %511)
  %513 = bitcast i8* %512 to i64*
  store i64 %508, i64* %513, align 8
  %514 = getelementptr inbounds i8, i8* %512, i64 8
  store i8* %514, i8** %join.p.9, align 8
  store i64 0, i64* %join.at.9, align 8
  br label %join.copy.body.9

join.copy.body.9:
  %515 = load i64, i64* %join.at.9, align 8
  %516 = icmp ult i64 %515, %489
  br i1 %516, label %join.part.9, label %join.end.9

join.part.9:
  %517 = load i8*, i8** %join.p.9, align 8
  %518 = icmp eq i64 %515, 0
  %519 = select i1 %518, i64 0, i64 %491
  %520 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %517, i8* %520, i64 %519, i1 false)
  %521 = getelementptr inbounds i8, i8* %517, i64 %519
  %522 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %487, i64 0, i32 2
  %523 = load i8*, i8** %522, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %524 = bitcast i8* %523 to i8**
  %525 = getelementptr inbounds i8*, i8** %524, i64 %515
  %526 = load i8*, i8** %525, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %527 = bitcast i8* %526 to i64*
  %528 = load i64, i64* %527, align 8
  %529 = getelementptr inbounds i8, i8* %526, i64 8
  %530 = icmp eq i64 %528, 1
  br i1 %530, label %join.byte.9, label %join.bulk.9

join.byte.9:
  %531 = load i8, i8* %529, align 1
  store i8 %531, i8* %521, align 1
  br label %join.next.9

join.bulk.9:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %521, i8* %529, i64 %528, i1 false)
  br label %join.next.9

join.next.9:
  %532 = getelementptr inbounds i8, i8* %521, i64 %528
  store i8* %532, i8** %join.p.9, align 8
  %533 = add i64 %515, 1
  store i64 %533, i64* %join.at.9, align 8
  br label %join.copy.body.9

join.end.9:
  %534 = load i8*, i8** %join.p.9, align 8
  store i8 0, i8* %534, align 1
  %535 = bitcast i8* %512 to i64*
  %536 = load i64, i64* %535, align 8
  %537 = trunc i64 %536 to i32
  %538 = call i8* @nish_str_from_i32(i32 %537)
  call void @nish_print(i8* %538)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

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
!13 = !{!"element ptr", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}

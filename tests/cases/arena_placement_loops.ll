%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"w\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"r\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"j\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"t\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"none\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c",\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #3
declare noundef i64 @nish_arena_mark() #3
declare void @nish_arena_release(i64 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #3
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #6 {
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

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @words(i32 noundef %n) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp slt i32 %5, %n
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %8 = load i32, i32* %i.addr, align 4
  %9 = call i8* @nish_str_from_i32(i32 %8)
  %10 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8* %9)
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %15 = icmp eq i64 %12, %14
  br i1 %15, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %7, i64 8)
  br label %push.store

push.store:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %18 = bitcast i8* %17 to i8**
  %19 = getelementptr inbounds i8*, i8** %18, i64 %12
  store i8* %10, i8** %19, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %20 = add i64 %12, 1
  store i64 %20, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = trunc i64 %20 to i32
  br label %for.inc

for.inc:
  %22 = load i32, i32* %i.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %24 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %24
}

define void @nish_main() #0 {
entry:
  %total.addr = alloca i32, align 4
  %round.addr = alloca i32, align 4
  %last.addr = alloca i8*, align 8
  %j.addr = alloca i32, align 4
  %a.addr = alloca i64, align 8
  %tag.addr = alloca i8*, align 8
  %j.addr.1 = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %ws.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %round.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %round.addr, align 4
  %1 = icmp slt i32 %0, 3
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*), i8** %last.addr, align 8
  store i32 0, i32* %j.addr, align 4
  br label %for.cond.1

for.cond.1:
  %6 = load i32, i32* %j.addr, align 4
  %7 = icmp slt i32 %6, 4
  br i1 %7, label %for.body.1, label %for.end.1

for.body.1:
  %8 = load i32, i32* %round.addr, align 4
  %9 = call i8* @nish_str_from_i32(i32 %8)
  %10 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i8* %9)
  %11 = call i8* @nish_str_concat(i8* %10, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %12 = load i32, i32* %j.addr, align 4
  %13 = call i8* @nish_str_from_i32(i32 %12)
  %14 = call i8* @nish_str_concat(i8* %11, i8* %13)
  store i8* %14, i8** %last.addr, align 8
  br label %for.inc.1

for.inc.1:
  %15 = load i32, i32* %j.addr, align 4
  %16 = add nsw i32 %15, 1
  store i32 %16, i32* %j.addr, align 4
  br label %for.cond.1

for.end.1:
  %17 = load i32, i32* %total.addr, align 4
  %18 = load i8*, i8** %last.addr, align 8
  %19 = bitcast i8* %18 to i64*
  %20 = load i64, i64* %19, align 8
  %21 = trunc i64 %20 to i32
  %22 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %17, i32 %21)
  %23 = extractvalue { i32, i1 } %22, 0
  %24 = extractvalue { i32, i1 } %22, 1
  br i1 %24, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %23, i32* %total.addr, align 4
  %25 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %26 = load i8*, i8** %25, align 8
  %27 = icmp eq i8* %26, %3
  br i1 %27, label %pass.rewind, label %pass.free

pass.rewind:
  %28 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %28, align 8
  br label %pass.done

pass.free:
  %29 = ptrtoint i8* %3 to i64
  %30 = add i64 %29, %5
  call void @nish_arena_release(i64 %30)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %31 = load i32, i32* %round.addr, align 4
  %32 = add nsw i32 %31, 1
  store i32 %32, i32* %round.addr, align 4
  br label %for.cond

for.end:
  %33 = call i64 @nish_arena_mark()
  store i64 %33, i64* %a.addr, align 8
  %34 = load i64, i64* %a.addr, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*), i8** %tag.addr, align 8
  store i32 0, i32* %j.addr.1, align 4
  br label %for.cond.2

for.cond.2:
  %35 = load i32, i32* %j.addr.1, align 4
  %36 = icmp slt i32 %35, 4
  br i1 %36, label %for.body.2, label %for.end.2

for.body.2:
  %37 = load i32, i32* %j.addr.1, align 4
  %38 = call i8* @nish_str_from_i32(i32 %37)
  %39 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*), i8* %38)
  store i8* %39, i8** %tag.addr, align 8
  br label %for.inc.2

for.inc.2:
  %40 = load i32, i32* %j.addr.1, align 4
  %41 = add nsw i32 %40, 1
  store i32 %41, i32* %j.addr.1, align 4
  br label %for.cond.2

for.end.2:
  %42 = load i32, i32* %total.addr, align 4
  %43 = load i8*, i8** %tag.addr, align 8
  %44 = bitcast i8* %43 to i64*
  %45 = load i64, i64* %44, align 8
  %46 = trunc i64 %45 to i32
  %47 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %42, i32 %46)
  %48 = extractvalue { i32, i1 } %47, 0
  %49 = extractvalue { i32, i1 } %47, 1
  br i1 %49, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %48, i32* %total.addr, align 4
  call void @nish_arena_release(i64 %34)
  store i32 0, i32* %k.addr, align 4
  br label %while.cond

while.cond:
  %50 = load i32, i32* %k.addr, align 4
  %51 = call i8* @nish_str_from_i32(i32 %50)
  %52 = bitcast i8* %51 to i64*
  %53 = load i64, i64* %52, align 8
  %54 = trunc i64 %53 to i32
  %55 = icmp slt i32 %54, 2
  br i1 %55, label %while.body, label %while.end

while.body:
  %56 = load i32, i32* %k.addr, align 4
  %57 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %56, i32 1)
  %58 = extractvalue { i32, i1 } %57, 0
  %59 = extractvalue { i32, i1 } %57, 1
  br i1 %59, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %58, i32* %k.addr, align 4
  br label %while.cond

while.end:
  %60 = call %struct.nish_array* @words(i32 3)
  store %struct.nish_array* %60, %struct.nish_array** %ws.addr, align 8
  %61 = load i32, i32* %total.addr, align 4
  %62 = call i8* @nish_str_from_i32(i32 %61)
  call void @nish_print(i8* %62)
  %63 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %64 = call i8* @first$str(%struct.nish_array* %63, i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*))
  %65 = call i8* @nish_str_concat(i8* %64, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %66, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %67, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %68 = bitcast [2 x i32]* %arr.data to i8*
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %68, i8** %69, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %70 = bitcast i8* %68 to i32*
  %71 = getelementptr inbounds i32, i32* %70, i64 0
  store i32 7, i32* %71, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %72 = getelementptr inbounds i32, i32* %70, i64 1
  store i32 8, i32* %72, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %73 = call i32 @first$i32(%struct.nish_array* %arr.hdr, i32 0)
  %74 = call i8* @nish_str_from_i32(i32 %73)
  %75 = call i8* @nish_str_concat(i8* %65, i8* %74)
  %76 = call i8* @nish_str_concat(i8* %75, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  %77 = load %struct.nish_array*, %struct.nish_array** %ws.addr, align 8
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %77, i64 0, i32 0
  %79 = load i64, i64* %78, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %80 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*) to i64*
  %81 = load i64, i64* %80, align 8
  %82 = sub i64 %79, 1
  %83 = mul i64 %81, %82
  %84 = icmp eq i64 %79, 0
  %85 = select i1 %84, i64 0, i64 %83
  store i64 %85, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %86 = load i64, i64* %join.at, align 8
  %87 = icmp ult i64 %86, %79
  br i1 %87, label %join.sum.body, label %join.copy

join.sum.body:
  %88 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %77, i64 0, i32 2
  %89 = load i8*, i8** %88, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %90 = bitcast i8* %89 to i8**
  %91 = getelementptr inbounds i8*, i8** %90, i64 %86
  %92 = load i8*, i8** %91, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %93 = load i64, i64* %join.total, align 8
  %94 = bitcast i8* %92 to i64*
  %95 = load i64, i64* %94, align 8
  %96 = add i64 %93, %95
  store i64 %96, i64* %join.total, align 8
  %97 = add i64 %86, 1
  store i64 %97, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %98 = load i64, i64* %join.total, align 8
  %99 = icmp ugt i64 %98, 2147483647
  %100 = add i64 %98, 9
  %101 = select i1 %99, i64 4611686018427387904, i64 %100
  %102 = call i8* @nish_alloc_struct(i64 %101)
  %103 = bitcast i8* %102 to i64*
  store i64 %98, i64* %103, align 8
  %104 = getelementptr inbounds i8, i8* %102, i64 8
  store i8* %104, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %105 = load i64, i64* %join.at, align 8
  %106 = icmp ult i64 %105, %79
  br i1 %106, label %join.part, label %join.end

join.part:
  %107 = load i8*, i8** %join.p, align 8
  %108 = icmp eq i64 %105, 0
  %109 = select i1 %108, i64 0, i64 %81
  %110 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %107, i8* %110, i64 %109, i1 false)
  %111 = getelementptr inbounds i8, i8* %107, i64 %109
  %112 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %77, i64 0, i32 2
  %113 = load i8*, i8** %112, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %114 = bitcast i8* %113 to i8**
  %115 = getelementptr inbounds i8*, i8** %114, i64 %105
  %116 = load i8*, i8** %115, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %117 = bitcast i8* %116 to i64*
  %118 = load i64, i64* %117, align 8
  %119 = getelementptr inbounds i8, i8* %116, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %111, i8* %119, i64 %118, i1 false)
  %120 = getelementptr inbounds i8, i8* %111, i64 %118
  store i8* %120, i8** %join.p, align 8
  %121 = add i64 %105, 1
  store i64 %121, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %122 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %122, align 1
  %123 = call i8* @nish_str_concat(i8* %76, i8* %102)
  %124 = call i8* @nish_str_concat(i8* %123, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  %125 = load i32, i32* %k.addr, align 4
  %126 = call i8* @nish_str_from_i32(i32 %125)
  %127 = call i8* @nish_str_concat(i8* %124, i8* %126)
  call void @nish_print(i8* %127)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 i8* @first$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i8* noundef nonnull noalias readonly align 8 %fallback) #1 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = icmp sgt i32 %2, 0
  br i1 %3, label %cond.true, label %cond.false

cond.true:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %5 to i8**
  %7 = getelementptr inbounds i8*, i8** %6, i64 0
  %8 = load i8*, i8** %7, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %9 = phi i8* [ %8, %cond.true ], [ %fallback, %cond.false ]
  ret i8* %9
}

define internal noundef i32 @first$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %fallback) #1 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = icmp sgt i32 %2, 0
  br i1 %3, label %cond.true, label %cond.false

cond.true:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %9 = phi i32 [ %8, %cond.true ], [ %fallback, %cond.false ]
  ret i32 %9
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind willreturn }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { nounwind willreturn readnone }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

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
!15 = !{!"element i32", !6, i64 0}
!16 = !{!15, !15, i64 0}

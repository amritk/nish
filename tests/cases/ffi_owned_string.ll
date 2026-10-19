%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"owned by C\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"none\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"while \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"\00\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [87 x i8] } { i64 86, [87 x i8] c"`strdup`: argument 1 (s) holds a NUL byte, which C would read as the end of the string\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"do \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"of \00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"nested \00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"into \00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c".\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"hello\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.15 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"/\00" }, align 8
@.str.16 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"|\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare i8* @strdup(i8*)
declare i8* @realpath(i8*, i8*)
declare void @free(i8*)
declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare zeroext i1 @nish_str_at(i8* noundef nonnull readonly align 8 nocapture, i64 noundef, i8* noundef nonnull readonly align 8 nocapture) #3
declare i64 @nish_str_index_of(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5

define private i8* @nish.ffi.str(i8* %p) {
entry:
  br label %scan

scan:
  %n = phi i64 [ 0, %entry ], [ %next, %scan ]
  %at = getelementptr inbounds i8, i8* %p, i64 %n
  %byte = load i8, i8* %at, align 1
  %next = add i64 %n, 1
  %end = icmp eq i8 %byte, 0
  br i1 %end, label %copy, label %scan

copy:
  %s = call i8* @nish_str_new(i8* %p, i64 %n)
  ret i8* %s
}

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

define internal noundef i32 @churn() #0 {
entry:
  %t.addr = alloca %struct.nish_array*, align 8
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
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %t.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, 4000
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = call i8* @nish_str_from_i32(i32 %6)
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %12 = icmp eq i64 %9, %11
  br i1 %12, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 8)
  br label %push.store

push.store:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %15 = bitcast i8* %14 to i8**
  %16 = getelementptr inbounds i8*, i8** %15, i64 %9
  store i8* %7, i8** %16, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %17 = add i64 %9, 1
  store i64 %17, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = trunc i64 %17 to i32
  br label %for.inc

for.inc:
  %19 = load i32, i32* %i.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %21 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*) to i64*
  %25 = load i64, i64* %24, align 8
  %26 = sub i64 %23, 1
  %27 = mul i64 %25, %26
  %28 = icmp eq i64 %23, 0
  %29 = select i1 %28, i64 0, i64 %27
  store i64 %29, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %30 = load i64, i64* %join.at, align 8
  %31 = icmp ult i64 %30, %23
  br i1 %31, label %join.sum.body, label %join.copy

join.sum.body:
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %34 = bitcast i8* %33 to i8**
  %35 = getelementptr inbounds i8*, i8** %34, i64 %30
  %36 = load i8*, i8** %35, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %37 = load i64, i64* %join.total, align 8
  %38 = bitcast i8* %36 to i64*
  %39 = load i64, i64* %38, align 8
  %40 = add i64 %37, %39
  store i64 %40, i64* %join.total, align 8
  %41 = add i64 %30, 1
  store i64 %41, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %42 = load i64, i64* %join.total, align 8
  %43 = icmp ugt i64 %42, 2147483647
  %44 = add i64 %42, 9
  %45 = select i1 %43, i64 4611686018427387904, i64 %44
  %46 = call i8* @nish_alloc_struct(i64 %45)
  %47 = bitcast i8* %46 to i64*
  store i64 %42, i64* %47, align 8
  %48 = getelementptr inbounds i8, i8* %46, i64 8
  store i8* %48, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %49 = load i64, i64* %join.at, align 8
  %50 = icmp ult i64 %49, %23
  br i1 %50, label %join.part, label %join.end

join.part:
  %51 = load i8*, i8** %join.p, align 8
  %52 = icmp eq i64 %49, 0
  %53 = select i1 %52, i64 0, i64 %25
  %54 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %51, i8* %54, i64 %53, i1 false)
  %55 = getelementptr inbounds i8, i8* %51, i64 %53
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %57 = load i8*, i8** %56, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %58 = bitcast i8* %57 to i8**
  %59 = getelementptr inbounds i8*, i8** %58, i64 %49
  %60 = load i8*, i8** %59, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %61 = bitcast i8* %60 to i64*
  %62 = load i64, i64* %61, align 8
  %63 = getelementptr inbounds i8, i8* %60, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %55, i8* %63, i64 %62, i1 false)
  %64 = getelementptr inbounds i8, i8* %55, i64 %62
  store i8* %64, i8** %join.p, align 8
  %65 = add i64 %49, 1
  store i64 %65, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %66 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %66, align 1
  %67 = bitcast i8* %46 to i64*
  %68 = load i64, i64* %67, align 8
  %69 = trunc i64 %68 to i32
  ret i32 %69
}

define internal noundef nonnull align 8 i8* @find(i32 noundef %n) #1 {
entry:
  %p.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  %s.addr = alloca i8*, align 8
  %0 = getelementptr inbounds i8, i8* bitcast ({ i64, [11 x i8] }* @.str.1 to i8*), i64 8
  %1 = call i8* @strdup(i8* %0)
  store i8* %1, i8** %p.addr, align 8
  %2 = load i8*, i8** %p.addr, align 8
  %3 = icmp eq i8* %2, null
  br i1 %3, label %if.then, label %if.end

if.then:
  ret i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*)

if.end:
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp slt i32 %4, %n
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = load i32, i32* %i.addr, align 4
  %7 = icmp eq i32 %6, 2
  br i1 %7, label %if.then.1, label %if.end.1

if.then.1:
  %8 = load i8*, i8** %p.addr, align 8
  %9 = call i8* @nish.ffi.str(i8* %8)
  store i8* %9, i8** %s.addr, align 8
  %10 = load i8*, i8** %p.addr, align 8
  call void @free(i8* %10)
  %11 = load i8*, i8** %s.addr, align 8
  ret i8* %11

if.end.1:
  br label %for.inc

for.inc:
  %12 = load i32, i32* %i.addr, align 4
  %13 = add nsw i32 %12, 1
  store i32 %13, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %14 = load i8*, i8** %p.addr, align 8
  call void @free(i8* %14)
  ret i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*)
}

define internal noundef nonnull align 8 i8* @last(i32 noundef %n) #1 {
entry:
  %p.addr = alloca i8*, align 8
  %s.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds i8, i8* bitcast ({ i64, [11 x i8] }* @.str.1 to i8*), i64 8
  %1 = call i8* @strdup(i8* %0)
  store i8* %1, i8** %p.addr, align 8
  %2 = load i8*, i8** %p.addr, align 8
  %3 = icmp eq i8* %2, null
  br i1 %3, label %if.then, label %if.end

if.then:
  ret i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*)

if.end:
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp slt i32 %4, %n
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = load i8*, i8** %p.addr, align 8
  %7 = call i8* @nish.ffi.str(i8* %6)
  store i8* %7, i8** %s.addr, align 8
  br label %for.inc

for.inc:
  %8 = load i32, i32* %i.addr, align 4
  %9 = add nsw i32 %8, 1
  store i32 %9, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %10 = load i8*, i8** %p.addr, align 8
  call void @free(i8* %10)
  %11 = load i8*, i8** %s.addr, align 8
  ret i8* %11
}

define internal noundef nonnull align 8 i8* @whiles(i32 noundef %n) #1 {
entry:
  %p.addr = alloca i8*, align 8
  %s.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds i8, i8* bitcast ({ i64, [11 x i8] }* @.str.1 to i8*), i64 8
  %1 = call i8* @strdup(i8* %0)
  store i8* %1, i8** %p.addr, align 8
  %2 = load i8*, i8** %p.addr, align 8
  %3 = icmp eq i8* %2, null
  br i1 %3, label %if.then, label %if.end

if.then:
  ret i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*)

if.end:
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp slt i32 %4, %n
  br i1 %5, label %while.body, label %while.end

while.body:
  %6 = load i8*, i8** %p.addr, align 8
  %7 = call i8* @nish.ffi.str(i8* %6)
  store i8* %7, i8** %s.addr, align 8
  %8 = load i32, i32* %i.addr, align 4
  %9 = add nsw i32 %8, 1
  store i32 %9, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %10 = load i8*, i8** %p.addr, align 8
  call void @free(i8* %10)
  %11 = load i8*, i8** %s.addr, align 8
  ret i8* %11
}

define internal noundef nonnull align 8 i8* @does(i32 noundef %n) #1 {
entry:
  %p.addr = alloca i8*, align 8
  %s.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds i8, i8* bitcast ({ i64, [11 x i8] }* @.str.1 to i8*), i64 8
  %1 = call i8* @strdup(i8* %0)
  store i8* %1, i8** %p.addr, align 8
  %2 = load i8*, i8** %p.addr, align 8
  %3 = icmp eq i8* %2, null
  br i1 %3, label %if.then, label %if.end

if.then:
  ret i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*)

if.end:
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %do.body

do.body:
  %4 = load i8*, i8** %p.addr, align 8
  %5 = call i8* @nish.ffi.str(i8* %4)
  store i8* %5, i8** %s.addr, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 1)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %8, i32* %i.addr, align 4
  br label %do.cond

do.cond:
  %10 = load i32, i32* %i.addr, align 4
  %11 = icmp slt i32 %10, %n
  br i1 %11, label %do.body, label %do.end

do.end:
  %12 = load i8*, i8** %p.addr, align 8
  call void @free(i8* %12)
  %13 = load i8*, i8** %s.addr, align 8
  ret i8* %13

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 i8* @ofs(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %p.addr = alloca i8*, align 8
  %s.addr = alloca i8*, align 8
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %0 = getelementptr inbounds i8, i8* bitcast ({ i64, [11 x i8] }* @.str.1 to i8*), i64 8
  %1 = call i8* @strdup(i8* %0)
  store i8* %1, i8** %p.addr, align 8
  %2 = load i8*, i8** %p.addr, align 8
  %3 = icmp eq i8* %2, null
  br i1 %3, label %if.then, label %if.end

if.then:
  ret i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*)

if.end:
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %4 = load i64, i64* %forof.idx, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = icmp ult i64 %4, %6
  br i1 %7, label %forof.body, label %forof.end

forof.body:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %10 = bitcast i8* %9 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %4
  %12 = load i32, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store i32 %12, i32* %x.addr, align 4
  %13 = load i32, i32* %x.addr, align 4
  %14 = icmp sgt i32 %13, 0
  br i1 %14, label %if.then.1, label %if.end.1

if.then.1:
  %15 = load i8*, i8** %p.addr, align 8
  %16 = call i8* @nish.ffi.str(i8* %15)
  store i8* %16, i8** %s.addr, align 8
  br label %if.end.1

if.end.1:
  br label %forof.inc

forof.inc:
  %17 = load i64, i64* %forof.idx, align 8
  %18 = add i64 %17, 1
  store i64 %18, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %19 = load i8*, i8** %p.addr, align 8
  call void @free(i8* %19)
  %20 = load i8*, i8** %s.addr, align 8
  ret i8* %20
}

define internal noundef nonnull align 8 i8* @nested(i32 noundef %n) #1 {
entry:
  %p.addr = alloca i8*, align 8
  %s.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %0 = getelementptr inbounds i8, i8* bitcast ({ i64, [11 x i8] }* @.str.1 to i8*), i64 8
  %1 = call i8* @strdup(i8* %0)
  store i8* %1, i8** %p.addr, align 8
  %2 = load i8*, i8** %p.addr, align 8
  %3 = icmp eq i8* %2, null
  br i1 %3, label %if.then, label %if.end

if.then:
  ret i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*)

if.end:
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = icmp slt i32 %4, %n
  br i1 %5, label %for.body, label %for.end

for.body:
  store i32 0, i32* %j.addr, align 4
  br label %for.cond.1

for.cond.1:
  %6 = load i32, i32* %j.addr, align 4
  %7 = icmp slt i32 %6, %n
  br i1 %7, label %for.body.1, label %for.end.1

for.body.1:
  %8 = load i8*, i8** %p.addr, align 8
  %9 = call i8* @nish.ffi.str(i8* %8)
  store i8* %9, i8** %s.addr, align 8
  br label %for.inc.1

for.inc.1:
  %10 = load i32, i32* %j.addr, align 4
  %11 = add nsw i32 %10, 1
  store i32 %11, i32* %j.addr, align 4
  br label %for.cond.1

for.end.1:
  br label %for.inc

for.inc:
  %12 = load i32, i32* %i.addr, align 4
  %13 = add nsw i32 %12, 1
  store i32 %13, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %14 = load i8*, i8** %p.addr, align 8
  call void @free(i8* %14)
  %15 = load i8*, i8** %s.addr, align 8
  ret i8* %15
}

define internal noundef nonnull align 8 i8* @findWhile(i32 noundef %n) #1 {
entry:
  %i.addr = alloca i32, align 4
  %p.addr = alloca i8*, align 8
  %s.addr = alloca i8*, align 8
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = call i8* @nish_str_from_i32(i32 %2)
  %4 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.3 to i8*), i8* %3)
  %5 = call i64 @nish_str_index_of(i8* %4, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %6 = icmp sge i64 %5, 0
  br i1 %6, label %ffi.nul, label %ffi.ok

ffi.nul:
  call void @nish_panic(i8* bitcast ({ i64, [87 x i8] }* @.str.5 to i8*))
  unreachable

ffi.ok:
  %7 = getelementptr inbounds i8, i8* %4, i64 8
  %8 = call i8* @strdup(i8* %7)
  store i8* %8, i8** %p.addr, align 8
  %9 = load i8*, i8** %p.addr, align 8
  %10 = icmp ne i8* %9, null
  br i1 %10, label %land.rhs, label %land.end

land.rhs:
  %11 = load i32, i32* %i.addr, align 4
  %12 = icmp eq i32 %11, 3
  br label %land.end

land.end:
  %13 = phi i1 [ false, %ffi.ok ], [ %12, %land.rhs ]
  br i1 %13, label %if.then, label %if.end

if.then:
  %14 = load i8*, i8** %p.addr, align 8
  %15 = call i8* @nish.ffi.str(i8* %14)
  store i8* %15, i8** %s.addr, align 8
  %16 = load i8*, i8** %p.addr, align 8
  call void @free(i8* %16)
  %17 = load i8*, i8** %s.addr, align 8
  ret i8* %17

if.end:
  %18 = load i8*, i8** %p.addr, align 8
  %19 = icmp ne i8* %18, null
  br i1 %19, label %if.then.1, label %if.end.1

if.then.1:
  %20 = load i8*, i8** %p.addr, align 8
  call void @free(i8* %20)
  br label %if.end.1

if.end.1:
  %21 = load i32, i32* %i.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %i.addr, align 4
  br label %while.cond

while.end:
  ret i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*)
}

define internal noundef nonnull align 8 i8* @findDo(i32 noundef %n) #1 {
entry:
  %i.addr = alloca i32, align 4
  %p.addr = alloca i8*, align 8
  %s.addr = alloca i8*, align 8
  store i32 0, i32* %i.addr, align 4
  br label %do.body

do.body:
  %0 = load i32, i32* %i.addr, align 4
  %1 = call i8* @nish_str_from_i32(i32 %0)
  %2 = call i8* @nish_str_concat(i8* bitcast ({ i64, [4 x i8] }* @.str.6 to i8*), i8* %1)
  %3 = call i64 @nish_str_index_of(i8* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %4 = icmp sge i64 %3, 0
  br i1 %4, label %ffi.nul, label %ffi.ok

ffi.nul:
  call void @nish_panic(i8* bitcast ({ i64, [87 x i8] }* @.str.5 to i8*))
  unreachable

ffi.ok:
  %5 = getelementptr inbounds i8, i8* %2, i64 8
  %6 = call i8* @strdup(i8* %5)
  store i8* %6, i8** %p.addr, align 8
  %7 = load i8*, i8** %p.addr, align 8
  %8 = icmp ne i8* %7, null
  br i1 %8, label %land.rhs, label %land.end

land.rhs:
  %9 = load i32, i32* %i.addr, align 4
  %10 = icmp eq i32 %9, 4
  br label %land.end

land.end:
  %11 = phi i1 [ false, %ffi.ok ], [ %10, %land.rhs ]
  br i1 %11, label %if.then, label %if.end

if.then:
  %12 = load i8*, i8** %p.addr, align 8
  %13 = call i8* @nish.ffi.str(i8* %12)
  store i8* %13, i8** %s.addr, align 8
  %14 = load i8*, i8** %p.addr, align 8
  call void @free(i8* %14)
  %15 = load i8*, i8** %s.addr, align 8
  ret i8* %15

if.end:
  %16 = load i8*, i8** %p.addr, align 8
  %17 = icmp ne i8* %16, null
  br i1 %17, label %if.then.1, label %if.end.1

if.then.1:
  %18 = load i8*, i8** %p.addr, align 8
  call void @free(i8* %18)
  br label %if.end.1

if.end.1:
  %19 = load i32, i32* %i.addr, align 4
  %20 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %19, i32 1)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %21, i32* %i.addr, align 4
  br label %do.cond

do.cond:
  %23 = load i32, i32* %i.addr, align 4
  %24 = icmp slt i32 %23, %n
  br i1 %24, label %do.body, label %do.end

do.end:
  ret i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*)

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 i8* @findOf(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %p.addr = alloca i8*, align 8
  %s.addr = alloca i8*, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 %0
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store i32 %8, i32* %x.addr, align 4
  %9 = load i32, i32* %x.addr, align 4
  %10 = call i8* @nish_str_from_i32(i32 %9)
  %11 = call i8* @nish_str_concat(i8* bitcast ({ i64, [4 x i8] }* @.str.7 to i8*), i8* %10)
  %12 = call i64 @nish_str_index_of(i8* %11, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %13 = icmp sge i64 %12, 0
  br i1 %13, label %ffi.nul, label %ffi.ok

ffi.nul:
  call void @nish_panic(i8* bitcast ({ i64, [87 x i8] }* @.str.5 to i8*))
  unreachable

ffi.ok:
  %14 = getelementptr inbounds i8, i8* %11, i64 8
  %15 = call i8* @strdup(i8* %14)
  store i8* %15, i8** %p.addr, align 8
  %16 = load i8*, i8** %p.addr, align 8
  %17 = icmp ne i8* %16, null
  br i1 %17, label %land.rhs, label %land.end

land.rhs:
  %18 = load i32, i32* %x.addr, align 4
  %19 = icmp sgt i32 %18, 7
  br label %land.end

land.end:
  %20 = phi i1 [ false, %ffi.ok ], [ %19, %land.rhs ]
  br i1 %20, label %if.then, label %if.end

if.then:
  %21 = load i8*, i8** %p.addr, align 8
  %22 = call i8* @nish.ffi.str(i8* %21)
  store i8* %22, i8** %s.addr, align 8
  %23 = load i8*, i8** %p.addr, align 8
  call void @free(i8* %23)
  %24 = load i8*, i8** %s.addr, align 8
  ret i8* %24

if.end:
  %25 = load i8*, i8** %p.addr, align 8
  %26 = icmp ne i8* %25, null
  br i1 %26, label %if.then.1, label %if.end.1

if.then.1:
  %27 = load i8*, i8** %p.addr, align 8
  call void @free(i8* %27)
  br label %if.end.1

if.end.1:
  br label %forof.inc

forof.inc:
  %28 = load i64, i64* %forof.idx, align 8
  %29 = add i64 %28, 1
  store i64 %29, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  ret i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*)
}

define internal noundef nonnull align 8 i8* @findNested(i32 noundef %n) #1 {
entry:
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %p.addr = alloca i8*, align 8
  %s.addr = alloca i8*, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  store i32 0, i32* %j.addr, align 4
  br label %for.cond.1

for.cond.1:
  %2 = load i32, i32* %j.addr, align 4
  %3 = icmp slt i32 %2, %n
  br i1 %3, label %for.body.1, label %for.end.1

for.body.1:
  %4 = load i32, i32* %i.addr, align 4
  %5 = call i8* @nish_str_from_i32(i32 %4)
  %6 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.8 to i8*), i8* %5)
  %7 = call i8* @nish_str_concat(i8* %6, i8* bitcast ({ i64, [2 x i8] }* @.str.9 to i8*))
  %8 = load i32, i32* %j.addr, align 4
  %9 = call i8* @nish_str_from_i32(i32 %8)
  %10 = call i8* @nish_str_concat(i8* %7, i8* %9)
  %11 = call i64 @nish_str_index_of(i8* %10, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %12 = icmp sge i64 %11, 0
  br i1 %12, label %ffi.nul, label %ffi.ok

ffi.nul:
  call void @nish_panic(i8* bitcast ({ i64, [87 x i8] }* @.str.5 to i8*))
  unreachable

ffi.ok:
  %13 = getelementptr inbounds i8, i8* %10, i64 8
  %14 = call i8* @strdup(i8* %13)
  store i8* %14, i8** %p.addr, align 8
  %15 = load i8*, i8** %p.addr, align 8
  %16 = icmp ne i8* %15, null
  br i1 %16, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %17 = load i32, i32* %i.addr, align 4
  %18 = icmp eq i32 %17, 2
  br label %land.end.1

land.end.1:
  %19 = phi i1 [ false, %ffi.ok ], [ %18, %land.rhs.1 ]
  br i1 %19, label %land.rhs, label %land.end

land.rhs:
  %20 = load i32, i32* %j.addr, align 4
  %21 = icmp eq i32 %20, 1
  br label %land.end

land.end:
  %22 = phi i1 [ false, %land.end.1 ], [ %21, %land.rhs ]
  br i1 %22, label %if.then, label %if.end

if.then:
  %23 = load i8*, i8** %p.addr, align 8
  %24 = call i8* @nish.ffi.str(i8* %23)
  store i8* %24, i8** %s.addr, align 8
  %25 = load i8*, i8** %p.addr, align 8
  call void @free(i8* %25)
  %26 = load i8*, i8** %s.addr, align 8
  ret i8* %26

if.end:
  %27 = load i8*, i8** %p.addr, align 8
  %28 = icmp ne i8* %27, null
  br i1 %28, label %if.then.1, label %if.end.1

if.then.1:
  %29 = load i8*, i8** %p.addr, align 8
  call void @free(i8* %29)
  br label %if.end.1

if.end.1:
  br label %for.inc.1

for.inc.1:
  %30 = load i32, i32* %j.addr, align 4
  %31 = add nsw i32 %30, 1
  store i32 %31, i32* %j.addr, align 4
  br label %for.cond.1

for.end.1:
  br label %for.inc

for.inc:
  %32 = load i32, i32* %i.addr, align 4
  %33 = add nsw i32 %32, 1
  store i32 %33, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*)
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @into(i32 noundef %n) #1 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %p.addr = alloca i8*, align 8
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
  %7 = load i32, i32* %i.addr, align 4
  %8 = call i8* @nish_str_from_i32(i32 %7)
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.10 to i8*), i8* %8)
  %10 = call i64 @nish_str_index_of(i8* %9, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %11 = icmp sge i64 %10, 0
  br i1 %11, label %ffi.nul, label %ffi.ok

ffi.nul:
  call void @nish_panic(i8* bitcast ({ i64, [87 x i8] }* @.str.5 to i8*))
  unreachable

ffi.ok:
  %12 = getelementptr inbounds i8, i8* %9, i64 8
  %13 = call i8* @strdup(i8* %12)
  store i8* %13, i8** %p.addr, align 8
  %14 = load i8*, i8** %p.addr, align 8
  %15 = icmp ne i8* %14, null
  br i1 %15, label %if.then, label %if.end

if.then:
  %16 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %17 = load i8*, i8** %p.addr, align 8
  %18 = call i8* @nish.ffi.str(i8* %17)
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 1
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %23 = icmp eq i64 %20, %22
  br i1 %23, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %16, i64 8)
  br label %push.store

push.store:
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  %25 = load i8*, i8** %24, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %26 = bitcast i8* %25 to i8**
  %27 = getelementptr inbounds i8*, i8** %26, i64 %20
  store i8* %18, i8** %27, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %28 = add i64 %20, 1
  store i64 %28, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = trunc i64 %28 to i32
  %30 = load i8*, i8** %p.addr, align 8
  call void @free(i8* %30)
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %31 = load i32, i32* %i.addr, align 4
  %32 = add nsw i32 %31, 1
  store i32 %32, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %33 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %33
}

define internal noundef nonnull align 8 i8* @owned(i8* noundef nonnull noalias readonly align 8 %s) #1 {
entry:
  %p.addr = alloca i8*, align 8
  %copy.addr = alloca i8*, align 8
  %0 = call i64 @nish_str_index_of(i8* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %1 = icmp sge i64 %0, 0
  br i1 %1, label %ffi.nul, label %ffi.ok

ffi.nul:
  call void @nish_panic(i8* bitcast ({ i64, [87 x i8] }* @.str.5 to i8*))
  unreachable

ffi.ok:
  %2 = getelementptr inbounds i8, i8* %s, i64 8
  %3 = call i8* @strdup(i8* %2)
  store i8* %3, i8** %p.addr, align 8
  %4 = load i8*, i8** %p.addr, align 8
  %5 = icmp eq i8* %4, null
  br i1 %5, label %if.then, label %if.end

if.then:
  ret i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*)

if.end:
  %6 = load i8*, i8** %p.addr, align 8
  %7 = call i8* @nish.ffi.str(i8* %6)
  store i8* %7, i8** %copy.addr, align 8
  %8 = load i8*, i8** %p.addr, align 8
  call void @free(i8* %8)
  %9 = load i8*, i8** %copy.addr, align 8
  ret i8* %9
}

define internal noundef nonnull align 8 i8* @here() #1 {
entry:
  %p.addr = alloca i8*, align 8
  %path.addr = alloca i8*, align 8
  %0 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.11 to i8*), i64 8
  %1 = call i8* @realpath(i8* %0, i8* null)
  store i8* %1, i8** %p.addr, align 8
  %2 = load i8*, i8** %p.addr, align 8
  %3 = icmp eq i8* %2, null
  br i1 %3, label %if.then, label %if.end

if.then:
  ret i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*)

if.end:
  %4 = load i8*, i8** %p.addr, align 8
  %5 = call i8* @nish.ffi.str(i8* %4)
  store i8* %5, i8** %path.addr, align 8
  %6 = load i8*, i8** %p.addr, align 8
  call void @free(i8* %6)
  %7 = load i8*, i8** %path.addr, align 8
  ret i8* %7
}

define noundef i32 @nish_main() #1 {
entry:
  %a.addr = alloca i8*, align 8
  %b.addr = alloca i8*, align 8
  %e.addr = alloca i8*, align 8
  %f.addr = alloca i8*, align 8
  %g.addr = alloca i8*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %h.addr = alloca i8*, align 8
  %k.addr = alloca i8*, align 8
  %d.addr = alloca i8*, align 8
  %w.addr = alloca i8*, align 8
  %x.addr = alloca i8*, align 8
  %y.addr = alloca i8*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [4 x i32], align 8
  %z.addr = alloca i8*, align 8
  %o.addr = alloca %struct.nish_array*, align 8
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @find(i32 9)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  store i8* %2, i8** %a.addr, align 8
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @last(i32 3)
  %5 = call i8* @nish_arena_keep(i64 %3, i8* %4)
  store i8* %5, i8** %b.addr, align 8
  %6 = call i64 @nish_arena_mark()
  %7 = call i8* @whiles(i32 5)
  %8 = call i8* @nish_arena_keep(i64 %6, i8* %7)
  store i8* %8, i8** %e.addr, align 8
  %9 = call i64 @nish_arena_mark()
  %10 = call i8* @does(i32 6)
  %11 = call i8* @nish_arena_keep(i64 %9, i8* %10)
  store i8* %11, i8** %f.addr, align 8
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %14 = bitcast [2 x i32]* %arr.data to i8*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %16 = bitcast i8* %14 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 0
  store i32 7, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %18 = getelementptr inbounds i32, i32* %16, i64 1
  store i32 8, i32* %18, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %19 = call i64 @nish_arena_mark()
  %20 = call i8* @ofs(%struct.nish_array* %arr.hdr)
  %21 = call i8* @nish_arena_keep(i64 %19, i8* %20)
  store i8* %21, i8** %g.addr, align 8
  %22 = call i64 @nish_arena_mark()
  %23 = call i8* @nested(i32 4)
  %24 = call i8* @nish_arena_keep(i64 %22, i8* %23)
  store i8* %24, i8** %h.addr, align 8
  %25 = call i64 @nish_arena_mark()
  %26 = call i8* @owned(i8* bitcast ({ i64, [6 x i8] }* @.str.12 to i8*))
  %27 = call i8* @nish_arena_keep(i64 %25, i8* %26)
  store i8* %27, i8** %k.addr, align 8
  %28 = call i64 @nish_arena_mark()
  %29 = call i8* @here()
  %30 = call i8* @nish_arena_keep(i64 %28, i8* %29)
  store i8* %30, i8** %d.addr, align 8
  %31 = call i64 @nish_arena_mark()
  %32 = call i8* @findWhile(i32 9)
  %33 = call i8* @nish_arena_keep(i64 %31, i8* %32)
  store i8* %33, i8** %w.addr, align 8
  %34 = call i64 @nish_arena_mark()
  %35 = call i8* @findDo(i32 9)
  %36 = call i8* @nish_arena_keep(i64 %34, i8* %35)
  store i8* %36, i8** %x.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 4, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 4, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %39 = bitcast [4 x i32]* %arr.data.1 to i8*
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %39, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %41 = bitcast i8* %39 to i32*
  %42 = getelementptr inbounds i32, i32* %41, i64 0
  store i32 5, i32* %42, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %43 = getelementptr inbounds i32, i32* %41, i64 1
  store i32 6, i32* %43, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %44 = getelementptr inbounds i32, i32* %41, i64 2
  store i32 8, i32* %44, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %45 = getelementptr inbounds i32, i32* %41, i64 3
  store i32 9, i32* %45, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %46 = call i64 @nish_arena_mark()
  %47 = call i8* @findOf(%struct.nish_array* %arr.hdr.1)
  %48 = call i8* @nish_arena_keep(i64 %46, i8* %47)
  store i8* %48, i8** %y.addr, align 8
  %49 = call i64 @nish_arena_mark()
  %50 = call i8* @findNested(i32 4)
  %51 = call i8* @nish_arena_keep(i64 %49, i8* %50)
  store i8* %51, i8** %z.addr, align 8
  %52 = call %struct.nish_array* @into(i32 3)
  store %struct.nish_array* %52, %struct.nish_array** %o.addr, align 8
  %53 = call i32 @churn()
  %54 = icmp sgt i32 %53, 0
  %55 = select i1 %54, i8* bitcast ({ i64, [5 x i8] }* @.str.13 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.14 to i8*)
  call void @nish_print(i8* %55)
  %56 = load i8*, i8** %a.addr, align 8
  call void @nish_print(i8* %56)
  %57 = load i8*, i8** %b.addr, align 8
  call void @nish_print(i8* %57)
  %58 = load i8*, i8** %e.addr, align 8
  call void @nish_print(i8* %58)
  %59 = load i8*, i8** %f.addr, align 8
  call void @nish_print(i8* %59)
  %60 = load i8*, i8** %g.addr, align 8
  call void @nish_print(i8* %60)
  %61 = load i8*, i8** %h.addr, align 8
  call void @nish_print(i8* %61)
  %62 = load i8*, i8** %k.addr, align 8
  %63 = call i8* @nish_str_concat(i8* %62, i8* bitcast ({ i64, [2 x i8] }* @.str.9 to i8*))
  %64 = load i8*, i8** %k.addr, align 8
  %65 = bitcast i8* %64 to i64*
  %66 = load i64, i64* %65, align 8
  %67 = trunc i64 %66 to i32
  %68 = call i8* @nish_str_from_i32(i32 %67)
  %69 = call i8* @nish_str_concat(i8* %63, i8* %68)
  call void @nish_print(i8* %69)
  %70 = load i8*, i8** %d.addr, align 8
  %71 = call zeroext i1 @nish_str_at(i8* %70, i64 0, i8* bitcast ({ i64, [2 x i8] }* @.str.15 to i8*))
  %72 = select i1 %71, i8* bitcast ({ i64, [5 x i8] }* @.str.13 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.14 to i8*)
  %73 = call i8* @nish_str_concat(i8* %72, i8* bitcast ({ i64, [2 x i8] }* @.str.9 to i8*))
  %74 = load i8*, i8** %d.addr, align 8
  %75 = bitcast i8* %74 to i64*
  %76 = load i64, i64* %75, align 8
  %77 = trunc i64 %76 to i32
  %78 = icmp sgt i32 %77, 1
  %79 = select i1 %78, i8* bitcast ({ i64, [5 x i8] }* @.str.13 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.14 to i8*)
  %80 = call i8* @nish_str_concat(i8* %73, i8* %79)
  call void @nish_print(i8* %80)
  %81 = load i8*, i8** %w.addr, align 8
  call void @nish_print(i8* %81)
  %82 = load i8*, i8** %x.addr, align 8
  call void @nish_print(i8* %82)
  %83 = load i8*, i8** %y.addr, align 8
  call void @nish_print(i8* %83)
  %84 = load i8*, i8** %z.addr, align 8
  call void @nish_print(i8* %84)
  %85 = load %struct.nish_array*, %struct.nish_array** %o.addr, align 8
  %86 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %85, i64 0, i32 0
  %87 = load i64, i64* %86, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %88 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.16 to i8*) to i64*
  %89 = load i64, i64* %88, align 8
  %90 = sub i64 %87, 1
  %91 = mul i64 %89, %90
  %92 = icmp eq i64 %87, 0
  %93 = select i1 %92, i64 0, i64 %91
  store i64 %93, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %94 = load i64, i64* %join.at, align 8
  %95 = icmp ult i64 %94, %87
  br i1 %95, label %join.sum.body, label %join.copy

join.sum.body:
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %85, i64 0, i32 2
  %97 = load i8*, i8** %96, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %98 = bitcast i8* %97 to i8**
  %99 = getelementptr inbounds i8*, i8** %98, i64 %94
  %100 = load i8*, i8** %99, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %101 = load i64, i64* %join.total, align 8
  %102 = bitcast i8* %100 to i64*
  %103 = load i64, i64* %102, align 8
  %104 = add i64 %101, %103
  store i64 %104, i64* %join.total, align 8
  %105 = add i64 %94, 1
  store i64 %105, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %106 = load i64, i64* %join.total, align 8
  %107 = icmp ugt i64 %106, 2147483647
  %108 = add i64 %106, 9
  %109 = select i1 %107, i64 4611686018427387904, i64 %108
  %110 = call i8* @nish_alloc_struct(i64 %109)
  %111 = bitcast i8* %110 to i64*
  store i64 %106, i64* %111, align 8
  %112 = getelementptr inbounds i8, i8* %110, i64 8
  store i8* %112, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %113 = load i64, i64* %join.at, align 8
  %114 = icmp ult i64 %113, %87
  br i1 %114, label %join.part, label %join.end

join.part:
  %115 = load i8*, i8** %join.p, align 8
  %116 = icmp eq i64 %113, 0
  %117 = select i1 %116, i64 0, i64 %89
  %118 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.16 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %115, i8* %118, i64 %117, i1 false)
  %119 = getelementptr inbounds i8, i8* %115, i64 %117
  %120 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %85, i64 0, i32 2
  %121 = load i8*, i8** %120, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %122 = bitcast i8* %121 to i8**
  %123 = getelementptr inbounds i8*, i8** %122, i64 %113
  %124 = load i8*, i8** %123, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %125 = bitcast i8* %124 to i64*
  %126 = load i64, i64* %125, align 8
  %127 = getelementptr inbounds i8, i8* %124, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %119, i8* %127, i64 %126, i1 false)
  %128 = getelementptr inbounds i8, i8* %119, i64 %126
  store i8* %128, i8** %join.p, align 8
  %129 = add i64 %113, 1
  store i64 %129, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %130 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %130, align 1
  call void @nish_print(i8* %110)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind willreturn memory(argmem: read) }
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

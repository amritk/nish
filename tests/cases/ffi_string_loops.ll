%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [75 x i8] } { i64 74, [75 x i8] c"`strerror` returned NULL for a `string` result; declare it `string | null`\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"none\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"HOME\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"unset\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"set\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"|\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare i8* @strerror(i32)
declare i8* @getenv(i8*)
declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

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
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = icmp eq i32 %2, 2
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = load i32, i32* %i.addr, align 4
  %5 = call i8* @strerror(i32 %4)
  %6 = icmp eq i8* %5, null
  br i1 %6, label %ffi.null, label %ffi.copy

ffi.null:
  call void @nish_panic(i8* bitcast ({ i64, [75 x i8] }* @.str.1 to i8*))
  unreachable

ffi.copy:
  %7 = call i8* @nish.ffi.str(i8* %5)
  ret i8* %7

if.end:
  br label %for.inc

for.inc:
  %8 = load i32, i32* %i.addr, align 4
  %9 = add nsw i32 %8, 1
  store i32 %9, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*)
}

define internal noundef nonnull align 8 i8* @last(i32 noundef %n) #1 {
entry:
  %s.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = call i8* @strerror(i32 %2)
  %4 = icmp eq i8* %3, null
  br i1 %4, label %ffi.null, label %ffi.copy

ffi.null:
  call void @nish_panic(i8* bitcast ({ i64, [75 x i8] }* @.str.1 to i8*))
  unreachable

ffi.copy:
  %5 = call i8* @nish.ffi.str(i8* %3)
  store i8* %5, i8** %s.addr, align 8
  br label %for.inc

for.inc:
  %6 = load i32, i32* %i.addr, align 4
  %7 = add nsw i32 %6, 1
  store i32 %7, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %8 = load i8*, i8** %s.addr, align 8
  ret i8* %8
}

define internal noundef nonnull align 8 i8* @whiles(i32 noundef %n) #1 {
entry:
  %s.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = call i8* @strerror(i32 %2)
  %4 = icmp eq i8* %3, null
  br i1 %4, label %ffi.null, label %ffi.copy

ffi.null:
  call void @nish_panic(i8* bitcast ({ i64, [75 x i8] }* @.str.1 to i8*))
  unreachable

ffi.copy:
  %5 = call i8* @nish.ffi.str(i8* %3)
  store i8* %5, i8** %s.addr, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = add nsw i32 %6, 1
  store i32 %7, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %8 = load i8*, i8** %s.addr, align 8
  ret i8* %8
}

define internal noundef nonnull align 8 i8* @does(i32 noundef %n) #1 {
entry:
  %s.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %do.body

do.body:
  %0 = load i32, i32* %i.addr, align 4
  %1 = call i8* @strerror(i32 %0)
  %2 = icmp eq i8* %1, null
  br i1 %2, label %ffi.null, label %ffi.copy

ffi.null:
  call void @nish_panic(i8* bitcast ({ i64, [75 x i8] }* @.str.1 to i8*))
  unreachable

ffi.copy:
  %3 = call i8* @nish.ffi.str(i8* %1)
  store i8* %3, i8** %s.addr, align 8
  %4 = load i32, i32* %i.addr, align 4
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %4, i32 1)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %6, i32* %i.addr, align 4
  br label %do.cond

do.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = icmp slt i32 %8, %n
  br i1 %9, label %do.body, label %do.end

do.end:
  %10 = load i8*, i8** %s.addr, align 8
  ret i8* %10

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 i8* @ofs(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %s.addr = alloca i8*, align 8
  %x.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
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
  %10 = call i8* @strerror(i32 %9)
  %11 = icmp eq i8* %10, null
  br i1 %11, label %ffi.null, label %ffi.copy

ffi.null:
  call void @nish_panic(i8* bitcast ({ i64, [75 x i8] }* @.str.1 to i8*))
  unreachable

ffi.copy:
  %12 = call i8* @nish.ffi.str(i8* %10)
  store i8* %12, i8** %s.addr, align 8
  br label %forof.inc

forof.inc:
  %13 = load i64, i64* %forof.idx, align 8
  %14 = add i64 %13, 1
  store i64 %14, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %15 = load i8*, i8** %s.addr, align 8
  ret i8* %15
}

define internal noundef nonnull align 8 i8* @nested(i32 noundef %n) #1 {
entry:
  %s.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
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
  %5 = load i32, i32* %j.addr, align 4
  %6 = add nsw i32 %4, %5
  %7 = call i8* @strerror(i32 %6)
  %8 = icmp eq i8* %7, null
  br i1 %8, label %ffi.null, label %ffi.copy

ffi.null:
  call void @nish_panic(i8* bitcast ({ i64, [75 x i8] }* @.str.1 to i8*))
  unreachable

ffi.copy:
  %9 = call i8* @nish.ffi.str(i8* %7)
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
  %14 = load i8*, i8** %s.addr, align 8
  ret i8* %14
}

define internal noundef align 8 i8* @nullable(i32 noundef %n) #1 {
entry:
  %s.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  store i8* null, i8** %s.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds i8, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i64 8
  %3 = call i8* @getenv(i8* %2)
  %4 = icmp eq i8* %3, null
  br i1 %4, label %ffi.none, label %ffi.copy

ffi.copy:
  %5 = call i8* @nish.ffi.str(i8* %3)
  br label %ffi.join

ffi.none:
  br label %ffi.join

ffi.join:
  %6 = phi i8* [ %5, %ffi.copy ], [ null, %ffi.none ]
  store i8* %6, i8** %s.addr, align 8
  br label %for.inc

for.inc:
  %7 = load i32, i32* %i.addr, align 4
  %8 = add nsw i32 %7, 1
  store i32 %8, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %9 = load i8*, i8** %s.addr, align 8
  ret i8* %9
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @into(i32 noundef %n) #1 {
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
  %9 = call i8* @strerror(i32 %8)
  %10 = icmp eq i8* %9, null
  br i1 %10, label %ffi.null, label %ffi.copy

ffi.null:
  call void @nish_panic(i8* bitcast ({ i64, [75 x i8] }* @.str.1 to i8*))
  unreachable

ffi.copy:
  %11 = call i8* @nish.ffi.str(i8* %9)
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  %15 = load i64, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %16 = icmp eq i64 %13, %15
  br i1 %16, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %7, i64 8)
  br label %push.store

push.store:
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %19 = bitcast i8* %18 to i8**
  %20 = getelementptr inbounds i8*, i8** %19, i64 %13
  store i8* %11, i8** %20, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %21 = add i64 %13, 1
  store i64 %21, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = trunc i64 %21 to i32
  br label %for.inc

for.inc:
  %23 = load i32, i32* %i.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %25 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %25
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
  %m.addr = alloca i8*, align 8
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
  %23 = call i8* @nested(i32 6)
  %24 = call i8* @nish_arena_keep(i64 %22, i8* %23)
  store i8* %24, i8** %h.addr, align 8
  %25 = call i8* @nullable(i32 2)
  store i8* %25, i8** %k.addr, align 8
  %26 = call i64 @nish_arena_mark()
  %27 = call i8* @err$fn.8.strerror(i32 12)
  %28 = call i8* @nish_arena_keep(i64 %26, i8* %27)
  store i8* %28, i8** %m.addr, align 8
  %29 = call %struct.nish_array* @into(i32 3)
  store %struct.nish_array* %29, %struct.nish_array** %o.addr, align 8
  %30 = call i32 @churn()
  %31 = icmp sgt i32 %30, 0
  %32 = select i1 %31, i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*)
  call void @nish_print(i8* %32)
  %33 = load i8*, i8** %a.addr, align 8
  call void @nish_print(i8* %33)
  %34 = load i8*, i8** %b.addr, align 8
  call void @nish_print(i8* %34)
  %35 = load i8*, i8** %e.addr, align 8
  call void @nish_print(i8* %35)
  %36 = load i8*, i8** %f.addr, align 8
  call void @nish_print(i8* %36)
  %37 = load i8*, i8** %g.addr, align 8
  call void @nish_print(i8* %37)
  %38 = load i8*, i8** %h.addr, align 8
  call void @nish_print(i8* %38)
  %39 = load i8*, i8** %k.addr, align 8
  %40 = icmp eq i8* %39, null
  br i1 %40, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %41 = phi i8* [ bitcast ({ i64, [6 x i8] }* @.str.6 to i8*), %cond.true ], [ bitcast ({ i64, [4 x i8] }* @.str.7 to i8*), %cond.false ]
  call void @nish_print(i8* %41)
  %42 = load i8*, i8** %m.addr, align 8
  call void @nish_print(i8* %42)
  %43 = load %struct.nish_array*, %struct.nish_array** %o.addr, align 8
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 0
  %45 = load i64, i64* %44, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %46 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*) to i64*
  %47 = load i64, i64* %46, align 8
  %48 = sub i64 %45, 1
  %49 = mul i64 %47, %48
  %50 = icmp eq i64 %45, 0
  %51 = select i1 %50, i64 0, i64 %49
  store i64 %51, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %52 = load i64, i64* %join.at, align 8
  %53 = icmp ult i64 %52, %45
  br i1 %53, label %join.sum.body, label %join.copy

join.sum.body:
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 2
  %55 = load i8*, i8** %54, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %56 = bitcast i8* %55 to i8**
  %57 = getelementptr inbounds i8*, i8** %56, i64 %52
  %58 = load i8*, i8** %57, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %59 = load i64, i64* %join.total, align 8
  %60 = bitcast i8* %58 to i64*
  %61 = load i64, i64* %60, align 8
  %62 = add i64 %59, %61
  store i64 %62, i64* %join.total, align 8
  %63 = add i64 %52, 1
  store i64 %63, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %64 = load i64, i64* %join.total, align 8
  %65 = icmp ugt i64 %64, 2147483647
  %66 = add i64 %64, 9
  %67 = select i1 %65, i64 4611686018427387904, i64 %66
  %68 = call i8* @nish_alloc_struct(i64 %67)
  %69 = bitcast i8* %68 to i64*
  store i64 %64, i64* %69, align 8
  %70 = getelementptr inbounds i8, i8* %68, i64 8
  store i8* %70, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %71 = load i64, i64* %join.at, align 8
  %72 = icmp ult i64 %71, %45
  br i1 %72, label %join.part, label %join.end

join.part:
  %73 = load i8*, i8** %join.p, align 8
  %74 = icmp eq i64 %71, 0
  %75 = select i1 %74, i64 0, i64 %47
  %76 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %73, i8* %76, i64 %75, i1 false)
  %77 = getelementptr inbounds i8, i8* %73, i64 %75
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 2
  %79 = load i8*, i8** %78, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %80 = bitcast i8* %79 to i8**
  %81 = getelementptr inbounds i8*, i8** %80, i64 %71
  %82 = load i8*, i8** %81, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %83 = bitcast i8* %82 to i64*
  %84 = load i64, i64* %83, align 8
  %85 = getelementptr inbounds i8, i8* %82, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %77, i8* %85, i64 %84, i1 false)
  %86 = getelementptr inbounds i8, i8* %77, i64 %84
  store i8* %86, i8** %join.p, align 8
  %87 = add i64 %71, 1
  store i64 %87, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %88 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %88, align 1
  call void @nish_print(i8* %68)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define internal noundef nonnull align 8 i8* @err$fn.8.strerror(i32 noundef %n) #1 {
entry:
  %s.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = call i8* @strerror(i32 %2)
  %4 = icmp eq i8* %3, null
  br i1 %4, label %ffi.null, label %ffi.copy

ffi.null:
  call void @nish_panic(i8* bitcast ({ i64, [75 x i8] }* @.str.1 to i8*))
  unreachable

ffi.copy:
  %5 = call i8* @nish.ffi.str(i8* %3)
  store i8* %5, i8** %s.addr, align 8
  br label %for.inc

for.inc:
  %6 = load i32, i32* %i.addr, align 4
  %7 = add nsw i32 %6, 1
  store i32 %7, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %8 = load i8*, i8** %s.addr, align 8
  ret i8* %8
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
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

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

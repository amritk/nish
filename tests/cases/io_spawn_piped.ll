%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"cat\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"cat: \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"/bin/cat\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"big: \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"sh\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"-c\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [35 x i8] } { i64 34, [35 x i8] c"printf out; printf err >&2; exit 3\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"split: \00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"/bin/sh\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"printf more\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"appended: \00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"missing: \00" }, align 8
@.str.15 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"nish-no-such-program\00" }, align 8
@.str.16 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"missing path: \00" }, align 8
@.str.17 = private unnamed_addr constant { i64, [23 x i8] } { i64 22, [23 x i8] c"/nonexistent/nish-prog\00" }, align 8
@.str.18 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"unread: \00" }, align 8
@.str.19 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"yes\00" }, align 8
@.str.20 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"flood: \00" }, align 8
@.str.21 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"hunter2-secret\00" }, align 8
@.str.22 = private unnamed_addr constant { i64, [19 x i8] } { i64 18, [19 x i8] c"/proc/self/cmdline\00" }, align 8
@.str.23 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"env\00" }, align 8
@.str.24 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"secret visible: \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #3
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #3
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #3
declare noundef i32 @nish_spawn_piped(%struct.nish_array* noundef nonnull align 8, %struct.nish_array* noundef nonnull align 8 nocapture readonly, %struct.nish_array* noundef nonnull align 8 nocapture, %struct.nish_array* noundef nonnull align 8 nocapture) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #5

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

define internal noundef zeroext i1 @same(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %a, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b) #0 {
entry:
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = icmp ne i32 %2, %5
  br i1 %6, label %if.then, label %if.end

if.then:
  ret i1 false

if.end:
  store i32 0, i32* %i.addr, align 4
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %a, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %15 = load i32, i32* %i.addr, align 4
  %16 = trunc i64 %8 to i32
  %17 = icmp slt i32 %15, %16
  br i1 %17, label %land.rhs, label %land.end

land.rhs:
  %18 = load i32, i32* %i.addr, align 4
  %19 = trunc i64 %12 to i32
  %20 = icmp slt i32 %18, %19
  br label %land.end

land.end:
  %21 = phi i1 [ false, %for.cond ], [ %20, %land.rhs ]
  br i1 %21, label %for.body, label %for.end

for.body:
  %22 = load i32, i32* %i.addr, align 4
  %23 = sext i32 %22 to i64
  %24 = bitcast i8* %10 to i8*
  %25 = getelementptr inbounds i8, i8* %24, i64 %23
  %26 = load i8, i8* %25, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %27 = load i32, i32* %i.addr, align 4
  %28 = sext i32 %27 to i64
  %29 = bitcast i8* %14 to i8*
  %30 = getelementptr inbounds i8, i8* %29, i64 %28
  %31 = load i8, i8* %30, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %32 = icmp ne i8 %26, %31
  br i1 %32, label %if.then.1, label %if.end.1

if.then.1:
  ret i1 false

if.end.1:
  br label %for.inc

for.inc:
  %33 = load i32, i32* %i.addr, align 4
  %34 = add nsw i32 %33, 1
  store i32 %34, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret i1 true
}

define internal noundef zeroext i1 @contains(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hay, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %needle) #1 {
entry:
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %needle, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %needle, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hay, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hay, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = trunc i64 %1 to i32
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %8, i32 %9)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  %13 = trunc i64 %5 to i32
  %14 = icmp sle i32 %11, %13
  br i1 %14, label %for.body, label %for.end

for.body:
  store i32 0, i32* %j.addr, align 4
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %needle, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %needle, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hay, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hay, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %while.cond

while.cond:
  %23 = load i32, i32* %j.addr, align 4
  %24 = trunc i64 %16 to i32
  %25 = icmp slt i32 %23, %24
  br i1 %25, label %land.rhs, label %land.end

land.rhs:
  %26 = load i32, i32* %i.addr, align 4
  %27 = load i32, i32* %j.addr, align 4
  %28 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %26, i32 %27)
  %29 = extractvalue { i32, i1 } %28, 0
  %30 = extractvalue { i32, i1 } %28, 1
  br i1 %30, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %31 = sext i32 %29 to i64
  %32 = icmp ult i64 %31, %20
  br i1 %32, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %31, i64 %20)
  unreachable

bounds.ok:
  %33 = bitcast i8* %22 to i8*
  %34 = getelementptr inbounds i8, i8* %33, i64 %31
  %35 = load i8, i8* %34, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %36 = load i32, i32* %j.addr, align 4
  %37 = sext i32 %36 to i64
  %38 = bitcast i8* %18 to i8*
  %39 = getelementptr inbounds i8, i8* %38, i64 %37
  %40 = load i8, i8* %39, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %41 = icmp eq i8 %35, %40
  br label %land.end

land.end:
  %42 = phi i1 [ false, %while.cond ], [ %41, %bounds.ok ]
  br i1 %42, label %while.body, label %while.end

while.body:
  %43 = load i32, i32* %j.addr, align 4
  %44 = add nsw i32 %43, 1
  store i32 %44, i32* %j.addr, align 4
  br label %while.cond

while.end:
  %45 = load i32, i32* %j.addr, align 4
  %46 = trunc i64 %1 to i32
  %47 = icmp eq i32 %45, %46
  br i1 %47, label %if.then, label %if.end

if.then:
  ret i1 true

if.end:
  br label %for.inc

for.inc:
  %48 = load i32, i32* %i.addr, align 4
  %49 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %48, i32 1)
  %50 = extractvalue { i32, i1 } %49, 0
  %51 = extractvalue { i32, i1 } %49, 1
  br i1 %51, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %50, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret i1 false

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #1 {
entry:
  %all.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %echoed.addr = alloca %struct.nish_array*, align 8
  %quiet.addr = alloca %struct.nish_array*, align 8
  %catStatus.addr = alloca i32, align 4
  %big.addr = alloca %struct.nish_array*, align 8
  %i.addr.1 = alloca i32, align 4
  %back.addr = alloca %struct.nish_array*, align 8
  %bigStatus.addr = alloca i32, align 4
  %none.addr = alloca %struct.nish_array*, align 8
  %out.addr = alloca %struct.nish_array*, align 8
  %err.addr = alloca %struct.nish_array*, align 8
  %split.addr = alloca i32, align 4
  %flood.addr = alloca %struct.nish_array*, align 8
  %floodStatus.addr = alloca i32, align 4
  %secret.addr = alloca %struct.nish_array*, align 8
  %word.addr = alloca i8*, align 8
  %i.addr.2 = alloca i32, align 4
  %seen.addr = alloca %struct.nish_array*, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %1, %struct.nish_array** %all.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp slt i32 %5, 256
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load %struct.nish_array*, %struct.nish_array** %all.addr, align 8
  %8 = load i32, i32* %i.addr, align 4
  %9 = trunc i32 %8 to i8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %14 = icmp eq i64 %11, %13
  br i1 %14, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %7, i64 1)
  br label %push.store

push.store:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %17 = bitcast i8* %16 to i8*
  %18 = getelementptr inbounds i8, i8* %17, i64 %11
  store i8 %9, i8* %18, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %19 = add i64 %11, 1
  store i64 %19, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = trunc i64 %19 to i32
  br label %for.inc

for.inc:
  %21 = load i32, i32* %i.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %23 = call i8* @nish_alloc_struct(i64 24)
  %24 = bitcast i8* %23 to %struct.nish_array*
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  store i64 0, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 1
  store i64 0, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  store i8* null, i8** %27, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %24, %struct.nish_array** %echoed.addr, align 8
  %28 = call i8* @nish_alloc_struct(i64 24)
  %29 = bitcast i8* %28 to %struct.nish_array*
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  store i64 0, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 1
  store i64 0, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  store i8* null, i8** %32, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %29, %struct.nish_array** %quiet.addr, align 8
  %33 = call i8* @nish_alloc_struct(i64 24)
  %34 = bitcast i8* %33 to %struct.nish_array*
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  store i64 1, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 1
  store i64 1, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %37 = call i8* @nish_alloc_struct(i64 8)
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  store i8* %37, i8** %38, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %39 = bitcast i8* %37 to i8**
  %40 = getelementptr inbounds i8*, i8** %39, i64 0
  store i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*), i8** %40, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %41 = load %struct.nish_array*, %struct.nish_array** %all.addr, align 8
  %42 = load %struct.nish_array*, %struct.nish_array** %echoed.addr, align 8
  %43 = load %struct.nish_array*, %struct.nish_array** %quiet.addr, align 8
  %44 = call i32 @nish_spawn_piped(%struct.nish_array* %34, %struct.nish_array* %41, %struct.nish_array* %42, %struct.nish_array* %43)
  store i32 %44, i32* %catStatus.addr, align 4
  %45 = load i32, i32* %catStatus.addr, align 4
  %46 = call i8* @nish_str_from_i32(i32 %45)
  %47 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*), i8* %46)
  %48 = call i8* @nish_str_concat(i8* %47, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %49 = load %struct.nish_array*, %struct.nish_array** %echoed.addr, align 8
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 0
  %51 = load i64, i64* %50, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %52 = trunc i64 %51 to i32
  %53 = call i8* @nish_str_from_i32(i32 %52)
  %54 = call i8* @nish_str_concat(i8* %48, i8* %53)
  %55 = call i8* @nish_str_concat(i8* %54, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %56 = load %struct.nish_array*, %struct.nish_array** %all.addr, align 8
  %57 = load %struct.nish_array*, %struct.nish_array** %echoed.addr, align 8
  %58 = call i1 @same(%struct.nish_array* %56, %struct.nish_array* %57)
  %59 = select i1 %58, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  %60 = call i8* @nish_str_concat(i8* %55, i8* %59)
  %61 = call i8* @nish_str_concat(i8* %60, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %62 = load %struct.nish_array*, %struct.nish_array** %quiet.addr, align 8
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 0
  %64 = load i64, i64* %63, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %65 = trunc i64 %64 to i32
  %66 = call i8* @nish_str_from_i32(i32 %65)
  %67 = call i8* @nish_str_concat(i8* %61, i8* %66)
  call void @nish_print(i8* %67)
  %68 = call i8* @nish_alloc_struct(i64 24)
  %69 = bitcast i8* %68 to %struct.nish_array*
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %69, i64 0, i32 0
  store i64 0, i64* %70, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %69, i64 0, i32 1
  store i64 0, i64* %71, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %69, i64 0, i32 2
  store i8* null, i8** %72, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %69, %struct.nish_array** %big.addr, align 8
  store i32 0, i32* %i.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %73 = load i32, i32* %i.addr.1, align 4
  %74 = mul nsw i32 1536, 1024
  %75 = icmp slt i32 %73, %74
  br i1 %75, label %for.body.1, label %for.end.1

for.body.1:
  %76 = load %struct.nish_array*, %struct.nish_array** %big.addr, align 8
  %77 = load i32, i32* %i.addr.1, align 4
  %78 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %77, i32 7)
  %79 = extractvalue { i32, i1 } %78, 0
  %80 = extractvalue { i32, i1 } %78, 1
  br i1 %80, label %ovf.fail, label %ovf.ok

ovf.ok:
  %81 = load i32, i32* %i.addr.1, align 4
  %82 = ashr i32 %81, 9
  %83 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %79, i32 %82)
  %84 = extractvalue { i32, i1 } %83, 0
  %85 = extractvalue { i32, i1 } %83, 1
  br i1 %85, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %86 = trunc i32 %84 to i8
  %87 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %76, i64 0, i32 0
  %88 = load i64, i64* %87, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %76, i64 0, i32 1
  %90 = load i64, i64* %89, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %91 = icmp eq i64 %88, %90
  br i1 %91, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %76, i64 1)
  br label %push.store.1

push.store.1:
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %76, i64 0, i32 2
  %93 = load i8*, i8** %92, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %94 = bitcast i8* %93 to i8*
  %95 = getelementptr inbounds i8, i8* %94, i64 %88
  store i8 %86, i8* %95, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %96 = add i64 %88, 1
  store i64 %96, i64* %87, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %97 = trunc i64 %96 to i32
  br label %for.inc.1

for.inc.1:
  %98 = load i32, i32* %i.addr.1, align 4
  %99 = add nsw i32 %98, 1
  store i32 %99, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  %100 = call i8* @nish_alloc_struct(i64 24)
  %101 = bitcast i8* %100 to %struct.nish_array*
  %102 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %101, i64 0, i32 0
  store i64 0, i64* %102, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %103 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %101, i64 0, i32 1
  store i64 0, i64* %103, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %104 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %101, i64 0, i32 2
  store i8* null, i8** %104, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %101, %struct.nish_array** %back.addr, align 8
  %105 = call i8* @nish_alloc_struct(i64 24)
  %106 = bitcast i8* %105 to %struct.nish_array*
  %107 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %106, i64 0, i32 0
  store i64 1, i64* %107, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %108 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %106, i64 0, i32 1
  store i64 1, i64* %108, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %109 = call i8* @nish_alloc_struct(i64 8)
  %110 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %106, i64 0, i32 2
  store i8* %109, i8** %110, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %111 = bitcast i8* %109 to i8**
  %112 = getelementptr inbounds i8*, i8** %111, i64 0
  store i8* bitcast ({ i64, [9 x i8] }* @.str.5 to i8*), i8** %112, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %113 = load %struct.nish_array*, %struct.nish_array** %big.addr, align 8
  %114 = load %struct.nish_array*, %struct.nish_array** %back.addr, align 8
  %115 = load %struct.nish_array*, %struct.nish_array** %quiet.addr, align 8
  %116 = call i32 @nish_spawn_piped(%struct.nish_array* %106, %struct.nish_array* %113, %struct.nish_array* %114, %struct.nish_array* %115)
  store i32 %116, i32* %bigStatus.addr, align 4
  %117 = load i32, i32* %bigStatus.addr, align 4
  %118 = call i8* @nish_str_from_i32(i32 %117)
  %119 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*), i8* %118)
  %120 = call i8* @nish_str_concat(i8* %119, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %121 = load %struct.nish_array*, %struct.nish_array** %back.addr, align 8
  %122 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %121, i64 0, i32 0
  %123 = load i64, i64* %122, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %124 = trunc i64 %123 to i32
  %125 = call i8* @nish_str_from_i32(i32 %124)
  %126 = call i8* @nish_str_concat(i8* %120, i8* %125)
  %127 = call i8* @nish_str_concat(i8* %126, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %128 = load %struct.nish_array*, %struct.nish_array** %big.addr, align 8
  %129 = load %struct.nish_array*, %struct.nish_array** %back.addr, align 8
  %130 = call i1 @same(%struct.nish_array* %128, %struct.nish_array* %129)
  %131 = select i1 %130, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  %132 = call i8* @nish_str_concat(i8* %127, i8* %131)
  call void @nish_print(i8* %132)
  %133 = call i8* @nish_alloc_struct(i64 24)
  %134 = bitcast i8* %133 to %struct.nish_array*
  %135 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %134, i64 0, i32 0
  store i64 0, i64* %135, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %136 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %134, i64 0, i32 1
  store i64 0, i64* %136, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %137 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %134, i64 0, i32 2
  store i8* null, i8** %137, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %134, %struct.nish_array** %none.addr, align 8
  %138 = call i8* @nish_alloc_struct(i64 24)
  %139 = bitcast i8* %138 to %struct.nish_array*
  %140 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %139, i64 0, i32 0
  store i64 0, i64* %140, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %141 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %139, i64 0, i32 1
  store i64 0, i64* %141, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %142 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %139, i64 0, i32 2
  store i8* null, i8** %142, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %139, %struct.nish_array** %out.addr, align 8
  %143 = call i8* @nish_alloc_struct(i64 24)
  %144 = bitcast i8* %143 to %struct.nish_array*
  %145 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %144, i64 0, i32 0
  store i64 0, i64* %145, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %146 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %144, i64 0, i32 1
  store i64 0, i64* %146, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %147 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %144, i64 0, i32 2
  store i8* null, i8** %147, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %144, %struct.nish_array** %err.addr, align 8
  %148 = call i8* @nish_alloc_struct(i64 24)
  %149 = bitcast i8* %148 to %struct.nish_array*
  %150 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %149, i64 0, i32 0
  store i64 3, i64* %150, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %151 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %149, i64 0, i32 1
  store i64 3, i64* %151, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %152 = call i8* @nish_alloc_struct(i64 24)
  %153 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %149, i64 0, i32 2
  store i8* %152, i8** %153, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %154 = bitcast i8* %152 to i8**
  %155 = getelementptr inbounds i8*, i8** %154, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.7 to i8*), i8** %155, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %156 = getelementptr inbounds i8*, i8** %154, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.8 to i8*), i8** %156, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %157 = getelementptr inbounds i8*, i8** %154, i64 2
  store i8* bitcast ({ i64, [35 x i8] }* @.str.9 to i8*), i8** %157, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %158 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %159 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %160 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %161 = call i32 @nish_spawn_piped(%struct.nish_array* %149, %struct.nish_array* %158, %struct.nish_array* %159, %struct.nish_array* %160)
  store i32 %161, i32* %split.addr, align 4
  %162 = load i32, i32* %split.addr, align 4
  %163 = call i8* @nish_str_from_i32(i32 %162)
  %164 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.10 to i8*), i8* %163)
  %165 = call i8* @nish_str_concat(i8* %164, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %166 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %167 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %168 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %167, i64 0, i32 0
  %169 = load i64, i64* %168, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %170 = trunc i64 %169 to i32
  %171 = sext i32 %170 to i64
  %172 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %166, i64 0, i32 0
  %173 = load i64, i64* %172, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %174 = icmp ule i64 0, %171
  %175 = icmp ule i64 %171, %173
  %176 = and i1 %174, %175
  br i1 %176, label %bytes.ok, label %bytes.fail

bytes.fail:
  call void @nish_panic_slice(i64 0, i64 %171, i64 %173)
  unreachable

bytes.ok:
  %177 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %166, i64 0, i32 2
  %178 = load i8*, i8** %177, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %179 = getelementptr inbounds i8, i8* %178, i64 0
  %180 = sub i64 %171, 0
  %181 = call i8* @nish_str_new(i8* %179, i64 %180)
  %182 = call i8* @nish_str_concat(i8* %165, i8* %181)
  %183 = call i8* @nish_str_concat(i8* %182, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %184 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %185 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %186 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %185, i64 0, i32 0
  %187 = load i64, i64* %186, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %188 = trunc i64 %187 to i32
  %189 = sext i32 %188 to i64
  %190 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %184, i64 0, i32 0
  %191 = load i64, i64* %190, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %192 = icmp ule i64 0, %189
  %193 = icmp ule i64 %189, %191
  %194 = and i1 %192, %193
  br i1 %194, label %bytes.ok.1, label %bytes.fail.1

bytes.fail.1:
  call void @nish_panic_slice(i64 0, i64 %189, i64 %191)
  unreachable

bytes.ok.1:
  %195 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %184, i64 0, i32 2
  %196 = load i8*, i8** %195, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %197 = getelementptr inbounds i8, i8* %196, i64 0
  %198 = sub i64 %189, 0
  %199 = call i8* @nish_str_new(i8* %197, i64 %198)
  %200 = call i8* @nish_str_concat(i8* %183, i8* %199)
  call void @nish_print(i8* %200)
  %201 = call i8* @nish_alloc_struct(i64 24)
  %202 = bitcast i8* %201 to %struct.nish_array*
  %203 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %202, i64 0, i32 0
  store i64 3, i64* %203, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %204 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %202, i64 0, i32 1
  store i64 3, i64* %204, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %205 = call i8* @nish_alloc_struct(i64 24)
  %206 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %202, i64 0, i32 2
  store i8* %205, i8** %206, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %207 = bitcast i8* %205 to i8**
  %208 = getelementptr inbounds i8*, i8** %207, i64 0
  store i8* bitcast ({ i64, [8 x i8] }* @.str.11 to i8*), i8** %208, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %209 = getelementptr inbounds i8*, i8** %207, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.8 to i8*), i8** %209, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %210 = getelementptr inbounds i8*, i8** %207, i64 2
  store i8* bitcast ({ i64, [12 x i8] }* @.str.12 to i8*), i8** %210, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %211 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %212 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %213 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %214 = call i32 @nish_spawn_piped(%struct.nish_array* %202, %struct.nish_array* %211, %struct.nish_array* %212, %struct.nish_array* %213)
  %215 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %216 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %217 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %216, i64 0, i32 0
  %218 = load i64, i64* %217, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %219 = trunc i64 %218 to i32
  %220 = sext i32 %219 to i64
  %221 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %215, i64 0, i32 0
  %222 = load i64, i64* %221, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %223 = icmp ule i64 0, %220
  %224 = icmp ule i64 %220, %222
  %225 = and i1 %223, %224
  br i1 %225, label %bytes.ok.2, label %bytes.fail.2

bytes.fail.2:
  call void @nish_panic_slice(i64 0, i64 %220, i64 %222)
  unreachable

bytes.ok.2:
  %226 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %215, i64 0, i32 2
  %227 = load i8*, i8** %226, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %228 = getelementptr inbounds i8, i8* %227, i64 0
  %229 = sub i64 %220, 0
  %230 = call i8* @nish_str_new(i8* %228, i64 %229)
  %231 = call i8* @nish_str_concat(i8* bitcast ({ i64, [11 x i8] }* @.str.13 to i8*), i8* %230)
  call void @nish_print(i8* %231)
  %232 = call i8* @nish_alloc_struct(i64 24)
  %233 = bitcast i8* %232 to %struct.nish_array*
  %234 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %233, i64 0, i32 0
  store i64 1, i64* %234, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %235 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %233, i64 0, i32 1
  store i64 1, i64* %235, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %236 = call i8* @nish_alloc_struct(i64 8)
  %237 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %233, i64 0, i32 2
  store i8* %236, i8** %237, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %238 = bitcast i8* %236 to i8**
  %239 = getelementptr inbounds i8*, i8** %238, i64 0
  store i8* bitcast ({ i64, [21 x i8] }* @.str.15 to i8*), i8** %239, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %240 = load %struct.nish_array*, %struct.nish_array** %all.addr, align 8
  %241 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %242 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %243 = call i32 @nish_spawn_piped(%struct.nish_array* %233, %struct.nish_array* %240, %struct.nish_array* %241, %struct.nish_array* %242)
  %244 = call i8* @nish_str_from_i32(i32 %243)
  %245 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.14 to i8*), i8* %244)
  call void @nish_print(i8* %245)
  %246 = call i8* @nish_alloc_struct(i64 24)
  %247 = bitcast i8* %246 to %struct.nish_array*
  %248 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %247, i64 0, i32 0
  store i64 1, i64* %248, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %249 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %247, i64 0, i32 1
  store i64 1, i64* %249, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %250 = call i8* @nish_alloc_struct(i64 8)
  %251 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %247, i64 0, i32 2
  store i8* %250, i8** %251, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %252 = bitcast i8* %250 to i8**
  %253 = getelementptr inbounds i8*, i8** %252, i64 0
  store i8* bitcast ({ i64, [23 x i8] }* @.str.17 to i8*), i8** %253, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %254 = load %struct.nish_array*, %struct.nish_array** %all.addr, align 8
  %255 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %256 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %257 = call i32 @nish_spawn_piped(%struct.nish_array* %247, %struct.nish_array* %254, %struct.nish_array* %255, %struct.nish_array* %256)
  %258 = call i8* @nish_str_from_i32(i32 %257)
  %259 = call i8* @nish_str_concat(i8* bitcast ({ i64, [15 x i8] }* @.str.16 to i8*), i8* %258)
  call void @nish_print(i8* %259)
  %260 = call i8* @nish_alloc_struct(i64 24)
  %261 = bitcast i8* %260 to %struct.nish_array*
  %262 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %261, i64 0, i32 0
  store i64 1, i64* %262, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %263 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %261, i64 0, i32 1
  store i64 1, i64* %263, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %264 = call i8* @nish_alloc_struct(i64 8)
  %265 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %261, i64 0, i32 2
  store i8* %264, i8** %265, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %266 = bitcast i8* %264 to i8**
  %267 = getelementptr inbounds i8*, i8** %266, i64 0
  store i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8** %267, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %268 = load %struct.nish_array*, %struct.nish_array** %big.addr, align 8
  %269 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %270 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %271 = call i32 @nish_spawn_piped(%struct.nish_array* %261, %struct.nish_array* %268, %struct.nish_array* %269, %struct.nish_array* %270)
  %272 = call i8* @nish_str_from_i32(i32 %271)
  %273 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.18 to i8*), i8* %272)
  call void @nish_print(i8* %273)
  %274 = call i8* @nish_alloc_struct(i64 24)
  %275 = bitcast i8* %274 to %struct.nish_array*
  %276 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %275, i64 0, i32 0
  store i64 0, i64* %276, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %277 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %275, i64 0, i32 1
  store i64 0, i64* %277, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %278 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %275, i64 0, i32 2
  store i8* null, i8** %278, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %275, %struct.nish_array** %flood.addr, align 8
  %279 = call i8* @nish_alloc_struct(i64 24)
  %280 = bitcast i8* %279 to %struct.nish_array*
  %281 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %280, i64 0, i32 0
  store i64 1, i64* %281, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %282 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %280, i64 0, i32 1
  store i64 1, i64* %282, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %283 = call i8* @nish_alloc_struct(i64 8)
  %284 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %280, i64 0, i32 2
  store i8* %283, i8** %284, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %285 = bitcast i8* %283 to i8**
  %286 = getelementptr inbounds i8*, i8** %285, i64 0
  store i8* bitcast ({ i64, [4 x i8] }* @.str.19 to i8*), i8** %286, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %287 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %288 = load %struct.nish_array*, %struct.nish_array** %flood.addr, align 8
  %289 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %290 = call i32 @nish_spawn_piped(%struct.nish_array* %280, %struct.nish_array* %287, %struct.nish_array* %288, %struct.nish_array* %289)
  store i32 %290, i32* %floodStatus.addr, align 4
  %291 = load i32, i32* %floodStatus.addr, align 4
  %292 = call i8* @nish_str_from_i32(i32 %291)
  %293 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.20 to i8*), i8* %292)
  %294 = call i8* @nish_str_concat(i8* %293, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %295 = load %struct.nish_array*, %struct.nish_array** %flood.addr, align 8
  %296 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %295, i64 0, i32 0
  %297 = load i64, i64* %296, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %298 = trunc i64 %297 to i32
  %299 = call i8* @nish_str_from_i32(i32 %298)
  %300 = call i8* @nish_str_concat(i8* %294, i8* %299)
  call void @nish_print(i8* %300)
  %301 = call i8* @nish_alloc_struct(i64 24)
  %302 = bitcast i8* %301 to %struct.nish_array*
  %303 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %302, i64 0, i32 0
  store i64 0, i64* %303, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %304 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %302, i64 0, i32 1
  store i64 0, i64* %304, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %305 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %302, i64 0, i32 2
  store i8* null, i8** %305, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %302, %struct.nish_array** %secret.addr, align 8
  store i8* bitcast ({ i64, [15 x i8] }* @.str.21 to i8*), i8** %word.addr, align 8
  store i32 0, i32* %i.addr.2, align 4
  br label %for.cond.2

for.cond.2:
  %306 = load i32, i32* %i.addr.2, align 4
  %307 = load i8*, i8** %word.addr, align 8
  %308 = bitcast i8* %307 to i64*
  %309 = load i64, i64* %308, align 8
  %310 = trunc i64 %309 to i32
  %311 = icmp slt i32 %306, %310
  br i1 %311, label %for.body.2, label %for.end.2

for.body.2:
  %312 = load %struct.nish_array*, %struct.nish_array** %secret.addr, align 8
  %313 = load i8*, i8** %word.addr, align 8
  %314 = load i32, i32* %i.addr.2, align 4
  %315 = sext i32 %314 to i64
  %316 = getelementptr inbounds i8, i8* %313, i64 8
  %317 = getelementptr inbounds i8, i8* %316, i64 %315
  %318 = load i8, i8* %317, align 1
  %319 = zext i8 %318 to i32
  %320 = trunc i32 %319 to i8
  %321 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %312, i64 0, i32 0
  %322 = load i64, i64* %321, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %323 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %312, i64 0, i32 1
  %324 = load i64, i64* %323, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %325 = icmp eq i64 %322, %324
  br i1 %325, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %312, i64 1)
  br label %push.store.2

push.store.2:
  %326 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %312, i64 0, i32 2
  %327 = load i8*, i8** %326, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %328 = bitcast i8* %327 to i8*
  %329 = getelementptr inbounds i8, i8* %328, i64 %322
  store i8 %320, i8* %329, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %330 = add i64 %322, 1
  store i64 %330, i64* %321, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %331 = trunc i64 %330 to i32
  br label %for.inc.2

for.inc.2:
  %332 = load i32, i32* %i.addr.2, align 4
  %333 = add nsw i32 %332, 1
  store i32 %333, i32* %i.addr.2, align 4
  br label %for.cond.2

for.end.2:
  %334 = call i8* @nish_alloc_struct(i64 24)
  %335 = bitcast i8* %334 to %struct.nish_array*
  %336 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %335, i64 0, i32 0
  store i64 0, i64* %336, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %337 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %335, i64 0, i32 1
  store i64 0, i64* %337, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %338 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %335, i64 0, i32 2
  store i8* null, i8** %338, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %335, %struct.nish_array** %seen.addr, align 8
  %339 = call i8* @nish_alloc_struct(i64 24)
  %340 = bitcast i8* %339 to %struct.nish_array*
  %341 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %340, i64 0, i32 0
  store i64 2, i64* %341, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %342 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %340, i64 0, i32 1
  store i64 2, i64* %342, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %343 = call i8* @nish_alloc_struct(i64 16)
  %344 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %340, i64 0, i32 2
  store i8* %343, i8** %344, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %345 = bitcast i8* %343 to i8**
  %346 = getelementptr inbounds i8*, i8** %345, i64 0
  store i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*), i8** %346, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %347 = getelementptr inbounds i8*, i8** %345, i64 1
  store i8* bitcast ({ i64, [19 x i8] }* @.str.22 to i8*), i8** %347, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %348 = load %struct.nish_array*, %struct.nish_array** %secret.addr, align 8
  %349 = load %struct.nish_array*, %struct.nish_array** %seen.addr, align 8
  %350 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %351 = call i32 @nish_spawn_piped(%struct.nish_array* %340, %struct.nish_array* %348, %struct.nish_array* %349, %struct.nish_array* %350)
  %352 = call i8* @nish_alloc_struct(i64 24)
  %353 = bitcast i8* %352 to %struct.nish_array*
  %354 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %353, i64 0, i32 0
  store i64 1, i64* %354, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %355 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %353, i64 0, i32 1
  store i64 1, i64* %355, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %356 = call i8* @nish_alloc_struct(i64 8)
  %357 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %353, i64 0, i32 2
  store i8* %356, i8** %357, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %358 = bitcast i8* %356 to i8**
  %359 = getelementptr inbounds i8*, i8** %358, i64 0
  store i8* bitcast ({ i64, [4 x i8] }* @.str.23 to i8*), i8** %359, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %360 = load %struct.nish_array*, %struct.nish_array** %secret.addr, align 8
  %361 = load %struct.nish_array*, %struct.nish_array** %seen.addr, align 8
  %362 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %363 = call i32 @nish_spawn_piped(%struct.nish_array* %353, %struct.nish_array* %360, %struct.nish_array* %361, %struct.nish_array* %362)
  %364 = load %struct.nish_array*, %struct.nish_array** %seen.addr, align 8
  %365 = load %struct.nish_array*, %struct.nish_array** %secret.addr, align 8
  %366 = call i1 @contains(%struct.nish_array* %364, %struct.nish_array* %365)
  %367 = select i1 %366, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  %368 = call i8* @nish_str_concat(i8* bitcast ({ i64, [17 x i8] }* @.str.24 to i8*), i8* %367)
  call void @nish_print(i8* %368)
  ret i32 0

ovf.fail:
  %ovf.op = phi i32 [ 2, %for.body.1 ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind readonly "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #5 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

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
!11 = !{!9, !8, i64 16}
!12 = !{!"element i8", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}
!15 = !{!"element ptr", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{i32 8, !"cf-protection-branch", i32 1}
!18 = !{i32 8, !"cf-protection-return", i32 1}
!19 = !{i32 8, !"branch-target-enforcement", i32 1}
!20 = !{i32 8, !"sign-return-address", i32 1}
!21 = !{i32 4, !"probe-stack", !"inline-asm"}

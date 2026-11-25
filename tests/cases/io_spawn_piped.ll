%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"cat\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"cat: \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"/bin/cat\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"big: \00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"twice: \00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"sh\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"-c\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [35 x i8] } { i64 34, [35 x i8] c"printf out; printf err >&2; exit 3\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"split: \00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"/bin/sh\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"printf more\00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"appended: \00" }, align 8
@.str.15 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"missing: \00" }, align 8
@.str.16 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"nish-no-such-program\00" }, align 8
@.str.17 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"missing path: \00" }, align 8
@.str.18 = private unnamed_addr constant { i64, [23 x i8] } { i64 22, [23 x i8] c"/nonexistent/nish-prog\00" }, align 8
@.str.19 = private unnamed_addr constant { i64, [16 x i8] } { i64 15, [16 x i8] c"empty command: \00" }, align 8
@.str.20 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.21 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.22 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.23 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"nul argument: \00" }, align 8
@.str.24 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"echo\00" }, align 8
@.str.25 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"unread: \00" }, align 8
@.str.26 = private unnamed_addr constant { i64, [16 x i8] } { i64 15, [16 x i8] c"child sigpipe: \00" }, align 8
@.str.27 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"kill -PIPE $$; echo alive\00" }, align 8
@.str.28 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"yes\00" }, align 8
@.str.29 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"flood: \00" }, align 8
@.str.30 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"yes >&2\00" }, align 8
@.str.31 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"stderr flood: \00" }, align 8
@.str.32 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"head\00" }, align 8
@.str.33 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"16777216\00" }, align 8
@.str.34 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"/dev/zero\00" }, align 8
@.str.35 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"at cap: \00" }, align 8
@.str.36 = private unnamed_addr constant { i64, [85 x i8] } { i64 84, [85 x i8] c"for f in 3 4 5 6 7 8 9; do if ( : <&$f ) 2>/dev/null; then printf '%s ' $f; fi; done\00" }, align 8
@.str.37 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"inherited: [\00" }, align 8
@.str.38 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"]\00" }, align 8
@.str.39 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"hunter2-secret\00" }, align 8
@.str.40 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"printf '%s ' \22$0\22 \22$@\22; env\00" }, align 8
@.str.41 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"argv-marker\00" }, align 8
@.str.42 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"x\00" }, align 8
@.str.43 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"argv-marker x\00" }, align 8
@.str.44 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"secret visible: \00" }, align 8
@.str.45 = private unnamed_addr constant { i64, [16 x i8] } { i64 15, [16 x i8] c" argv printed: \00" }, align 8
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
  %twice.addr = alloca %struct.nish_array*, align 8
  %i.addr.2 = alloca i32, align 4
  %halves.addr = alloca i1, align 1
  %i.addr.3 = alloca i32, align 4
  %none.addr = alloca %struct.nish_array*, align 8
  %out.addr = alloca %struct.nish_array*, align 8
  %err.addr = alloca %struct.nish_array*, align 8
  %split.addr = alloca i32, align 4
  %nul.addr = alloca i8*, align 8
  %chr = alloca i8, align 1
  %flood.addr = alloca %struct.nish_array*, align 8
  %floodStatus.addr = alloca i32, align 4
  %errFlood.addr = alloca %struct.nish_array*, align 8
  %errFloodStatus.addr = alloca i32, align 4
  %atCap.addr = alloca %struct.nish_array*, align 8
  %atCapStatus.addr = alloca i32, align 4
  %fds.addr = alloca %struct.nish_array*, align 8
  %probe.addr = alloca i8*, align 8
  %secret.addr = alloca %struct.nish_array*, align 8
  %word.addr = alloca i8*, align 8
  %i.addr.4 = alloca i32, align 4
  %seen.addr = alloca %struct.nish_array*, align 8
  %marker.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %name.addr = alloca i8*, align 8
  %i.addr.5 = alloca i32, align 4
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
  store %struct.nish_array* %134, %struct.nish_array** %twice.addr, align 8
  store i32 0, i32* %i.addr.2, align 4
  br label %for.cond.2

for.cond.2:
  %138 = load i32, i32* %i.addr.2, align 4
  %139 = icmp slt i32 %138, 100000
  br i1 %139, label %for.body.2, label %for.end.2

for.body.2:
  %140 = load %struct.nish_array*, %struct.nish_array** %twice.addr, align 8
  %141 = load i32, i32* %i.addr.2, align 4
  %142 = trunc i32 %141 to i8
  %143 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %140, i64 0, i32 0
  %144 = load i64, i64* %143, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %145 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %140, i64 0, i32 1
  %146 = load i64, i64* %145, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %147 = icmp eq i64 %144, %146
  br i1 %147, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %140, i64 1)
  br label %push.store.2

push.store.2:
  %148 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %140, i64 0, i32 2
  %149 = load i8*, i8** %148, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %150 = bitcast i8* %149 to i8*
  %151 = getelementptr inbounds i8, i8* %150, i64 %144
  store i8 %142, i8* %151, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %152 = add i64 %144, 1
  store i64 %152, i64* %143, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %153 = trunc i64 %152 to i32
  br label %for.inc.2

for.inc.2:
  %154 = load i32, i32* %i.addr.2, align 4
  %155 = add nsw i32 %154, 1
  store i32 %155, i32* %i.addr.2, align 4
  br label %for.cond.2

for.end.2:
  %156 = call i8* @nish_alloc_struct(i64 24)
  %157 = bitcast i8* %156 to %struct.nish_array*
  %158 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %157, i64 0, i32 0
  store i64 1, i64* %158, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %159 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %157, i64 0, i32 1
  store i64 1, i64* %159, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %160 = call i8* @nish_alloc_struct(i64 8)
  %161 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %157, i64 0, i32 2
  store i8* %160, i8** %161, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %162 = bitcast i8* %160 to i8**
  %163 = getelementptr inbounds i8*, i8** %162, i64 0
  store i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*), i8** %163, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %164 = load %struct.nish_array*, %struct.nish_array** %twice.addr, align 8
  %165 = load %struct.nish_array*, %struct.nish_array** %twice.addr, align 8
  %166 = load %struct.nish_array*, %struct.nish_array** %quiet.addr, align 8
  %167 = call i32 @nish_spawn_piped(%struct.nish_array* %157, %struct.nish_array* %164, %struct.nish_array* %165, %struct.nish_array* %166)
  %168 = load %struct.nish_array*, %struct.nish_array** %twice.addr, align 8
  %169 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %168, i64 0, i32 0
  %170 = load i64, i64* %169, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %171 = trunc i64 %170 to i32
  %172 = icmp eq i32 %171, 200000
  store i1 %172, i1* %halves.addr, align 1
  store i32 0, i32* %i.addr.3, align 4
  %173 = load %struct.nish_array*, %struct.nish_array** %twice.addr, align 8
  %174 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %173, i64 0, i32 0
  %175 = load i64, i64* %174, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %176 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %173, i64 0, i32 2
  %177 = load i8*, i8** %176, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond.3

for.cond.3:
  %178 = load i1, i1* %halves.addr, align 1
  br i1 %178, label %land.rhs, label %land.end

land.rhs:
  %179 = load i32, i32* %i.addr.3, align 4
  %180 = icmp slt i32 %179, 100000
  br label %land.end

land.end:
  %181 = phi i1 [ false, %for.cond.3 ], [ %180, %land.rhs ]
  br i1 %181, label %for.body.3, label %for.end.3

for.body.3:
  %182 = load i32, i32* %i.addr.3, align 4
  %183 = sext i32 %182 to i64
  %184 = icmp ult i64 %183, %175
  br i1 %184, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %183, i64 %175)
  unreachable

bounds.ok:
  %185 = bitcast i8* %177 to i8*
  %186 = getelementptr inbounds i8, i8* %185, i64 %183
  %187 = load i8, i8* %186, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %188 = load i32, i32* %i.addr.3, align 4
  %189 = add nsw i32 %188, 100000
  %190 = sext i32 %189 to i64
  %191 = icmp ult i64 %190, %175
  br i1 %191, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %190, i64 %175)
  unreachable

bounds.ok.1:
  %192 = bitcast i8* %177 to i8*
  %193 = getelementptr inbounds i8, i8* %192, i64 %190
  %194 = load i8, i8* %193, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %195 = icmp eq i8 %187, %194
  store i1 %195, i1* %halves.addr, align 1
  br label %for.inc.3

for.inc.3:
  %196 = load i32, i32* %i.addr.3, align 4
  %197 = add nsw i32 %196, 1
  store i32 %197, i32* %i.addr.3, align 4
  br label %for.cond.3

for.end.3:
  %198 = load %struct.nish_array*, %struct.nish_array** %twice.addr, align 8
  %199 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %198, i64 0, i32 0
  %200 = load i64, i64* %199, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %201 = trunc i64 %200 to i32
  %202 = call i8* @nish_str_from_i32(i32 %201)
  %203 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.7 to i8*), i8* %202)
  %204 = call i8* @nish_str_concat(i8* %203, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %205 = load i1, i1* %halves.addr, align 1
  %206 = select i1 %205, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  %207 = call i8* @nish_str_concat(i8* %204, i8* %206)
  call void @nish_print(i8* %207)
  %208 = call i8* @nish_alloc_struct(i64 24)
  %209 = bitcast i8* %208 to %struct.nish_array*
  %210 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %209, i64 0, i32 0
  store i64 0, i64* %210, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %211 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %209, i64 0, i32 1
  store i64 0, i64* %211, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %212 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %209, i64 0, i32 2
  store i8* null, i8** %212, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %209, %struct.nish_array** %none.addr, align 8
  %213 = call i8* @nish_alloc_struct(i64 24)
  %214 = bitcast i8* %213 to %struct.nish_array*
  %215 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %214, i64 0, i32 0
  store i64 0, i64* %215, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %216 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %214, i64 0, i32 1
  store i64 0, i64* %216, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %217 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %214, i64 0, i32 2
  store i8* null, i8** %217, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %214, %struct.nish_array** %out.addr, align 8
  %218 = call i8* @nish_alloc_struct(i64 24)
  %219 = bitcast i8* %218 to %struct.nish_array*
  %220 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %219, i64 0, i32 0
  store i64 0, i64* %220, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %221 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %219, i64 0, i32 1
  store i64 0, i64* %221, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %222 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %219, i64 0, i32 2
  store i8* null, i8** %222, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %219, %struct.nish_array** %err.addr, align 8
  %223 = call i8* @nish_alloc_struct(i64 24)
  %224 = bitcast i8* %223 to %struct.nish_array*
  %225 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %224, i64 0, i32 0
  store i64 3, i64* %225, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %226 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %224, i64 0, i32 1
  store i64 3, i64* %226, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %227 = call i8* @nish_alloc_struct(i64 24)
  %228 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %224, i64 0, i32 2
  store i8* %227, i8** %228, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %229 = bitcast i8* %227 to i8**
  %230 = getelementptr inbounds i8*, i8** %229, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.8 to i8*), i8** %230, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %231 = getelementptr inbounds i8*, i8** %229, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.9 to i8*), i8** %231, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %232 = getelementptr inbounds i8*, i8** %229, i64 2
  store i8* bitcast ({ i64, [35 x i8] }* @.str.10 to i8*), i8** %232, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %233 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %234 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %235 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %236 = call i32 @nish_spawn_piped(%struct.nish_array* %224, %struct.nish_array* %233, %struct.nish_array* %234, %struct.nish_array* %235)
  store i32 %236, i32* %split.addr, align 4
  %237 = load i32, i32* %split.addr, align 4
  %238 = call i8* @nish_str_from_i32(i32 %237)
  %239 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.11 to i8*), i8* %238)
  %240 = call i8* @nish_str_concat(i8* %239, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %241 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %242 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %243 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %242, i64 0, i32 0
  %244 = load i64, i64* %243, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %245 = trunc i64 %244 to i32
  %246 = sext i32 %245 to i64
  %247 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %241, i64 0, i32 2
  %248 = load i8*, i8** %247, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %249 = getelementptr inbounds i8, i8* %248, i64 0
  %250 = sub i64 %246, 0
  %251 = call i8* @nish_str_new(i8* %249, i64 %250)
  %252 = call i8* @nish_str_concat(i8* %240, i8* %251)
  %253 = call i8* @nish_str_concat(i8* %252, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %254 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %255 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %256 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %255, i64 0, i32 0
  %257 = load i64, i64* %256, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %258 = trunc i64 %257 to i32
  %259 = sext i32 %258 to i64
  %260 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %254, i64 0, i32 2
  %261 = load i8*, i8** %260, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %262 = getelementptr inbounds i8, i8* %261, i64 0
  %263 = sub i64 %259, 0
  %264 = call i8* @nish_str_new(i8* %262, i64 %263)
  %265 = call i8* @nish_str_concat(i8* %253, i8* %264)
  call void @nish_print(i8* %265)
  %266 = call i8* @nish_alloc_struct(i64 24)
  %267 = bitcast i8* %266 to %struct.nish_array*
  %268 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %267, i64 0, i32 0
  store i64 3, i64* %268, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %269 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %267, i64 0, i32 1
  store i64 3, i64* %269, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %270 = call i8* @nish_alloc_struct(i64 24)
  %271 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %267, i64 0, i32 2
  store i8* %270, i8** %271, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %272 = bitcast i8* %270 to i8**
  %273 = getelementptr inbounds i8*, i8** %272, i64 0
  store i8* bitcast ({ i64, [8 x i8] }* @.str.12 to i8*), i8** %273, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %274 = getelementptr inbounds i8*, i8** %272, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.9 to i8*), i8** %274, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %275 = getelementptr inbounds i8*, i8** %272, i64 2
  store i8* bitcast ({ i64, [12 x i8] }* @.str.13 to i8*), i8** %275, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %276 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %277 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %278 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %279 = call i32 @nish_spawn_piped(%struct.nish_array* %267, %struct.nish_array* %276, %struct.nish_array* %277, %struct.nish_array* %278)
  %280 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %281 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %282 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %281, i64 0, i32 0
  %283 = load i64, i64* %282, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %284 = trunc i64 %283 to i32
  %285 = sext i32 %284 to i64
  %286 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %280, i64 0, i32 2
  %287 = load i8*, i8** %286, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %288 = getelementptr inbounds i8, i8* %287, i64 0
  %289 = sub i64 %285, 0
  %290 = call i8* @nish_str_new(i8* %288, i64 %289)
  %291 = call i8* @nish_str_concat(i8* bitcast ({ i64, [11 x i8] }* @.str.14 to i8*), i8* %290)
  call void @nish_print(i8* %291)
  %292 = call i8* @nish_alloc_struct(i64 24)
  %293 = bitcast i8* %292 to %struct.nish_array*
  %294 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %293, i64 0, i32 0
  store i64 1, i64* %294, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %295 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %293, i64 0, i32 1
  store i64 1, i64* %295, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %296 = call i8* @nish_alloc_struct(i64 8)
  %297 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %293, i64 0, i32 2
  store i8* %296, i8** %297, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %298 = bitcast i8* %296 to i8**
  %299 = getelementptr inbounds i8*, i8** %298, i64 0
  store i8* bitcast ({ i64, [21 x i8] }* @.str.16 to i8*), i8** %299, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %300 = load %struct.nish_array*, %struct.nish_array** %all.addr, align 8
  %301 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %302 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %303 = call i32 @nish_spawn_piped(%struct.nish_array* %293, %struct.nish_array* %300, %struct.nish_array* %301, %struct.nish_array* %302)
  %304 = call i8* @nish_str_from_i32(i32 %303)
  %305 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.15 to i8*), i8* %304)
  call void @nish_print(i8* %305)
  %306 = call i8* @nish_alloc_struct(i64 24)
  %307 = bitcast i8* %306 to %struct.nish_array*
  %308 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %307, i64 0, i32 0
  store i64 1, i64* %308, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %309 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %307, i64 0, i32 1
  store i64 1, i64* %309, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %310 = call i8* @nish_alloc_struct(i64 8)
  %311 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %307, i64 0, i32 2
  store i8* %310, i8** %311, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %312 = bitcast i8* %310 to i8**
  %313 = getelementptr inbounds i8*, i8** %312, i64 0
  store i8* bitcast ({ i64, [23 x i8] }* @.str.18 to i8*), i8** %313, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %314 = load %struct.nish_array*, %struct.nish_array** %all.addr, align 8
  %315 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %316 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %317 = call i32 @nish_spawn_piped(%struct.nish_array* %307, %struct.nish_array* %314, %struct.nish_array* %315, %struct.nish_array* %316)
  %318 = call i8* @nish_str_from_i32(i32 %317)
  %319 = call i8* @nish_str_concat(i8* bitcast ({ i64, [15 x i8] }* @.str.17 to i8*), i8* %318)
  call void @nish_print(i8* %319)
  %320 = call i8* @nish_alloc_struct(i64 24)
  %321 = bitcast i8* %320 to %struct.nish_array*
  %322 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %321, i64 0, i32 0
  store i64 1, i64* %322, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %323 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %321, i64 0, i32 1
  store i64 1, i64* %323, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %324 = call i8* @nish_alloc_struct(i64 8)
  %325 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %321, i64 0, i32 2
  store i8* %324, i8** %325, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %326 = bitcast i8* %324 to i8**
  %327 = getelementptr inbounds i8*, i8** %326, i64 0
  store i8* bitcast ({ i64, [1 x i8] }* @.str.20 to i8*), i8** %327, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %328 = load %struct.nish_array*, %struct.nish_array** %all.addr, align 8
  %329 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %330 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %331 = call i32 @nish_spawn_piped(%struct.nish_array* %321, %struct.nish_array* %328, %struct.nish_array* %329, %struct.nish_array* %330)
  %332 = call i8* @nish_str_from_i32(i32 %331)
  %333 = call i8* @nish_str_concat(i8* bitcast ({ i64, [16 x i8] }* @.str.19 to i8*), i8* %332)
  call void @nish_print(i8* %333)
  %334 = trunc i64 0 to i8
  store i8 %334, i8* %chr, align 1
  %335 = call i8* @nish_str_new(i8* %chr, i64 1)
  %336 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.21 to i8*), i8* %335)
  %337 = call i8* @nish_str_concat(i8* %336, i8* bitcast ({ i64, [2 x i8] }* @.str.22 to i8*))
  store i8* %337, i8** %nul.addr, align 8
  %338 = load i8*, i8** %nul.addr, align 8
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
  store i8* bitcast ({ i64, [5 x i8] }* @.str.24 to i8*), i8** %346, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %347 = getelementptr inbounds i8*, i8** %345, i64 1
  store i8* %338, i8** %347, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %348 = load %struct.nish_array*, %struct.nish_array** %all.addr, align 8
  %349 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %350 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %351 = call i32 @nish_spawn_piped(%struct.nish_array* %340, %struct.nish_array* %348, %struct.nish_array* %349, %struct.nish_array* %350)
  %352 = call i8* @nish_str_from_i32(i32 %351)
  %353 = call i8* @nish_str_concat(i8* bitcast ({ i64, [15 x i8] }* @.str.23 to i8*), i8* %352)
  %354 = call i8* @nish_str_concat(i8* %353, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %355 = load i8*, i8** %nul.addr, align 8
  %356 = call i8* @nish_alloc_struct(i64 24)
  %357 = bitcast i8* %356 to %struct.nish_array*
  %358 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %357, i64 0, i32 0
  store i64 1, i64* %358, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %359 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %357, i64 0, i32 1
  store i64 1, i64* %359, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %360 = call i8* @nish_alloc_struct(i64 8)
  %361 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %357, i64 0, i32 2
  store i8* %360, i8** %361, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %362 = bitcast i8* %360 to i8**
  %363 = getelementptr inbounds i8*, i8** %362, i64 0
  store i8* %355, i8** %363, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %364 = load %struct.nish_array*, %struct.nish_array** %all.addr, align 8
  %365 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %366 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %367 = call i32 @nish_spawn_piped(%struct.nish_array* %357, %struct.nish_array* %364, %struct.nish_array* %365, %struct.nish_array* %366)
  %368 = call i8* @nish_str_from_i32(i32 %367)
  %369 = call i8* @nish_str_concat(i8* %354, i8* %368)
  call void @nish_print(i8* %369)
  %370 = call i8* @nish_alloc_struct(i64 24)
  %371 = bitcast i8* %370 to %struct.nish_array*
  %372 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %371, i64 0, i32 0
  store i64 1, i64* %372, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %373 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %371, i64 0, i32 1
  store i64 1, i64* %373, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %374 = call i8* @nish_alloc_struct(i64 8)
  %375 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %371, i64 0, i32 2
  store i8* %374, i8** %375, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %376 = bitcast i8* %374 to i8**
  %377 = getelementptr inbounds i8*, i8** %376, i64 0
  store i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8** %377, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %378 = load %struct.nish_array*, %struct.nish_array** %big.addr, align 8
  %379 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %380 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %381 = call i32 @nish_spawn_piped(%struct.nish_array* %371, %struct.nish_array* %378, %struct.nish_array* %379, %struct.nish_array* %380)
  %382 = call i8* @nish_str_from_i32(i32 %381)
  %383 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.25 to i8*), i8* %382)
  call void @nish_print(i8* %383)
  %384 = call i8* @nish_alloc_struct(i64 24)
  %385 = bitcast i8* %384 to %struct.nish_array*
  %386 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %385, i64 0, i32 0
  store i64 3, i64* %386, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %387 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %385, i64 0, i32 1
  store i64 3, i64* %387, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %388 = call i8* @nish_alloc_struct(i64 24)
  %389 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %385, i64 0, i32 2
  store i8* %388, i8** %389, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %390 = bitcast i8* %388 to i8**
  %391 = getelementptr inbounds i8*, i8** %390, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.8 to i8*), i8** %391, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %392 = getelementptr inbounds i8*, i8** %390, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.9 to i8*), i8** %392, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %393 = getelementptr inbounds i8*, i8** %390, i64 2
  store i8* bitcast ({ i64, [26 x i8] }* @.str.27 to i8*), i8** %393, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %394 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %395 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %396 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %397 = call i32 @nish_spawn_piped(%struct.nish_array* %385, %struct.nish_array* %394, %struct.nish_array* %395, %struct.nish_array* %396)
  %398 = call i8* @nish_str_from_i32(i32 %397)
  %399 = call i8* @nish_str_concat(i8* bitcast ({ i64, [16 x i8] }* @.str.26 to i8*), i8* %398)
  call void @nish_print(i8* %399)
  %400 = call i8* @nish_alloc_struct(i64 24)
  %401 = bitcast i8* %400 to %struct.nish_array*
  %402 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %401, i64 0, i32 0
  store i64 0, i64* %402, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %403 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %401, i64 0, i32 1
  store i64 0, i64* %403, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %404 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %401, i64 0, i32 2
  store i8* null, i8** %404, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %401, %struct.nish_array** %flood.addr, align 8
  %405 = call i8* @nish_alloc_struct(i64 24)
  %406 = bitcast i8* %405 to %struct.nish_array*
  %407 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %406, i64 0, i32 0
  store i64 1, i64* %407, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %408 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %406, i64 0, i32 1
  store i64 1, i64* %408, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %409 = call i8* @nish_alloc_struct(i64 8)
  %410 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %406, i64 0, i32 2
  store i8* %409, i8** %410, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %411 = bitcast i8* %409 to i8**
  %412 = getelementptr inbounds i8*, i8** %411, i64 0
  store i8* bitcast ({ i64, [4 x i8] }* @.str.28 to i8*), i8** %412, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %413 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %414 = load %struct.nish_array*, %struct.nish_array** %flood.addr, align 8
  %415 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %416 = call i32 @nish_spawn_piped(%struct.nish_array* %406, %struct.nish_array* %413, %struct.nish_array* %414, %struct.nish_array* %415)
  store i32 %416, i32* %floodStatus.addr, align 4
  %417 = load i32, i32* %floodStatus.addr, align 4
  %418 = call i8* @nish_str_from_i32(i32 %417)
  %419 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.29 to i8*), i8* %418)
  %420 = call i8* @nish_str_concat(i8* %419, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %421 = load %struct.nish_array*, %struct.nish_array** %flood.addr, align 8
  %422 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %421, i64 0, i32 0
  %423 = load i64, i64* %422, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %424 = trunc i64 %423 to i32
  %425 = call i8* @nish_str_from_i32(i32 %424)
  %426 = call i8* @nish_str_concat(i8* %420, i8* %425)
  call void @nish_print(i8* %426)
  %427 = call i8* @nish_alloc_struct(i64 24)
  %428 = bitcast i8* %427 to %struct.nish_array*
  %429 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %428, i64 0, i32 0
  store i64 0, i64* %429, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %430 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %428, i64 0, i32 1
  store i64 0, i64* %430, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %431 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %428, i64 0, i32 2
  store i8* null, i8** %431, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %428, %struct.nish_array** %errFlood.addr, align 8
  %432 = call i8* @nish_alloc_struct(i64 24)
  %433 = bitcast i8* %432 to %struct.nish_array*
  %434 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %433, i64 0, i32 0
  store i64 3, i64* %434, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %435 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %433, i64 0, i32 1
  store i64 3, i64* %435, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %436 = call i8* @nish_alloc_struct(i64 24)
  %437 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %433, i64 0, i32 2
  store i8* %436, i8** %437, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %438 = bitcast i8* %436 to i8**
  %439 = getelementptr inbounds i8*, i8** %438, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.8 to i8*), i8** %439, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %440 = getelementptr inbounds i8*, i8** %438, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.9 to i8*), i8** %440, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %441 = getelementptr inbounds i8*, i8** %438, i64 2
  store i8* bitcast ({ i64, [8 x i8] }* @.str.30 to i8*), i8** %441, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %442 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %443 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %444 = load %struct.nish_array*, %struct.nish_array** %errFlood.addr, align 8
  %445 = call i32 @nish_spawn_piped(%struct.nish_array* %433, %struct.nish_array* %442, %struct.nish_array* %443, %struct.nish_array* %444)
  store i32 %445, i32* %errFloodStatus.addr, align 4
  %446 = load i32, i32* %errFloodStatus.addr, align 4
  %447 = call i8* @nish_str_from_i32(i32 %446)
  %448 = call i8* @nish_str_concat(i8* bitcast ({ i64, [15 x i8] }* @.str.31 to i8*), i8* %447)
  %449 = call i8* @nish_str_concat(i8* %448, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %450 = load %struct.nish_array*, %struct.nish_array** %errFlood.addr, align 8
  %451 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %450, i64 0, i32 0
  %452 = load i64, i64* %451, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %453 = trunc i64 %452 to i32
  %454 = call i8* @nish_str_from_i32(i32 %453)
  %455 = call i8* @nish_str_concat(i8* %449, i8* %454)
  call void @nish_print(i8* %455)
  %456 = call i8* @nish_alloc_struct(i64 24)
  %457 = bitcast i8* %456 to %struct.nish_array*
  %458 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %457, i64 0, i32 0
  store i64 0, i64* %458, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %459 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %457, i64 0, i32 1
  store i64 0, i64* %459, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %460 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %457, i64 0, i32 2
  store i8* null, i8** %460, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %457, %struct.nish_array** %atCap.addr, align 8
  %461 = call i8* @nish_alloc_struct(i64 24)
  %462 = bitcast i8* %461 to %struct.nish_array*
  %463 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %462, i64 0, i32 0
  store i64 4, i64* %463, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %464 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %462, i64 0, i32 1
  store i64 4, i64* %464, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %465 = call i8* @nish_alloc_struct(i64 32)
  %466 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %462, i64 0, i32 2
  store i8* %465, i8** %466, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %467 = bitcast i8* %465 to i8**
  %468 = getelementptr inbounds i8*, i8** %467, i64 0
  store i8* bitcast ({ i64, [5 x i8] }* @.str.32 to i8*), i8** %468, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %469 = getelementptr inbounds i8*, i8** %467, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.9 to i8*), i8** %469, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %470 = getelementptr inbounds i8*, i8** %467, i64 2
  store i8* bitcast ({ i64, [9 x i8] }* @.str.33 to i8*), i8** %470, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %471 = getelementptr inbounds i8*, i8** %467, i64 3
  store i8* bitcast ({ i64, [10 x i8] }* @.str.34 to i8*), i8** %471, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %472 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %473 = load %struct.nish_array*, %struct.nish_array** %atCap.addr, align 8
  %474 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %475 = call i32 @nish_spawn_piped(%struct.nish_array* %462, %struct.nish_array* %472, %struct.nish_array* %473, %struct.nish_array* %474)
  store i32 %475, i32* %atCapStatus.addr, align 4
  %476 = load i32, i32* %atCapStatus.addr, align 4
  %477 = call i8* @nish_str_from_i32(i32 %476)
  %478 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.35 to i8*), i8* %477)
  %479 = call i8* @nish_str_concat(i8* %478, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %480 = load %struct.nish_array*, %struct.nish_array** %atCap.addr, align 8
  %481 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %480, i64 0, i32 0
  %482 = load i64, i64* %481, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %483 = trunc i64 %482 to i32
  %484 = call i8* @nish_str_from_i32(i32 %483)
  %485 = call i8* @nish_str_concat(i8* %479, i8* %484)
  call void @nish_print(i8* %485)
  %486 = call i8* @nish_alloc_struct(i64 24)
  %487 = bitcast i8* %486 to %struct.nish_array*
  %488 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %487, i64 0, i32 0
  store i64 0, i64* %488, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %489 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %487, i64 0, i32 1
  store i64 0, i64* %489, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %490 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %487, i64 0, i32 2
  store i8* null, i8** %490, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %487, %struct.nish_array** %fds.addr, align 8
  store i8* bitcast ({ i64, [85 x i8] }* @.str.36 to i8*), i8** %probe.addr, align 8
  %491 = load i8*, i8** %probe.addr, align 8
  %492 = call i8* @nish_alloc_struct(i64 24)
  %493 = bitcast i8* %492 to %struct.nish_array*
  %494 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %493, i64 0, i32 0
  store i64 3, i64* %494, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %495 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %493, i64 0, i32 1
  store i64 3, i64* %495, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %496 = call i8* @nish_alloc_struct(i64 24)
  %497 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %493, i64 0, i32 2
  store i8* %496, i8** %497, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %498 = bitcast i8* %496 to i8**
  %499 = getelementptr inbounds i8*, i8** %498, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.8 to i8*), i8** %499, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %500 = getelementptr inbounds i8*, i8** %498, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.9 to i8*), i8** %500, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %501 = getelementptr inbounds i8*, i8** %498, i64 2
  store i8* %491, i8** %501, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %502 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %503 = load %struct.nish_array*, %struct.nish_array** %fds.addr, align 8
  %504 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %505 = call i32 @nish_spawn_piped(%struct.nish_array* %493, %struct.nish_array* %502, %struct.nish_array* %503, %struct.nish_array* %504)
  %506 = load %struct.nish_array*, %struct.nish_array** %fds.addr, align 8
  %507 = load %struct.nish_array*, %struct.nish_array** %fds.addr, align 8
  %508 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %507, i64 0, i32 0
  %509 = load i64, i64* %508, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %510 = trunc i64 %509 to i32
  %511 = sext i32 %510 to i64
  %512 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %506, i64 0, i32 2
  %513 = load i8*, i8** %512, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %514 = getelementptr inbounds i8, i8* %513, i64 0
  %515 = sub i64 %511, 0
  %516 = call i8* @nish_str_new(i8* %514, i64 %515)
  %517 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.37 to i8*), i8* %516)
  %518 = call i8* @nish_str_concat(i8* %517, i8* bitcast ({ i64, [2 x i8] }* @.str.38 to i8*))
  call void @nish_print(i8* %518)
  %519 = call i8* @nish_alloc_struct(i64 24)
  %520 = bitcast i8* %519 to %struct.nish_array*
  %521 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %520, i64 0, i32 0
  store i64 0, i64* %521, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %522 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %520, i64 0, i32 1
  store i64 0, i64* %522, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %523 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %520, i64 0, i32 2
  store i8* null, i8** %523, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %520, %struct.nish_array** %secret.addr, align 8
  store i8* bitcast ({ i64, [15 x i8] }* @.str.39 to i8*), i8** %word.addr, align 8
  store i32 0, i32* %i.addr.4, align 4
  br label %for.cond.4

for.cond.4:
  %524 = load i32, i32* %i.addr.4, align 4
  %525 = load i8*, i8** %word.addr, align 8
  %526 = bitcast i8* %525 to i64*
  %527 = load i64, i64* %526, align 8
  %528 = trunc i64 %527 to i32
  %529 = icmp slt i32 %524, %528
  br i1 %529, label %for.body.4, label %for.end.4

for.body.4:
  %530 = load %struct.nish_array*, %struct.nish_array** %secret.addr, align 8
  %531 = load i8*, i8** %word.addr, align 8
  %532 = load i32, i32* %i.addr.4, align 4
  %533 = sext i32 %532 to i64
  %534 = getelementptr inbounds i8, i8* %531, i64 8
  %535 = getelementptr inbounds i8, i8* %534, i64 %533
  %536 = load i8, i8* %535, align 1
  %537 = zext i8 %536 to i32
  %538 = trunc i32 %537 to i8
  %539 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %530, i64 0, i32 0
  %540 = load i64, i64* %539, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %541 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %530, i64 0, i32 1
  %542 = load i64, i64* %541, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %543 = icmp eq i64 %540, %542
  br i1 %543, label %push.grow.3, label %push.store.3

push.grow.3:
  call void @nish_array_grow(%struct.nish_array* %530, i64 1)
  br label %push.store.3

push.store.3:
  %544 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %530, i64 0, i32 2
  %545 = load i8*, i8** %544, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %546 = bitcast i8* %545 to i8*
  %547 = getelementptr inbounds i8, i8* %546, i64 %540
  store i8 %538, i8* %547, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %548 = add i64 %540, 1
  store i64 %548, i64* %539, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %549 = trunc i64 %548 to i32
  br label %for.inc.4

for.inc.4:
  %550 = load i32, i32* %i.addr.4, align 4
  %551 = add nsw i32 %550, 1
  store i32 %551, i32* %i.addr.4, align 4
  br label %for.cond.4

for.end.4:
  %552 = call i8* @nish_alloc_struct(i64 24)
  %553 = bitcast i8* %552 to %struct.nish_array*
  %554 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %553, i64 0, i32 0
  store i64 0, i64* %554, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %555 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %553, i64 0, i32 1
  store i64 0, i64* %555, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %556 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %553, i64 0, i32 2
  store i8* null, i8** %556, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %553, %struct.nish_array** %seen.addr, align 8
  %557 = call i8* @nish_alloc_struct(i64 24)
  %558 = bitcast i8* %557 to %struct.nish_array*
  %559 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %558, i64 0, i32 0
  store i64 5, i64* %559, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %560 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %558, i64 0, i32 1
  store i64 5, i64* %560, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %561 = call i8* @nish_alloc_struct(i64 40)
  %562 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %558, i64 0, i32 2
  store i8* %561, i8** %562, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %563 = bitcast i8* %561 to i8**
  %564 = getelementptr inbounds i8*, i8** %563, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.8 to i8*), i8** %564, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %565 = getelementptr inbounds i8*, i8** %563, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.9 to i8*), i8** %565, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %566 = getelementptr inbounds i8*, i8** %563, i64 2
  store i8* bitcast ({ i64, [28 x i8] }* @.str.40 to i8*), i8** %566, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %567 = getelementptr inbounds i8*, i8** %563, i64 3
  store i8* bitcast ({ i64, [12 x i8] }* @.str.41 to i8*), i8** %567, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %568 = getelementptr inbounds i8*, i8** %563, i64 4
  store i8* bitcast ({ i64, [2 x i8] }* @.str.42 to i8*), i8** %568, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %569 = load %struct.nish_array*, %struct.nish_array** %secret.addr, align 8
  %570 = load %struct.nish_array*, %struct.nish_array** %seen.addr, align 8
  %571 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %572 = call i32 @nish_spawn_piped(%struct.nish_array* %558, %struct.nish_array* %569, %struct.nish_array* %570, %struct.nish_array* %571)
  %573 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %573, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %574 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %574, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %575 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %575, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %marker.addr, align 8
  store i8* bitcast ({ i64, [14 x i8] }* @.str.43 to i8*), i8** %name.addr, align 8
  store i32 0, i32* %i.addr.5, align 4
  br label %for.cond.5

for.cond.5:
  %576 = load i32, i32* %i.addr.5, align 4
  %577 = load i8*, i8** %name.addr, align 8
  %578 = bitcast i8* %577 to i64*
  %579 = load i64, i64* %578, align 8
  %580 = trunc i64 %579 to i32
  %581 = icmp slt i32 %576, %580
  br i1 %581, label %for.body.5, label %for.end.5

for.body.5:
  %582 = load %struct.nish_array*, %struct.nish_array** %marker.addr, align 8
  %583 = load i8*, i8** %name.addr, align 8
  %584 = load i32, i32* %i.addr.5, align 4
  %585 = sext i32 %584 to i64
  %586 = getelementptr inbounds i8, i8* %583, i64 8
  %587 = getelementptr inbounds i8, i8* %586, i64 %585
  %588 = load i8, i8* %587, align 1
  %589 = zext i8 %588 to i32
  %590 = trunc i32 %589 to i8
  %591 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %582, i64 0, i32 0
  %592 = load i64, i64* %591, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %593 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %582, i64 0, i32 1
  %594 = load i64, i64* %593, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %595 = icmp eq i64 %592, %594
  br i1 %595, label %push.grow.4, label %push.store.4

push.grow.4:
  call void @nish_array_grow(%struct.nish_array* %582, i64 1)
  br label %push.store.4

push.store.4:
  %596 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %582, i64 0, i32 2
  %597 = load i8*, i8** %596, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %598 = bitcast i8* %597 to i8*
  %599 = getelementptr inbounds i8, i8* %598, i64 %592
  store i8 %590, i8* %599, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %600 = add i64 %592, 1
  store i64 %600, i64* %591, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %601 = trunc i64 %600 to i32
  br label %for.inc.5

for.inc.5:
  %602 = load i32, i32* %i.addr.5, align 4
  %603 = add nsw i32 %602, 1
  store i32 %603, i32* %i.addr.5, align 4
  br label %for.cond.5

for.end.5:
  %604 = load %struct.nish_array*, %struct.nish_array** %seen.addr, align 8
  %605 = load %struct.nish_array*, %struct.nish_array** %secret.addr, align 8
  %606 = call i1 @contains(%struct.nish_array* %604, %struct.nish_array* %605)
  %607 = select i1 %606, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  %608 = call i8* @nish_str_concat(i8* bitcast ({ i64, [17 x i8] }* @.str.44 to i8*), i8* %607)
  %609 = call i8* @nish_str_concat(i8* %608, i8* bitcast ({ i64, [16 x i8] }* @.str.45 to i8*))
  %610 = load %struct.nish_array*, %struct.nish_array** %seen.addr, align 8
  %611 = load %struct.nish_array*, %struct.nish_array** %marker.addr, align 8
  %612 = call i1 @contains(%struct.nish_array* %610, %struct.nish_array* %611)
  %613 = select i1 %612, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  %614 = call i8* @nish_str_concat(i8* %609, i8* %613)
  call void @nish_print(i8* %614)
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

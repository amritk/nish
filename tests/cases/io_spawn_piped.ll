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
  %247 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %241, i64 0, i32 0
  %248 = load i64, i64* %247, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %249 = icmp ule i64 0, %246
  %250 = icmp ule i64 %246, %248
  %251 = and i1 %249, %250
  br i1 %251, label %bytes.ok, label %bytes.fail

bytes.fail:
  call void @nish_panic_slice(i64 0, i64 %246, i64 %248)
  unreachable

bytes.ok:
  %252 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %241, i64 0, i32 2
  %253 = load i8*, i8** %252, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %254 = getelementptr inbounds i8, i8* %253, i64 0
  %255 = sub i64 %246, 0
  %256 = call i8* @nish_str_new(i8* %254, i64 %255)
  %257 = call i8* @nish_str_concat(i8* %240, i8* %256)
  %258 = call i8* @nish_str_concat(i8* %257, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %259 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %260 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %261 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %260, i64 0, i32 0
  %262 = load i64, i64* %261, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %263 = trunc i64 %262 to i32
  %264 = sext i32 %263 to i64
  %265 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %259, i64 0, i32 0
  %266 = load i64, i64* %265, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %267 = icmp ule i64 0, %264
  %268 = icmp ule i64 %264, %266
  %269 = and i1 %267, %268
  br i1 %269, label %bytes.ok.1, label %bytes.fail.1

bytes.fail.1:
  call void @nish_panic_slice(i64 0, i64 %264, i64 %266)
  unreachable

bytes.ok.1:
  %270 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %259, i64 0, i32 2
  %271 = load i8*, i8** %270, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %272 = getelementptr inbounds i8, i8* %271, i64 0
  %273 = sub i64 %264, 0
  %274 = call i8* @nish_str_new(i8* %272, i64 %273)
  %275 = call i8* @nish_str_concat(i8* %258, i8* %274)
  call void @nish_print(i8* %275)
  %276 = call i8* @nish_alloc_struct(i64 24)
  %277 = bitcast i8* %276 to %struct.nish_array*
  %278 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %277, i64 0, i32 0
  store i64 3, i64* %278, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %279 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %277, i64 0, i32 1
  store i64 3, i64* %279, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %280 = call i8* @nish_alloc_struct(i64 24)
  %281 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %277, i64 0, i32 2
  store i8* %280, i8** %281, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %282 = bitcast i8* %280 to i8**
  %283 = getelementptr inbounds i8*, i8** %282, i64 0
  store i8* bitcast ({ i64, [8 x i8] }* @.str.12 to i8*), i8** %283, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %284 = getelementptr inbounds i8*, i8** %282, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.9 to i8*), i8** %284, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %285 = getelementptr inbounds i8*, i8** %282, i64 2
  store i8* bitcast ({ i64, [12 x i8] }* @.str.13 to i8*), i8** %285, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %286 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %287 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %288 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %289 = call i32 @nish_spawn_piped(%struct.nish_array* %277, %struct.nish_array* %286, %struct.nish_array* %287, %struct.nish_array* %288)
  %290 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %291 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %292 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %291, i64 0, i32 0
  %293 = load i64, i64* %292, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %294 = trunc i64 %293 to i32
  %295 = sext i32 %294 to i64
  %296 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %290, i64 0, i32 0
  %297 = load i64, i64* %296, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %298 = icmp ule i64 0, %295
  %299 = icmp ule i64 %295, %297
  %300 = and i1 %298, %299
  br i1 %300, label %bytes.ok.2, label %bytes.fail.2

bytes.fail.2:
  call void @nish_panic_slice(i64 0, i64 %295, i64 %297)
  unreachable

bytes.ok.2:
  %301 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %290, i64 0, i32 2
  %302 = load i8*, i8** %301, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %303 = getelementptr inbounds i8, i8* %302, i64 0
  %304 = sub i64 %295, 0
  %305 = call i8* @nish_str_new(i8* %303, i64 %304)
  %306 = call i8* @nish_str_concat(i8* bitcast ({ i64, [11 x i8] }* @.str.14 to i8*), i8* %305)
  call void @nish_print(i8* %306)
  %307 = call i8* @nish_alloc_struct(i64 24)
  %308 = bitcast i8* %307 to %struct.nish_array*
  %309 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %308, i64 0, i32 0
  store i64 1, i64* %309, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %310 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %308, i64 0, i32 1
  store i64 1, i64* %310, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %311 = call i8* @nish_alloc_struct(i64 8)
  %312 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %308, i64 0, i32 2
  store i8* %311, i8** %312, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %313 = bitcast i8* %311 to i8**
  %314 = getelementptr inbounds i8*, i8** %313, i64 0
  store i8* bitcast ({ i64, [21 x i8] }* @.str.16 to i8*), i8** %314, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %315 = load %struct.nish_array*, %struct.nish_array** %all.addr, align 8
  %316 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %317 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %318 = call i32 @nish_spawn_piped(%struct.nish_array* %308, %struct.nish_array* %315, %struct.nish_array* %316, %struct.nish_array* %317)
  %319 = call i8* @nish_str_from_i32(i32 %318)
  %320 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.15 to i8*), i8* %319)
  call void @nish_print(i8* %320)
  %321 = call i8* @nish_alloc_struct(i64 24)
  %322 = bitcast i8* %321 to %struct.nish_array*
  %323 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %322, i64 0, i32 0
  store i64 1, i64* %323, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %324 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %322, i64 0, i32 1
  store i64 1, i64* %324, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %325 = call i8* @nish_alloc_struct(i64 8)
  %326 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %322, i64 0, i32 2
  store i8* %325, i8** %326, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %327 = bitcast i8* %325 to i8**
  %328 = getelementptr inbounds i8*, i8** %327, i64 0
  store i8* bitcast ({ i64, [23 x i8] }* @.str.18 to i8*), i8** %328, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %329 = load %struct.nish_array*, %struct.nish_array** %all.addr, align 8
  %330 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %331 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %332 = call i32 @nish_spawn_piped(%struct.nish_array* %322, %struct.nish_array* %329, %struct.nish_array* %330, %struct.nish_array* %331)
  %333 = call i8* @nish_str_from_i32(i32 %332)
  %334 = call i8* @nish_str_concat(i8* bitcast ({ i64, [15 x i8] }* @.str.17 to i8*), i8* %333)
  call void @nish_print(i8* %334)
  %335 = call i8* @nish_alloc_struct(i64 24)
  %336 = bitcast i8* %335 to %struct.nish_array*
  %337 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %336, i64 0, i32 0
  store i64 1, i64* %337, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %338 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %336, i64 0, i32 1
  store i64 1, i64* %338, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %339 = call i8* @nish_alloc_struct(i64 8)
  %340 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %336, i64 0, i32 2
  store i8* %339, i8** %340, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %341 = bitcast i8* %339 to i8**
  %342 = getelementptr inbounds i8*, i8** %341, i64 0
  store i8* bitcast ({ i64, [1 x i8] }* @.str.20 to i8*), i8** %342, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %343 = load %struct.nish_array*, %struct.nish_array** %all.addr, align 8
  %344 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %345 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %346 = call i32 @nish_spawn_piped(%struct.nish_array* %336, %struct.nish_array* %343, %struct.nish_array* %344, %struct.nish_array* %345)
  %347 = call i8* @nish_str_from_i32(i32 %346)
  %348 = call i8* @nish_str_concat(i8* bitcast ({ i64, [16 x i8] }* @.str.19 to i8*), i8* %347)
  call void @nish_print(i8* %348)
  %349 = trunc i64 0 to i8
  store i8 %349, i8* %chr, align 1
  %350 = call i8* @nish_str_new(i8* %chr, i64 1)
  %351 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.21 to i8*), i8* %350)
  %352 = call i8* @nish_str_concat(i8* %351, i8* bitcast ({ i64, [2 x i8] }* @.str.22 to i8*))
  store i8* %352, i8** %nul.addr, align 8
  %353 = load i8*, i8** %nul.addr, align 8
  %354 = call i8* @nish_alloc_struct(i64 24)
  %355 = bitcast i8* %354 to %struct.nish_array*
  %356 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %355, i64 0, i32 0
  store i64 2, i64* %356, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %357 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %355, i64 0, i32 1
  store i64 2, i64* %357, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %358 = call i8* @nish_alloc_struct(i64 16)
  %359 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %355, i64 0, i32 2
  store i8* %358, i8** %359, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %360 = bitcast i8* %358 to i8**
  %361 = getelementptr inbounds i8*, i8** %360, i64 0
  store i8* bitcast ({ i64, [5 x i8] }* @.str.24 to i8*), i8** %361, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %362 = getelementptr inbounds i8*, i8** %360, i64 1
  store i8* %353, i8** %362, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %363 = load %struct.nish_array*, %struct.nish_array** %all.addr, align 8
  %364 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %365 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %366 = call i32 @nish_spawn_piped(%struct.nish_array* %355, %struct.nish_array* %363, %struct.nish_array* %364, %struct.nish_array* %365)
  %367 = call i8* @nish_str_from_i32(i32 %366)
  %368 = call i8* @nish_str_concat(i8* bitcast ({ i64, [15 x i8] }* @.str.23 to i8*), i8* %367)
  %369 = call i8* @nish_str_concat(i8* %368, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %370 = load i8*, i8** %nul.addr, align 8
  %371 = call i8* @nish_alloc_struct(i64 24)
  %372 = bitcast i8* %371 to %struct.nish_array*
  %373 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %372, i64 0, i32 0
  store i64 1, i64* %373, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %374 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %372, i64 0, i32 1
  store i64 1, i64* %374, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %375 = call i8* @nish_alloc_struct(i64 8)
  %376 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %372, i64 0, i32 2
  store i8* %375, i8** %376, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %377 = bitcast i8* %375 to i8**
  %378 = getelementptr inbounds i8*, i8** %377, i64 0
  store i8* %370, i8** %378, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %379 = load %struct.nish_array*, %struct.nish_array** %all.addr, align 8
  %380 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %381 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %382 = call i32 @nish_spawn_piped(%struct.nish_array* %372, %struct.nish_array* %379, %struct.nish_array* %380, %struct.nish_array* %381)
  %383 = call i8* @nish_str_from_i32(i32 %382)
  %384 = call i8* @nish_str_concat(i8* %369, i8* %383)
  call void @nish_print(i8* %384)
  %385 = call i8* @nish_alloc_struct(i64 24)
  %386 = bitcast i8* %385 to %struct.nish_array*
  %387 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %386, i64 0, i32 0
  store i64 1, i64* %387, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %388 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %386, i64 0, i32 1
  store i64 1, i64* %388, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %389 = call i8* @nish_alloc_struct(i64 8)
  %390 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %386, i64 0, i32 2
  store i8* %389, i8** %390, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %391 = bitcast i8* %389 to i8**
  %392 = getelementptr inbounds i8*, i8** %391, i64 0
  store i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8** %392, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %393 = load %struct.nish_array*, %struct.nish_array** %big.addr, align 8
  %394 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %395 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %396 = call i32 @nish_spawn_piped(%struct.nish_array* %386, %struct.nish_array* %393, %struct.nish_array* %394, %struct.nish_array* %395)
  %397 = call i8* @nish_str_from_i32(i32 %396)
  %398 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.25 to i8*), i8* %397)
  call void @nish_print(i8* %398)
  %399 = call i8* @nish_alloc_struct(i64 24)
  %400 = bitcast i8* %399 to %struct.nish_array*
  %401 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %400, i64 0, i32 0
  store i64 3, i64* %401, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %402 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %400, i64 0, i32 1
  store i64 3, i64* %402, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %403 = call i8* @nish_alloc_struct(i64 24)
  %404 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %400, i64 0, i32 2
  store i8* %403, i8** %404, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %405 = bitcast i8* %403 to i8**
  %406 = getelementptr inbounds i8*, i8** %405, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.8 to i8*), i8** %406, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %407 = getelementptr inbounds i8*, i8** %405, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.9 to i8*), i8** %407, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %408 = getelementptr inbounds i8*, i8** %405, i64 2
  store i8* bitcast ({ i64, [26 x i8] }* @.str.27 to i8*), i8** %408, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %409 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %410 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %411 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %412 = call i32 @nish_spawn_piped(%struct.nish_array* %400, %struct.nish_array* %409, %struct.nish_array* %410, %struct.nish_array* %411)
  %413 = call i8* @nish_str_from_i32(i32 %412)
  %414 = call i8* @nish_str_concat(i8* bitcast ({ i64, [16 x i8] }* @.str.26 to i8*), i8* %413)
  call void @nish_print(i8* %414)
  %415 = call i8* @nish_alloc_struct(i64 24)
  %416 = bitcast i8* %415 to %struct.nish_array*
  %417 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %416, i64 0, i32 0
  store i64 0, i64* %417, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %418 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %416, i64 0, i32 1
  store i64 0, i64* %418, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %419 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %416, i64 0, i32 2
  store i8* null, i8** %419, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %416, %struct.nish_array** %flood.addr, align 8
  %420 = call i8* @nish_alloc_struct(i64 24)
  %421 = bitcast i8* %420 to %struct.nish_array*
  %422 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %421, i64 0, i32 0
  store i64 1, i64* %422, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %423 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %421, i64 0, i32 1
  store i64 1, i64* %423, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %424 = call i8* @nish_alloc_struct(i64 8)
  %425 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %421, i64 0, i32 2
  store i8* %424, i8** %425, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %426 = bitcast i8* %424 to i8**
  %427 = getelementptr inbounds i8*, i8** %426, i64 0
  store i8* bitcast ({ i64, [4 x i8] }* @.str.28 to i8*), i8** %427, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %428 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %429 = load %struct.nish_array*, %struct.nish_array** %flood.addr, align 8
  %430 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %431 = call i32 @nish_spawn_piped(%struct.nish_array* %421, %struct.nish_array* %428, %struct.nish_array* %429, %struct.nish_array* %430)
  store i32 %431, i32* %floodStatus.addr, align 4
  %432 = load i32, i32* %floodStatus.addr, align 4
  %433 = call i8* @nish_str_from_i32(i32 %432)
  %434 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.29 to i8*), i8* %433)
  %435 = call i8* @nish_str_concat(i8* %434, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %436 = load %struct.nish_array*, %struct.nish_array** %flood.addr, align 8
  %437 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %436, i64 0, i32 0
  %438 = load i64, i64* %437, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %439 = trunc i64 %438 to i32
  %440 = call i8* @nish_str_from_i32(i32 %439)
  %441 = call i8* @nish_str_concat(i8* %435, i8* %440)
  call void @nish_print(i8* %441)
  %442 = call i8* @nish_alloc_struct(i64 24)
  %443 = bitcast i8* %442 to %struct.nish_array*
  %444 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %443, i64 0, i32 0
  store i64 0, i64* %444, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %445 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %443, i64 0, i32 1
  store i64 0, i64* %445, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %446 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %443, i64 0, i32 2
  store i8* null, i8** %446, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %443, %struct.nish_array** %errFlood.addr, align 8
  %447 = call i8* @nish_alloc_struct(i64 24)
  %448 = bitcast i8* %447 to %struct.nish_array*
  %449 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %448, i64 0, i32 0
  store i64 3, i64* %449, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %450 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %448, i64 0, i32 1
  store i64 3, i64* %450, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %451 = call i8* @nish_alloc_struct(i64 24)
  %452 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %448, i64 0, i32 2
  store i8* %451, i8** %452, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %453 = bitcast i8* %451 to i8**
  %454 = getelementptr inbounds i8*, i8** %453, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.8 to i8*), i8** %454, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %455 = getelementptr inbounds i8*, i8** %453, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.9 to i8*), i8** %455, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %456 = getelementptr inbounds i8*, i8** %453, i64 2
  store i8* bitcast ({ i64, [8 x i8] }* @.str.30 to i8*), i8** %456, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %457 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %458 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %459 = load %struct.nish_array*, %struct.nish_array** %errFlood.addr, align 8
  %460 = call i32 @nish_spawn_piped(%struct.nish_array* %448, %struct.nish_array* %457, %struct.nish_array* %458, %struct.nish_array* %459)
  store i32 %460, i32* %errFloodStatus.addr, align 4
  %461 = load i32, i32* %errFloodStatus.addr, align 4
  %462 = call i8* @nish_str_from_i32(i32 %461)
  %463 = call i8* @nish_str_concat(i8* bitcast ({ i64, [15 x i8] }* @.str.31 to i8*), i8* %462)
  %464 = call i8* @nish_str_concat(i8* %463, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %465 = load %struct.nish_array*, %struct.nish_array** %errFlood.addr, align 8
  %466 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %465, i64 0, i32 0
  %467 = load i64, i64* %466, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %468 = trunc i64 %467 to i32
  %469 = call i8* @nish_str_from_i32(i32 %468)
  %470 = call i8* @nish_str_concat(i8* %464, i8* %469)
  call void @nish_print(i8* %470)
  %471 = call i8* @nish_alloc_struct(i64 24)
  %472 = bitcast i8* %471 to %struct.nish_array*
  %473 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %472, i64 0, i32 0
  store i64 0, i64* %473, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %474 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %472, i64 0, i32 1
  store i64 0, i64* %474, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %475 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %472, i64 0, i32 2
  store i8* null, i8** %475, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %472, %struct.nish_array** %atCap.addr, align 8
  %476 = call i8* @nish_alloc_struct(i64 24)
  %477 = bitcast i8* %476 to %struct.nish_array*
  %478 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %477, i64 0, i32 0
  store i64 4, i64* %478, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %479 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %477, i64 0, i32 1
  store i64 4, i64* %479, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %480 = call i8* @nish_alloc_struct(i64 32)
  %481 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %477, i64 0, i32 2
  store i8* %480, i8** %481, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %482 = bitcast i8* %480 to i8**
  %483 = getelementptr inbounds i8*, i8** %482, i64 0
  store i8* bitcast ({ i64, [5 x i8] }* @.str.32 to i8*), i8** %483, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %484 = getelementptr inbounds i8*, i8** %482, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.9 to i8*), i8** %484, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %485 = getelementptr inbounds i8*, i8** %482, i64 2
  store i8* bitcast ({ i64, [9 x i8] }* @.str.33 to i8*), i8** %485, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %486 = getelementptr inbounds i8*, i8** %482, i64 3
  store i8* bitcast ({ i64, [10 x i8] }* @.str.34 to i8*), i8** %486, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %487 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %488 = load %struct.nish_array*, %struct.nish_array** %atCap.addr, align 8
  %489 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %490 = call i32 @nish_spawn_piped(%struct.nish_array* %477, %struct.nish_array* %487, %struct.nish_array* %488, %struct.nish_array* %489)
  store i32 %490, i32* %atCapStatus.addr, align 4
  %491 = load i32, i32* %atCapStatus.addr, align 4
  %492 = call i8* @nish_str_from_i32(i32 %491)
  %493 = call i8* @nish_str_concat(i8* bitcast ({ i64, [9 x i8] }* @.str.35 to i8*), i8* %492)
  %494 = call i8* @nish_str_concat(i8* %493, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %495 = load %struct.nish_array*, %struct.nish_array** %atCap.addr, align 8
  %496 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %495, i64 0, i32 0
  %497 = load i64, i64* %496, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %498 = trunc i64 %497 to i32
  %499 = call i8* @nish_str_from_i32(i32 %498)
  %500 = call i8* @nish_str_concat(i8* %494, i8* %499)
  call void @nish_print(i8* %500)
  %501 = call i8* @nish_alloc_struct(i64 24)
  %502 = bitcast i8* %501 to %struct.nish_array*
  %503 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %502, i64 0, i32 0
  store i64 0, i64* %503, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %504 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %502, i64 0, i32 1
  store i64 0, i64* %504, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %505 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %502, i64 0, i32 2
  store i8* null, i8** %505, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %502, %struct.nish_array** %fds.addr, align 8
  store i8* bitcast ({ i64, [85 x i8] }* @.str.36 to i8*), i8** %probe.addr, align 8
  %506 = load i8*, i8** %probe.addr, align 8
  %507 = call i8* @nish_alloc_struct(i64 24)
  %508 = bitcast i8* %507 to %struct.nish_array*
  %509 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %508, i64 0, i32 0
  store i64 3, i64* %509, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %510 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %508, i64 0, i32 1
  store i64 3, i64* %510, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %511 = call i8* @nish_alloc_struct(i64 24)
  %512 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %508, i64 0, i32 2
  store i8* %511, i8** %512, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %513 = bitcast i8* %511 to i8**
  %514 = getelementptr inbounds i8*, i8** %513, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.8 to i8*), i8** %514, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %515 = getelementptr inbounds i8*, i8** %513, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.9 to i8*), i8** %515, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %516 = getelementptr inbounds i8*, i8** %513, i64 2
  store i8* %506, i8** %516, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %517 = load %struct.nish_array*, %struct.nish_array** %none.addr, align 8
  %518 = load %struct.nish_array*, %struct.nish_array** %fds.addr, align 8
  %519 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %520 = call i32 @nish_spawn_piped(%struct.nish_array* %508, %struct.nish_array* %517, %struct.nish_array* %518, %struct.nish_array* %519)
  %521 = load %struct.nish_array*, %struct.nish_array** %fds.addr, align 8
  %522 = load %struct.nish_array*, %struct.nish_array** %fds.addr, align 8
  %523 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %522, i64 0, i32 0
  %524 = load i64, i64* %523, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %525 = trunc i64 %524 to i32
  %526 = sext i32 %525 to i64
  %527 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %521, i64 0, i32 0
  %528 = load i64, i64* %527, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %529 = icmp ule i64 0, %526
  %530 = icmp ule i64 %526, %528
  %531 = and i1 %529, %530
  br i1 %531, label %bytes.ok.3, label %bytes.fail.3

bytes.fail.3:
  call void @nish_panic_slice(i64 0, i64 %526, i64 %528)
  unreachable

bytes.ok.3:
  %532 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %521, i64 0, i32 2
  %533 = load i8*, i8** %532, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %534 = getelementptr inbounds i8, i8* %533, i64 0
  %535 = sub i64 %526, 0
  %536 = call i8* @nish_str_new(i8* %534, i64 %535)
  %537 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.37 to i8*), i8* %536)
  %538 = call i8* @nish_str_concat(i8* %537, i8* bitcast ({ i64, [2 x i8] }* @.str.38 to i8*))
  call void @nish_print(i8* %538)
  %539 = call i8* @nish_alloc_struct(i64 24)
  %540 = bitcast i8* %539 to %struct.nish_array*
  %541 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %540, i64 0, i32 0
  store i64 0, i64* %541, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %542 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %540, i64 0, i32 1
  store i64 0, i64* %542, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %543 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %540, i64 0, i32 2
  store i8* null, i8** %543, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %540, %struct.nish_array** %secret.addr, align 8
  store i8* bitcast ({ i64, [15 x i8] }* @.str.39 to i8*), i8** %word.addr, align 8
  store i32 0, i32* %i.addr.4, align 4
  br label %for.cond.4

for.cond.4:
  %544 = load i32, i32* %i.addr.4, align 4
  %545 = load i8*, i8** %word.addr, align 8
  %546 = bitcast i8* %545 to i64*
  %547 = load i64, i64* %546, align 8
  %548 = trunc i64 %547 to i32
  %549 = icmp slt i32 %544, %548
  br i1 %549, label %for.body.4, label %for.end.4

for.body.4:
  %550 = load %struct.nish_array*, %struct.nish_array** %secret.addr, align 8
  %551 = load i8*, i8** %word.addr, align 8
  %552 = load i32, i32* %i.addr.4, align 4
  %553 = sext i32 %552 to i64
  %554 = getelementptr inbounds i8, i8* %551, i64 8
  %555 = getelementptr inbounds i8, i8* %554, i64 %553
  %556 = load i8, i8* %555, align 1
  %557 = zext i8 %556 to i32
  %558 = trunc i32 %557 to i8
  %559 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %550, i64 0, i32 0
  %560 = load i64, i64* %559, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %561 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %550, i64 0, i32 1
  %562 = load i64, i64* %561, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %563 = icmp eq i64 %560, %562
  br i1 %563, label %push.grow.3, label %push.store.3

push.grow.3:
  call void @nish_array_grow(%struct.nish_array* %550, i64 1)
  br label %push.store.3

push.store.3:
  %564 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %550, i64 0, i32 2
  %565 = load i8*, i8** %564, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %566 = bitcast i8* %565 to i8*
  %567 = getelementptr inbounds i8, i8* %566, i64 %560
  store i8 %558, i8* %567, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %568 = add i64 %560, 1
  store i64 %568, i64* %559, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %569 = trunc i64 %568 to i32
  br label %for.inc.4

for.inc.4:
  %570 = load i32, i32* %i.addr.4, align 4
  %571 = add nsw i32 %570, 1
  store i32 %571, i32* %i.addr.4, align 4
  br label %for.cond.4

for.end.4:
  %572 = call i8* @nish_alloc_struct(i64 24)
  %573 = bitcast i8* %572 to %struct.nish_array*
  %574 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %573, i64 0, i32 0
  store i64 0, i64* %574, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %575 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %573, i64 0, i32 1
  store i64 0, i64* %575, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %576 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %573, i64 0, i32 2
  store i8* null, i8** %576, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %573, %struct.nish_array** %seen.addr, align 8
  %577 = call i8* @nish_alloc_struct(i64 24)
  %578 = bitcast i8* %577 to %struct.nish_array*
  %579 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %578, i64 0, i32 0
  store i64 5, i64* %579, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %580 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %578, i64 0, i32 1
  store i64 5, i64* %580, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %581 = call i8* @nish_alloc_struct(i64 40)
  %582 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %578, i64 0, i32 2
  store i8* %581, i8** %582, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %583 = bitcast i8* %581 to i8**
  %584 = getelementptr inbounds i8*, i8** %583, i64 0
  store i8* bitcast ({ i64, [3 x i8] }* @.str.8 to i8*), i8** %584, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %585 = getelementptr inbounds i8*, i8** %583, i64 1
  store i8* bitcast ({ i64, [3 x i8] }* @.str.9 to i8*), i8** %585, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %586 = getelementptr inbounds i8*, i8** %583, i64 2
  store i8* bitcast ({ i64, [28 x i8] }* @.str.40 to i8*), i8** %586, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %587 = getelementptr inbounds i8*, i8** %583, i64 3
  store i8* bitcast ({ i64, [12 x i8] }* @.str.41 to i8*), i8** %587, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %588 = getelementptr inbounds i8*, i8** %583, i64 4
  store i8* bitcast ({ i64, [2 x i8] }* @.str.42 to i8*), i8** %588, align 8, !alias.scope !4, !noalias !3, !tbaa !16
  %589 = load %struct.nish_array*, %struct.nish_array** %secret.addr, align 8
  %590 = load %struct.nish_array*, %struct.nish_array** %seen.addr, align 8
  %591 = load %struct.nish_array*, %struct.nish_array** %err.addr, align 8
  %592 = call i32 @nish_spawn_piped(%struct.nish_array* %578, %struct.nish_array* %589, %struct.nish_array* %590, %struct.nish_array* %591)
  %593 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %593, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %594 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %594, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %595 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %595, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %marker.addr, align 8
  store i8* bitcast ({ i64, [14 x i8] }* @.str.43 to i8*), i8** %name.addr, align 8
  store i32 0, i32* %i.addr.5, align 4
  br label %for.cond.5

for.cond.5:
  %596 = load i32, i32* %i.addr.5, align 4
  %597 = load i8*, i8** %name.addr, align 8
  %598 = bitcast i8* %597 to i64*
  %599 = load i64, i64* %598, align 8
  %600 = trunc i64 %599 to i32
  %601 = icmp slt i32 %596, %600
  br i1 %601, label %for.body.5, label %for.end.5

for.body.5:
  %602 = load %struct.nish_array*, %struct.nish_array** %marker.addr, align 8
  %603 = load i8*, i8** %name.addr, align 8
  %604 = load i32, i32* %i.addr.5, align 4
  %605 = sext i32 %604 to i64
  %606 = getelementptr inbounds i8, i8* %603, i64 8
  %607 = getelementptr inbounds i8, i8* %606, i64 %605
  %608 = load i8, i8* %607, align 1
  %609 = zext i8 %608 to i32
  %610 = trunc i32 %609 to i8
  %611 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %602, i64 0, i32 0
  %612 = load i64, i64* %611, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %613 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %602, i64 0, i32 1
  %614 = load i64, i64* %613, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %615 = icmp eq i64 %612, %614
  br i1 %615, label %push.grow.4, label %push.store.4

push.grow.4:
  call void @nish_array_grow(%struct.nish_array* %602, i64 1)
  br label %push.store.4

push.store.4:
  %616 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %602, i64 0, i32 2
  %617 = load i8*, i8** %616, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %618 = bitcast i8* %617 to i8*
  %619 = getelementptr inbounds i8, i8* %618, i64 %612
  store i8 %610, i8* %619, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %620 = add i64 %612, 1
  store i64 %620, i64* %611, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %621 = trunc i64 %620 to i32
  br label %for.inc.5

for.inc.5:
  %622 = load i32, i32* %i.addr.5, align 4
  %623 = add nsw i32 %622, 1
  store i32 %623, i32* %i.addr.5, align 4
  br label %for.cond.5

for.end.5:
  %624 = load %struct.nish_array*, %struct.nish_array** %seen.addr, align 8
  %625 = load %struct.nish_array*, %struct.nish_array** %secret.addr, align 8
  %626 = call i1 @contains(%struct.nish_array* %624, %struct.nish_array* %625)
  %627 = select i1 %626, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  %628 = call i8* @nish_str_concat(i8* bitcast ({ i64, [17 x i8] }* @.str.44 to i8*), i8* %627)
  %629 = call i8* @nish_str_concat(i8* %628, i8* bitcast ({ i64, [16 x i8] }* @.str.45 to i8*))
  %630 = load %struct.nish_array*, %struct.nish_array** %seen.addr, align 8
  %631 = load %struct.nish_array*, %struct.nish_array** %marker.addr, align 8
  %632 = call i1 @contains(%struct.nish_array* %630, %struct.nish_array* %631)
  %633 = select i1 %632, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.4 to i8*)
  %634 = call i8* @nish_str_concat(i8* %629, i8* %633)
  call void @nish_print(i8* %634)
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

%struct.Setup = type { i1, i8* }
%struct.Style = type { i8* }
%struct.Pair = type { i8* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_result.i32.str = type { i1, i32, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"none\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"three\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"0\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"no\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"x\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c",\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [23 x i8] } { i64 22, [23 x i8] c"NISH_KEPT_MEMORY_UNSET\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #4
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef align 8 i8* @nish_getenv(i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #5
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #6

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #7 {
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

define internal noundef i32 @relabel(i32 noundef %n) #0 {
entry:
  %s.addr = alloca i8*, align 8
  store i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  %0 = icmp sgt i32 %n, 2
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call i8* @nish_str_from_i32(i32 %n)
  %2 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* %1)
  store i8* %2, i8** %s.addr, align 8
  br label %if.end

if.end:
  %3 = load i8*, i8** %s.addr, align 8
  %4 = bitcast i8* %3 to i64*
  %5 = load i64, i64* %4, align 8
  %6 = trunc i64 %5 to i32
  ret i32 %6
}

define internal noundef i32 @fixed(i32 noundef %n) #0 {
entry:
  %s.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = icmp sgt i32 %n, 2
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = call i8* @nish_str_from_i32(i32 %n)
  %2 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* %1)
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %3 = phi i8* [ %2, %cond.true ], [ bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), %cond.false ]
  store i8* %3, i8** %s.addr, align 8
  %4 = load i8*, i8** %s.addr, align 8
  %5 = bitcast i8* %4 to i64*
  %6 = load i64, i64* %5, align 8
  %7 = trunc i64 %6 to i32
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %7
}

define internal noundef i32 @scoped(i32 noundef %n) #0 {
entry:
  %a.addr = alloca i64, align 8
  %s.addr = alloca i8*, align 8
  %0 = call i64 @nish_arena_mark()
  store i64 %0, i64* %a.addr, align 8
  %1 = load i64, i64* %a.addr, align 8
  store i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  %2 = icmp sgt i32 %n, 2
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = call i8* @nish_str_from_i32(i32 %n)
  %4 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* %3)
  store i8* %4, i8** %s.addr, align 8
  br label %if.end

if.end:
  %5 = load i8*, i8** %s.addr, align 8
  %6 = bitcast i8* %5 to i64*
  %7 = load i64, i64* %6, align 8
  %8 = trunc i64 %7 to i32
  call void @nish_arena_release(i64 %1)
  ret i32 %8
}

define internal noundef i32 @pick(i32 noundef %n) #1 {
entry:
  %r.addr = alloca %struct.nish_result.i32.str*, align 8
  %nish_result.i32.str.obj = alloca %struct.nish_result.i32.str, align 8
  %nish_result.i32.str.obj.1 = alloca %struct.nish_result.i32.str, align 8
  %0 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %nish_result.i32.str.obj, i32 0, i32 0
  store i1 true, i1* %0, align 1
  %1 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %nish_result.i32.str.obj, i32 0, i32 1
  store i32 %n, i32* %1, align 4
  store %struct.nish_result.i32.str* %nish_result.i32.str.obj, %struct.nish_result.i32.str** %r.addr, align 8
  %2 = srem i32 %n, 3
  %3 = icmp eq i32 %2, 0
  br i1 %3, label %land.rhs, label %land.end

land.rhs:
  %4 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r.addr, align 8
  %5 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %4, i32 0, i32 0
  %6 = load i1, i1* %5, align 1
  br label %land.end

land.end:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %nish_result.i32.str.obj.1, i32 0, i32 0
  store i1 false, i1* %8, align 1
  %9 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %nish_result.i32.str.obj.1, i32 0, i32 2
  store i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*), i8** %9, align 8
  store %struct.nish_result.i32.str* %nish_result.i32.str.obj.1, %struct.nish_result.i32.str** %r.addr, align 8
  br label %if.end

if.end:
  %10 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r.addr, align 8
  %11 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %10, i32 0, i32 0
  %12 = load i1, i1* %11, align 1
  br i1 %12, label %res.ok, label %res.alt

res.ok:
  %13 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %10, i32 0, i32 1
  %14 = load i32, i32* %13, align 4
  br label %res.end

res.alt:
  br label %res.end

res.end:
  %15 = phi i32 [ %14, %res.ok ], [ -1, %res.alt ]
  ret i32 %15
}

define internal noundef i32 @outer(i32 noundef %n) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @relabel(i32 %n)
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 1)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %2

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @tally(i32 noundef %n) #1 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %3 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %4 = call i8* @nish_str_from_i32(i32 %n)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = icmp eq i64 %6, %8
  br i1 %9, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %3, i64 8)
  br label %push.store

push.store:
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %12 = bitcast i8* %11 to i8**
  %13 = getelementptr inbounds i8*, i8** %12, i64 %6
  store i8* %4, i8** %13, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %14 = add i64 %6, 1
  store i64 %14, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = trunc i64 %14 to i32
  %16 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = trunc i64 %18 to i32
  ret i32 %19
}

define internal void @prepare(%struct.Setup* noundef nonnull align 8 dereferenceable(16) nocapture %s) #1 {
entry:
  %0 = getelementptr inbounds %struct.Setup, %struct.Setup* %s, i32 0, i32 0
  %1 = load i1, i1* %0, align 1, !tbaa !18
  br i1 %1, label %if.then, label %if.end

if.then:
  ret void

if.end:
  %2 = getelementptr inbounds %struct.Setup, %struct.Setup* %s, i32 0, i32 0
  store i1 true, i1* %2, align 1, !tbaa !18
  %3 = call i32 @tally(i32 3)
  %4 = call i8* @nish_str_from_i32(i32 %3)
  %5 = getelementptr inbounds %struct.Setup, %struct.Setup* %s, i32 0, i32 1
  store i8* %4, i8** %5, align 8, !tbaa !19
  ret void
}

define internal noundef nonnull align 8 i8* @Style.get(%struct.Style* noundef nonnull align 8 dereferenceable(8) nocapture %this, i32 noundef %n) #1 {
entry:
  %known.addr = alloca i8*, align 8
  %v.addr = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.Style, %struct.Style* %this, i32 0, i32 0
  %1 = load i8*, i8** %0, align 8, !tbaa !21
  store i8* %1, i8** %known.addr, align 8
  %2 = load i8*, i8** %known.addr, align 8
  %3 = icmp ne i8* %2, null
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = load i8*, i8** %known.addr, align 8
  ret i8* %4

if.end:
  %5 = call i32 @tally(i32 %n)
  %6 = call i8* @nish_str_from_i32(i32 %5)
  store i8* %6, i8** %v.addr, align 8
  %7 = load i8*, i8** %v.addr, align 8
  %8 = getelementptr inbounds %struct.Style, %struct.Style* %this, i32 0, i32 0
  store i8* %7, i8** %8, align 8, !tbaa !21
  %9 = load i8*, i8** %v.addr, align 8
  ret i8* %9
}

define internal noundef zeroext i1 @isNo(i8* noundef nonnull noalias readonly align 8 nocapture %value) #2 {
entry:
  %0 = call zeroext i1 @nish_str_eq(i8* %value, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = call zeroext i1 @nish_str_eq(i8* %value, i8* bitcast ({ i64, [3 x i8] }* @.str.4 to i8*))
  br label %lor.end

lor.end:
  %2 = phi i1 [ true, %entry ], [ %1, %lor.rhs ]
  ret i1 %2
}

define internal noundef zeroext i1 @saysNo(i8* noundef noalias readonly align 8 %value) #2 {
entry:
  %0 = icmp ne i8* %value, null
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = call i1 @isNo(i8* %value)
  br label %land.end

land.end:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs ]
  ret i1 %2
}

define internal noundef zeroext i1 @envSaysNo(i8* noundef nonnull noalias readonly align 8 nocapture %name) #1 {
entry:
  %0 = call i8* @nish_getenv(i8* %name)
  %1 = call i1 @saysNo(i8* %0)
  ret i1 %1
}

define internal noundef i32 @argc(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %argv) #2 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %argv, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = trunc i64 %1 to i32
  ret i32 %2
}

define internal noundef i32 @listed(i32 noundef %n) #1 {
entry:
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i8*], align 8
  %0 = call i8* @nish_str_from_i32(i32 %n)
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %3 = bitcast [2 x i8*]* %arr.data to i8*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %5 = bitcast i8* %3 to i8**
  %6 = getelementptr inbounds i8*, i8** %5, i64 0
  store i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*), i8** %6, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i8*, i8** %5, i64 1
  store i8* %0, i8** %7, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = call i32 @argc(%struct.nish_array* %arr.hdr)
  ret i32 %8
}

define internal noundef i32 @keyLength(%struct.Pair* noundef nonnull readonly align 8 dereferenceable(8) nocapture %p) #2 {
entry:
  %0 = getelementptr inbounds %struct.Pair, %struct.Pair* %p, i32 0, i32 0
  %1 = load i8*, i8** %0, align 8
  %2 = bitcast i8* %1 to i64*
  %3 = load i64, i64* %2, align 8
  %4 = trunc i64 %3 to i32
  ret i32 %4
}

define internal noundef i32 @paired(i32 noundef %n) #1 {
entry:
  %Pair.obj = alloca %struct.Pair, align 8
  %0 = call i8* @nish_str_from_i32(i32 %n)
  %1 = getelementptr inbounds %struct.Pair, %struct.Pair* %Pair.obj, i32 0, i32 0
  store i8* %0, i8** %1, align 8
  %2 = call i32 @keyLength(%struct.Pair* %Pair.obj)
  ret i32 %2
}

define internal noundef i32 @joined(i32 noundef %n) #1 {
entry:
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i8*], align 8
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = call i8* @nish_str_from_i32(i32 %n)
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %3 = bitcast [2 x i8*]* %arr.data to i8*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %5 = bitcast i8* %3 to i8**
  %6 = getelementptr inbounds i8*, i8** %5, i64 0
  store i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*), i8** %6, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i8*, i8** %5, i64 1
  store i8* %0, i8** %7, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*) to i64*
  %11 = load i64, i64* %10, align 8
  %12 = sub i64 %9, 1
  %13 = mul i64 %11, %12
  %14 = icmp eq i64 %9, 0
  %15 = select i1 %14, i64 0, i64 %13
  store i64 %15, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %16 = load i64, i64* %join.at, align 8
  %17 = icmp ult i64 %16, %9
  br i1 %17, label %join.sum.body, label %join.copy

join.sum.body:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %20 = bitcast i8* %19 to i8**
  %21 = getelementptr inbounds i8*, i8** %20, i64 %16
  %22 = load i8*, i8** %21, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %23 = load i64, i64* %join.total, align 8
  %24 = bitcast i8* %22 to i64*
  %25 = load i64, i64* %24, align 8
  %26 = add i64 %23, %25
  store i64 %26, i64* %join.total, align 8
  %27 = add i64 %16, 1
  store i64 %27, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %28 = load i64, i64* %join.total, align 8
  %29 = icmp ugt i64 %28, 2147483647
  %30 = add i64 %28, 9
  %31 = select i1 %29, i64 4611686018427387904, i64 %30
  %32 = call i8* @nish_alloc_struct(i64 %31)
  %33 = bitcast i8* %32 to i64*
  store i64 %28, i64* %33, align 8
  %34 = getelementptr inbounds i8, i8* %32, i64 8
  store i8* %34, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %35 = load i64, i64* %join.at, align 8
  %36 = icmp ult i64 %35, %9
  br i1 %36, label %join.part, label %join.end

join.part:
  %37 = load i8*, i8** %join.p, align 8
  %38 = icmp eq i64 %35, 0
  %39 = select i1 %38, i64 0, i64 %11
  %40 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %37, i8* %40, i64 %39, i1 false)
  %41 = getelementptr inbounds i8, i8* %37, i64 %39
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  %43 = load i8*, i8** %42, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %44 = bitcast i8* %43 to i8**
  %45 = getelementptr inbounds i8*, i8** %44, i64 %35
  %46 = load i8*, i8** %45, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %47 = bitcast i8* %46 to i64*
  %48 = load i64, i64* %47, align 8
  %49 = getelementptr inbounds i8, i8* %46, i64 8
  %50 = icmp eq i64 %48, 1
  br i1 %50, label %join.byte, label %join.bulk

join.byte:
  %51 = load i8, i8* %49, align 1
  store i8 %51, i8* %41, align 1
  br label %join.next

join.bulk:
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %41, i8* %49, i64 %48, i1 false)
  br label %join.next

join.next:
  %52 = getelementptr inbounds i8, i8* %41, i64 %48
  store i8* %52, i8** %join.p, align 8
  %53 = add i64 %35, 1
  store i64 %53, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %54 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %54, align 1
  %55 = bitcast i8* %32 to i64*
  %56 = load i64, i64* %55, align 8
  %57 = trunc i64 %56 to i32
  ret i32 %57
}

define internal noundef i32 @keepDeep(i32 noundef %n) #1 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %3 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %4 = call i8* @nish_str_from_i32(i32 %n)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %9 = icmp eq i64 %6, %8
  br i1 %9, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %3, i64 8)
  br label %push.store

push.store:
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %12 = bitcast i8* %11 to i8**
  %13 = getelementptr inbounds i8*, i8** %12, i64 %6
  store i8* %4, i8** %13, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %14 = add i64 %6, 1
  store i64 %14, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = trunc i64 %14 to i32
  %16 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = trunc i64 %18 to i32
  ret i32 %19
}

define internal noundef nonnull align 8 i8* @keepVia(i32 noundef %n) #1 {
entry:
  %0 = call i32 @keepDeep(i32 %n)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  ret i8* %1
}

define void @nish_main() #0 {
entry:
  %setup.addr = alloca %struct.Setup*, align 8
  %Setup.obj = alloca %struct.Setup, align 8
  %style.addr = alloca %struct.Style*, align 8
  %Style.obj = alloca %struct.Style, align 8
  %names.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %total.addr = alloca i32, align 4
  %i.addr.1 = alloca i32, align 4
  %i.addr.2 = alloca i32, align 4
  %n.addr = alloca i32, align 4
  %a.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Setup, %struct.Setup* %Setup.obj, i32 0, i32 0
  store i1 false, i1* %0, align 1, !tbaa !18
  %1 = getelementptr inbounds %struct.Setup, %struct.Setup* %Setup.obj, i32 0, i32 1
  store i8* bitcast ({ i64, [1 x i8] }* @.str.8 to i8*), i8** %1, align 8, !tbaa !19
  store %struct.Setup* %Setup.obj, %struct.Setup** %setup.addr, align 8
  %2 = getelementptr inbounds %struct.Style, %struct.Style* %Style.obj, i32 0, i32 0
  store i8* null, i8** %2, align 8, !tbaa !21
  store %struct.Style* %Style.obj, %struct.Style** %style.addr, align 8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %names.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %6 = load i32, i32* %i.addr, align 4
  %7 = icmp slt i32 %6, 1000
  br i1 %7, label %for.body, label %for.end

for.body:
  %8 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %9 = load i32, i32* %i.addr, align 4
  %10 = call i32 @fixed(i32 %9)
  %11 = load i32, i32* %i.addr, align 4
  %12 = call i32 @scoped(i32 %11)
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %10, i32 %12)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok

ovf.ok:
  %16 = load i32, i32* %i.addr, align 4
  %17 = call i32 @pick(i32 %16)
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %14, i32 %17)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %21 = load i32, i32* %i.addr, align 4
  %22 = call i32 @outer(i32 %21)
  %23 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %19, i32 %22)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %26 = load i32, i32* %i.addr, align 4
  %27 = call i32 @listed(i32 %26)
  %28 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %24, i32 %27)
  %29 = extractvalue { i32, i1 } %28, 0
  %30 = extractvalue { i32, i1 } %28, 1
  br i1 %30, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %31 = load i32, i32* %i.addr, align 4
  %32 = call i32 @paired(i32 %31)
  %33 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %29, i32 %32)
  %34 = extractvalue { i32, i1 } %33, 0
  %35 = extractvalue { i32, i1 } %33, 1
  br i1 %35, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %36 = load i32, i32* %i.addr, align 4
  %37 = call i32 @joined(i32 %36)
  %38 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %34, i32 %37)
  %39 = extractvalue { i32, i1 } %38, 0
  %40 = extractvalue { i32, i1 } %38, 1
  br i1 %40, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  %41 = call i8* @nish_str_from_i32(i32 %39)
  %42 = load i32, i32* %i.addr, align 4
  %43 = call i64 @nish_arena_mark()
  %44 = call i8* @keepVia(i32 %42)
  %45 = call i8* @nish_arena_keep(i64 %43, i8* %44)
  %46 = call i8* @nish_str_concat(i8* %41, i8* %45)
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %48 = load i64, i64* %47, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 1
  %50 = load i64, i64* %49, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %51 = icmp eq i64 %48, %50
  br i1 %51, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %8, i64 8)
  br label %push.store

push.store:
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %53 = load i8*, i8** %52, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %54 = bitcast i8* %53 to i8**
  %55 = getelementptr inbounds i8*, i8** %54, i64 %48
  store i8* %46, i8** %55, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %56 = add i64 %48, 1
  store i64 %56, i64* %47, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %57 = trunc i64 %56 to i32
  %58 = load %struct.Setup*, %struct.Setup** %setup.addr, align 8
  call void @prepare(%struct.Setup* %58)
  %59 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %60 = load %struct.Style*, %struct.Style** %style.addr, align 8
  %61 = load i32, i32* %i.addr, align 4
  %62 = call i8* @Style.get(%struct.Style* %60, i32 %61)
  %63 = call i1 @envSaysNo(i8* bitcast ({ i64, [23 x i8] }* @.str.9 to i8*))
  br i1 %63, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %64 = phi i32 [ 1, %cond.true ], [ 0, %cond.false ]
  %65 = call i8* @nish_str_from_i32(i32 %64)
  %66 = call i8* @nish_str_concat(i8* %62, i8* %65)
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 0
  %68 = load i64, i64* %67, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %69 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 1
  %70 = load i64, i64* %69, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %71 = icmp eq i64 %68, %70
  br i1 %71, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %59, i64 8)
  br label %push.store.1

push.store.1:
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 2
  %73 = load i8*, i8** %72, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %74 = bitcast i8* %73 to i8**
  %75 = getelementptr inbounds i8*, i8** %74, i64 %68
  store i8* %66, i8** %75, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %76 = add i64 %68, 1
  store i64 %76, i64* %67, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %77 = trunc i64 %76 to i32
  br label %for.inc

for.inc:
  %78 = load i32, i32* %i.addr, align 4
  %79 = add nsw i32 %78, 1
  store i32 %79, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %80 = load i32, i32* %i.addr.1, align 4
  %81 = icmp slt i32 %80, 1000
  br i1 %81, label %for.body.1, label %for.end.1

for.body.1:
  %82 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %83 = load i8*, i8** %82, align 8
  %84 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %85 = load i64, i64* %84, align 8
  %86 = load i32, i32* %total.addr, align 4
  %87 = load i32, i32* %i.addr.1, align 4
  %88 = call i32 @relabel(i32 %87)
  %89 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %86, i32 %88)
  %90 = extractvalue { i32, i1 } %89, 0
  %91 = extractvalue { i32, i1 } %89, 1
  br i1 %91, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  store i32 %90, i32* %total.addr, align 4
  %92 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %93 = load i8*, i8** %92, align 8
  %94 = icmp eq i8* %93, %83
  br i1 %94, label %pass.rewind, label %pass.free

pass.rewind:
  %95 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %85, i64* %95, align 8
  br label %pass.done

pass.free:
  %96 = ptrtoint i8* %83 to i64
  %97 = add i64 %96, %85
  call void @nish_arena_release(i64 %97)
  br label %pass.done

pass.done:
  br label %for.inc.1

for.inc.1:
  %98 = load i32, i32* %i.addr.1, align 4
  %99 = add nsw i32 %98, 1
  store i32 %99, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  store i32 0, i32* %i.addr.2, align 4
  br label %for.cond.2

for.cond.2:
  %100 = load i32, i32* %i.addr.2, align 4
  %101 = icmp slt i32 %100, 1000
  br i1 %101, label %for.body.2, label %for.end.2

for.body.2:
  store i32 0, i32* %n.addr, align 4
  %102 = call i64 @nish_arena_mark()
  store i64 %102, i64* %a.addr, align 8
  %103 = load i64, i64* %a.addr, align 8
  %104 = load i32, i32* %i.addr.2, align 4
  %105 = call i32 @relabel(i32 %104)
  store i32 %105, i32* %n.addr, align 4
  call void @nish_arena_release(i64 %103)
  %106 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %107 = load i32, i32* %n.addr, align 4
  %108 = call i8* @nish_str_from_i32(i32 %107)
  %109 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %106, i64 0, i32 0
  %110 = load i64, i64* %109, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %111 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %106, i64 0, i32 1
  %112 = load i64, i64* %111, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %113 = icmp eq i64 %110, %112
  br i1 %113, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %106, i64 8)
  br label %push.store.2

push.store.2:
  %114 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %106, i64 0, i32 2
  %115 = load i8*, i8** %114, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %116 = bitcast i8* %115 to i8**
  %117 = getelementptr inbounds i8*, i8** %116, i64 %110
  store i8* %108, i8** %117, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %118 = add i64 %110, 1
  store i64 %118, i64* %109, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %119 = trunc i64 %118 to i32
  br label %for.inc.2

for.inc.2:
  %120 = load i32, i32* %i.addr.2, align 4
  %121 = add nsw i32 %120, 1
  store i32 %121, i32* %i.addr.2, align 4
  br label %for.cond.2

for.end.2:
  %122 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %123 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %122, i64 0, i32 0
  %124 = load i64, i64* %123, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %125 = trunc i64 %124 to i32
  %126 = call i8* @nish_str_from_i32(i32 %125)
  %127 = call i8* @nish_str_concat(i8* %126, i8* bitcast ({ i64, [2 x i8] }* @.str.10 to i8*))
  %128 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %129 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %128, i64 0, i32 0
  %130 = load i64, i64* %129, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %131 = icmp ult i64 1998, %130
  br i1 %131, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1998, i64 %130)
  unreachable

bounds.ok:
  %132 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %128, i64 0, i32 2
  %133 = load i8*, i8** %132, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %134 = bitcast i8* %133 to i8**
  %135 = getelementptr inbounds i8*, i8** %134, i64 1998
  %136 = load i8*, i8** %135, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %137 = call i8* @nish_str_concat(i8* %127, i8* %136)
  %138 = call i8* @nish_str_concat(i8* %137, i8* bitcast ({ i64, [2 x i8] }* @.str.10 to i8*))
  %139 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %140 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %139, i64 0, i32 0
  %141 = load i64, i64* %140, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %142 = icmp ult i64 2999, %141
  br i1 %142, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 2999, i64 %141)
  unreachable

bounds.ok.1:
  %143 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %139, i64 0, i32 2
  %144 = load i8*, i8** %143, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %145 = bitcast i8* %144 to i8**
  %146 = getelementptr inbounds i8*, i8** %145, i64 2999
  %147 = load i8*, i8** %146, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %148 = call i8* @nish_str_concat(i8* %138, i8* %147)
  %149 = call i8* @nish_str_concat(i8* %148, i8* bitcast ({ i64, [2 x i8] }* @.str.10 to i8*))
  %150 = load i32, i32* %total.addr, align 4
  %151 = call i8* @nish_str_from_i32(i32 %150)
  %152 = call i8* @nish_str_concat(i8* %149, i8* %151)
  %153 = call i8* @nish_str_concat(i8* %152, i8* bitcast ({ i64, [2 x i8] }* @.str.10 to i8*))
  %154 = call i32 @relabel(i32 7)
  %155 = call i8* @nish_str_from_i32(i32 %154)
  %156 = call i8* @nish_str_concat(i8* %153, i8* %155)
  %157 = call i8* @nish_str_concat(i8* %156, i8* bitcast ({ i64, [2 x i8] }* @.str.10 to i8*))
  %158 = load %struct.Setup*, %struct.Setup** %setup.addr, align 8
  %159 = getelementptr inbounds %struct.Setup, %struct.Setup* %158, i32 0, i32 1
  %160 = load i8*, i8** %159, align 8, !tbaa !19
  %161 = call i8* @nish_str_concat(i8* %157, i8* %160)
  call void @nish_print(i8* %161)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn memory(argmem: read) "probe-stack"="inline-asm" }
attributes #5 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #6 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!22, !23, !24, !25, !26}
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
!15 = !{!"i1", !6, i64 0}
!16 = !{!"ptr", !6, i64 0}
!17 = !{!"Setup", !15, i64 0, !16, i64 8}
!18 = !{!17, !15, i64 0}
!19 = !{!17, !16, i64 8}
!20 = !{!"Style", !16, i64 0}
!21 = !{!20, !16, i64 0}
!22 = !{i32 8, !"cf-protection-branch", i32 1}
!23 = !{i32 8, !"cf-protection-return", i32 1}
!24 = !{i32 8, !"branch-target-enforcement", i32 1}
!25 = !{i32 8, !"sign-return-address", i32 1}
!26 = !{i32 4, !"probe-stack", !"inline-asm"}

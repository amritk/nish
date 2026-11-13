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
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 1
  %45 = load i64, i64* %44, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %46 = icmp eq i64 %43, %45
  br i1 %46, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %8, i64 8)
  br label %push.store

push.store:
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %48 = load i8*, i8** %47, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %49 = bitcast i8* %48 to i8**
  %50 = getelementptr inbounds i8*, i8** %49, i64 %43
  store i8* %41, i8** %50, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %51 = add i64 %43, 1
  store i64 %51, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %52 = trunc i64 %51 to i32
  %53 = load %struct.Setup*, %struct.Setup** %setup.addr, align 8
  call void @prepare(%struct.Setup* %53)
  %54 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %55 = load %struct.Style*, %struct.Style** %style.addr, align 8
  %56 = load i32, i32* %i.addr, align 4
  %57 = call i8* @Style.get(%struct.Style* %55, i32 %56)
  %58 = call i1 @envSaysNo(i8* bitcast ({ i64, [23 x i8] }* @.str.9 to i8*))
  br i1 %58, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %59 = phi i32 [ 1, %cond.true ], [ 0, %cond.false ]
  %60 = call i8* @nish_str_from_i32(i32 %59)
  %61 = call i8* @nish_str_concat(i8* %57, i8* %60)
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 0
  %63 = load i64, i64* %62, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 1
  %65 = load i64, i64* %64, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %66 = icmp eq i64 %63, %65
  br i1 %66, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %54, i64 8)
  br label %push.store.1

push.store.1:
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 2
  %68 = load i8*, i8** %67, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %69 = bitcast i8* %68 to i8**
  %70 = getelementptr inbounds i8*, i8** %69, i64 %63
  store i8* %61, i8** %70, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %71 = add i64 %63, 1
  store i64 %71, i64* %62, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %72 = trunc i64 %71 to i32
  br label %for.inc

for.inc:
  %73 = load i32, i32* %i.addr, align 4
  %74 = add nsw i32 %73, 1
  store i32 %74, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %75 = load i32, i32* %i.addr.1, align 4
  %76 = icmp slt i32 %75, 1000
  br i1 %76, label %for.body.1, label %for.end.1

for.body.1:
  %77 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %78 = load i8*, i8** %77, align 8
  %79 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %80 = load i64, i64* %79, align 8
  %81 = load i32, i32* %total.addr, align 4
  %82 = load i32, i32* %i.addr.1, align 4
  %83 = call i32 @relabel(i32 %82)
  %84 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %81, i32 %83)
  %85 = extractvalue { i32, i1 } %84, 0
  %86 = extractvalue { i32, i1 } %84, 1
  br i1 %86, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  store i32 %85, i32* %total.addr, align 4
  %87 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %88 = load i8*, i8** %87, align 8
  %89 = icmp eq i8* %88, %78
  br i1 %89, label %pass.rewind, label %pass.free

pass.rewind:
  %90 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %80, i64* %90, align 8
  br label %pass.done

pass.free:
  %91 = ptrtoint i8* %78 to i64
  %92 = add i64 %91, %80
  call void @nish_arena_release(i64 %92)
  br label %pass.done

pass.done:
  br label %for.inc.1

for.inc.1:
  %93 = load i32, i32* %i.addr.1, align 4
  %94 = add nsw i32 %93, 1
  store i32 %94, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  store i32 0, i32* %i.addr.2, align 4
  br label %for.cond.2

for.cond.2:
  %95 = load i32, i32* %i.addr.2, align 4
  %96 = icmp slt i32 %95, 1000
  br i1 %96, label %for.body.2, label %for.end.2

for.body.2:
  store i32 0, i32* %n.addr, align 4
  %97 = call i64 @nish_arena_mark()
  store i64 %97, i64* %a.addr, align 8
  %98 = load i64, i64* %a.addr, align 8
  %99 = load i32, i32* %i.addr.2, align 4
  %100 = call i32 @relabel(i32 %99)
  store i32 %100, i32* %n.addr, align 4
  call void @nish_arena_release(i64 %98)
  %101 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %102 = load i32, i32* %n.addr, align 4
  %103 = call i8* @nish_str_from_i32(i32 %102)
  %104 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %101, i64 0, i32 0
  %105 = load i64, i64* %104, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %106 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %101, i64 0, i32 1
  %107 = load i64, i64* %106, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %108 = icmp eq i64 %105, %107
  br i1 %108, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %101, i64 8)
  br label %push.store.2

push.store.2:
  %109 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %101, i64 0, i32 2
  %110 = load i8*, i8** %109, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %111 = bitcast i8* %110 to i8**
  %112 = getelementptr inbounds i8*, i8** %111, i64 %105
  store i8* %103, i8** %112, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %113 = add i64 %105, 1
  store i64 %113, i64* %104, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %114 = trunc i64 %113 to i32
  br label %for.inc.2

for.inc.2:
  %115 = load i32, i32* %i.addr.2, align 4
  %116 = add nsw i32 %115, 1
  store i32 %116, i32* %i.addr.2, align 4
  br label %for.cond.2

for.end.2:
  %117 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %118 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %117, i64 0, i32 0
  %119 = load i64, i64* %118, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %120 = trunc i64 %119 to i32
  %121 = call i8* @nish_str_from_i32(i32 %120)
  %122 = call i8* @nish_str_concat(i8* %121, i8* bitcast ({ i64, [2 x i8] }* @.str.10 to i8*))
  %123 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %124 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %123, i64 0, i32 0
  %125 = load i64, i64* %124, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %126 = icmp ult i64 1998, %125
  br i1 %126, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1998, i64 %125)
  unreachable

bounds.ok:
  %127 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %123, i64 0, i32 2
  %128 = load i8*, i8** %127, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %129 = bitcast i8* %128 to i8**
  %130 = getelementptr inbounds i8*, i8** %129, i64 1998
  %131 = load i8*, i8** %130, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %132 = call i8* @nish_str_concat(i8* %122, i8* %131)
  %133 = call i8* @nish_str_concat(i8* %132, i8* bitcast ({ i64, [2 x i8] }* @.str.10 to i8*))
  %134 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %135 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %134, i64 0, i32 0
  %136 = load i64, i64* %135, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %137 = icmp ult i64 2999, %136
  br i1 %137, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 2999, i64 %136)
  unreachable

bounds.ok.1:
  %138 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %134, i64 0, i32 2
  %139 = load i8*, i8** %138, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %140 = bitcast i8* %139 to i8**
  %141 = getelementptr inbounds i8*, i8** %140, i64 2999
  %142 = load i8*, i8** %141, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %143 = call i8* @nish_str_concat(i8* %133, i8* %142)
  %144 = call i8* @nish_str_concat(i8* %143, i8* bitcast ({ i64, [2 x i8] }* @.str.10 to i8*))
  %145 = load i32, i32* %total.addr, align 4
  %146 = call i8* @nish_str_from_i32(i32 %145)
  %147 = call i8* @nish_str_concat(i8* %144, i8* %146)
  %148 = call i8* @nish_str_concat(i8* %147, i8* bitcast ({ i64, [2 x i8] }* @.str.10 to i8*))
  %149 = call i32 @relabel(i32 7)
  %150 = call i8* @nish_str_from_i32(i32 %149)
  %151 = call i8* @nish_str_concat(i8* %148, i8* %150)
  %152 = call i8* @nish_str_concat(i8* %151, i8* bitcast ({ i64, [2 x i8] }* @.str.10 to i8*))
  %153 = load %struct.Setup*, %struct.Setup** %setup.addr, align 8
  %154 = getelementptr inbounds %struct.Setup, %struct.Setup* %153, i32 0, i32 1
  %155 = load i8*, i8** %154, align 8, !tbaa !19
  %156 = call i8* @nish_str_concat(i8* %152, i8* %155)
  call void @nish_print(i8* %156)
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

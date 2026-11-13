%struct.Setup = type { i1, i8* }
%struct.Style = type { i8* }
%struct.Pair = type { i8* }
%struct.Once = type { i1 }
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
@.str.8 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [23 x i8] } { i64 22, [23 x i8] c"NISH_KEPT_MEMORY_UNSET\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
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

define internal noundef i32 @warmOnce(%struct.Once* noundef nonnull align 8 dereferenceable(1) nocapture %o) #1 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %0 = getelementptr inbounds %struct.Once, %struct.Once* %o, i32 0, i32 0
  %1 = load i1, i1* %0, align 1, !tbaa !23
  br i1 %1, label %if.then, label %if.end

if.then:
  ret i32 0

if.end:
  %2 = getelementptr inbounds %struct.Once, %struct.Once* %o, i32 0, i32 0
  store i1 true, i1* %2, align 1, !tbaa !23
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %6 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %7 = getelementptr inbounds %struct.Once, %struct.Once* %o, i32 0, i32 0
  %8 = load i1, i1* %7, align 1, !tbaa !23
  %9 = select i1 %8, i8* bitcast ({ i64, [5 x i8] }* @.str.8 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.9 to i8*)
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %14 = icmp eq i64 %11, %13
  br i1 %14, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %6, i64 8)
  br label %push.store

push.store:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %17 = bitcast i8* %16 to i8**
  %18 = getelementptr inbounds i8*, i8** %17, i64 %11
  store i8* %9, i8** %18, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %19 = add i64 %11, 1
  store i64 %19, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = trunc i64 %19 to i32
  %21 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = trunc i64 %23 to i32
  ret i32 %24
}

define internal noundef nonnull align 8 i8* @warmVia(%struct.Once* noundef nonnull align 8 dereferenceable(1) nocapture %o) #1 {
entry:
  %0 = call i32 @warmOnce(%struct.Once* %o)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  ret i8* %1
}

define void @nish_main() #0 {
entry:
  %setup.addr = alloca %struct.Setup*, align 8
  %Setup.obj = alloca %struct.Setup, align 8
  %style.addr = alloca %struct.Style*, align 8
  %Style.obj = alloca %struct.Style, align 8
  %once.addr = alloca %struct.Once*, align 8
  %Once.obj = alloca %struct.Once, align 8
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
  store i8* bitcast ({ i64, [1 x i8] }* @.str.10 to i8*), i8** %1, align 8, !tbaa !19
  store %struct.Setup* %Setup.obj, %struct.Setup** %setup.addr, align 8
  %2 = getelementptr inbounds %struct.Style, %struct.Style* %Style.obj, i32 0, i32 0
  store i8* null, i8** %2, align 8, !tbaa !21
  store %struct.Style* %Style.obj, %struct.Style** %style.addr, align 8
  %3 = getelementptr inbounds %struct.Once, %struct.Once* %Once.obj, i32 0, i32 0
  store i1 false, i1* %3, align 1, !tbaa !23
  store %struct.Once* %Once.obj, %struct.Once** %once.addr, align 8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %names.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %7 = load i32, i32* %i.addr, align 4
  %8 = icmp slt i32 %7, 1000
  br i1 %8, label %for.body, label %for.end

for.body:
  %9 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %10 = load i32, i32* %i.addr, align 4
  %11 = call i32 @fixed(i32 %10)
  %12 = load i32, i32* %i.addr, align 4
  %13 = call i32 @scoped(i32 %12)
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %11, i32 %13)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok

ovf.ok:
  %17 = load i32, i32* %i.addr, align 4
  %18 = call i32 @pick(i32 %17)
  %19 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %15, i32 %18)
  %20 = extractvalue { i32, i1 } %19, 0
  %21 = extractvalue { i32, i1 } %19, 1
  br i1 %21, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %22 = load i32, i32* %i.addr, align 4
  %23 = call i32 @outer(i32 %22)
  %24 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %20, i32 %23)
  %25 = extractvalue { i32, i1 } %24, 0
  %26 = extractvalue { i32, i1 } %24, 1
  br i1 %26, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %27 = load i32, i32* %i.addr, align 4
  %28 = call i32 @listed(i32 %27)
  %29 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %25, i32 %28)
  %30 = extractvalue { i32, i1 } %29, 0
  %31 = extractvalue { i32, i1 } %29, 1
  br i1 %31, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %32 = load i32, i32* %i.addr, align 4
  %33 = call i32 @paired(i32 %32)
  %34 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %30, i32 %33)
  %35 = extractvalue { i32, i1 } %34, 0
  %36 = extractvalue { i32, i1 } %34, 1
  br i1 %36, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  %37 = load i32, i32* %i.addr, align 4
  %38 = call i32 @joined(i32 %37)
  %39 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %35, i32 %38)
  %40 = extractvalue { i32, i1 } %39, 0
  %41 = extractvalue { i32, i1 } %39, 1
  br i1 %41, label %ovf.fail, label %ovf.ok.5

ovf.ok.5:
  %42 = call i8* @nish_str_from_i32(i32 %40)
  %43 = load %struct.Once*, %struct.Once** %once.addr, align 8
  %44 = call i64 @nish_arena_mark()
  %45 = call i8* @warmVia(%struct.Once* %43)
  %46 = call i8* @nish_arena_keep(i64 %44, i8* %45)
  %47 = call i8* @nish_str_concat(i8* %42, i8* %46)
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %49 = load i64, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 1
  %51 = load i64, i64* %50, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %52 = icmp eq i64 %49, %51
  br i1 %52, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %9, i64 8)
  br label %push.store

push.store:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %55 = bitcast i8* %54 to i8**
  %56 = getelementptr inbounds i8*, i8** %55, i64 %49
  store i8* %47, i8** %56, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %57 = add i64 %49, 1
  store i64 %57, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %58 = trunc i64 %57 to i32
  %59 = load %struct.Setup*, %struct.Setup** %setup.addr, align 8
  call void @prepare(%struct.Setup* %59)
  %60 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %61 = load %struct.Style*, %struct.Style** %style.addr, align 8
  %62 = load i32, i32* %i.addr, align 4
  %63 = call i8* @Style.get(%struct.Style* %61, i32 %62)
  %64 = call i1 @envSaysNo(i8* bitcast ({ i64, [23 x i8] }* @.str.11 to i8*))
  br i1 %64, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %65 = phi i32 [ 1, %cond.true ], [ 0, %cond.false ]
  %66 = call i8* @nish_str_from_i32(i32 %65)
  %67 = call i8* @nish_str_concat(i8* %63, i8* %66)
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 0
  %69 = load i64, i64* %68, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 1
  %71 = load i64, i64* %70, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %72 = icmp eq i64 %69, %71
  br i1 %72, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %60, i64 8)
  br label %push.store.1

push.store.1:
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 2
  %74 = load i8*, i8** %73, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %75 = bitcast i8* %74 to i8**
  %76 = getelementptr inbounds i8*, i8** %75, i64 %69
  store i8* %67, i8** %76, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %77 = add i64 %69, 1
  store i64 %77, i64* %68, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %78 = trunc i64 %77 to i32
  br label %for.inc

for.inc:
  %79 = load i32, i32* %i.addr, align 4
  %80 = add nsw i32 %79, 1
  store i32 %80, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %81 = load i32, i32* %i.addr.1, align 4
  %82 = icmp slt i32 %81, 1000
  br i1 %82, label %for.body.1, label %for.end.1

for.body.1:
  %83 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %84 = load i8*, i8** %83, align 8
  %85 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %86 = load i64, i64* %85, align 8
  %87 = load i32, i32* %total.addr, align 4
  %88 = load i32, i32* %i.addr.1, align 4
  %89 = call i32 @relabel(i32 %88)
  %90 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %87, i32 %89)
  %91 = extractvalue { i32, i1 } %90, 0
  %92 = extractvalue { i32, i1 } %90, 1
  br i1 %92, label %ovf.fail, label %ovf.ok.6

ovf.ok.6:
  store i32 %91, i32* %total.addr, align 4
  %93 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %94 = load i8*, i8** %93, align 8
  %95 = icmp eq i8* %94, %84
  br i1 %95, label %pass.rewind, label %pass.free

pass.rewind:
  %96 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %86, i64* %96, align 8
  br label %pass.done

pass.free:
  %97 = ptrtoint i8* %84 to i64
  %98 = add i64 %97, %86
  call void @nish_arena_release(i64 %98)
  br label %pass.done

pass.done:
  br label %for.inc.1

for.inc.1:
  %99 = load i32, i32* %i.addr.1, align 4
  %100 = add nsw i32 %99, 1
  store i32 %100, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  store i32 0, i32* %i.addr.2, align 4
  br label %for.cond.2

for.cond.2:
  %101 = load i32, i32* %i.addr.2, align 4
  %102 = icmp slt i32 %101, 1000
  br i1 %102, label %for.body.2, label %for.end.2

for.body.2:
  store i32 0, i32* %n.addr, align 4
  %103 = call i64 @nish_arena_mark()
  store i64 %103, i64* %a.addr, align 8
  %104 = load i64, i64* %a.addr, align 8
  %105 = load i32, i32* %i.addr.2, align 4
  %106 = call i32 @relabel(i32 %105)
  store i32 %106, i32* %n.addr, align 4
  call void @nish_arena_release(i64 %104)
  %107 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %108 = load i32, i32* %n.addr, align 4
  %109 = call i8* @nish_str_from_i32(i32 %108)
  %110 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %107, i64 0, i32 0
  %111 = load i64, i64* %110, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %112 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %107, i64 0, i32 1
  %113 = load i64, i64* %112, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %114 = icmp eq i64 %111, %113
  br i1 %114, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %107, i64 8)
  br label %push.store.2

push.store.2:
  %115 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %107, i64 0, i32 2
  %116 = load i8*, i8** %115, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %117 = bitcast i8* %116 to i8**
  %118 = getelementptr inbounds i8*, i8** %117, i64 %111
  store i8* %109, i8** %118, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %119 = add i64 %111, 1
  store i64 %119, i64* %110, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %120 = trunc i64 %119 to i32
  br label %for.inc.2

for.inc.2:
  %121 = load i32, i32* %i.addr.2, align 4
  %122 = add nsw i32 %121, 1
  store i32 %122, i32* %i.addr.2, align 4
  br label %for.cond.2

for.end.2:
  %123 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %124 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %123, i64 0, i32 0
  %125 = load i64, i64* %124, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %126 = trunc i64 %125 to i32
  %127 = call i8* @nish_str_from_i32(i32 %126)
  %128 = call i8* @nish_str_concat(i8* %127, i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*))
  %129 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %130 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %129, i64 0, i32 0
  %131 = load i64, i64* %130, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %132 = icmp ult i64 1998, %131
  br i1 %132, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1998, i64 %131)
  unreachable

bounds.ok:
  %133 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %129, i64 0, i32 2
  %134 = load i8*, i8** %133, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %135 = bitcast i8* %134 to i8**
  %136 = getelementptr inbounds i8*, i8** %135, i64 1998
  %137 = load i8*, i8** %136, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %138 = call i8* @nish_str_concat(i8* %128, i8* %137)
  %139 = call i8* @nish_str_concat(i8* %138, i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*))
  %140 = load %struct.nish_array*, %struct.nish_array** %names.addr, align 8
  %141 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %140, i64 0, i32 0
  %142 = load i64, i64* %141, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %143 = icmp ult i64 2999, %142
  br i1 %143, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 2999, i64 %142)
  unreachable

bounds.ok.1:
  %144 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %140, i64 0, i32 2
  %145 = load i8*, i8** %144, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %146 = bitcast i8* %145 to i8**
  %147 = getelementptr inbounds i8*, i8** %146, i64 2999
  %148 = load i8*, i8** %147, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %149 = call i8* @nish_str_concat(i8* %139, i8* %148)
  %150 = call i8* @nish_str_concat(i8* %149, i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*))
  %151 = load i32, i32* %total.addr, align 4
  %152 = call i8* @nish_str_from_i32(i32 %151)
  %153 = call i8* @nish_str_concat(i8* %150, i8* %152)
  %154 = call i8* @nish_str_concat(i8* %153, i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*))
  %155 = call i32 @relabel(i32 7)
  %156 = call i8* @nish_str_from_i32(i32 %155)
  %157 = call i8* @nish_str_concat(i8* %154, i8* %156)
  %158 = call i8* @nish_str_concat(i8* %157, i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*))
  %159 = load %struct.Setup*, %struct.Setup** %setup.addr, align 8
  %160 = getelementptr inbounds %struct.Setup, %struct.Setup* %159, i32 0, i32 1
  %161 = load i8*, i8** %160, align 8, !tbaa !19
  %162 = call i8* @nish_str_concat(i8* %158, i8* %161)
  call void @nish_print(i8* %162)
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

!llvm.module.flags = !{!24, !25, !26, !27, !28}
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
!22 = !{!"Once", !15, i64 0}
!23 = !{!22, !15, i64 0}
!24 = !{i32 8, !"cf-protection-branch", i32 1}
!25 = !{i32 8, !"cf-protection-return", i32 1}
!26 = !{i32 8, !"branch-target-enforcement", i32 1}
!27 = !{i32 8, !"sign-return-address", i32 1}
!28 = !{i32 4, !"probe-stack", !"inline-asm"}

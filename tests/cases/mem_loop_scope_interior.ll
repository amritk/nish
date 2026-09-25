%struct.P = type { i32, i32 }
%struct.Holder = type { %struct.P* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"null\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
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

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @points(i32 noundef %n) #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %P.obj = alloca %struct.P, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4
  store %struct.nish_array* %1, %struct.nish_array** %xs.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp slt i32 %5, %n
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %8 = load i32, i32* %i.addr, align 4
  %9 = getelementptr inbounds %struct.P, %struct.P* %P.obj, i32 0, i32 0
  store i32 %8, i32* %9, align 4
  %10 = load i32, i32* %i.addr, align 4
  %11 = mul nsw i32 %10, 2
  %12 = getelementptr inbounds %struct.P, %struct.P* %P.obj, i32 0, i32 1
  store i32 %11, i32* %12, align 4
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4
  %17 = icmp eq i64 %14, %16
  br i1 %17, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %7, i64 8)
  br label %push.store

push.store:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4
  %20 = bitcast i8* %19 to %struct.P*
  %21 = getelementptr inbounds %struct.P, %struct.P* %20, i64 %14
  %22 = bitcast %struct.P* %21 to i8*
  %23 = bitcast %struct.P* %P.obj to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %22, i8* align 4 %23, i64 8, i1 false), !alias.scope !4, !noalias !3
  %24 = add i64 %14, 1
  store i64 %24, i64* %13, align 8, !alias.scope !3, !noalias !4
  %25 = trunc i64 %24 to i32
  br label %for.inc

for.inc:
  %26 = load i32, i32* %i.addr, align 4
  %27 = add nsw i32 %26, 1
  store i32 %27, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %28 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  ret %struct.nish_array* %28
}

define internal noundef i32 @fill(%struct.Holder* noundef nonnull align 8 dereferenceable(8) nocapture %h, i32 noundef %n) #1 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %0 = call %struct.nish_array* @points(i32 %n)
  store %struct.nish_array* %0, %struct.nish_array** %xs.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %2 = sub nsw i32 %n, 1
  %3 = sext i32 %2 to i64
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4
  %6 = icmp ult i64 %3, %5
  br i1 %6, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %3, i64 %5)
  unreachable

bounds.ok:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4
  %9 = bitcast i8* %8 to %struct.P*
  %10 = getelementptr inbounds %struct.P, %struct.P* %9, i64 %3
  %11 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  store %struct.P* %10, %struct.P** %11, align 8, !tbaa !9
  ret i32 %n
}

define internal noundef i32 @fillVia(%struct.Holder* noundef nonnull align 8 dereferenceable(8) nocapture %h, i32 noundef %n) #1 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %last.addr = alloca %struct.P*, align 8
  %0 = call %struct.nish_array* @points(i32 %n)
  store %struct.nish_array* %0, %struct.nish_array** %xs.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %2 = sub nsw i32 %n, 1
  %3 = sext i32 %2 to i64
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4
  %6 = icmp ult i64 %3, %5
  br i1 %6, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %3, i64 %5)
  unreachable

bounds.ok:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4
  %9 = bitcast i8* %8 to %struct.P*
  %10 = getelementptr inbounds %struct.P, %struct.P* %9, i64 %3
  store %struct.P* %10, %struct.P** %last.addr, align 8
  %11 = load %struct.P*, %struct.P** %last.addr, align 8
  %12 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  store %struct.P* %11, %struct.P** %12, align 8, !tbaa !9
  %13 = load %struct.P*, %struct.P** %last.addr, align 8
  %14 = getelementptr inbounds %struct.P, %struct.P* %13, i32 0, i32 0
  %15 = load i32, i32* %14, align 4
  ret i32 %15
}

define internal noundef nonnull align 4 dereferenceable(8) %struct.P* @lastOfEach(i32 noundef %rounds) #1 {
entry:
  %keep.addr = alloca %struct.P*, align 8
  %r.addr = alloca i32, align 4
  %xs.addr = alloca %struct.nish_array*, align 8
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.P*
  %2 = getelementptr inbounds %struct.P, %struct.P* %1, i32 0, i32 0
  store i32 0, i32* %2, align 4
  %3 = getelementptr inbounds %struct.P, %struct.P* %1, i32 0, i32 1
  store i32 0, i32* %3, align 4
  store %struct.P* %1, %struct.P** %keep.addr, align 8
  store i32 1, i32* %r.addr, align 4
  br label %for.cond

for.cond:
  %4 = load i32, i32* %r.addr, align 4
  %5 = icmp sle i32 %4, %rounds
  br i1 %5, label %for.body, label %for.end

for.body:
  %6 = load i32, i32* %r.addr, align 4
  %7 = call %struct.nish_array* @points(i32 %6)
  store %struct.nish_array* %7, %struct.nish_array** %xs.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %9 = load i32, i32* %r.addr, align 4
  %10 = sub nsw i32 %9, 1
  %11 = sext i32 %10 to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4
  %14 = icmp ult i64 %11, %13
  br i1 %14, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %11, i64 %13)
  unreachable

bounds.ok:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4
  %17 = bitcast i8* %16 to %struct.P*
  %18 = getelementptr inbounds %struct.P, %struct.P* %17, i64 %11
  store %struct.P* %18, %struct.P** %keep.addr, align 8
  br label %for.inc

for.inc:
  %19 = load i32, i32* %r.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %r.addr, align 4
  br label %for.cond

for.end:
  %21 = load %struct.P*, %struct.P** %keep.addr, align 8
  ret %struct.P* %21
}

define internal noundef i32 @lastSeen(%struct.Holder* noundef nonnull align 8 dereferenceable(8) nocapture %h, i32 noundef %rounds) #1 {
entry:
  %r.addr = alloca i32, align 4
  %p.addr = alloca %struct.P*, align 8
  %forof.idx = alloca i64, align 8
  store i32 1, i32* %r.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %r.addr, align 4
  %1 = icmp sle i32 %0, %rounds
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %r.addr, align 4
  %3 = call %struct.nish_array* @points(i32 %2)
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %4 = load i64, i64* %forof.idx, align 8
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4
  %7 = icmp ult i64 %4, %6
  br i1 %7, label %forof.body, label %forof.end

forof.body:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4
  %10 = bitcast i8* %9 to %struct.P*
  %11 = getelementptr inbounds %struct.P, %struct.P* %10, i64 %4
  store %struct.P* %11, %struct.P** %p.addr, align 8
  %12 = load %struct.P*, %struct.P** %p.addr, align 8
  %13 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  store %struct.P* %12, %struct.P** %13, align 8, !tbaa !9
  br label %forof.inc

forof.inc:
  %14 = load i64, i64* %forof.idx, align 8
  %15 = add i64 %14, 1
  store i64 %15, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  br label %for.inc

for.inc:
  %16 = load i32, i32* %r.addr, align 4
  %17 = add nsw i32 %16, 1
  store i32 %17, i32* %r.addr, align 4
  br label %for.cond

for.end:
  ret i32 %rounds
}

define internal void @pick(%struct.Holder* noundef nonnull align 8 dereferenceable(8) nocapture %h, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs, i32 noundef %i) #1 {
entry:
  %0 = sext i32 %i to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4
  %6 = bitcast i8* %5 to %struct.P*
  %7 = getelementptr inbounds %struct.P, %struct.P* %6, i64 %0
  %8 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  store %struct.P* %7, %struct.P** %8, align 8, !tbaa !9
  ret void
}

define internal noundef i32 @viaCallee(%struct.Holder* noundef nonnull align 8 dereferenceable(8) nocapture %h, i32 noundef %rounds) #1 {
entry:
  %r.addr = alloca i32, align 4
  store i32 1, i32* %r.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %r.addr, align 4
  %1 = icmp sle i32 %0, %rounds
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %r.addr, align 4
  %3 = call %struct.nish_array* @points(i32 %2)
  %4 = load i32, i32* %r.addr, align 4
  %5 = sub nsw i32 %4, 1
  call void @pick(%struct.Holder* %h, %struct.nish_array* %3, i32 %5)
  br label %for.inc

for.inc:
  %6 = load i32, i32* %r.addr, align 4
  %7 = add nsw i32 %6, 1
  store i32 %7, i32* %r.addr, align 4
  br label %for.cond

for.end:
  ret i32 %rounds
}

define internal noundef i32 @churn() #0 {
entry:
  %junk.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %junk.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, 400
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.nish_array*, %struct.nish_array** %junk.addr, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4
  %10 = icmp eq i64 %7, %9
  br i1 %10, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 4)
  br label %push.store

push.store:
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4
  %13 = bitcast i8* %12 to i32*
  %14 = getelementptr inbounds i32, i32* %13, i64 %7
  store i32 7777, i32* %14, align 4, !alias.scope !4, !noalias !3, !tbaa !11
  %15 = add i64 %7, 1
  store i64 %15, i64* %6, align 8, !alias.scope !3, !noalias !4
  %16 = trunc i64 %15 to i32
  br label %for.inc

for.inc:
  %17 = load i32, i32* %i.addr, align 4
  %18 = add nsw i32 %17, 1
  store i32 %18, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %19 = load %struct.nish_array*, %struct.nish_array** %junk.addr, align 8
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4
  %22 = trunc i64 %21 to i32
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %22
}

define internal noundef nonnull align 8 i8* @show(%struct.Holder* noundef nonnull readonly align 8 dereferenceable(8) nocapture %h) #0 {
entry:
  %p.addr = alloca %struct.P*, align 8
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %1 = load %struct.P*, %struct.P** %0, align 8, !tbaa !9
  store %struct.P* %1, %struct.P** %p.addr, align 8
  %2 = load %struct.P*, %struct.P** %p.addr, align 8
  %3 = icmp eq %struct.P* %2, null
  br i1 %3, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %4 = load %struct.P*, %struct.P** %p.addr, align 8
  %5 = getelementptr inbounds %struct.P, %struct.P* %4, i32 0, i32 0
  %6 = load i32, i32* %5, align 4
  %7 = call i8* @nish_str_from_i32(i32 %6)
  %8 = call i8* @nish_str_concat(i8* %7, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %9 = load %struct.P*, %struct.P** %p.addr, align 8
  %10 = getelementptr inbounds %struct.P, %struct.P* %9, i32 0, i32 1
  %11 = load i32, i32* %10, align 4
  %12 = call i8* @nish_str_from_i32(i32 %11)
  %13 = call i8* @nish_str_concat(i8* %8, i8* %12)
  br label %cond.end

cond.end:
  %14 = phi i8* [ bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), %cond.true ], [ %13, %cond.false ]
  ret i8* %14
}

define void @nish_main() #1 {
entry:
  %h.addr = alloca %struct.Holder*, align 8
  %Holder.obj = alloca %struct.Holder, align 8
  %v.addr = alloca %struct.Holder*, align 8
  %Holder.obj.1 = alloca %struct.Holder, align 8
  %k.addr = alloca %struct.P*, align 8
  %g.addr = alloca %struct.Holder*, align 8
  %Holder.obj.2 = alloca %struct.Holder, align 8
  %c.addr = alloca %struct.Holder*, align 8
  %Holder.obj.3 = alloca %struct.Holder, align 8
  %n.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %Holder.obj, i32 0, i32 0
  store %struct.P* null, %struct.P** %0, align 8, !tbaa !9
  store %struct.Holder* %Holder.obj, %struct.Holder** %h.addr, align 8
  %1 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %2 = call i32 @fill(%struct.Holder* %1, i32 50)
  %3 = getelementptr inbounds %struct.Holder, %struct.Holder* %Holder.obj.1, i32 0, i32 0
  store %struct.P* null, %struct.P** %3, align 8, !tbaa !9
  store %struct.Holder* %Holder.obj.1, %struct.Holder** %v.addr, align 8
  %4 = load %struct.Holder*, %struct.Holder** %v.addr, align 8
  %5 = call i32 @fillVia(%struct.Holder* %4, i32 30)
  %6 = call %struct.P* @lastOfEach(i32 20)
  store %struct.P* %6, %struct.P** %k.addr, align 8
  %7 = getelementptr inbounds %struct.Holder, %struct.Holder* %Holder.obj.2, i32 0, i32 0
  store %struct.P* null, %struct.P** %7, align 8, !tbaa !9
  store %struct.Holder* %Holder.obj.2, %struct.Holder** %g.addr, align 8
  %8 = load %struct.Holder*, %struct.Holder** %g.addr, align 8
  %9 = call i32 @lastSeen(%struct.Holder* %8, i32 20)
  %10 = getelementptr inbounds %struct.Holder, %struct.Holder* %Holder.obj.3, i32 0, i32 0
  store %struct.P* null, %struct.P** %10, align 8, !tbaa !9
  store %struct.Holder* %Holder.obj.3, %struct.Holder** %c.addr, align 8
  %11 = load %struct.Holder*, %struct.Holder** %c.addr, align 8
  %12 = call i32 @viaCallee(%struct.Holder* %11, i32 20)
  %13 = call i32 @churn()
  store i32 %13, i32* %n.addr, align 4
  %14 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %15 = call i64 @nish_arena_mark()
  %16 = call i8* @show(%struct.Holder* %14)
  %17 = call i8* @nish_arena_keep(i64 %15, i8* %16)
  %18 = call i8* @nish_str_concat(i8* %17, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %19 = load i32, i32* %n.addr, align 4
  %20 = call i8* @nish_str_from_i32(i32 %19)
  %21 = call i8* @nish_str_concat(i8* %18, i8* %20)
  call void @nish_print(i8* %21)
  %22 = load %struct.Holder*, %struct.Holder** %v.addr, align 8
  %23 = call i64 @nish_arena_mark()
  %24 = call i8* @show(%struct.Holder* %22)
  %25 = call i8* @nish_arena_keep(i64 %23, i8* %24)
  call void @nish_print(i8* %25)
  %26 = load %struct.P*, %struct.P** %k.addr, align 8
  %27 = getelementptr inbounds %struct.P, %struct.P* %26, i32 0, i32 0
  %28 = load i32, i32* %27, align 4
  %29 = call i8* @nish_str_from_i32(i32 %28)
  %30 = call i8* @nish_str_concat(i8* %29, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %31 = load %struct.P*, %struct.P** %k.addr, align 8
  %32 = getelementptr inbounds %struct.P, %struct.P* %31, i32 0, i32 1
  %33 = load i32, i32* %32, align 4
  %34 = call i8* @nish_str_from_i32(i32 %33)
  %35 = call i8* @nish_str_concat(i8* %30, i8* %34)
  call void @nish_print(i8* %35)
  %36 = load %struct.Holder*, %struct.Holder** %g.addr, align 8
  %37 = call i64 @nish_arena_mark()
  %38 = call i8* @show(%struct.Holder* %36)
  %39 = call i8* @nish_arena_keep(i64 %37, i8* %38)
  call void @nish_print(i8* %39)
  %40 = load %struct.Holder*, %struct.Holder** %c.addr, align 8
  %41 = call i64 @nish_arena_mark()
  %42 = call i8* @show(%struct.Holder* %40)
  %43 = call i8* @nish_arena_keep(i64 %41, i8* %42)
  call void @nish_print(i8* %43)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"ptr", !6, i64 0}
!8 = !{!"Holder", !7, i64 0}
!9 = !{!8, !7, i64 0}
!10 = !{!"element i32", !6, i64 0}
!11 = !{!10, !10, i64 0}

%struct.Tally = type { i32 }
%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"k=\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #1
declare void @nish.ThreadScope.spawn$i32$i32$fn.6.triple(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i32 noundef, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef i64 @nish_arena_used() #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare void @nish_panic_div(i1 noundef zeroext) #4
declare void @nish_scope_join(i8* noundef nonnull) #2

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #5 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %in.cap = icmp ule i64 %new.off, %cap
  %bounded = icmp ule i64 %size, 4611686018427387904
  %fits = and i1 %in.cap, %bounded
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %request = select i1 %bounded, i64 %size.aligned, i64 %size
  %grown = call i8* @nish_arena_grow(i64 %request)
  ret i8* %grown
}

define hidden noundef i32 @triple(i32 noundef %n) #0 {
entry:
  %0 = mul nsw i32 %n, 3
  ret i32 %0
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @fill(i32 noundef %k) #1 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %xs.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp slt i32 %5, %k
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %8 = load i32, i32* %i.addr, align 4
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = icmp eq i64 %10, %12
  br i1 %13, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %7, i64 4)
  br label %push.store

push.store:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %10
  store i32 %8, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %18 = add i64 %10, 1
  store i64 %18, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = trunc i64 %18 to i32
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %22 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  ret %struct.nish_array* %22
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Tally* @leave(i32 noundef %k, %struct.Tally* noundef nonnull align 8 dereferenceable(4) %t) #2 {
entry:
  %a.addr = alloca i64, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %b.addr = alloca i64, align 8
  %ys.addr = alloca %struct.nish_array*, align 8
  %0 = call i64 @nish_arena_mark()
  store i64 %0, i64* %a.addr, align 8
  %1 = load i64, i64* %a.addr, align 8
  %2 = call %struct.nish_array* @fill(i32 %k)
  store %struct.nish_array* %2, %struct.nish_array** %xs.addr, align 8
  %3 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  %4 = load i32, i32* %3, align 4, !tbaa !17
  %5 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = trunc i64 %7 to i32
  %9 = add nsw i32 %4, %8
  %10 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  store i32 %9, i32* %10, align 4, !tbaa !17
  call void @nish_arena_release(i64 %1)
  %11 = call i64 @nish_arena_mark()
  store i64 %11, i64* %b.addr, align 8
  %12 = load i64, i64* %b.addr, align 8
  %13 = call %struct.nish_array* @fill(i32 %k)
  store %struct.nish_array* %13, %struct.nish_array** %ys.addr, align 8
  %14 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = trunc i64 %16 to i32
  %18 = icmp eq i32 2, 0
  %19 = icmp eq i32 %k, -2147483648
  %20 = icmp eq i32 2, -1
  %21 = and i1 %19, %20
  %22 = or i1 %18, %21
  br i1 %22, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %18)
  unreachable

div.ok:
  %23 = sdiv i32 %k, 2
  %24 = icmp sgt i32 %17, %23
  br i1 %24, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %12)
  ret %struct.Tally* %t

if.end:
  %25 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  %26 = load i32, i32* %25, align 4, !tbaa !17
  %27 = add nsw i32 %26, 1
  %28 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  store i32 %27, i32* %28, align 4, !tbaa !17
  call void @nish_arena_release(i64 %12)
  ret %struct.Tally* %t
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Tally* @passes(i32 noundef %k, %struct.Tally* noundef nonnull align 8 dereferenceable(4) %t) #1 {
entry:
  %top.addr = alloca i64, align 8
  %i.addr = alloca i32, align 4
  %a.addr = alloca i64, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %0 = call i64 @nish_arena_mark()
  store i64 %0, i64* %top.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %1 = load i32, i32* %i.addr, align 4
  %2 = icmp slt i32 %1, 4
  br i1 %2, label %for.body, label %for.end

for.body:
  %3 = call i64 @nish_arena_mark()
  store i64 %3, i64* %a.addr, align 8
  %4 = load i64, i64* %a.addr, align 8
  %5 = call %struct.nish_array* @fill(i32 %k)
  store %struct.nish_array* %5, %struct.nish_array** %xs.addr, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = icmp eq i32 %6, 1
  br i1 %7, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %4)
  br label %for.inc

if.end:
  %8 = load i32, i32* %i.addr, align 4
  %9 = icmp eq i32 %8, 2
  br i1 %9, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_arena_release(i64 %4)
  br label %for.end

if.end.1:
  %10 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  %11 = load i32, i32* %10, align 4, !tbaa !17
  %12 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = trunc i64 %14 to i32
  %16 = add nsw i32 %11, %15
  %17 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  store i32 %16, i32* %17, align 4, !tbaa !17
  call void @nish_arena_release(i64 %4)
  br label %for.inc

for.inc:
  %18 = load i32, i32* %i.addr, align 4
  %19 = add nsw i32 %18, 1
  store i32 %19, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %20 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  %21 = load i32, i32* %20, align 4, !tbaa !17
  %22 = call i64 @nish_arena_mark()
  %23 = load i64, i64* %top.addr, align 8
  %24 = icmp eq i64 %22, %23
  br i1 %24, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %25 = phi i32 [ 0, %cond.true ], [ 1, %cond.false ]
  %26 = add nsw i32 %21, %25
  %27 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  store i32 %26, i32* %27, align 4, !tbaa !17
  ret %struct.Tally* %t
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Tally* @inPass(i32 noundef %k, %struct.Tally* noundef nonnull align 8 dereferenceable(4) %t) #1 {
entry:
  %i.addr = alloca i32, align 4
  %ys.addr = alloca %struct.nish_array*, align 8
  %a.addr = alloca i64, align 8
  %zs.addr = alloca %struct.nish_array*, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 3
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = call %struct.nish_array* @fill(i32 %k)
  store %struct.nish_array* %6, %struct.nish_array** %ys.addr, align 8
  %7 = call i64 @nish_arena_mark()
  store i64 %7, i64* %a.addr, align 8
  %8 = load i64, i64* %a.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = trunc i64 %11 to i32
  %13 = call %struct.nish_array* @fill(i32 %12)
  store %struct.nish_array* %13, %struct.nish_array** %zs.addr, align 8
  %14 = load i32, i32* %i.addr, align 4
  %15 = icmp eq i32 %14, 1
  br i1 %15, label %if.then, label %if.end

if.then:
  %16 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %17 = load i8*, i8** %16, align 8
  %18 = icmp eq i8* %17, %3
  br i1 %18, label %pass.rewind, label %pass.free

pass.rewind:
  %19 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %19, align 8
  br label %pass.done

pass.free:
  %20 = ptrtoint i8* %3 to i64
  %21 = add i64 %20, %5
  call void @nish_arena_release(i64 %21)
  br label %pass.done

pass.done:
  ret %struct.Tally* %t

if.end:
  %22 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  %23 = load i32, i32* %22, align 4, !tbaa !17
  %24 = load %struct.nish_array*, %struct.nish_array** %zs.addr, align 8
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  %26 = load i64, i64* %25, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = trunc i64 %26 to i32
  %28 = add nsw i32 %23, %27
  %29 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  store i32 %28, i32* %29, align 4, !tbaa !17
  call void @nish_arena_release(i64 %8)
  %30 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %31 = load i8*, i8** %30, align 8
  %32 = icmp eq i8* %31, %3
  br i1 %32, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %33 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %33, align 8
  br label %pass.done.1

pass.free.1:
  %34 = ptrtoint i8* %3 to i64
  %35 = add i64 %34, %5
  call void @nish_arena_release(i64 %35)
  br label %pass.done.1

pass.done.1:
  br label %for.inc

for.inc:
  %36 = load i32, i32* %i.addr, align 4
  %37 = add nsw i32 %36, 1
  store i32 %37, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret %struct.Tally* %t
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Tally* @aroundPass(i32 noundef %k, %struct.Tally* noundef nonnull align 8 dereferenceable(4) %t) #1 {
entry:
  %a.addr = alloca i64, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %zs.addr = alloca %struct.nish_array*, align 8
  %0 = call i64 @nish_arena_mark()
  store i64 %0, i64* %a.addr, align 8
  %1 = load i64, i64* %a.addr, align 8
  %2 = call %struct.nish_array* @fill(i32 %k)
  store %struct.nish_array* %2, %struct.nish_array** %xs.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, 3
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %6 = load i8*, i8** %5, align 8
  %7 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %8 = load i64, i64* %7, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = trunc i64 %11 to i32
  %13 = call %struct.nish_array* @fill(i32 %12)
  store %struct.nish_array* %13, %struct.nish_array** %zs.addr, align 8
  %14 = load i32, i32* %i.addr, align 4
  %15 = icmp eq i32 %14, 1
  br i1 %15, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %1)
  ret %struct.Tally* %t

if.end:
  %16 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  %17 = load i32, i32* %16, align 4, !tbaa !17
  %18 = load %struct.nish_array*, %struct.nish_array** %zs.addr, align 8
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = trunc i64 %20 to i32
  %22 = add nsw i32 %17, %21
  %23 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  store i32 %22, i32* %23, align 4, !tbaa !17
  %24 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %25 = load i8*, i8** %24, align 8
  %26 = icmp eq i8* %25, %6
  br i1 %26, label %pass.rewind, label %pass.free

pass.rewind:
  %27 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %8, i64* %27, align 8
  br label %pass.done

pass.free:
  %28 = ptrtoint i8* %6 to i64
  %29 = add i64 %28, %8
  call void @nish_arena_release(i64 %29)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %30 = load i32, i32* %i.addr, align 4
  %31 = add nsw i32 %30, 1
  store i32 %31, i32* %i.addr, align 4
  br label %for.cond

for.end:
  call void @nish_arena_release(i64 %1)
  ret %struct.Tally* %t
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Tally* @switched(i32 noundef %k, %struct.Tally* noundef nonnull align 8 dereferenceable(4) %t, i32 noundef %pick) #1 {
entry:
  %a.addr = alloca i64, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %b.addr = alloca i64, align 8
  %ys.addr = alloca %struct.nish_array*, align 8
  %0 = call i64 @nish_arena_mark()
  store i64 %0, i64* %a.addr, align 8
  %1 = load i64, i64* %a.addr, align 8
  %2 = call %struct.nish_array* @fill(i32 %k)
  store %struct.nish_array* %2, %struct.nish_array** %xs.addr, align 8
  switch i32 %pick, label %sw.default [
    i32 0, label %sw.case
    i32 1, label %sw.case.1
  ]

sw.case:
  %3 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  %4 = load i32, i32* %3, align 4, !tbaa !17
  %5 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = trunc i64 %7 to i32
  %9 = add nsw i32 %4, %8
  %10 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  store i32 %9, i32* %10, align 4, !tbaa !17
  br label %sw.end

sw.case.1:
  call void @nish_arena_release(i64 %1)
  ret %struct.Tally* %t

sw.default:
  %11 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  %12 = load i32, i32* %11, align 4, !tbaa !17
  %13 = add nsw i32 %12, 1
  %14 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  store i32 %13, i32* %14, align 4, !tbaa !17
  br label %sw.end

sw.end:
  call void @nish_arena_release(i64 %1)
  switch i32 %pick, label %sw.default.1 [
    i32 0, label %sw.case.2
  ]

sw.case.2:
  %15 = call i64 @nish_arena_mark()
  store i64 %15, i64* %b.addr, align 8
  %16 = load i64, i64* %b.addr, align 8
  %17 = call %struct.nish_array* @fill(i32 %k)
  store %struct.nish_array* %17, %struct.nish_array** %ys.addr, align 8
  %18 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = trunc i64 %20 to i32
  %22 = icmp sgt i32 %21, 0
  br i1 %22, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %16)
  br label %sw.end.1

if.end:
  %23 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  %24 = load i32, i32* %23, align 4, !tbaa !17
  %25 = add nsw i32 %24, 1
  %26 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  store i32 %25, i32* %26, align 4, !tbaa !17
  call void @nish_arena_release(i64 %16)
  br label %sw.end.1

sw.default.1:
  %27 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  %28 = load i32, i32* %27, align 4, !tbaa !17
  %29 = add nsw i32 %28, 2
  %30 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  store i32 %29, i32* %30, align 4, !tbaa !17
  br label %sw.end.1

sw.end.1:
  ret %struct.Tally* %t
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Tally* @pair(i32 noundef %k, %struct.Tally* noundef nonnull align 8 dereferenceable(4) %t) #1 {
entry:
  %a.addr = alloca i64, align 8
  %b.addr = alloca i64, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %c.addr = alloca i64, align 8
  %d.addr = alloca i64, align 8
  %ys.addr = alloca %struct.nish_array*, align 8
  %0 = call i64 @nish_arena_mark()
  store i64 %0, i64* %a.addr, align 8
  %1 = call i64 @nish_arena_mark()
  store i64 %1, i64* %b.addr, align 8
  %2 = load i64, i64* %a.addr, align 8
  %3 = load i64, i64* %b.addr, align 8
  %4 = call %struct.nish_array* @fill(i32 %k)
  store %struct.nish_array* %4, %struct.nish_array** %xs.addr, align 8
  %5 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  %6 = load i32, i32* %5, align 4, !tbaa !17
  %7 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = trunc i64 %9 to i32
  %11 = add nsw i32 %6, %10
  %12 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  store i32 %11, i32* %12, align 4, !tbaa !17
  call void @nish_arena_release(i64 %3)
  call void @nish_arena_release(i64 %2)
  %13 = call i64 @nish_arena_mark()
  store i64 %13, i64* %c.addr, align 8
  %14 = call i64 @nish_arena_mark()
  store i64 %14, i64* %d.addr, align 8
  %15 = load i64, i64* %c.addr, align 8
  %16 = load i64, i64* %d.addr, align 8
  %17 = call %struct.nish_array* @fill(i32 %k)
  store %struct.nish_array* %17, %struct.nish_array** %ys.addr, align 8
  %18 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = trunc i64 %20 to i32
  %22 = icmp sgt i32 %21, %k
  br i1 %22, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %15)
  ret %struct.Tally* %t

if.end:
  %23 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  %24 = load i32, i32* %23, align 4, !tbaa !17
  %25 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = trunc i64 %27 to i32
  %29 = add nsw i32 %24, %28
  %30 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  store i32 %29, i32* %30, align 4, !tbaa !17
  call void @nish_arena_release(i64 %15)
  ret %struct.Tally* %t
}

define internal noundef i32 @ownScope(i32 noundef %k) #1 {
entry:
  %label.addr = alloca i8*, align 8
  %a.addr = alloca i64, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_from_i32(i32 %k)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8* %0)
  store i8* %1, i8** %label.addr, align 8
  %2 = call i64 @nish_arena_mark()
  store i64 %2, i64* %a.addr, align 8
  %3 = load i64, i64* %a.addr, align 8
  %4 = call %struct.nish_array* @fill(i32 %k)
  store %struct.nish_array* %4, %struct.nish_array** %xs.addr, align 8
  %5 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = trunc i64 %7 to i32
  %9 = icmp sgt i32 %8, %k
  br i1 %9, label %if.then, label %if.end

if.then:
  %10 = load i8*, i8** %label.addr, align 8
  %11 = bitcast i8* %10 to i64*
  %12 = load i64, i64* %11, align 8
  %13 = trunc i64 %12 to i32
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %13

if.end:
  call void @nish_arena_release(i64 %3)
  %14 = load i8*, i8** %label.addr, align 8
  %15 = bitcast i8* %14 to i64*
  %16 = load i64, i64* %15, align 8
  %17 = trunc i64 %16 to i32
  %18 = add nsw i32 %17, %k
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %18
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Tally* @scopeThenArena(i32 noundef %k, %struct.Tally* noundef nonnull align 8 dereferenceable(4) %t, i32 noundef %mode) #2 {
entry:
  %res.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %s.addr = alloca %struct.ThreadScope*, align 8
  %a.addr = alloca i64, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 2, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 2, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 8)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 0, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 0, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %1, %struct.nish_array** %res.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %9 = load i32, i32* %i.addr, align 4
  %10 = icmp slt i32 %9, 2
  br i1 %10, label %for.body, label %for.end

for.body:
  %11 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %11, %struct.ThreadScope** %s.addr, align 8
  %12 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %13 = bitcast %struct.ThreadScope* %12 to i8*
  %14 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %15 = load i32, i32* %i.addr, align 4
  %16 = add nsw i32 %k, %15
  %17 = load %struct.nish_array*, %struct.nish_array** %res.addr, align 8
  %18 = load i32, i32* %i.addr, align 4
  call void @nish.ThreadScope.spawn$i32$i32$fn.6.triple(%struct.ThreadScope* %14, i32 %16, %struct.nish_array* %17, i32 %18)
  %19 = call i64 @nish_arena_mark()
  store i64 %19, i64* %a.addr, align 8
  %20 = load i64, i64* %a.addr, align 8
  %21 = call %struct.nish_array* @fill(i32 %k)
  store %struct.nish_array* %21, %struct.nish_array** %xs.addr, align 8
  %22 = icmp eq i32 %mode, 0
  br i1 %22, label %land.rhs, label %land.end

land.rhs:
  %23 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = trunc i64 %25 to i32
  %27 = icmp sgt i32 %26, 0
  br label %land.end

land.end:
  %28 = phi i1 [ false, %for.body ], [ %27, %land.rhs ]
  br i1 %28, label %if.then, label %if.end

if.then:
  call void @nish_scope_join(i8* %13)
  call void @nish_arena_release(i64 %20)
  ret %struct.Tally* %t

if.end:
  %29 = icmp eq i32 %mode, 1
  br i1 %29, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %30 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %33 = trunc i64 %32 to i32
  %34 = icmp sgt i32 %33, 0
  br label %land.end.1

land.end.1:
  %35 = phi i1 [ false, %if.end ], [ %34, %land.rhs.1 ]
  br i1 %35, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_arena_release(i64 %20)
  call void @nish_scope_join(i8* %13)
  br label %for.end

if.end.1:
  call void @nish_arena_release(i64 %20)
  call void @nish_scope_join(i8* %13)
  br label %for.inc

for.inc:
  %36 = load i32, i32* %i.addr, align 4
  %37 = add nsw i32 %36, 1
  store i32 %37, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %38 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  %39 = load i32, i32* %38, align 4, !tbaa !17
  %40 = load %struct.nish_array*, %struct.nish_array** %res.addr, align 8
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 0
  %42 = load i64, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %43 = icmp ult i64 0, %42
  br i1 %43, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %42)
  unreachable

bounds.ok:
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 2
  %45 = load i8*, i8** %44, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %46 = bitcast i8* %45 to i32*
  %47 = getelementptr inbounds i32, i32* %46, i64 0
  %48 = load i32, i32* %47, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %49 = add nsw i32 %39, %48
  %50 = load %struct.nish_array*, %struct.nish_array** %res.addr, align 8
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %53 = icmp ult i64 1, %52
  br i1 %53, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %52)
  unreachable

bounds.ok.1:
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 2
  %55 = load i8*, i8** %54, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %56 = bitcast i8* %55 to i32*
  %57 = getelementptr inbounds i32, i32* %56, i64 1
  %58 = load i32, i32* %57, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %59 = add nsw i32 %49, %58
  %60 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  store i32 %59, i32* %60, align 4, !tbaa !17
  ret %struct.Tally* %t
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nested(i32 noundef %k) #2 {
entry:
  %res.addr = alloca %struct.nish_array*, align 8
  %a.addr = alloca i64, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %i.addr = alloca i32, align 4
  %ys.addr = alloca %struct.nish_array*, align 8
  %a.addr.1 = alloca i64, align 8
  %zs.addr = alloca %struct.nish_array*, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 2, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 2, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 8)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 0, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 0, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %1, %struct.nish_array** %res.addr, align 8
  %9 = call i64 @nish_arena_mark()
  store i64 %9, i64* %a.addr, align 8
  %10 = load i64, i64* %a.addr, align 8
  %11 = call %struct.nish_array* @fill(i32 %k)
  store %struct.nish_array* %11, %struct.nish_array** %xs.addr, align 8
  %12 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %12, %struct.ThreadScope** %s.addr, align 8
  %13 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %14 = bitcast %struct.ThreadScope* %13 to i8*
  %15 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = trunc i64 %18 to i32
  %20 = load %struct.nish_array*, %struct.nish_array** %res.addr, align 8
  call void @nish.ThreadScope.spawn$i32$i32$fn.6.triple(%struct.ThreadScope* %15, i32 %19, %struct.nish_array* %20, i32 0)
  call void @nish_scope_join(i8* %14)
  call void @nish_arena_release(i64 %10)
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %21 = load i32, i32* %i.addr, align 4
  %22 = icmp slt i32 %21, 3
  br i1 %22, label %for.body, label %for.end

for.body:
  %23 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %24 = load i8*, i8** %23, align 8
  %25 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %26 = load i64, i64* %25, align 8
  %27 = call %struct.nish_array* @fill(i32 %k)
  store %struct.nish_array* %27, %struct.nish_array** %ys.addr, align 8
  %28 = call i64 @nish_arena_mark()
  store i64 %28, i64* %a.addr.1, align 8
  %29 = load i64, i64* %a.addr.1, align 8
  %30 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %33 = trunc i64 %32 to i32
  %34 = call %struct.nish_array* @fill(i32 %33)
  store %struct.nish_array* %34, %struct.nish_array** %zs.addr, align 8
  %35 = load i32, i32* %i.addr, align 4
  %36 = icmp eq i32 %35, 1
  br i1 %36, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %29)
  %37 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %38 = load i8*, i8** %37, align 8
  %39 = icmp eq i8* %38, %24
  br i1 %39, label %pass.rewind, label %pass.free

pass.rewind:
  %40 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %26, i64* %40, align 8
  br label %pass.done

pass.free:
  %41 = ptrtoint i8* %24 to i64
  %42 = add i64 %41, %26
  call void @nish_arena_release(i64 %42)
  br label %pass.done

pass.done:
  br label %for.inc

if.end:
  %43 = load %struct.nish_array*, %struct.nish_array** %res.addr, align 8
  %44 = load %struct.nish_array*, %struct.nish_array** %res.addr, align 8
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  %46 = load i64, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = icmp ult i64 1, %46
  br i1 %47, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %46)
  unreachable

bounds.ok:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %50 = bitcast i8* %49 to i32*
  %51 = getelementptr inbounds i32, i32* %50, i64 1
  %52 = load i32, i32* %51, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %53 = load %struct.nish_array*, %struct.nish_array** %zs.addr, align 8
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 0
  %55 = load i64, i64* %54, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %56 = trunc i64 %55 to i32
  %57 = add nsw i32 %52, %56
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 2
  %59 = load i8*, i8** %58, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %60 = bitcast i8* %59 to i32*
  %61 = getelementptr inbounds i32, i32* %60, i64 1
  store i32 %57, i32* %61, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  call void @nish_arena_release(i64 %29)
  %62 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %63 = load i8*, i8** %62, align 8
  %64 = icmp eq i8* %63, %24
  br i1 %64, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %65 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %26, i64* %65, align 8
  br label %pass.done.1

pass.free.1:
  %66 = ptrtoint i8* %24 to i64
  %67 = add i64 %66, %26
  call void @nish_arena_release(i64 %67)
  br label %pass.done.1

pass.done.1:
  br label %for.inc

for.inc:
  %68 = load i32, i32* %i.addr, align 4
  %69 = add nsw i32 %68, 1
  store i32 %69, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %70 = load %struct.nish_array*, %struct.nish_array** %res.addr, align 8
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 0
  %72 = load i64, i64* %71, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %73 = icmp ult i64 0, %72
  br i1 %73, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %72)
  unreachable

bounds.ok.1:
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 2
  %75 = load i8*, i8** %74, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %76 = bitcast i8* %75 to i32*
  %77 = getelementptr inbounds i32, i32* %76, i64 0
  %78 = load i32, i32* %77, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %79 = load %struct.nish_array*, %struct.nish_array** %res.addr, align 8
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %79, i64 0, i32 0
  %81 = load i64, i64* %80, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %82 = icmp ult i64 1, %81
  br i1 %82, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 1, i64 %81)
  unreachable

bounds.ok.2:
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %79, i64 0, i32 2
  %84 = load i8*, i8** %83, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %85 = bitcast i8* %84 to i32*
  %86 = getelementptr inbounds i32, i32* %85, i64 1
  %87 = load i32, i32* %86, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %88 = call i8* @nish_alloc_struct(i64 24)
  %89 = bitcast i8* %88 to %struct.nish_array*
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %89, i64 0, i32 0
  store i64 2, i64* %90, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %91 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %89, i64 0, i32 1
  store i64 2, i64* %91, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %92 = call i8* @nish_alloc_struct(i64 8)
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %89, i64 0, i32 2
  store i8* %92, i8** %93, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %94 = bitcast i8* %92 to i32*
  %95 = getelementptr inbounds i32, i32* %94, i64 0
  store i32 %78, i32* %95, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %96 = getelementptr inbounds i32, i32* %94, i64 1
  store i32 %87, i32* %96, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  ret %struct.nish_array* %89
}

define noundef i32 @nish_main() #2 {
entry:
  %t.addr = alloca %struct.Tally*, align 8
  %b1.addr = alloca i64, align 8
  %r1.addr = alloca i32, align 4
  %r2.addr = alloca i32, align 4
  %d1.addr = alloca i64, align 8
  %b2.addr = alloca i64, align 8
  %r3.addr = alloca i32, align 4
  %d2.addr = alloca i64, align 8
  %b3.addr = alloca i64, align 8
  %r4.addr = alloca i32, align 4
  %r5.addr = alloca i32, align 4
  %d3.addr = alloca i64, align 8
  %b6.addr = alloca i64, align 8
  %r8.addr = alloca i32, align 4
  %r9.addr = alloca i32, align 4
  %r10.addr = alloca i32, align 4
  %r11.addr = alloca i32, align 4
  %d6.addr = alloca i64, align 8
  %b7.addr = alloca i64, align 8
  %r12.addr = alloca i32, align 4
  %d7.addr = alloca i64, align 8
  %u.addr = alloca %struct.Tally*, align 8
  %b8.addr = alloca i64, align 8
  %r13.addr = alloca i32, align 4
  %r14.addr = alloca i32, align 4
  %r15.addr = alloca i32, align 4
  %d8.addr = alloca i64, align 8
  %b9.addr = alloca i64, align 8
  %d9.addr = alloca i64, align 8
  %b4.addr = alloca i64, align 8
  %r6.addr = alloca %struct.nish_array*, align 8
  %d4.addr = alloca i64, align 8
  %b5.addr = alloca i64, align 8
  %r7.addr = alloca %struct.nish_array*, align 8
  %d5.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.Tally*
  %2 = getelementptr inbounds %struct.Tally, %struct.Tally* %1, i32 0, i32 0
  store i32 0, i32* %2, align 4, !tbaa !17
  store %struct.Tally* %1, %struct.Tally** %t.addr, align 8
  %3 = call i64 @nish_arena_used()
  store i64 %3, i64* %b1.addr, align 8
  %4 = load %struct.Tally*, %struct.Tally** %t.addr, align 8
  %5 = call %struct.Tally* @leave(i32 1000, %struct.Tally* %4)
  %6 = getelementptr inbounds %struct.Tally, %struct.Tally* %5, i32 0, i32 0
  %7 = load i32, i32* %6, align 4, !tbaa !17
  store i32 %7, i32* %r1.addr, align 4
  %8 = load %struct.Tally*, %struct.Tally** %t.addr, align 8
  %9 = call %struct.Tally* @leave(i32 2, %struct.Tally* %8)
  %10 = getelementptr inbounds %struct.Tally, %struct.Tally* %9, i32 0, i32 0
  %11 = load i32, i32* %10, align 4, !tbaa !17
  store i32 %11, i32* %r2.addr, align 4
  %12 = call i64 @nish_arena_used()
  %13 = load i64, i64* %b1.addr, align 8
  %14 = sub nsw i64 %12, %13
  store i64 %14, i64* %d1.addr, align 8
  %15 = call i64 @nish_arena_used()
  store i64 %15, i64* %b2.addr, align 8
  %16 = load %struct.Tally*, %struct.Tally** %t.addr, align 8
  %17 = call %struct.Tally* @passes(i32 1000, %struct.Tally* %16)
  %18 = getelementptr inbounds %struct.Tally, %struct.Tally* %17, i32 0, i32 0
  %19 = load i32, i32* %18, align 4, !tbaa !17
  store i32 %19, i32* %r3.addr, align 4
  %20 = call i64 @nish_arena_used()
  %21 = load i64, i64* %b2.addr, align 8
  %22 = sub nsw i64 %20, %21
  store i64 %22, i64* %d2.addr, align 8
  %23 = call i64 @nish_arena_used()
  store i64 %23, i64* %b3.addr, align 8
  %24 = load %struct.Tally*, %struct.Tally** %t.addr, align 8
  %25 = call %struct.Tally* @inPass(i32 1000, %struct.Tally* %24)
  %26 = getelementptr inbounds %struct.Tally, %struct.Tally* %25, i32 0, i32 0
  %27 = load i32, i32* %26, align 4, !tbaa !17
  store i32 %27, i32* %r4.addr, align 4
  %28 = load %struct.Tally*, %struct.Tally** %t.addr, align 8
  %29 = call %struct.Tally* @aroundPass(i32 1000, %struct.Tally* %28)
  %30 = getelementptr inbounds %struct.Tally, %struct.Tally* %29, i32 0, i32 0
  %31 = load i32, i32* %30, align 4, !tbaa !17
  store i32 %31, i32* %r5.addr, align 4
  %32 = call i64 @nish_arena_used()
  %33 = load i64, i64* %b3.addr, align 8
  %34 = sub nsw i64 %32, %33
  store i64 %34, i64* %d3.addr, align 8
  %35 = call i64 @nish_arena_used()
  store i64 %35, i64* %b6.addr, align 8
  %36 = load %struct.Tally*, %struct.Tally** %t.addr, align 8
  %37 = call %struct.Tally* @switched(i32 1000, %struct.Tally* %36, i32 0)
  %38 = getelementptr inbounds %struct.Tally, %struct.Tally* %37, i32 0, i32 0
  %39 = load i32, i32* %38, align 4, !tbaa !17
  store i32 %39, i32* %r8.addr, align 4
  %40 = load %struct.Tally*, %struct.Tally** %t.addr, align 8
  %41 = call %struct.Tally* @switched(i32 1000, %struct.Tally* %40, i32 1)
  %42 = getelementptr inbounds %struct.Tally, %struct.Tally* %41, i32 0, i32 0
  %43 = load i32, i32* %42, align 4, !tbaa !17
  store i32 %43, i32* %r9.addr, align 4
  %44 = load %struct.Tally*, %struct.Tally** %t.addr, align 8
  %45 = call %struct.Tally* @switched(i32 1000, %struct.Tally* %44, i32 2)
  %46 = getelementptr inbounds %struct.Tally, %struct.Tally* %45, i32 0, i32 0
  %47 = load i32, i32* %46, align 4, !tbaa !17
  store i32 %47, i32* %r10.addr, align 4
  %48 = load %struct.Tally*, %struct.Tally** %t.addr, align 8
  %49 = call %struct.Tally* @pair(i32 1000, %struct.Tally* %48)
  %50 = getelementptr inbounds %struct.Tally, %struct.Tally* %49, i32 0, i32 0
  %51 = load i32, i32* %50, align 4, !tbaa !17
  store i32 %51, i32* %r11.addr, align 4
  %52 = call i64 @nish_arena_used()
  %53 = load i64, i64* %b6.addr, align 8
  %54 = sub nsw i64 %52, %53
  store i64 %54, i64* %d6.addr, align 8
  %55 = call i64 @nish_arena_used()
  store i64 %55, i64* %b7.addr, align 8
  %56 = call i32 @ownScope(i32 1000)
  %57 = call i32 @ownScope(i32 2)
  %58 = add nsw i32 %56, %57
  store i32 %58, i32* %r12.addr, align 4
  %59 = call i64 @nish_arena_used()
  %60 = load i64, i64* %b7.addr, align 8
  %61 = sub nsw i64 %59, %60
  store i64 %61, i64* %d7.addr, align 8
  %62 = call i8* @nish_alloc_struct(i64 4)
  %63 = bitcast i8* %62 to %struct.Tally*
  %64 = getelementptr inbounds %struct.Tally, %struct.Tally* %63, i32 0, i32 0
  store i32 0, i32* %64, align 4, !tbaa !17
  store %struct.Tally* %63, %struct.Tally** %u.addr, align 8
  %65 = call i64 @nish_arena_used()
  store i64 %65, i64* %b8.addr, align 8
  %66 = load %struct.Tally*, %struct.Tally** %u.addr, align 8
  %67 = call %struct.Tally* @scopeThenArena(i32 1000, %struct.Tally* %66, i32 0)
  %68 = getelementptr inbounds %struct.Tally, %struct.Tally* %67, i32 0, i32 0
  %69 = load i32, i32* %68, align 4, !tbaa !17
  store i32 %69, i32* %r13.addr, align 4
  %70 = load %struct.Tally*, %struct.Tally** %u.addr, align 8
  %71 = call %struct.Tally* @scopeThenArena(i32 1000, %struct.Tally* %70, i32 1)
  %72 = getelementptr inbounds %struct.Tally, %struct.Tally* %71, i32 0, i32 0
  %73 = load i32, i32* %72, align 4, !tbaa !17
  store i32 %73, i32* %r14.addr, align 4
  %74 = load %struct.Tally*, %struct.Tally** %u.addr, align 8
  %75 = call %struct.Tally* @scopeThenArena(i32 1000, %struct.Tally* %74, i32 2)
  %76 = getelementptr inbounds %struct.Tally, %struct.Tally* %75, i32 0, i32 0
  %77 = load i32, i32* %76, align 4, !tbaa !17
  store i32 %77, i32* %r15.addr, align 4
  %78 = call i64 @nish_arena_used()
  %79 = load i64, i64* %b8.addr, align 8
  %80 = sub nsw i64 %78, %79
  store i64 %80, i64* %d8.addr, align 8
  %81 = call i64 @nish_arena_used()
  store i64 %81, i64* %b9.addr, align 8
  %82 = load %struct.Tally*, %struct.Tally** %u.addr, align 8
  %83 = call %struct.Tally* @scopeThenArena(i32 1, %struct.Tally* %82, i32 0)
  %84 = load %struct.Tally*, %struct.Tally** %u.addr, align 8
  %85 = call %struct.Tally* @scopeThenArena(i32 1, %struct.Tally* %84, i32 1)
  %86 = load %struct.Tally*, %struct.Tally** %u.addr, align 8
  %87 = call %struct.Tally* @scopeThenArena(i32 1, %struct.Tally* %86, i32 2)
  %88 = call i64 @nish_arena_used()
  %89 = load i64, i64* %b9.addr, align 8
  %90 = sub nsw i64 %88, %89
  store i64 %90, i64* %d9.addr, align 8
  %91 = call i64 @nish_arena_used()
  store i64 %91, i64* %b4.addr, align 8
  %92 = call %struct.nish_array* @nested(i32 1000)
  store %struct.nish_array* %92, %struct.nish_array** %r6.addr, align 8
  %93 = call i64 @nish_arena_used()
  %94 = load i64, i64* %b4.addr, align 8
  %95 = sub nsw i64 %93, %94
  store i64 %95, i64* %d4.addr, align 8
  %96 = call i64 @nish_arena_used()
  store i64 %96, i64* %b5.addr, align 8
  %97 = call %struct.nish_array* @nested(i32 1)
  store %struct.nish_array* %97, %struct.nish_array** %r7.addr, align 8
  %98 = call i64 @nish_arena_used()
  %99 = load i64, i64* %b5.addr, align 8
  %100 = sub nsw i64 %98, %99
  store i64 %100, i64* %d5.addr, align 8
  %101 = load i32, i32* %r1.addr, align 4
  %102 = call i8* @nish_str_from_i32(i32 %101)
  %103 = call i8* @nish_str_concat(i8* %102, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %104 = load i32, i32* %r2.addr, align 4
  %105 = call i8* @nish_str_from_i32(i32 %104)
  %106 = call i8* @nish_str_concat(i8* %103, i8* %105)
  %107 = call i8* @nish_str_concat(i8* %106, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %108 = load i64, i64* %d1.addr, align 8
  %109 = call i8* @nish_str_from_i64(i64 %108)
  %110 = call i8* @nish_str_concat(i8* %107, i8* %109)
  call void @nish_print(i8* %110)
  %111 = load i32, i32* %r3.addr, align 4
  %112 = call i8* @nish_str_from_i32(i32 %111)
  %113 = call i8* @nish_str_concat(i8* %112, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %114 = load i64, i64* %d2.addr, align 8
  %115 = call i8* @nish_str_from_i64(i64 %114)
  %116 = call i8* @nish_str_concat(i8* %113, i8* %115)
  call void @nish_print(i8* %116)
  %117 = load i32, i32* %r4.addr, align 4
  %118 = call i8* @nish_str_from_i32(i32 %117)
  %119 = call i8* @nish_str_concat(i8* %118, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %120 = load i32, i32* %r5.addr, align 4
  %121 = call i8* @nish_str_from_i32(i32 %120)
  %122 = call i8* @nish_str_concat(i8* %119, i8* %121)
  %123 = call i8* @nish_str_concat(i8* %122, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %124 = load i64, i64* %d3.addr, align 8
  %125 = call i8* @nish_str_from_i64(i64 %124)
  %126 = call i8* @nish_str_concat(i8* %123, i8* %125)
  call void @nish_print(i8* %126)
  %127 = load i32, i32* %r8.addr, align 4
  %128 = call i8* @nish_str_from_i32(i32 %127)
  %129 = call i8* @nish_str_concat(i8* %128, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %130 = load i32, i32* %r9.addr, align 4
  %131 = call i8* @nish_str_from_i32(i32 %130)
  %132 = call i8* @nish_str_concat(i8* %129, i8* %131)
  %133 = call i8* @nish_str_concat(i8* %132, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %134 = load i32, i32* %r10.addr, align 4
  %135 = call i8* @nish_str_from_i32(i32 %134)
  %136 = call i8* @nish_str_concat(i8* %133, i8* %135)
  %137 = call i8* @nish_str_concat(i8* %136, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %138 = load i32, i32* %r11.addr, align 4
  %139 = call i8* @nish_str_from_i32(i32 %138)
  %140 = call i8* @nish_str_concat(i8* %137, i8* %139)
  %141 = call i8* @nish_str_concat(i8* %140, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %142 = load i64, i64* %d6.addr, align 8
  %143 = call i8* @nish_str_from_i64(i64 %142)
  %144 = call i8* @nish_str_concat(i8* %141, i8* %143)
  call void @nish_print(i8* %144)
  %145 = load i32, i32* %r12.addr, align 4
  %146 = call i8* @nish_str_from_i32(i32 %145)
  %147 = call i8* @nish_str_concat(i8* %146, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %148 = load i64, i64* %d7.addr, align 8
  %149 = call i8* @nish_str_from_i64(i64 %148)
  %150 = call i8* @nish_str_concat(i8* %147, i8* %149)
  call void @nish_print(i8* %150)
  %151 = load i32, i32* %r13.addr, align 4
  %152 = call i8* @nish_str_from_i32(i32 %151)
  %153 = call i8* @nish_str_concat(i8* %152, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %154 = load i32, i32* %r14.addr, align 4
  %155 = call i8* @nish_str_from_i32(i32 %154)
  %156 = call i8* @nish_str_concat(i8* %153, i8* %155)
  %157 = call i8* @nish_str_concat(i8* %156, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %158 = load i32, i32* %r15.addr, align 4
  %159 = call i8* @nish_str_from_i32(i32 %158)
  %160 = call i8* @nish_str_concat(i8* %157, i8* %159)
  %161 = call i8* @nish_str_concat(i8* %160, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %162 = load i64, i64* %d8.addr, align 8
  %163 = load i64, i64* %d9.addr, align 8
  %164 = icmp eq i64 %162, %163
  %165 = select i1 %164, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %166 = call i8* @nish_str_concat(i8* %161, i8* %165)
  call void @nish_print(i8* %166)
  %167 = load %struct.nish_array*, %struct.nish_array** %r6.addr, align 8
  %168 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %167, i64 0, i32 0
  %169 = load i64, i64* %168, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %170 = icmp ult i64 0, %169
  br i1 %170, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %169)
  unreachable

bounds.ok:
  %171 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %167, i64 0, i32 2
  %172 = load i8*, i8** %171, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %173 = bitcast i8* %172 to i32*
  %174 = getelementptr inbounds i32, i32* %173, i64 0
  %175 = load i32, i32* %174, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %176 = call i8* @nish_str_from_i32(i32 %175)
  %177 = call i8* @nish_str_concat(i8* %176, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %178 = load %struct.nish_array*, %struct.nish_array** %r6.addr, align 8
  %179 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %178, i64 0, i32 0
  %180 = load i64, i64* %179, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %181 = icmp ult i64 1, %180
  br i1 %181, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %180)
  unreachable

bounds.ok.1:
  %182 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %178, i64 0, i32 2
  %183 = load i8*, i8** %182, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %184 = bitcast i8* %183 to i32*
  %185 = getelementptr inbounds i32, i32* %184, i64 1
  %186 = load i32, i32* %185, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %187 = call i8* @nish_str_from_i32(i32 %186)
  %188 = call i8* @nish_str_concat(i8* %177, i8* %187)
  %189 = call i8* @nish_str_concat(i8* %188, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %190 = load %struct.nish_array*, %struct.nish_array** %r7.addr, align 8
  %191 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %190, i64 0, i32 0
  %192 = load i64, i64* %191, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %193 = icmp ult i64 0, %192
  br i1 %193, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %192)
  unreachable

bounds.ok.2:
  %194 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %190, i64 0, i32 2
  %195 = load i8*, i8** %194, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %196 = bitcast i8* %195 to i32*
  %197 = getelementptr inbounds i32, i32* %196, i64 0
  %198 = load i32, i32* %197, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %199 = call i8* @nish_str_from_i32(i32 %198)
  %200 = call i8* @nish_str_concat(i8* %189, i8* %199)
  %201 = call i8* @nish_str_concat(i8* %200, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %202 = load %struct.nish_array*, %struct.nish_array** %r7.addr, align 8
  %203 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %202, i64 0, i32 0
  %204 = load i64, i64* %203, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %205 = icmp ult i64 1, %204
  br i1 %205, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 1, i64 %204)
  unreachable

bounds.ok.3:
  %206 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %202, i64 0, i32 2
  %207 = load i8*, i8** %206, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %208 = bitcast i8* %207 to i32*
  %209 = getelementptr inbounds i32, i32* %208, i64 1
  %210 = load i32, i32* %209, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %211 = call i8* @nish_str_from_i32(i32 %210)
  %212 = call i8* @nish_str_concat(i8* %201, i8* %211)
  %213 = call i8* @nish_str_concat(i8* %212, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %214 = load i64, i64* %d4.addr, align 8
  %215 = load i64, i64* %d5.addr, align 8
  %216 = icmp eq i64 %214, %215
  %217 = select i1 %216, i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*)
  %218 = call i8* @nish_str_concat(i8* %213, i8* %217)
  call void @nish_print(i8* %218)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind noreturn cold }
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
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"i32", !6, i64 0}
!16 = !{!"Tally", !15, i64 0}
!17 = !{!16, !15, i64 0}

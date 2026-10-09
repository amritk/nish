%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [41 x i8] } { i64 40, [41 x i8] c"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

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

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @wordsOf(i32 noundef %i) #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %xs.addr, align 8
  %5 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %6 = call i8* @nish_str_from_i32(i32 %i)
  %7 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8* %6)
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
  %19 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %20 = call i8* @nish_str_from_i32(i32 %i)
  %21 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* %20)
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 1
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %26 = icmp eq i64 %23, %25
  br i1 %26, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %19, i64 8)
  br label %push.store.1

push.store.1:
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %29 = bitcast i8* %28 to i8**
  %30 = getelementptr inbounds i8*, i8** %29, i64 %23
  store i8* %21, i8** %30, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %31 = add i64 %23, 1
  store i64 %31, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = trunc i64 %31 to i32
  %33 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  ret %struct.nish_array* %33
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @rowsOf(i32 noundef %i) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %5 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %6 = call %struct.nish_array* @wordsOf(i32 %i)
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %11 = icmp eq i64 %8, %10
  br i1 %11, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 8)
  br label %push.store

push.store:
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %14 = bitcast i8* %13 to %struct.nish_array**
  %15 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %14, i64 %8
  store %struct.nish_array* %6, %struct.nish_array** %15, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %16 = add i64 %8, 1
  store i64 %16, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = trunc i64 %16 to i32
  %18 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %18
}

define internal noundef nonnull align 8 i8* @firstOf(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %row) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %row, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = icmp ult i64 0, %1
  br i1 %2, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %1)
  unreachable

bounds.ok:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %row, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %5 = bitcast i8* %4 to i8**
  %6 = getelementptr inbounds i8*, i8** %5, i64 0
  %7 = load i8*, i8** %6, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  ret i8* %7
}

define internal noundef nonnull align 8 i8* @lastFirst(i32 noundef %n) #0 {
entry:
  %i.addr = alloca i32, align 4
  %row.addr = alloca %struct.nish_array*, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = call %struct.nish_array* @rowsOf(i32 %2)
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = icmp ult i64 0, %5
  br i1 %6, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %5)
  unreachable

bounds.ok:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %9 = bitcast i8* %8 to %struct.nish_array**
  %10 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %9, i64 0
  %11 = load %struct.nish_array*, %struct.nish_array** %10, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %11, %struct.nish_array** %row.addr, align 8
  %12 = load i32, i32* %i.addr, align 4
  %13 = sub nsw i32 %n, 1
  %14 = icmp eq i32 %12, %13
  br i1 %14, label %if.then, label %if.end

if.then:
  %15 = load %struct.nish_array*, %struct.nish_array** %row.addr, align 8
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = icmp ult i64 0, %17
  br i1 %18, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %17)
  unreachable

bounds.ok.1:
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %21 = bitcast i8* %20 to i8**
  %22 = getelementptr inbounds i8*, i8** %21, i64 0
  %23 = load i8*, i8** %22, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  ret i8* %23

if.end:
  br label %for.inc

for.inc:
  %24 = load i32, i32* %i.addr, align 4
  %25 = add nsw i32 %24, 1
  store i32 %25, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*)
}

define void @nish_main() #0 {
entry:
  %viaLocal.addr = alloca i8*, align 8
  %viaForOf.addr = alloca i8*, align 8
  %viaCall.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  %row.addr = alloca %struct.nish_array*, align 8
  %i.addr.1 = alloca i32, align 4
  %row.addr.1 = alloca %struct.nish_array*, align 8
  %forof.idx = alloca i64, align 8
  %i.addr.2 = alloca i32, align 4
  %viaReturn.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %viaLocal.addr, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %viaForOf.addr, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.2 to i8*), i8** %viaCall.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 1000
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = call %struct.nish_array* @rowsOf(i32 %2)
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = icmp ult i64 0, %5
  br i1 %6, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %5)
  unreachable

bounds.ok:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %9 = bitcast i8* %8 to %struct.nish_array**
  %10 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %9, i64 0
  %11 = load %struct.nish_array*, %struct.nish_array** %10, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %11, %struct.nish_array** %row.addr, align 8
  %12 = load %struct.nish_array*, %struct.nish_array** %row.addr, align 8
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = icmp ult i64 0, %14
  br i1 %15, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %14)
  unreachable

bounds.ok.1:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %18 = bitcast i8* %17 to i8**
  %19 = getelementptr inbounds i8*, i8** %18, i64 0
  %20 = load i8*, i8** %19, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i8* %20, i8** %viaLocal.addr, align 8
  br label %for.inc

for.inc:
  %21 = load i32, i32* %i.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %i.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %23 = load i32, i32* %i.addr.1, align 4
  %24 = icmp slt i32 %23, 1000
  br i1 %24, label %for.body.1, label %for.end.1

for.body.1:
  %25 = load i32, i32* %i.addr.1, align 4
  %26 = call %struct.nish_array* @rowsOf(i32 %25)
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %27 = load i64, i64* %forof.idx, align 8
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = icmp ult i64 %27, %29
  br i1 %30, label %forof.body, label %forof.end

forof.body:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %33 = bitcast i8* %32 to %struct.nish_array**
  %34 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %33, i64 %27
  %35 = load %struct.nish_array*, %struct.nish_array** %34, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %35, %struct.nish_array** %row.addr.1, align 8
  %36 = load %struct.nish_array*, %struct.nish_array** %row.addr.1, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = icmp ult i64 0, %38
  br i1 %39, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %38)
  unreachable

bounds.ok.2:
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %42 = bitcast i8* %41 to i8**
  %43 = getelementptr inbounds i8*, i8** %42, i64 0
  %44 = load i8*, i8** %43, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i8* %44, i8** %viaForOf.addr, align 8
  br label %forof.inc

forof.inc:
  %45 = load i64, i64* %forof.idx, align 8
  %46 = add i64 %45, 1
  store i64 %46, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  br label %for.inc.1

for.inc.1:
  %47 = load i32, i32* %i.addr.1, align 4
  %48 = add nsw i32 %47, 1
  store i32 %48, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  store i32 0, i32* %i.addr.2, align 4
  br label %for.cond.2

for.cond.2:
  %49 = load i32, i32* %i.addr.2, align 4
  %50 = icmp slt i32 %49, 1000
  br i1 %50, label %for.body.2, label %for.end.2

for.body.2:
  %51 = load i32, i32* %i.addr.2, align 4
  %52 = call %struct.nish_array* @rowsOf(i32 %51)
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %52, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %55 = icmp ult i64 0, %54
  br i1 %55, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 0, i64 %54)
  unreachable

bounds.ok.3:
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %52, i64 0, i32 2
  %57 = load i8*, i8** %56, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %58 = bitcast i8* %57 to %struct.nish_array**
  %59 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %58, i64 0
  %60 = load %struct.nish_array*, %struct.nish_array** %59, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %61 = call i8* @firstOf(%struct.nish_array* %60)
  store i8* %61, i8** %viaCall.addr, align 8
  br label %for.inc.2

for.inc.2:
  %62 = load i32, i32* %i.addr.2, align 4
  %63 = add nsw i32 %62, 1
  store i32 %63, i32* %i.addr.2, align 4
  br label %for.cond.2

for.end.2:
  %64 = call i8* @lastFirst(i32 1000)
  store i8* %64, i8** %viaReturn.addr, align 8
  %65 = call i32 @churn()
  %66 = call i8* @nish_str_from_i32(i32 %65)
  call void @nish_print(i8* %66)
  %67 = load i8*, i8** %viaLocal.addr, align 8
  call void @nish_print(i8* %67)
  %68 = load i8*, i8** %viaForOf.addr, align 8
  call void @nish_print(i8* %68)
  %69 = load i8*, i8** %viaCall.addr, align 8
  call void @nish_print(i8* %69)
  %70 = load i8*, i8** %viaReturn.addr, align 8
  call void @nish_print(i8* %70)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal noundef i32 @churn() #0 {
entry:
  %t.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %t.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 2000
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = load i32, i32* %t.addr, align 4
  %7 = load i32, i32* %i.addr, align 4
  %8 = call i8* @nish_str_from_i32(i32 %7)
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [41 x i8] }* @.str.3 to i8*), i8* %8)
  %10 = bitcast i8* %9 to i64*
  %11 = load i64, i64* %10, align 8
  %12 = trunc i64 %11 to i32
  %13 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 %12)
  %14 = extractvalue { i32, i1 } %13, 0
  %15 = extractvalue { i32, i1 } %13, 1
  br i1 %15, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %14, i32* %t.addr, align 4
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
  br label %for.inc

for.inc:
  %22 = load i32, i32* %i.addr, align 4
  %23 = add nsw i32 %22, 1
  store i32 %23, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %24 = load i32, i32* %t.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %24

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

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
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

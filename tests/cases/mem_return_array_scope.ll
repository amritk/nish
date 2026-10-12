%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"-\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"line \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"x\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"flat\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"grows\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noundef i64 @nish_arena_used() #2
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #2
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare i64 @nish_str_index_of(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #2
declare void @nish_exit(i32 noundef) #4
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #5
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare i64 @llvm.smin.i64(i64, i64) #6
declare i64 @llvm.smax.i64(i64, i64) #6
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #6
declare { i64, i1 } @llvm.ssub.with.overflow.i64(i64, i64) #6

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

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @fieldsOf(i8* noundef nonnull noalias readonly align 8 nocapture %line, i32 noundef %n) #0 {
entry:
  %values.addr = alloca %struct.nish_array*, align 8
  %k.addr = alloca i32, align 4
  %0 = sext i32 %n to i64
  %1 = icmp ule i64 %0, 2147483647
  br i1 %1, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 %0, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %0, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = mul i64 %0, 8
  %7 = call i8* @nish_alloc_struct(i64 %6)
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %6, i1 false), !alias.scope !4, !noalias !3
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %3, %struct.nish_array** %values.addr, align 8
  store i32 0, i32* %k.addr, align 4
  %9 = load %struct.nish_array*, %struct.nish_array** %values.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %14 = load i32, i32* %k.addr, align 4
  %15 = trunc i64 %11 to i32
  %16 = icmp slt i32 %14, %15
  br i1 %16, label %for.body, label %for.end

for.body:
  %17 = load i32, i32* %k.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = bitcast i8* %13 to i8**
  %20 = getelementptr inbounds i8*, i8** %19, i64 %18
  %21 = load i8*, i8** %20, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %22 = icmp eq i8* %21, null
  br i1 %22, label %land.rhs, label %land.end

land.rhs:
  %23 = load i32, i32* %k.addr, align 4
  %24 = bitcast i8* %line to i64*
  %25 = load i64, i64* %24, align 8
  %26 = trunc i64 %25 to i32
  %27 = icmp slt i32 %23, %26
  br label %land.end

land.end:
  %28 = phi i1 [ false, %for.body ], [ %27, %land.rhs ]
  br i1 %28, label %if.then, label %if.end

if.then:
  %29 = load i32, i32* %k.addr, align 4
  %30 = sext i32 %29 to i64
  %31 = bitcast i8* %line to i64*
  %32 = load i64, i64* %31, align 8
  %33 = load i32, i32* %k.addr, align 4
  %34 = sext i32 %33 to i64
  %35 = bitcast i8* %line to i64*
  %36 = load i64, i64* %35, align 8
  %37 = trunc i64 %36 to i32
  %38 = sext i32 %37 to i64
  %39 = call i64 @llvm.smin.i64(i64 %38, i64 %32)
  %40 = call i64 @llvm.smax.i64(i64 %39, i64 0)
  %41 = call i64 @llvm.smin.i64(i64 %34, i64 %40)
  %42 = call i64 @llvm.smax.i64(i64 %34, i64 %40)
  %43 = sub i64 %42, %41
  %44 = getelementptr inbounds i8, i8* %line, i64 8
  %45 = getelementptr inbounds i8, i8* %44, i64 %41
  %46 = call i8* @nish_str_new(i8* %45, i64 %43)
  %47 = bitcast i8* %13 to i8**
  %48 = getelementptr inbounds i8*, i8** %47, i64 %30
  store i8* %46, i8** %48, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %49 = load i32, i32* %k.addr, align 4
  %50 = add nsw i32 %49, 1
  store i32 %50, i32* %k.addr, align 4
  br label %for.cond

for.end:
  %51 = load %struct.nish_array*, %struct.nish_array** %values.addr, align 8
  ret %struct.nish_array* %51
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @pairOf(i8* noundef nonnull noalias readonly align 8 nocapture %a, i8* noundef nonnull noalias readonly align 8 nocapture %b) #0 {
entry:
  %pair.addr = alloca %struct.nish_array*, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %pair.addr, align 8
  %5 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %6 = call i8* @nish_str_concat(i8* %a, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %7 = call i8* @nish_str_concat(i8* %6, i8* %b)
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
  %19 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %20 = call i8* @nish_str_concat(i8* %b, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %21 = call i8* @nish_str_concat(i8* %20, i8* %a)
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
  %33 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  ret %struct.nish_array* %33
}

define internal noundef nonnull align 8 i8* @run(i32 noundef %calls) #0 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %fields.addr = alloca %struct.nish_array*, align 8
  %first.addr = alloca i8*, align 8
  %last.addr = alloca i8*, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %calls
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = call i8* @nish_str_from_i32(i32 %6)
  %8 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*), i8* %7)
  %9 = call %struct.nish_array* @fieldsOf(i8* %8, i32 3)
  store %struct.nish_array* %9, %struct.nish_array** %fields.addr, align 8
  %10 = load %struct.nish_array*, %struct.nish_array** %fields.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %12 to i8**
  %14 = getelementptr inbounds i8*, i8** %13, i64 0
  %15 = load i8*, i8** %14, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i8* %15, i8** %first.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %fields.addr, align 8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %19 = bitcast i8* %18 to i8**
  %20 = getelementptr inbounds i8*, i8** %19, i64 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i8* %21, i8** %last.addr, align 8
  %22 = load i8*, i8** %first.addr, align 8
  %23 = icmp ne i8* %22, null
  br i1 %23, label %land.rhs, label %land.end

land.rhs:
  %24 = load i8*, i8** %last.addr, align 8
  %25 = icmp ne i8* %24, null
  br label %land.end

land.end:
  %26 = phi i1 [ false, %for.body ], [ %25, %land.rhs ]
  br i1 %26, label %if.then, label %if.end

if.then:
  %27 = load i32, i32* %total.addr, align 4
  %28 = load i8*, i8** %first.addr, align 8
  %29 = bitcast i8* %28 to i64*
  %30 = load i64, i64* %29, align 8
  %31 = trunc i64 %30 to i32
  %32 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %27, i32 %31)
  %33 = extractvalue { i32, i1 } %32, 0
  %34 = extractvalue { i32, i1 } %32, 1
  br i1 %34, label %ovf.fail, label %ovf.ok

ovf.ok:
  %35 = load i8*, i8** %last.addr, align 8
  %36 = bitcast i8* %35 to i64*
  %37 = load i64, i64* %36, align 8
  %38 = trunc i64 %37 to i32
  %39 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %33, i32 %38)
  %40 = extractvalue { i32, i1 } %39, 0
  %41 = extractvalue { i32, i1 } %39, 1
  br i1 %41, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %40, i32* %total.addr, align 4
  br label %if.end

if.end:
  %42 = load i32, i32* %total.addr, align 4
  %43 = load i32, i32* %i.addr, align 4
  %44 = call i8* @nish_str_from_i32(i32 %43)
  %45 = call %struct.nish_array* @pairOf(i8* %44, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 0
  %47 = load i64, i64* %46, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %48 = icmp ult i64 1, %47
  br i1 %48, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 1, i64 %47)
  unreachable

bounds.ok:
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 2
  %50 = load i8*, i8** %49, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %51 = bitcast i8* %50 to i8**
  %52 = getelementptr inbounds i8*, i8** %51, i64 1
  %53 = load i8*, i8** %52, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %54 = bitcast i8* %53 to i64*
  %55 = load i64, i64* %54, align 8
  %56 = trunc i64 %55 to i32
  %57 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %42, i32 %56)
  %58 = extractvalue { i32, i1 } %57, 0
  %59 = extractvalue { i32, i1 } %57, 1
  br i1 %59, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %58, i32* %total.addr, align 4
  %60 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %61 = load i8*, i8** %60, align 8
  %62 = icmp eq i8* %61, %3
  br i1 %62, label %pass.rewind, label %pass.free

pass.rewind:
  %63 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %63, align 8
  br label %pass.done

pass.free:
  %64 = ptrtoint i8* %3 to i64
  %65 = add i64 %64, %5
  call void @nish_arena_release(i64 %65)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %66 = load i32, i32* %i.addr, align 4
  %67 = add nsw i32 %66, 1
  store i32 %67, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %68 = load i32, i32* %total.addr, align 4
  %69 = call i8* @nish_str_from_i32(i32 %68)
  ret i8* %69

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef nonnull align 8 i8* @grows(i32 noundef %calls) #0 {
entry:
  %before.addr = alloca i64, align 8
  %total.addr = alloca i8*, align 8
  %grown.addr = alloca i64, align 8
  %0 = call i64 @nish_arena_used()
  store i64 %0, i64* %before.addr, align 8
  %1 = call i64 @nish_arena_mark()
  %2 = call i8* @run(i32 %calls)
  %3 = call i8* @nish_arena_keep(i64 %1, i8* %2)
  store i8* %3, i8** %total.addr, align 8
  %4 = call i64 @nish_arena_used()
  %5 = load i64, i64* %before.addr, align 8
  %6 = call { i64, i1 } @llvm.ssub.with.overflow.i64(i64 %4, i64 %5)
  %7 = extractvalue { i64, i1 } %6, 0
  %8 = extractvalue { i64, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i64 %7, i64* %grown.addr, align 8
  %9 = load i8*, i8** %total.addr, align 8
  %10 = call i8* @nish_str_concat(i8* %9, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %11 = load i64, i64* %grown.addr, align 8
  %12 = call i8* @nish_str_from_i64(i64 %11)
  %13 = call i8* @nish_str_concat(i8* %10, i8* %12)
  ret i8* %13

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define void @nish_main() #0 {
entry:
  %one.addr = alloca i8*, align 8
  %many.addr = alloca i8*, align 8
  %g1.addr = alloca i8*, align 8
  %g2.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @grows(i32 1)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  store i8* %2, i8** %one.addr, align 8
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @grows(i32 1000)
  %5 = call i8* @nish_arena_keep(i64 %3, i8* %4)
  store i8* %5, i8** %many.addr, align 8
  %6 = load i8*, i8** %one.addr, align 8
  call void @nish_print(i8* %6)
  %7 = load i8*, i8** %many.addr, align 8
  call void @nish_print(i8* %7)
  %8 = load i8*, i8** %one.addr, align 8
  %9 = bitcast i8* %8 to i64*
  %10 = load i64, i64* %9, align 8
  %11 = load i8*, i8** %one.addr, align 8
  %12 = call i64 @nish_str_index_of(i8* %11, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %13 = trunc i64 %12 to i32
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %13, i32 1)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok

ovf.ok:
  %17 = sext i32 %15 to i64
  %18 = call i64 @llvm.smin.i64(i64 %17, i64 %10)
  %19 = call i64 @llvm.smax.i64(i64 %18, i64 0)
  %20 = load i8*, i8** %one.addr, align 8
  %21 = bitcast i8* %20 to i64*
  %22 = load i64, i64* %21, align 8
  %23 = trunc i64 %22 to i32
  %24 = sext i32 %23 to i64
  %25 = call i64 @llvm.smin.i64(i64 %24, i64 %10)
  %26 = call i64 @llvm.smax.i64(i64 %25, i64 0)
  %27 = call i64 @llvm.smin.i64(i64 %19, i64 %26)
  %28 = call i64 @llvm.smax.i64(i64 %19, i64 %26)
  %29 = sub i64 %28, %27
  %30 = getelementptr inbounds i8, i8* %8, i64 8
  %31 = getelementptr inbounds i8, i8* %30, i64 %27
  %32 = call i8* @nish_str_new(i8* %31, i64 %29)
  store i8* %32, i8** %g1.addr, align 8
  %33 = load i8*, i8** %many.addr, align 8
  %34 = bitcast i8* %33 to i64*
  %35 = load i64, i64* %34, align 8
  %36 = load i8*, i8** %many.addr, align 8
  %37 = call i64 @nish_str_index_of(i8* %36, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %38 = trunc i64 %37 to i32
  %39 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %38, i32 1)
  %40 = extractvalue { i32, i1 } %39, 0
  %41 = extractvalue { i32, i1 } %39, 1
  br i1 %41, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %42 = sext i32 %40 to i64
  %43 = call i64 @llvm.smin.i64(i64 %42, i64 %35)
  %44 = call i64 @llvm.smax.i64(i64 %43, i64 0)
  %45 = load i8*, i8** %many.addr, align 8
  %46 = bitcast i8* %45 to i64*
  %47 = load i64, i64* %46, align 8
  %48 = trunc i64 %47 to i32
  %49 = sext i32 %48 to i64
  %50 = call i64 @llvm.smin.i64(i64 %49, i64 %35)
  %51 = call i64 @llvm.smax.i64(i64 %50, i64 0)
  %52 = call i64 @llvm.smin.i64(i64 %44, i64 %51)
  %53 = call i64 @llvm.smax.i64(i64 %44, i64 %51)
  %54 = sub i64 %53, %52
  %55 = getelementptr inbounds i8, i8* %33, i64 8
  %56 = getelementptr inbounds i8, i8* %55, i64 %52
  %57 = call i8* @nish_str_new(i8* %56, i64 %54)
  store i8* %57, i8** %g2.addr, align 8
  %58 = load i8*, i8** %g1.addr, align 8
  %59 = load i8*, i8** %g2.addr, align 8
  %60 = call zeroext i1 @nish_str_eq(i8* %58, i8* %59)
  br i1 %60, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %61 = phi i8* [ bitcast ({ i64, [5 x i8] }* @.str.5 to i8*), %cond.true ], [ bitcast ({ i64, [6 x i8] }* @.str.6 to i8*), %cond.false ]
  call void @nish_print(i8* %61)
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

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind willreturn memory(argmem: read) }
attributes #4 = { noreturn nounwind }
attributes #5 = { nounwind noreturn cold }
attributes #6 = { nounwind willreturn readnone }
attributes #7 = { alwaysinline nounwind willreturn allocsize(0) }

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

%struct.Log = type { i8* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"<\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c">\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c".\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"-\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [41 x i8] } { i64 40, [41 x i8] c"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
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

define internal void @Log.constructor(%struct.Log* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Log, %struct.Log* %this, i32 0, i32 0
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %0, align 8, !tbaa !4
  ret void
}

define internal noundef nonnull align 8 i8* @firstOf(i32 noundef %n) #1 {
entry:
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %parts.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, %n
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = call i8* @nish_str_from_i32(i32 %6)
  %8 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* %7)
  %9 = call i8* @nish_str_concat(i8* %8, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %13 = load i64, i64* %12, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %14 = icmp eq i64 %11, %13
  br i1 %14, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 8)
  br label %push.store

push.store:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %17 = bitcast i8* %16 to i8**
  %18 = getelementptr inbounds i8*, i8** %17, i64 %11
  store i8* %9, i8** %18, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %19 = add i64 %11, 1
  store i64 %19, i64* %10, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %20 = trunc i64 %19 to i32
  br label %for.inc

for.inc:
  %21 = load i32, i32* %i.addr, align 4
  %22 = add nsw i32 %21, 1
  store i32 %22, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %23 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %26 = icmp ult i64 0, %25
  br i1 %26, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %25)
  unreachable

bounds.ok:
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %29 = bitcast i8* %28 to i8**
  %30 = getelementptr inbounds i8*, i8** %29, i64 0
  %31 = load i8*, i8** %30, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  ret i8* %31
}

define internal noundef nonnull align 8 i8* @noteFirst(%struct.Log* noundef nonnull align 8 dereferenceable(8) nocapture %log, i32 noundef %n) #1 {
entry:
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %parts.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, %n
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %6 = call i8* @nish_str_from_i32(i32 %n)
  %7 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* %6)
  %8 = call i8* @nish_str_concat(i8* %7, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %9 = load i32, i32* %i.addr, align 4
  %10 = call i8* @nish_str_from_i32(i32 %9)
  %11 = call i8* @nish_str_concat(i8* %8, i8* %10)
  %12 = call i8* @nish_str_concat(i8* %11, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %16 = load i64, i64* %15, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %17 = icmp eq i64 %14, %16
  br i1 %17, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 8)
  br label %push.store

push.store:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %20 = bitcast i8* %19 to i8**
  %21 = getelementptr inbounds i8*, i8** %20, i64 %14
  store i8* %12, i8** %21, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %22 = add i64 %14, 1
  store i64 %22, i64* %13, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %23 = trunc i64 %22 to i32
  br label %for.inc

for.inc:
  %24 = load i32, i32* %i.addr, align 4
  %25 = add nsw i32 %24, 1
  store i32 %25, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %26 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %29 = icmp ult i64 0, %28
  br i1 %29, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %28)
  unreachable

bounds.ok:
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %32 = bitcast i8* %31 to i8**
  %33 = getelementptr inbounds i8*, i8** %32, i64 0
  %34 = load i8*, i8** %33, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %35 = getelementptr inbounds %struct.Log, %struct.Log* %log, i32 0, i32 0
  store i8* %34, i8** %35, align 8, !tbaa !4
  %36 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %39 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*) to i64*
  %40 = load i64, i64* %39, align 8
  %41 = sub i64 %38, 1
  %42 = mul i64 %40, %41
  %43 = icmp eq i64 %38, 0
  %44 = select i1 %43, i64 0, i64 %42
  store i64 %44, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %45 = load i64, i64* %join.at, align 8
  %46 = icmp ult i64 %45, %38
  br i1 %46, label %join.sum.body, label %join.copy

join.sum.body:
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 2
  %48 = load i8*, i8** %47, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %49 = bitcast i8* %48 to i8**
  %50 = getelementptr inbounds i8*, i8** %49, i64 %45
  %51 = load i8*, i8** %50, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %52 = load i64, i64* %join.total, align 8
  %53 = bitcast i8* %51 to i64*
  %54 = load i64, i64* %53, align 8
  %55 = add i64 %52, %54
  store i64 %55, i64* %join.total, align 8
  %56 = add i64 %45, 1
  store i64 %56, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %57 = load i64, i64* %join.total, align 8
  %58 = icmp ugt i64 %57, 2147483647
  %59 = add i64 %57, 9
  %60 = select i1 %58, i64 4611686018427387904, i64 %59
  %61 = call i8* @nish_alloc_struct(i64 %60)
  %62 = bitcast i8* %61 to i64*
  store i64 %57, i64* %62, align 8
  %63 = getelementptr inbounds i8, i8* %61, i64 8
  store i8* %63, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %64 = load i64, i64* %join.at, align 8
  %65 = icmp ult i64 %64, %38
  br i1 %65, label %join.part, label %join.end

join.part:
  %66 = load i8*, i8** %join.p, align 8
  %67 = icmp eq i64 %64, 0
  %68 = select i1 %67, i64 0, i64 %40
  %69 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %66, i8* %69, i64 %68, i1 false)
  %70 = getelementptr inbounds i8, i8* %66, i64 %68
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 2
  %72 = load i8*, i8** %71, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %73 = bitcast i8* %72 to i8**
  %74 = getelementptr inbounds i8*, i8** %73, i64 %64
  %75 = load i8*, i8** %74, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %76 = bitcast i8* %75 to i64*
  %77 = load i64, i64* %76, align 8
  %78 = getelementptr inbounds i8, i8* %75, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %70, i8* %78, i64 %77, i1 false)
  %79 = getelementptr inbounds i8, i8* %70, i64 %77
  store i8* %79, i8** %join.p, align 8
  %80 = add i64 %64, 1
  store i64 %80, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %81 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %81, align 1
  ret i8* %61
}

define internal noundef nonnull align 8 i8* @run(%struct.Log* noundef nonnull align 8 dereferenceable(8) nocapture %log, i32 noundef %calls) #1 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %calls
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %total.addr, align 4
  %3 = load i32, i32* %i.addr, align 4
  %4 = srem i32 %3, 9
  %5 = add nsw i32 1, %4
  %6 = call i8* @firstOf(i32 %5)
  %7 = bitcast i8* %6 to i64*
  %8 = load i64, i64* %7, align 8
  %9 = trunc i64 %8 to i32
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %9)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  %13 = load i32, i32* %i.addr, align 4
  %14 = srem i32 %13, 9
  %15 = add nsw i32 1, %14
  %16 = call i8* @noteFirst(%struct.Log* %log, i32 %15)
  %17 = bitcast i8* %16 to i64*
  %18 = load i64, i64* %17, align 8
  %19 = trunc i64 %18 to i32
  %20 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %11, i32 %19)
  %21 = extractvalue { i32, i1 } %20, 0
  %22 = extractvalue { i32, i1 } %20, 1
  br i1 %22, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %21, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %23 = load i32, i32* %i.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %25 = load i32, i32* %total.addr, align 4
  %26 = call i8* @nish_str_from_i32(i32 %25)
  ret i8* %26

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @churn() #1 {
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
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [41 x i8] }* @.str.5 to i8*), i8* %8)
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

define void @nish_main() #1 {
entry:
  %log.addr = alloca %struct.Log*, align 8
  %Log.obj = alloca %struct.Log, align 8
  %total.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Log.constructor(%struct.Log* %Log.obj)
  store %struct.Log* %Log.obj, %struct.Log** %log.addr, align 8
  %0 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %1 = call i8* @run(%struct.Log* %0, i32 1000)
  store i8* %1, i8** %total.addr, align 8
  %2 = call i32 @churn()
  %3 = call i8* @nish_str_from_i32(i32 %2)
  call void @nish_print(i8* %3)
  %4 = load i8*, i8** %total.addr, align 8
  call void @nish_print(i8* %4)
  %5 = load %struct.Log*, %struct.Log** %log.addr, align 8
  %6 = getelementptr inbounds %struct.Log, %struct.Log* %5, i32 0, i32 0
  %7 = load i8*, i8** %6, align 8, !tbaa !4
  call void @nish_print(i8* %7)
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
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Log", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"header i64", !1, i64 0}
!11 = !{!"header ptr", !1, i64 0}
!12 = !{!"array header", !10, i64 0, !10, i64 8, !11, i64 16}
!13 = !{!12, !10, i64 0}
!14 = !{!12, !10, i64 8}
!15 = !{!12, !11, i64 16}
!16 = !{!"element ptr", !1, i64 0}
!17 = !{!16, !16, i64 0}

%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"#\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"<\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c">\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"-\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"flat\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"grows\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
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
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare i64 @llvm.smin.i64(i64, i64) #5
declare i64 @llvm.smax.i64(i64, i64) #5
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5
declare { i64, i1 } @llvm.ssub.with.overflow.i64(i64, i64) #5

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

define internal noundef nonnull align 8 i8* @tag(i32 noundef %i) #0 {
entry:
  %0 = call i8* @nish_str_from_i32(i32 %i)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8* %0)
  ret i8* %1
}

define internal noundef nonnull align 8 i8* @spell(i32 noundef %n) #0 {
entry:
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
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
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %14 = icmp eq i64 %11, %13
  br i1 %14, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 8)
  br label %push.store

push.store:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %17 = bitcast i8* %16 to i8**
  %18 = getelementptr inbounds i8*, i8** %17, i64 %11
  store i8* %9, i8** %18, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %19 = add i64 %11, 1
  store i64 %19, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = trunc i64 %19 to i32
  %21 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %22 = load i32, i32* %i.addr, align 4
  %23 = call i64 @nish_arena_mark()
  %24 = call i8* @tag(i32 %22)
  %25 = call i8* @nish_arena_keep(i64 %23, i8* %24)
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  %29 = load i64, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %30 = icmp eq i64 %27, %29
  br i1 %30, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %21, i64 8)
  br label %push.store.1

push.store.1:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %33 = bitcast i8* %32 to i8**
  %34 = getelementptr inbounds i8*, i8** %33, i64 %27
  store i8* %25, i8** %34, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %35 = add i64 %27, 1
  store i64 %35, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = trunc i64 %35 to i32
  br label %for.inc

for.inc:
  %37 = load i32, i32* %i.addr, align 4
  %38 = add nsw i32 %37, 1
  store i32 %38, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %39 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 0
  %41 = load i64, i64* %40, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %42 = trunc i64 %41 to i32
  %43 = icmp eq i32 %42, 0
  br i1 %43, label %if.then, label %if.end

if.then:
  ret i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*)

if.end:
  %44 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  %46 = load i64, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*) to i64*
  %48 = load i64, i64* %47, align 8
  %49 = sub i64 %46, 1
  %50 = mul i64 %48, %49
  %51 = icmp eq i64 %46, 0
  %52 = select i1 %51, i64 0, i64 %50
  store i64 %52, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %53 = load i64, i64* %join.at, align 8
  %54 = icmp ult i64 %53, %46
  br i1 %54, label %join.sum.body, label %join.copy

join.sum.body:
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 2
  %56 = load i8*, i8** %55, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %57 = bitcast i8* %56 to i8**
  %58 = getelementptr inbounds i8*, i8** %57, i64 %53
  %59 = load i8*, i8** %58, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %60 = load i64, i64* %join.total, align 8
  %61 = bitcast i8* %59 to i64*
  %62 = load i64, i64* %61, align 8
  %63 = add i64 %60, %62
  store i64 %63, i64* %join.total, align 8
  %64 = add i64 %53, 1
  store i64 %64, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %65 = load i64, i64* %join.total, align 8
  %66 = icmp ugt i64 %65, 2147483647
  %67 = add i64 %65, 9
  %68 = select i1 %66, i64 4611686018427387904, i64 %67
  %69 = call i8* @nish_alloc_struct(i64 %68)
  %70 = bitcast i8* %69 to i64*
  store i64 %65, i64* %70, align 8
  %71 = getelementptr inbounds i8, i8* %69, i64 8
  store i8* %71, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %72 = load i64, i64* %join.at, align 8
  %73 = icmp ult i64 %72, %46
  br i1 %73, label %join.part, label %join.end

join.part:
  %74 = load i8*, i8** %join.p, align 8
  %75 = icmp eq i64 %72, 0
  %76 = select i1 %75, i64 0, i64 %48
  %77 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %74, i8* %77, i64 %76, i1 false)
  %78 = getelementptr inbounds i8, i8* %74, i64 %76
  %79 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 2
  %80 = load i8*, i8** %79, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %81 = bitcast i8* %80 to i8**
  %82 = getelementptr inbounds i8*, i8** %81, i64 %72
  %83 = load i8*, i8** %82, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %84 = bitcast i8* %83 to i64*
  %85 = load i64, i64* %84, align 8
  %86 = getelementptr inbounds i8, i8* %83, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %78, i8* %86, i64 %85, i1 false)
  %87 = getelementptr inbounds i8, i8* %78, i64 %85
  store i8* %87, i8** %join.p, align 8
  %88 = add i64 %72, 1
  store i64 %88, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %89 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %89, align 1
  ret i8* %69
}

define internal noundef nonnull align 8 i8* @run(i32 noundef %calls) #0 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %s.addr = alloca i8*, align 8
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
  %7 = srem i32 %6, 9
  %8 = add nsw i32 1, %7
  %9 = call i64 @nish_arena_mark()
  %10 = call i8* @spell(i32 %8)
  %11 = call i8* @nish_arena_keep(i64 %9, i8* %10)
  store i8* %11, i8** %s.addr, align 8
  %12 = load i32, i32* %total.addr, align 4
  %13 = load i8*, i8** %s.addr, align 8
  %14 = bitcast i8* %13 to i64*
  %15 = load i64, i64* %14, align 8
  %16 = trunc i64 %15 to i32
  %17 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %12, i32 %16)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %18, i32* %total.addr, align 4
  %20 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %21 = load i8*, i8** %20, align 8
  %22 = icmp eq i8* %21, %3
  br i1 %22, label %pass.rewind, label %pass.free

pass.rewind:
  %23 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %23, align 8
  br label %pass.done

pass.free:
  %24 = ptrtoint i8* %3 to i64
  %25 = add i64 %24, %5
  call void @nish_arena_release(i64 %25)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %26 = load i32, i32* %i.addr, align 4
  %27 = add nsw i32 %26, 1
  store i32 %27, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %28 = load i32, i32* %total.addr, align 4
  %29 = call i8* @nish_str_from_i32(i32 %28)
  ret i8* %29

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
  %10 = call i8* @nish_str_concat(i8* %9, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
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
  %12 = call i64 @nish_str_index_of(i8* %11, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
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
  %37 = call i64 @nish_str_index_of(i8* %36, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
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
  %61 = phi i8* [ bitcast ({ i64, [5 x i8] }* @.str.6 to i8*), %cond.true ], [ bitcast ({ i64, [6 x i8] }* @.str.7 to i8*), %cond.false ]
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
attributes #4 = { nounwind noreturn cold }
attributes #5 = { nounwind willreturn readnone }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

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

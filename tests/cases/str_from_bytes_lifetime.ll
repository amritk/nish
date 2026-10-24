%struct.Holder = type { i8* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [41 x i8] } { i64 40, [41 x i8] c"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c",\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #2
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #3
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

define internal noundef nonnull align 8 i8* @word(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %i) #0 {
entry:
  %0 = srem i32 %i, 3
  %1 = sext i32 %0 to i64
  %2 = srem i32 %i, 3
  %3 = add nsw i32 3, %2
  %4 = sext i32 %3 to i64
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = icmp ule i64 %1, %4
  %8 = icmp ule i64 %4, %6
  %9 = and i1 %7, %8
  br i1 %9, label %bytes.ok, label %bytes.fail

bytes.fail:
  call void @nish_panic_slice(i64 %1, i64 %4, i64 %6)
  unreachable

bytes.ok:
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %12 = getelementptr inbounds i8, i8* %11, i64 %1
  %13 = sub i64 %4, %1
  %14 = call i8* @nish_str_new(i8* %12, i64 %13)
  ret i8* %14
}

define internal noundef nonnull align 8 i8* @twice(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %i) #0 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @word(%struct.nish_array* %bytes, i32 %i)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  ret i8* %2
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
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [41 x i8] }* @.str.0 to i8*), i8* %8)
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

define noundef i32 @nish_main() #0 {
entry:
  %bytes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [6 x i8], align 8
  %kept.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %last.addr = alloca i8*, align 8
  %h.addr = alloca %struct.Holder*, align 8
  %Holder.obj = alloca %struct.Holder, align 8
  %i.addr = alloca i32, align 4
  %t.addr = alloca i32, align 4
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 6, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 6, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %2 = bitcast [6 x i8]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = bitcast i8* %2 to i8*
  %5 = getelementptr inbounds i8, i8* %4, i64 0
  store i8 97, i8* %5, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i8, i8* %4, i64 1
  store i8 98, i8* %6, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i8, i8* %4, i64 2
  store i8 99, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i8, i8* %4, i64 3
  store i8 100, i8* %8, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds i8, i8* %4, i64 4
  store i8 101, i8* %9, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = getelementptr inbounds i8, i8* %4, i64 5
  store i8 102, i8* %10, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %bytes.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 0, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 0, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* null, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %kept.addr, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*), i8** %last.addr, align 8
  %14 = getelementptr inbounds %struct.Holder, %struct.Holder* %Holder.obj, i32 0, i32 0
  store i8* bitcast ({ i64, [1 x i8] }* @.str.1 to i8*), i8** %14, align 8, !tbaa !17
  store %struct.Holder* %Holder.obj, %struct.Holder** %h.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %15 = load i32, i32* %i.addr, align 4
  %16 = icmp slt i32 %15, 5
  br i1 %16, label %for.body, label %for.end

for.body:
  %17 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %18 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %19 = load i32, i32* %i.addr, align 4
  %20 = srem i32 %19, 4
  %21 = sext i32 %20 to i64
  %22 = load i32, i32* %i.addr, align 4
  %23 = srem i32 %22, 4
  %24 = add nsw i32 2, %23
  %25 = sext i32 %24 to i64
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %28 = icmp ule i64 %21, %25
  %29 = icmp ule i64 %25, %27
  %30 = and i1 %28, %29
  br i1 %30, label %bytes.ok, label %bytes.fail

bytes.fail:
  call void @nish_panic_slice(i64 %21, i64 %25, i64 %27)
  unreachable

bytes.ok:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %33 = getelementptr inbounds i8, i8* %32, i64 %21
  %34 = sub i64 %25, %21
  %35 = call i8* @nish_str_new(i8* %33, i64 %34)
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 1
  %39 = load i64, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %40 = icmp eq i64 %37, %39
  br i1 %40, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %17, i64 8)
  br label %push.store

push.store:
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %43 = bitcast i8* %42 to i8**
  %44 = getelementptr inbounds i8*, i8** %43, i64 %37
  store i8* %35, i8** %44, align 8, !alias.scope !4, !noalias !3, !tbaa !19
  %45 = add i64 %37, 1
  store i64 %45, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %46 = trunc i64 %45 to i32
  %47 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %48 = load i32, i32* %i.addr, align 4
  %49 = call i64 @nish_arena_mark()
  %50 = call i8* @word(%struct.nish_array* %47, i32 %48)
  %51 = call i8* @nish_arena_keep(i64 %49, i8* %50)
  store i8* %51, i8** %last.addr, align 8
  %52 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %53 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %54 = load i32, i32* %i.addr, align 4
  %55 = add nsw i32 %54, 1
  %56 = call i64 @nish_arena_mark()
  %57 = call i8* @twice(%struct.nish_array* %53, i32 %55)
  %58 = call i8* @nish_arena_keep(i64 %56, i8* %57)
  %59 = getelementptr inbounds %struct.Holder, %struct.Holder* %52, i32 0, i32 0
  store i8* %58, i8** %59, align 8, !tbaa !17
  br label %for.inc

for.inc:
  %60 = load i32, i32* %i.addr, align 4
  %61 = add nsw i32 %60, 1
  store i32 %61, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %62 = call i32 @churn()
  store i32 %62, i32* %t.addr, align 4
  %63 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 0
  %65 = load i64, i64* %64, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %66 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*) to i64*
  %67 = load i64, i64* %66, align 8
  %68 = sub i64 %65, 1
  %69 = mul i64 %67, %68
  %70 = icmp eq i64 %65, 0
  %71 = select i1 %70, i64 0, i64 %69
  store i64 %71, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %72 = load i64, i64* %join.at, align 8
  %73 = icmp ult i64 %72, %65
  br i1 %73, label %join.sum.body, label %join.copy

join.sum.body:
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 2
  %75 = load i8*, i8** %74, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %76 = bitcast i8* %75 to i8**
  %77 = getelementptr inbounds i8*, i8** %76, i64 %72
  %78 = load i8*, i8** %77, align 8, !alias.scope !4, !noalias !3, !tbaa !19
  %79 = load i64, i64* %join.total, align 8
  %80 = bitcast i8* %78 to i64*
  %81 = load i64, i64* %80, align 8
  %82 = add i64 %79, %81
  store i64 %82, i64* %join.total, align 8
  %83 = add i64 %72, 1
  store i64 %83, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %84 = load i64, i64* %join.total, align 8
  %85 = icmp ugt i64 %84, 2147483647
  %86 = add i64 %84, 9
  %87 = select i1 %85, i64 4611686018427387904, i64 %86
  %88 = call i8* @nish_alloc_struct(i64 %87)
  %89 = bitcast i8* %88 to i64*
  store i64 %84, i64* %89, align 8
  %90 = getelementptr inbounds i8, i8* %88, i64 8
  store i8* %90, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %91 = load i64, i64* %join.at, align 8
  %92 = icmp ult i64 %91, %65
  br i1 %92, label %join.part, label %join.end

join.part:
  %93 = load i8*, i8** %join.p, align 8
  %94 = icmp eq i64 %91, 0
  %95 = select i1 %94, i64 0, i64 %67
  %96 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %93, i8* %96, i64 %95, i1 false)
  %97 = getelementptr inbounds i8, i8* %93, i64 %95
  %98 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 2
  %99 = load i8*, i8** %98, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %100 = bitcast i8* %99 to i8**
  %101 = getelementptr inbounds i8*, i8** %100, i64 %91
  %102 = load i8*, i8** %101, align 8, !alias.scope !4, !noalias !3, !tbaa !19
  %103 = bitcast i8* %102 to i64*
  %104 = load i64, i64* %103, align 8
  %105 = getelementptr inbounds i8, i8* %102, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %97, i8* %105, i64 %104, i1 false)
  %106 = getelementptr inbounds i8, i8* %97, i64 %104
  store i8* %106, i8** %join.p, align 8
  %107 = add i64 %91, 1
  store i64 %107, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %108 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %108, align 1
  %109 = call i8* @nish_str_concat(i8* %88, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %110 = load i8*, i8** %last.addr, align 8
  %111 = call i8* @nish_str_concat(i8* %109, i8* %110)
  %112 = call i8* @nish_str_concat(i8* %111, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %113 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %114 = getelementptr inbounds %struct.Holder, %struct.Holder* %113, i32 0, i32 0
  %115 = load i8*, i8** %114, align 8, !tbaa !17
  %116 = call i8* @nish_str_concat(i8* %112, i8* %115)
  %117 = call i8* @nish_str_concat(i8* %116, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %118 = load i32, i32* %t.addr, align 4
  %119 = icmp sgt i32 %118, 0
  %120 = select i1 %119, i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*)
  %121 = call i8* @nish_str_concat(i8* %117, i8* %120)
  call void @nish_print(i8* %121)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!20, !21, !22, !23, !24}
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
!12 = !{!9, !7, i64 8}
!13 = !{!"element i8", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"ptr", !6, i64 0}
!16 = !{!"Holder", !15, i64 0}
!17 = !{!16, !15, i64 0}
!18 = !{!"element ptr", !6, i64 0}
!19 = !{!18, !18, i64 0}
!20 = !{i32 8, !"cf-protection-branch", i32 1}
!21 = !{i32 8, !"cf-protection-return", i32 1}
!22 = !{i32 8, !"branch-target-enforcement", i32 1}
!23 = !{i32 8, !"sign-return-address", i32 1}
!24 = !{i32 4, !"probe-stack", !"inline-asm"}

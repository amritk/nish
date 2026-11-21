%struct.Cell = type { i32, i32 }
%struct.Rec = type { i32, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c": \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8
@nish_arena_range_abi = external constant i32, align 4

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

define internal noalias noundef nonnull align 4 i8* @nish_alloc_ref(i64 noundef %size) #5 {
entry:
  %size.p3 = add i64 %size, 3
  %size.aligned = and i64 %size.p3, -4
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
  %abi = load volatile i32, i32* @nish_arena_range_abi, align 4
  %grown = call i8* @nish_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define internal void @Cell.constructor(%struct.Cell* noundef nonnull noalias align 4 dereferenceable(8) nocapture %this, i32 noundef %value, %struct.Cell* noundef align 4 %next) #0 {
entry:
  %0 = getelementptr inbounds %struct.Cell, %struct.Cell* %this, i32 0, i32 0
  store i32 %value, i32* %0, align 4, !tbaa !5
  %1 = getelementptr inbounds %struct.Cell, %struct.Cell* %this, i32 0, i32 1
  %2 = ptrtoint %struct.Cell* %next to i64
  %3 = lshr i64 %2, 2
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %1, align 4, !tbaa !6
  ret void
}

define internal noundef i32 @sum(%struct.Cell* noundef align 4 %head) #1 {
entry:
  %total.addr = alloca i32, align 4
  %at.addr = alloca %struct.Cell*, align 8
  store i32 0, i32* %total.addr, align 4
  store %struct.Cell* %head, %struct.Cell** %at.addr, align 8
  br label %while.cond

while.cond:
  %0 = load %struct.Cell*, %struct.Cell** %at.addr, align 8
  %1 = icmp ne %struct.Cell* %0, null
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i32, i32* %total.addr, align 4
  %3 = load %struct.Cell*, %struct.Cell** %at.addr, align 8
  %4 = getelementptr inbounds %struct.Cell, %struct.Cell* %3, i32 0, i32 0
  %5 = load i32, i32* %4, align 4, !tbaa !5
  %6 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %5)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %7, i32* %total.addr, align 4
  %9 = load %struct.Cell*, %struct.Cell** %at.addr, align 8
  %10 = getelementptr inbounds %struct.Cell, %struct.Cell* %9, i32 0, i32 1
  %11 = load i32, i32* %10, align 4, !tbaa !6
  %12 = zext i32 %11 to i64
  %13 = shl nuw nsw i64 %12, 2
  %14 = inttoptr i64 %13 to %struct.Cell*
  store %struct.Cell* %14, %struct.Cell** %at.addr, align 8
  br label %while.cond

while.end:
  %15 = load i32, i32* %total.addr, align 4
  ret i32 %15

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef align 4 %struct.Cell* @build(i32 noundef %n) #1 {
entry:
  %head.addr = alloca %struct.Cell*, align 8
  %i.addr = alloca i32, align 4
  store %struct.Cell* null, %struct.Cell** %head.addr, align 8
  store i32 1, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp sle i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = call i8* @nish_alloc_ref(i64 8)
  %3 = bitcast i8* %2 to %struct.Cell*
  %4 = load i32, i32* %i.addr, align 4
  %5 = load %struct.Cell*, %struct.Cell** %head.addr, align 8
  call void @Cell.constructor(%struct.Cell* %3, i32 %4, %struct.Cell* %5)
  store %struct.Cell* %3, %struct.Cell** %head.addr, align 8
  br label %for.inc

for.inc:
  %6 = load i32, i32* %i.addr, align 4
  %7 = add nsw i32 %6, 1
  store i32 %7, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %8 = load %struct.Cell*, %struct.Cell** %head.addr, align 8
  ret %struct.Cell* %8
}

define noundef i32 @nish_main() #1 {
entry:
  %recs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %r.addr = alloca %struct.Rec*, align 8
  %Rec.obj = alloca %struct.Rec, align 8
  %r.addr.1 = alloca %struct.Rec*, align 8
  %forof.idx = alloca i64, align 8
  %first.addr = alloca %struct.Rec*, align 8
  %copy.addr = alloca %struct.Rec*, align 8
  %Rec.obj.1 = alloca %struct.Rec, align 8
  %shared.addr = alloca %struct.Cell*, align 8
  %swapped.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x %struct.Rec], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %recs.addr, align 8
  store i32 1, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp sle i32 %3, 4
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load i32, i32* %i.addr, align 4
  %6 = mul nsw i32 %5, 3
  %7 = call %struct.Cell* @build(i32 %6)
  %8 = getelementptr inbounds %struct.Rec, %struct.Rec* %Rec.obj, i32 0, i32 0
  %9 = ptrtoint %struct.Cell* %7 to i64
  %10 = lshr i64 %9, 2
  %11 = trunc i64 %10 to i32
  store i32 %11, i32* %8, align 4
  %12 = load i32, i32* %i.addr, align 4
  %13 = getelementptr inbounds %struct.Rec, %struct.Rec* %Rec.obj, i32 0, i32 1
  store i32 %12, i32* %13, align 4
  store %struct.Rec* %Rec.obj, %struct.Rec** %r.addr, align 8
  %14 = load %struct.nish_array*, %struct.nish_array** %recs.addr, align 8
  %15 = load %struct.Rec*, %struct.Rec** %r.addr, align 8
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  %19 = load i64, i64* %18, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %20 = icmp eq i64 %17, %19
  br i1 %20, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %14, i64 8)
  br label %push.store

push.store:
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %23 = bitcast i8* %22 to %struct.Rec*
  %24 = getelementptr inbounds %struct.Rec, %struct.Rec* %23, i64 %17
  %25 = bitcast %struct.Rec* %24 to i8*
  %26 = bitcast %struct.Rec* %15 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %25, i8* align 4 %26, i64 8, i1 false), !alias.scope !11, !noalias !10
  %27 = add i64 %17, 1
  store i64 %27, i64* %16, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %28 = trunc i64 %27 to i32
  br label %for.inc

for.inc:
  %29 = load i32, i32* %i.addr, align 4
  %30 = add nsw i32 %29, 1
  store i32 %30, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %31 = load %struct.nish_array*, %struct.nish_array** %recs.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %32 = load i64, i64* %forof.idx, align 8
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %35 = icmp ult i64 %32, %34
  br i1 %35, label %forof.body, label %forof.end

forof.body:
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %38 = bitcast i8* %37 to %struct.Rec*
  %39 = getelementptr inbounds %struct.Rec, %struct.Rec* %38, i64 %32
  store %struct.Rec* %39, %struct.Rec** %r.addr.1, align 8
  %40 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %41 = load i8*, i8** %40, align 8
  %42 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %43 = load i64, i64* %42, align 8
  %44 = load %struct.Rec*, %struct.Rec** %r.addr.1, align 8
  %45 = getelementptr inbounds %struct.Rec, %struct.Rec* %44, i32 0, i32 1
  %46 = load i32, i32* %45, align 4
  %47 = call i8* @nish_str_from_i32(i32 %46)
  %48 = call i8* @nish_str_concat(i8* %47, i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*))
  %49 = load %struct.Rec*, %struct.Rec** %r.addr.1, align 8
  %50 = getelementptr inbounds %struct.Rec, %struct.Rec* %49, i32 0, i32 0
  %51 = load i32, i32* %50, align 4
  %52 = zext i32 %51 to i64
  %53 = shl nuw nsw i64 %52, 2
  %54 = inttoptr i64 %53 to %struct.Cell*
  %55 = call i32 @sum(%struct.Cell* %54)
  %56 = call i8* @nish_str_from_i32(i32 %55)
  %57 = call i8* @nish_str_concat(i8* %48, i8* %56)
  call void @nish_print(i8* %57)
  %58 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %59 = load i8*, i8** %58, align 8
  %60 = icmp eq i8* %59, %41
  br i1 %60, label %pass.rewind, label %pass.free

pass.rewind:
  %61 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %43, i64* %61, align 8
  br label %pass.done

pass.free:
  %62 = ptrtoint i8* %41 to i64
  %63 = add i64 %62, %43
  call void @nish_arena_release(i64 %63)
  br label %pass.done

pass.done:
  br label %forof.inc

forof.inc:
  %64 = load i64, i64* %forof.idx, align 8
  %65 = add i64 %64, 1
  store i64 %65, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %66 = load %struct.nish_array*, %struct.nish_array** %recs.addr, align 8
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 0
  %68 = load i64, i64* %67, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %69 = icmp ult i64 0, %68
  br i1 %69, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %68)
  unreachable

bounds.ok:
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %66, i64 0, i32 2
  %71 = load i8*, i8** %70, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %72 = bitcast i8* %71 to %struct.Rec*
  %73 = getelementptr inbounds %struct.Rec, %struct.Rec* %72, i64 0
  store %struct.Rec* %73, %struct.Rec** %first.addr, align 8
  %74 = load %struct.Rec*, %struct.Rec** %first.addr, align 8
  %75 = getelementptr inbounds %struct.Rec, %struct.Rec* %74, i32 0, i32 0
  %76 = load i32, i32* %75, align 4
  %77 = zext i32 %76 to i64
  %78 = shl nuw nsw i64 %77, 2
  %79 = inttoptr i64 %78 to %struct.Cell*
  %80 = getelementptr inbounds %struct.Rec, %struct.Rec* %Rec.obj.1, i32 0, i32 0
  %81 = ptrtoint %struct.Cell* %79 to i64
  %82 = lshr i64 %81, 2
  %83 = trunc i64 %82 to i32
  store i32 %83, i32* %80, align 4
  %84 = getelementptr inbounds %struct.Rec, %struct.Rec* %Rec.obj.1, i32 0, i32 1
  store i32 9, i32* %84, align 4
  store %struct.Rec* %Rec.obj.1, %struct.Rec** %copy.addr, align 8
  %85 = load %struct.Rec*, %struct.Rec** %copy.addr, align 8
  %86 = getelementptr inbounds %struct.Rec, %struct.Rec* %85, i32 0, i32 1
  %87 = load i32, i32* %86, align 4
  %88 = call i8* @nish_str_from_i32(i32 %87)
  %89 = call i8* @nish_str_concat(i8* %88, i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*))
  %90 = load %struct.Rec*, %struct.Rec** %copy.addr, align 8
  %91 = getelementptr inbounds %struct.Rec, %struct.Rec* %90, i32 0, i32 0
  %92 = load i32, i32* %91, align 4
  %93 = zext i32 %92 to i64
  %94 = shl nuw nsw i64 %93, 2
  %95 = inttoptr i64 %94 to %struct.Cell*
  %96 = call i32 @sum(%struct.Cell* %95)
  %97 = call i8* @nish_str_from_i32(i32 %96)
  %98 = call i8* @nish_str_concat(i8* %89, i8* %97)
  call void @nish_print(i8* %98)
  %99 = load %struct.Rec*, %struct.Rec** %first.addr, align 8
  %100 = getelementptr inbounds %struct.Rec, %struct.Rec* %99, i32 0, i32 0
  %101 = load i32, i32* %100, align 4
  %102 = zext i32 %101 to i64
  %103 = shl nuw nsw i64 %102, 2
  %104 = inttoptr i64 %103 to %struct.Cell*
  store %struct.Cell* %104, %struct.Cell** %shared.addr, align 8
  %105 = load %struct.Cell*, %struct.Cell** %shared.addr, align 8
  %106 = icmp ne %struct.Cell* %105, null
  br i1 %106, label %if.then, label %if.end

if.then:
  %107 = load %struct.Cell*, %struct.Cell** %shared.addr, align 8
  %108 = getelementptr inbounds %struct.Cell, %struct.Cell* %107, i32 0, i32 0
  store i32 100, i32* %108, align 4, !tbaa !5
  %109 = load %struct.Rec*, %struct.Rec** %copy.addr, align 8
  %110 = getelementptr inbounds %struct.Rec, %struct.Rec* %109, i32 0, i32 0
  %111 = load i32, i32* %110, align 4
  %112 = zext i32 %111 to i64
  %113 = shl nuw nsw i64 %112, 2
  %114 = inttoptr i64 %113 to %struct.Cell*
  %115 = call i32 @sum(%struct.Cell* %114)
  %116 = call i8* @nish_str_from_i32(i32 %115)
  call void @nish_print(i8* %116)
  br label %if.end

if.end:
  %117 = load %struct.nish_array*, %struct.nish_array** %recs.addr, align 8
  %118 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %117, i64 0, i32 0
  %119 = load i64, i64* %118, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %120 = icmp ult i64 3, %119
  br i1 %120, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 3, i64 %119)
  unreachable

bounds.ok.1:
  %121 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %117, i64 0, i32 2
  %122 = load i8*, i8** %121, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %123 = bitcast i8* %122 to %struct.Rec*
  %124 = getelementptr inbounds %struct.Rec, %struct.Rec* %123, i64 3
  %125 = load %struct.nish_array*, %struct.nish_array** %recs.addr, align 8
  %126 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %125, i64 0, i32 2
  %127 = load i8*, i8** %126, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %128 = bitcast i8* %127 to %struct.Rec*
  %129 = getelementptr inbounds %struct.Rec, %struct.Rec* %128, i64 1
  %130 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %130, align 8, !alias.scope !10, !noalias !11, !tbaa !15
  %131 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %131, align 8, !alias.scope !10, !noalias !11, !tbaa !16
  %132 = bitcast [2 x %struct.Rec]* %arr.data to i8*
  %133 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %132, i8** %133, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %134 = bitcast i8* %132 to %struct.Rec*
  %135 = getelementptr inbounds %struct.Rec, %struct.Rec* %134, i64 0
  %136 = bitcast %struct.Rec* %135 to i8*
  %137 = bitcast %struct.Rec* %124 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %136, i8* align 4 %137, i64 8, i1 false), !alias.scope !11, !noalias !10
  %138 = getelementptr inbounds %struct.Rec, %struct.Rec* %134, i64 1
  %139 = bitcast %struct.Rec* %138 to i8*
  %140 = bitcast %struct.Rec* %129 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 4 %139, i8* align 4 %140, i64 8, i1 false), !alias.scope !11, !noalias !10
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %swapped.addr, align 8
  %141 = load %struct.nish_array*, %struct.nish_array** %swapped.addr, align 8
  %142 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %141, i64 0, i32 2
  %143 = load i8*, i8** %142, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %144 = bitcast i8* %143 to %struct.Rec*
  %145 = getelementptr inbounds %struct.Rec, %struct.Rec* %144, i64 0
  %146 = getelementptr inbounds %struct.Rec, %struct.Rec* %145, i32 0, i32 0
  %147 = load i32, i32* %146, align 4
  %148 = zext i32 %147 to i64
  %149 = shl nuw nsw i64 %148, 2
  %150 = inttoptr i64 %149 to %struct.Cell*
  %151 = call i32 @sum(%struct.Cell* %150)
  %152 = call i8* @nish_str_from_i32(i32 %151)
  %153 = call i8* @nish_str_concat(i8* %152, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %154 = load %struct.nish_array*, %struct.nish_array** %swapped.addr, align 8
  %155 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %154, i64 0, i32 2
  %156 = load i8*, i8** %155, align 8, !alias.scope !10, !noalias !11, !tbaa !17
  %157 = bitcast i8* %156 to %struct.Rec*
  %158 = getelementptr inbounds %struct.Rec, %struct.Rec* %157, i64 1
  %159 = getelementptr inbounds %struct.Rec, %struct.Rec* %158, i32 0, i32 0
  %160 = load i32, i32* %159, align 4
  %161 = zext i32 %160 to i64
  %162 = shl nuw nsw i64 %161, 2
  %163 = inttoptr i64 %162 to %struct.Cell*
  %164 = call i32 @sum(%struct.Cell* %163)
  %165 = call i8* @nish_str_from_i32(i32 %164)
  %166 = call i8* @nish_str_concat(i8* %153, i8* %165)
  call void @nish_print(i8* %166)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!18, !19, !20, !21, !22}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ref32", !1, i64 0}
!4 = !{!"Cell", !2, i64 0, !3, i64 4}
!5 = !{!4, !2, i64 0}
!6 = !{!4, !3, i64 4}
!7 = !{!"nish array"}
!8 = !{!"header", !7}
!9 = !{!"elements", !7}
!10 = !{!8}
!11 = !{!9}
!12 = !{!"header i64", !1, i64 0}
!13 = !{!"header ptr", !1, i64 0}
!14 = !{!"array header", !12, i64 0, !12, i64 8, !13, i64 16}
!15 = !{!14, !12, i64 0}
!16 = !{!14, !12, i64 8}
!17 = !{!14, !13, i64 16}
!18 = !{i32 8, !"cf-protection-branch", i32 1}
!19 = !{i32 8, !"cf-protection-return", i32 1}
!20 = !{i32 8, !"branch-target-enforcement", i32 1}
!21 = !{i32 8, !"sign-return-address", i32 1}
!22 = !{i32 4, !"probe-stack", !"inline-asm"}

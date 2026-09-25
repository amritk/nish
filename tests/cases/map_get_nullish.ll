%struct.Map$str$f64 = type { double, %struct.nish_array*, i32, i32, %struct.nish_array*, %struct.nish_array*, %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"the\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"cat\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"sat\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"on\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"mat\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"and\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"ran\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"dog \00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"dog\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [28 x i8] } { i64 27, [28 x i8] c"Map: no entry at this index\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"Map maximum size exceeded\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"collections: a probe ran out of buckets\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare zeroext i1 @nish_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #4
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare void @nish_exit(i32 noundef) #5
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #6
declare i32 @llvm.fptosi.sat.i32.f64(double) #1
declare i64 @llvm.fptosi.sat.i64.f64(double) #1

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

define noundef i32 @nish_main() #0 {
entry:
  %words.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [10 x i8*], align 8
  %counts.addr = alloca %struct.Map$str$f64*, align 8
  %order.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %w.addr = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  %w.addr.1 = alloca i8*, align 8
  %forof.idx.1 = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 10, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 10, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [10 x i8*]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i8**
  %5 = getelementptr inbounds i8*, i8** %4, i64 0
  store i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*), i8** %5, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i8*, i8** %4, i64 1
  store i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*), i8** %6, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %7 = getelementptr inbounds i8*, i8** %4, i64 2
  store i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*), i8** %7, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i8*, i8** %4, i64 3
  store i8* bitcast ({ i64, [3 x i8] }* @.str.3 to i8*), i8** %8, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds i8*, i8** %4, i64 4
  store i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*), i8** %9, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = getelementptr inbounds i8*, i8** %4, i64 5
  store i8* bitcast ({ i64, [4 x i8] }* @.str.4 to i8*), i8** %10, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %11 = getelementptr inbounds i8*, i8** %4, i64 6
  store i8* bitcast ({ i64, [4 x i8] }* @.str.5 to i8*), i8** %11, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %12 = getelementptr inbounds i8*, i8** %4, i64 7
  store i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*), i8** %12, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %13 = getelementptr inbounds i8*, i8** %4, i64 8
  store i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*), i8** %13, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %14 = getelementptr inbounds i8*, i8** %4, i64 9
  store i8* bitcast ({ i64, [4 x i8] }* @.str.6 to i8*), i8** %14, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %words.addr, align 8
  %15 = call i8* @nish_alloc_struct(i64 48)
  %16 = bitcast i8* %15 to %struct.Map$str$f64*
  call void @nish.Map$str$f64.constructor(%struct.Map$str$f64* %16)
  store %struct.Map$str$f64* %16, %struct.Map$str$f64** %counts.addr, align 8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 0, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 0, i64* %18, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* null, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %order.addr, align 8
  %20 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %21 = load i64, i64* %forof.idx, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %24 = icmp ult i64 %21, %23
  br i1 %24, label %forof.body, label %forof.end

forof.body:
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %27 = bitcast i8* %26 to i8**
  %28 = getelementptr inbounds i8*, i8** %27, i64 %21
  %29 = load i8*, i8** %28, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i8* %29, i8** %w.addr, align 8
  %30 = load %struct.Map$str$f64*, %struct.Map$str$f64** %counts.addr, align 8
  %31 = load i8*, i8** %w.addr, align 8
  %32 = call i1 @nish.Map$str$f64.has(%struct.Map$str$f64* %30, i8* %31)
  %33 = xor i1 %32, true
  br i1 %33, label %if.then, label %if.end

if.then:
  %34 = load %struct.nish_array*, %struct.nish_array** %order.addr, align 8
  %35 = load i8*, i8** %w.addr, align 8
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 0
  %37 = load i64, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 1
  %39 = load i64, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %40 = icmp eq i64 %37, %39
  br i1 %40, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %34, i64 8)
  br label %push.store

push.store:
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %34, i64 0, i32 2
  %42 = load i8*, i8** %41, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %43 = bitcast i8* %42 to i8**
  %44 = getelementptr inbounds i8*, i8** %43, i64 %37
  store i8* %35, i8** %44, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %45 = add i64 %37, 1
  store i64 %45, i64* %36, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %46 = sitofp i64 %45 to double
  br label %if.end

if.end:
  %47 = load %struct.Map$str$f64*, %struct.Map$str$f64** %counts.addr, align 8
  %48 = load i8*, i8** %w.addr, align 8
  %49 = load %struct.Map$str$f64*, %struct.Map$str$f64** %counts.addr, align 8
  %50 = load i8*, i8** %w.addr, align 8
  %51 = call i64 @nish.Map$str$f64.probe(%struct.Map$str$f64* %49, i8* %50)
  %52 = icmp sge i64 %51, 0
  br i1 %52, label %nullish.value, label %nullish.default

nullish.value:
  %53 = trunc i64 %51 to i32
  %54 = call double @nish.Map$str$f64.valueAt(%struct.Map$str$f64* %49, i32 %53)
  br label %nullish.end

nullish.default:
  br label %nullish.end

nullish.end:
  %55 = phi double [ %54, %nullish.value ], [ 0x0000000000000000, %nullish.default ]
  %56 = fadd double %55, 0x3FF0000000000000
  %57 = call %struct.Map$str$f64* @nish.Map$str$f64.set(%struct.Map$str$f64* %47, i8* %48, double %56)
  br label %forof.inc

forof.inc:
  %58 = load i64, i64* %forof.idx, align 8
  %59 = add i64 %58, 1
  store i64 %59, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %60 = load %struct.nish_array*, %struct.nish_array** %order.addr, align 8
  store i64 0, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.cond.1:
  %61 = load i64, i64* %forof.idx.1, align 8
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 0
  %63 = load i64, i64* %62, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %64 = icmp ult i64 %61, %63
  br i1 %64, label %forof.body.1, label %forof.end.1

forof.body.1:
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 2
  %66 = load i8*, i8** %65, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %67 = bitcast i8* %66 to i8**
  %68 = getelementptr inbounds i8*, i8** %67, i64 %61
  %69 = load i8*, i8** %68, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store i8* %69, i8** %w.addr.1, align 8
  %70 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %71 = load i8*, i8** %70, align 8
  %72 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %73 = load i64, i64* %72, align 8
  %74 = load i8*, i8** %w.addr.1, align 8
  %75 = call i8* @nish_str_concat(i8* %74, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  %76 = load %struct.Map$str$f64*, %struct.Map$str$f64** %counts.addr, align 8
  %77 = load i8*, i8** %w.addr.1, align 8
  %78 = call i64 @nish.Map$str$f64.probe(%struct.Map$str$f64* %76, i8* %77)
  %79 = icmp sge i64 %78, 0
  br i1 %79, label %nullish.value.1, label %nullish.default.1

nullish.value.1:
  %80 = trunc i64 %78 to i32
  %81 = call double @nish.Map$str$f64.valueAt(%struct.Map$str$f64* %76, i32 %80)
  br label %nullish.end.1

nullish.default.1:
  %82 = fneg double 0x3FF0000000000000
  br label %nullish.end.1

nullish.end.1:
  %83 = phi double [ %81, %nullish.value.1 ], [ %82, %nullish.default.1 ]
  %84 = call i8* @nish_str_from_f64(double %83)
  %85 = call i8* @nish_str_concat(i8* %75, i8* %84)
  call void @nish_print(i8* %85)
  %86 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %87 = load i8*, i8** %86, align 8
  %88 = icmp eq i8* %87, %71
  br i1 %88, label %pass.rewind, label %pass.free

pass.rewind:
  %89 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %73, i64* %89, align 8
  br label %pass.done

pass.free:
  %90 = ptrtoint i8* %71 to i64
  %91 = add i64 %90, %73
  call void @nish_arena_release(i64 %91)
  br label %pass.done

pass.done:
  br label %forof.inc.1

forof.inc.1:
  %92 = load i64, i64* %forof.idx.1, align 8
  %93 = add i64 %92, 1
  store i64 %93, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.end.1:
  %94 = load %struct.Map$str$f64*, %struct.Map$str$f64** %counts.addr, align 8
  %95 = call i64 @nish.Map$str$f64.probe(%struct.Map$str$f64* %94, i8* bitcast ({ i64, [4 x i8] }* @.str.9 to i8*))
  %96 = icmp sge i64 %95, 0
  br i1 %96, label %nullish.value.2, label %nullish.default.2

nullish.value.2:
  %97 = trunc i64 %95 to i32
  %98 = call double @nish.Map$str$f64.valueAt(%struct.Map$str$f64* %94, i32 %97)
  br label %nullish.end.2

nullish.default.2:
  %99 = fneg double 0x3FF0000000000000
  br label %nullish.end.2

nullish.end.2:
  %100 = phi double [ %98, %nullish.value.2 ], [ %99, %nullish.default.2 ]
  %101 = call i8* @nish_str_from_f64(double %100)
  %102 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.8 to i8*), i8* %101)
  call void @nish_print(i8* %102)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

define internal noundef i32 @nish.homeBucket(i32 noundef %h, i32 noundef %mask) #1 {
entry:
  %0 = lshr i32 %h, 16
  %1 = xor i32 %h, %0
  %2 = and i32 %1, %mask
  ret i32 %2
}

define internal noundef i32 @nish.slotWord(i32 noundef %h, i32 noundef %index) #1 {
entry:
  %0 = lshr i32 %h, 24
  %1 = shl i32 %0, 24
  %2 = add nsw i32 %index, 1
  %3 = or i32 %1, %2
  ret i32 %3
}

define internal noundef i64 @nish.foundAt(i32 noundef %bucket, i32 noundef %index) #1 {
entry:
  %0 = sext i32 %bucket to i64
  %1 = shl i64 %0, 32
  %2 = sext i32 %index to i64
  %3 = or i64 %1, %2
  ret i64 %3
}

define internal noundef i64 @nish.absentAt(i32 noundef %bucket, i32 noundef %h) #1 {
entry:
  %0 = fneg double 0x3FF0000000000000
  %1 = call i64 @llvm.fptosi.sat.i64.f64(double %0)
  %2 = sext i32 %bucket to i64
  %3 = shl i64 %2, 32
  %4 = zext i32 %h to i64
  %5 = or i64 %3, %4
  %6 = sub nsw i64 %1, %5
  ret i64 %6
}

define internal void @nish.fileEntry(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %h, i32 noundef %index) #0 {
entry:
  %word.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %0 = call i32 @nish.slotWord(i32 %h, i32 %index)
  store i32 %0, i32* %word.addr, align 4
  %1 = call i32 @nish.homeBucket(i32 %h, i32 %mask)
  store i32 %1, i32* %bucket.addr, align 4
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %6 = load i32, i32* %bucket.addr, align 4
  %7 = icmp sge i32 %6, 0
  br i1 %7, label %land.rhs, label %land.end

land.rhs:
  %8 = load i32, i32* %bucket.addr, align 4
  %9 = sitofp i64 %3 to double
  %10 = call i32 @llvm.fptosi.sat.i32.f64(double %9)
  %11 = icmp slt i32 %8, %10
  br label %land.end

land.end:
  %12 = phi i1 [ false, %while.cond ], [ %11, %land.rhs ]
  br i1 %12, label %while.body, label %while.end

while.body:
  %13 = load i32, i32* %bucket.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = bitcast i8* %5 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 %14
  %17 = load i32, i32* %16, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %18 = icmp eq i32 %17, 0
  br i1 %18, label %if.then, label %if.end

if.then:
  %19 = load i32, i32* %bucket.addr, align 4
  %20 = sext i32 %19 to i64
  %21 = load i32, i32* %word.addr, align 4
  %22 = bitcast i8* %5 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %20
  store i32 %21, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  ret void

if.end:
  %24 = load i32, i32* %bucket.addr, align 4
  %25 = add nsw i32 %24, 1
  %26 = and i32 %25, %mask
  store i32 %26, i32* %bucket.addr, align 4
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactHashes(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %6 = load i32, i32* %from.addr, align 4
  %7 = load i32, i32* %used.addr, align 4
  %8 = icmp slt i32 %6, %7
  br i1 %8, label %for.body, label %for.end

for.body:
  %9 = load i32, i32* %from.addr, align 4
  %10 = sext i32 %9 to i64
  %11 = bitcast i8* %5 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 %10
  %13 = load i32, i32* %12, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store i32 %13, i32* %h.addr, align 4
  %14 = load i32, i32* %h.addr, align 4
  %15 = icmp ne i32 %14, 0
  br i1 %15, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %16 = load i32, i32* %to.addr, align 4
  %17 = icmp sge i32 %16, 0
  br label %land.end.1

land.end.1:
  %18 = phi i1 [ false, %for.body ], [ %17, %land.rhs.1 ]
  br i1 %18, label %land.rhs, label %land.end

land.rhs:
  %19 = load i32, i32* %to.addr, align 4
  %20 = load i32, i32* %used.addr, align 4
  %21 = icmp slt i32 %19, %20
  br label %land.end

land.end:
  %22 = phi i1 [ false, %land.end.1 ], [ %21, %land.rhs ]
  br i1 %22, label %if.then, label %if.end

if.then:
  %23 = load i32, i32* %to.addr, align 4
  %24 = sext i32 %23 to i64
  %25 = load i32, i32* %h.addr, align 4
  %26 = bitcast i8* %5 to i32*
  %27 = getelementptr inbounds i32, i32* %26, i64 %24
  store i32 %25, i32* %27, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %28 = load i32, i32* %to.addr, align 4
  %29 = add nsw i32 %28, 1
  store i32 %29, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %30 = load i32, i32* %from.addr, align 4
  %31 = add nsw i32 %30, 1
  store i32 %31, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %33 = load i64, i64* %32, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %34 = sitofp i64 %33 to double
  %35 = call i32 @llvm.fptosi.sat.i32.f64(double %34)
  %36 = load i32, i32* %to.addr, align 4
  %37 = icmp sgt i32 %35, %36
  br i1 %37, label %while.body, label %while.end

while.body:
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %39 = load i64, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %40 = icmp eq i64 %39, 0
  br i1 %40, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %41 = sub i64 %39, 1
  store i64 %41, i64* %38, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %43 = load i8*, i8** %42, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %44 = bitcast i8* %43 to i32*
  %45 = getelementptr inbounds i32, i32* %44, i64 %41
  %46 = load i32, i32* %45, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  br label %while.cond

while.end:
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %slots, i32 noundef %live, i32 noundef %used) #0 {
entry:
  %n.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %n.addr, align 4
  %4 = mul nsw i32 %live, 2
  %5 = icmp slt i32 %4, %used
  br i1 %5, label %if.then, label %if.end

if.then:
  call void @nish.clearSlots(%struct.nish_array* %slots)
  ret %struct.nish_array* %slots

if.end:
  %6 = load i32, i32* %n.addr, align 4
  %7 = mul nsw i32 %6, 2
  %8 = sext i32 %7 to i64
  %9 = call i8* @nish_alloc_struct(i64 24)
  %10 = bitcast i8* %9 to %struct.nish_array*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  store i64 %8, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  store i64 %8, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = mul i64 %8, 4
  %14 = call i8* @nish_alloc_struct(i64 %13)
  call void @llvm.memset.p0i8.i64(i8* align 8 %14, i8 0, i64 %13, i1 false), !alias.scope !4, !noalias !3
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  ret %struct.nish_array* %10
}

define internal void @nish.refile(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %hashes) #0 {
entry:
  %mask.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  %4 = sub nsw i32 %3, 1
  store i32 %4, i32* %mask.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %6 = load i64, i64* %5, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %9 = load i32, i32* %i.addr, align 4
  %10 = sitofp i64 %6 to double
  %11 = call i32 @llvm.fptosi.sat.i32.f64(double %10)
  %12 = icmp slt i32 %9, %11
  br i1 %12, label %for.body, label %for.end

for.body:
  %13 = load i32, i32* %mask.addr, align 4
  %14 = load i32, i32* %i.addr, align 4
  %15 = sext i32 %14 to i64
  %16 = bitcast i8* %8 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %15
  %18 = load i32, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %19 = load i32, i32* %i.addr, align 4
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %13, i32 %18, i32 %19)
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.clearSlots(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots) #0 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = sitofp i64 %1 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp slt i32 %4, %6
  br i1 %7, label %for.body, label %for.end

for.body:
  %8 = load i32, i32* %i.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = bitcast i8* %3 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %9
  store i32 0, i32* %11, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  br label %for.inc

for.inc:
  %12 = load i32, i32* %i.addr, align 4
  %13 = add nsw i32 %12, 1
  store i32 %13, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal void @nish.fileAppended(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %slots, i32 noundef %mask, i32 noundef %bucket, i32 noundef %h, i32 noundef %used) #0 {
entry:
  %0 = icmp sge i32 %bucket, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = sitofp i64 %2 to double
  %4 = call i32 @llvm.fptosi.sat.i32.f64(double %3)
  %5 = icmp slt i32 %bucket, %4
  br label %land.end

land.end:
  %6 = phi i1 [ false, %entry ], [ %5, %land.rhs ]
  br i1 %6, label %if.then, label %if.else

if.then:
  %7 = sext i32 %bucket to i64
  %8 = sub nsw i32 %used, 1
  %9 = call i32 @nish.slotWord(i32 %h, i32 %8)
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %12 = bitcast i8* %11 to i32*
  %13 = getelementptr inbounds i32, i32* %12, i64 %7
  store i32 %9, i32* %13, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  br label %if.end

if.else:
  %14 = sub nsw i32 %used, 1
  call void @nish.fileEntry(%struct.nish_array* %slots, i32 %mask, i32 %h, i32 %14)
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$str$f64.constructor(%struct.Map$str$f64* noundef nonnull noalias align 8 dereferenceable(48) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 0
  store double 0x0000000000000000, double* %0, align 8, !tbaa !21
  %1 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 2
  store i32 7, i32* %1, align 4, !tbaa !22
  %2 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 3
  store i32 0, i32* %2, align 4, !tbaa !23
  %3 = sext i32 8 to i64
  %4 = call i8* @nish_alloc_struct(i64 24)
  %5 = bitcast i8* %4 to %struct.nish_array*
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  store i64 %3, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  store i64 %3, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %8 = mul i64 %3, 4
  %9 = call i8* @nish_alloc_struct(i64 %8)
  call void @llvm.memset.p0i8.i64(i8* align 8 %9, i8 0, i64 %8, i1 false), !alias.scope !4, !noalias !3
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  store i8* %9, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %11 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 1
  store %struct.nish_array* %5, %struct.nish_array** %11, align 8, !tbaa !24
  %12 = call i8* @nish_alloc_struct(i64 24)
  %13 = bitcast i8* %12 to %struct.nish_array*
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  store i64 0, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1
  store i64 0, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  store i8* null, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %17 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 4
  store %struct.nish_array* %13, %struct.nish_array** %17, align 8, !tbaa !25
  %18 = call i8* @nish_alloc_struct(i64 24)
  %19 = bitcast i8* %18 to %struct.nish_array*
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  store i64 0, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 1
  store i64 0, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  store i8* null, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %23 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 5
  store %struct.nish_array* %19, %struct.nish_array** %23, align 8, !tbaa !26
  %24 = call i8* @nish_alloc_struct(i64 24)
  %25 = bitcast i8* %24 to %struct.nish_array*
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 0
  store i64 0, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 1
  store i64 0, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %25, i64 0, i32 2
  store i8* null, i8** %28, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %29 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 6
  store %struct.nish_array* %25, %struct.nish_array** %29, align 8, !tbaa !27
  ret void
}

define internal noundef i64 @nish.Map$str$f64.probe(%struct.Map$str$f64* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i8* noundef nonnull noalias readonly align 8 %key) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 1
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !24
  %2 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 2
  %3 = load i32, i32* %2, align 4, !tbaa !22
  %4 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 6
  %5 = load %struct.nish_array*, %struct.nish_array** %4, align 8, !tbaa !27
  %6 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 4
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !25
  %8 = call i64 @nish.probeTable$str(%struct.nish_array* %1, i32 %3, %struct.nish_array* %5, %struct.nish_array* %7, i8* %key)
  ret i64 %8
}

define internal noundef zeroext i1 @nish.Map$str$f64.has(%struct.Map$str$f64* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i8* noundef nonnull noalias readonly align 8 %key) #0 {
entry:
  %0 = call i64 @nish.Map$str$f64.probe(%struct.Map$str$f64* %this, i8* %key)
  %1 = icmp sge i64 %0, 0
  ret i1 %1
}

define internal noundef nonnull align 8 dereferenceable(48) %struct.Map$str$f64* @nish.Map$str$f64.set(%struct.Map$str$f64* noundef nonnull align 8 dereferenceable(48) %this, i8* noundef nonnull noalias readonly align 8 %key, double noundef %value) #0 {
entry:
  %found.addr = alloca i64, align 8
  %0 = call i64 @nish.Map$str$f64.probe(%struct.Map$str$f64* %this, i8* %key)
  store i64 %0, i64* %found.addr, align 8
  %1 = load i64, i64* %found.addr, align 8
  %2 = icmp sge i64 %1, 0
  br i1 %2, label %if.then, label %if.else

if.then:
  %3 = load i64, i64* %found.addr, align 8
  %4 = trunc i64 %3 to i32
  call void @nish.Map$str$f64.setValueAt(%struct.Map$str$f64* %this, i32 %4, double %value)
  br label %if.end

if.else:
  %5 = load i64, i64* %found.addr, align 8
  call void @nish.Map$str$f64.insertAt(%struct.Map$str$f64* %this, i64 %5, i8* %key, double %value)
  br label %if.end

if.end:
  ret %struct.Map$str$f64* %this
}

define internal noundef double @nish.Map$str$f64.valueAt(%struct.Map$str$f64* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %index) #0 {
entry:
  %0 = icmp slt i32 %index, 0
  br i1 %0, label %lor.end, label %lor.rhs

lor.rhs:
  %1 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !26
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp sge i32 %index, %6
  br label %lor.end

lor.end:
  %8 = phi i1 [ true, %entry ], [ %7, %lor.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  call void @nish_write(i8* bitcast ({ i64, [28 x i8] }* @.str.10 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end:
  %9 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 5
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !26
  %11 = sext i32 %index to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = icmp ult i64 %11, %13
  br i1 %14, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %11, i64 %13)
  unreachable

bounds.ok:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %17 = bitcast i8* %16 to double*
  %18 = getelementptr inbounds double, double* %17, i64 %11
  %19 = load double, double* %18, align 8, !alias.scope !4, !noalias !3, !tbaa !29
  ret double %19
}

define internal void @nish.Map$str$f64.setValueAt(%struct.Map$str$f64* noundef nonnull readonly align 8 dereferenceable(48) nocapture %this, i32 noundef %index, double noundef %value) #2 {
entry:
  %0 = icmp sge i32 %index, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 5
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !26
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = sitofp i64 %4 to double
  %6 = call i32 @llvm.fptosi.sat.i32.f64(double %5)
  %7 = icmp slt i32 %index, %6
  br label %land.end

land.end:
  %8 = phi i1 [ false, %entry ], [ %7, %land.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 5
  %10 = load %struct.nish_array*, %struct.nish_array** %9, align 8, !tbaa !26
  %11 = sext i32 %index to i64
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %14 = bitcast i8* %13 to double*
  %15 = getelementptr inbounds double, double* %14, i64 %11
  store double %value, double* %15, align 8, !alias.scope !4, !noalias !3, !tbaa !29
  br label %if.end

if.end:
  ret void
}

define internal void @nish.Map$str$f64.insertAt(%struct.Map$str$f64* noundef nonnull align 8 dereferenceable(48) nocapture %this, i64 noundef %absent, i8* noundef nonnull noalias readonly align 8 %key, double noundef %value) #0 {
entry:
  %packed.addr = alloca i64, align 8
  %bucket.addr = alloca i32, align 4
  %h.addr = alloca i32, align 4
  %used.addr = alloca i32, align 4
  %0 = sub nsw i64 0, 1
  %1 = sub nsw i64 %0, %absent
  store i64 %1, i64* %packed.addr, align 8
  %2 = load i64, i64* %packed.addr, align 8
  %3 = ashr i64 %2, 32
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %bucket.addr, align 4
  %5 = load i64, i64* %packed.addr, align 8
  %6 = trunc i64 %5 to i32
  store i32 %6, i32* %h.addr, align 4
  %7 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 4
  %8 = load %struct.nish_array*, %struct.nish_array** %7, align 8, !tbaa !25
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = sitofp i64 %10 to double
  %12 = call i32 @llvm.fptosi.sat.i32.f64(double %11)
  %13 = icmp sge i32 %12, 16777215
  br i1 %13, label %if.then, label %if.end

if.then:
  %14 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 3
  %15 = load i32, i32* %14, align 4, !tbaa !23
  %16 = icmp sge i32 %15, 16777215
  br i1 %16, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.11 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

if.end.1:
  call void @nish.Map$str$f64.rebuild(%struct.Map$str$f64* %this)
  %17 = sub nsw i32 0, 1
  store i32 %17, i32* %bucket.addr, align 4
  br label %if.end

if.end:
  %18 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 4
  %19 = load %struct.nish_array*, %struct.nish_array** %18, align 8, !tbaa !25
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 1
  %23 = load i64, i64* %22, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %24 = icmp eq i64 %21, %23
  br i1 %24, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %19, i64 8)
  br label %push.store

push.store:
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %27 = bitcast i8* %26 to i8**
  %28 = getelementptr inbounds i8*, i8** %27, i64 %21
  store i8* %key, i8** %28, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %29 = add i64 %21, 1
  store i64 %29, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = sitofp i64 %29 to double
  %31 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 5
  %32 = load %struct.nish_array*, %struct.nish_array** %31, align 8, !tbaa !26
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 1
  %36 = load i64, i64* %35, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %37 = icmp eq i64 %34, %36
  br i1 %37, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %32, i64 8)
  br label %push.store.1

push.store.1:
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 2
  %39 = load i8*, i8** %38, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %40 = bitcast i8* %39 to double*
  %41 = getelementptr inbounds double, double* %40, i64 %34
  store double %value, double* %41, align 8, !alias.scope !4, !noalias !3, !tbaa !29
  %42 = add i64 %34, 1
  store i64 %42, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %43 = sitofp i64 %42 to double
  %44 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 6
  %45 = load %struct.nish_array*, %struct.nish_array** %44, align 8, !tbaa !27
  %46 = load i32, i32* %h.addr, align 4
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 0
  %48 = load i64, i64* %47, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 1
  %50 = load i64, i64* %49, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %51 = icmp eq i64 %48, %50
  br i1 %51, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %45, i64 4)
  br label %push.store.2

push.store.2:
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %45, i64 0, i32 2
  %53 = load i8*, i8** %52, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %54 = bitcast i8* %53 to i32*
  %55 = getelementptr inbounds i32, i32* %54, i64 %48
  store i32 %46, i32* %55, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %56 = add i64 %48, 1
  store i64 %56, i64* %47, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %57 = sitofp i64 %56 to double
  %58 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 3
  %59 = load i32, i32* %58, align 4, !tbaa !23
  %60 = add nsw i32 %59, 1
  %61 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 3
  store i32 %60, i32* %61, align 4, !tbaa !23
  %62 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 0
  %63 = load double, double* %62, align 8, !tbaa !21
  %64 = fadd double %63, 0x3FF0000000000000
  %65 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 0
  store double %64, double* %65, align 8, !tbaa !21
  %66 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 4
  %67 = load %struct.nish_array*, %struct.nish_array** %66, align 8, !tbaa !25
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %67, i64 0, i32 0
  %69 = load i64, i64* %68, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %70 = sitofp i64 %69 to double
  %71 = call i32 @llvm.fptosi.sat.i32.f64(double %70)
  store i32 %71, i32* %used.addr, align 4
  %72 = load i32, i32* %used.addr, align 4
  %73 = mul nsw i32 %72, 4
  %74 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 1
  %75 = load %struct.nish_array*, %struct.nish_array** %74, align 8, !tbaa !24
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 0
  %77 = load i64, i64* %76, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %78 = sitofp i64 %77 to double
  %79 = call i32 @llvm.fptosi.sat.i32.f64(double %78)
  %80 = mul nsw i32 %79, 3
  %81 = icmp sgt i32 %73, %80
  br i1 %81, label %if.then.2, label %if.else

if.then.2:
  call void @nish.Map$str$f64.rebuild(%struct.Map$str$f64* %this)
  br label %if.end.2

if.else:
  %82 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 1
  %83 = load %struct.nish_array*, %struct.nish_array** %82, align 8, !tbaa !24
  %84 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 2
  %85 = load i32, i32* %84, align 4, !tbaa !22
  %86 = load i32, i32* %bucket.addr, align 4
  %87 = load i32, i32* %h.addr, align 4
  %88 = load i32, i32* %used.addr, align 4
  call void @nish.fileAppended(%struct.nish_array* %83, i32 %85, i32 %86, i32 %87, i32 %88)
  br label %if.end.2

if.end.2:
  ret void
}

define internal void @nish.Map$str$f64.rebuild(%struct.Map$str$f64* noundef nonnull align 8 dereferenceable(48) nocapture %this) #0 {
entry:
  %used.addr = alloca i32, align 4
  %slots.addr = alloca %struct.nish_array*, align 8
  %0 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 4
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !25
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = sitofp i64 %3 to double
  %5 = call i32 @llvm.fptosi.sat.i32.f64(double %4)
  store i32 %5, i32* %used.addr, align 4
  %6 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 1
  %7 = load %struct.nish_array*, %struct.nish_array** %6, align 8, !tbaa !24
  %8 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 3
  %9 = load i32, i32* %8, align 4, !tbaa !23
  %10 = load i32, i32* %used.addr, align 4
  %11 = call %struct.nish_array* @nish.rebuiltSlots(%struct.nish_array* %7, i32 %9, i32 %10)
  store %struct.nish_array* %11, %struct.nish_array** %slots.addr, align 8
  %12 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 3
  %13 = load i32, i32* %12, align 4, !tbaa !23
  %14 = load i32, i32* %used.addr, align 4
  %15 = icmp slt i32 %13, %14
  br i1 %15, label %if.then, label %if.end

if.then:
  %16 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 4
  %17 = load %struct.nish_array*, %struct.nish_array** %16, align 8, !tbaa !25
  %18 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 6
  %19 = load %struct.nish_array*, %struct.nish_array** %18, align 8, !tbaa !27
  call void @nish.compactEntries$str(%struct.nish_array* %17, %struct.nish_array* %19)
  %20 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 5
  %21 = load %struct.nish_array*, %struct.nish_array** %20, align 8, !tbaa !26
  %22 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 6
  %23 = load %struct.nish_array*, %struct.nish_array** %22, align 8, !tbaa !27
  call void @nish.compactEntries$f64(%struct.nish_array* %21, %struct.nish_array* %23)
  %24 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 6
  %25 = load %struct.nish_array*, %struct.nish_array** %24, align 8, !tbaa !27
  call void @nish.compactHashes(%struct.nish_array* %25)
  br label %if.end

if.end:
  %26 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %27 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 1
  store %struct.nish_array* %26, %struct.nish_array** %27, align 8, !tbaa !24
  %28 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  %30 = load i64, i64* %29, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %31 = sitofp i64 %30 to double
  %32 = call i32 @llvm.fptosi.sat.i32.f64(double %31)
  %33 = sub nsw i32 %32, 1
  %34 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 2
  store i32 %33, i32* %34, align 4, !tbaa !22
  %35 = load %struct.nish_array*, %struct.nish_array** %slots.addr, align 8
  %36 = getelementptr inbounds %struct.Map$str$f64, %struct.Map$str$f64* %this, i32 0, i32 6
  %37 = load %struct.nish_array*, %struct.nish_array** %36, align 8, !tbaa !27
  call void @nish.refile(%struct.nish_array* %35, %struct.nish_array* %37)
  ret void
}

define internal noundef i64 @nish.probeTable$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %slots, i32 noundef %mask, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %keys, i8* noundef nonnull noalias readonly align 8 %key) #0 {
entry:
  %h.addr = alloca i32, align 4
  %hash.i = alloca i64, align 8
  %hash.h = alloca i32, align 4
  %fingerprint.addr = alloca i32, align 4
  %bucket.addr = alloca i32, align 4
  %word.addr = alloca i32, align 4
  %at.addr = alloca i32, align 4
  %0 = bitcast i8* %key to i64*
  %1 = load i64, i64* %0, align 8
  %2 = getelementptr inbounds i8, i8* %key, i64 8
  store i64 0, i64* %hash.i, align 8
  store i32 -2128831035, i32* %hash.h, align 4
  br label %hash.test

hash.test:
  %3 = load i64, i64* %hash.i, align 8
  %4 = icmp ult i64 %3, %1
  br i1 %4, label %hash.byte, label %hash.done

hash.byte:
  %5 = getelementptr inbounds i8, i8* %2, i64 %3
  %6 = load i8, i8* %5
  %7 = zext i8 %6 to i32
  %8 = load i32, i32* %hash.h, align 4
  %9 = xor i32 %8, %7
  %10 = mul i32 %9, 16777619
  store i32 %10, i32* %hash.h, align 4
  %11 = add i64 %3, 1
  store i64 %11, i64* %hash.i, align 8
  br label %hash.test

hash.done:
  %12 = load i32, i32* %hash.h, align 4
  %13 = icmp eq i32 %12, 0
  %14 = select i1 %13, i32 1, i32 %12
  store i32 %14, i32* %h.addr, align 4
  %15 = load i32, i32* %h.addr, align 4
  %16 = lshr i32 %15, 24
  store i32 %16, i32* %fingerprint.addr, align 4
  %17 = load i32, i32* %h.addr, align 4
  %18 = call i32 @nish.homeBucket(i32 %17, i32 %mask)
  store i32 %18, i32* %bucket.addr, align 4
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %slots, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %26 = load i8*, i8** %25, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %while.cond

while.cond:
  %31 = load i32, i32* %bucket.addr, align 4
  %32 = icmp sge i32 %31, 0
  br i1 %32, label %land.rhs, label %land.end

land.rhs:
  %33 = load i32, i32* %bucket.addr, align 4
  %34 = sitofp i64 %20 to double
  %35 = call i32 @llvm.fptosi.sat.i32.f64(double %34)
  %36 = icmp slt i32 %33, %35
  br label %land.end

land.end:
  %37 = phi i1 [ false, %while.cond ], [ %36, %land.rhs ]
  br i1 %37, label %while.body, label %while.end

while.body:
  %38 = load i32, i32* %bucket.addr, align 4
  %39 = sext i32 %38 to i64
  %40 = bitcast i8* %22 to i32*
  %41 = getelementptr inbounds i32, i32* %40, i64 %39
  %42 = load i32, i32* %41, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  store i32 %42, i32* %word.addr, align 4
  %43 = load i32, i32* %word.addr, align 4
  %44 = icmp eq i32 %43, 0
  br i1 %44, label %if.then, label %if.end

if.then:
  %45 = load i32, i32* %bucket.addr, align 4
  %46 = load i32, i32* %h.addr, align 4
  %47 = tail call i64 @nish.absentAt(i32 %45, i32 %46)
  ret i64 %47

if.end:
  %48 = load i32, i32* %word.addr, align 4
  %49 = lshr i32 %48, 24
  %50 = load i32, i32* %fingerprint.addr, align 4
  %51 = icmp eq i32 %49, %50
  br i1 %51, label %if.then.1, label %if.end.1

if.then.1:
  %52 = load i32, i32* %word.addr, align 4
  %53 = and i32 %52, 16777215
  %54 = sub nsw i32 %53, 1
  store i32 %54, i32* %at.addr, align 4
  %55 = load i32, i32* %at.addr, align 4
  %56 = icmp sge i32 %55, 0
  br i1 %56, label %land.rhs.4, label %land.end.4

land.rhs.4:
  %57 = load i32, i32* %at.addr, align 4
  %58 = sitofp i64 %24 to double
  %59 = call i32 @llvm.fptosi.sat.i32.f64(double %58)
  %60 = icmp slt i32 %57, %59
  br label %land.end.4

land.end.4:
  %61 = phi i1 [ false, %if.then.1 ], [ %60, %land.rhs.4 ]
  br i1 %61, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %62 = load i32, i32* %at.addr, align 4
  %63 = sext i32 %62 to i64
  %64 = bitcast i8* %26 to i32*
  %65 = getelementptr inbounds i32, i32* %64, i64 %63
  %66 = load i32, i32* %65, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %67 = load i32, i32* %h.addr, align 4
  %68 = icmp eq i32 %66, %67
  br label %land.end.3

land.end.3:
  %69 = phi i1 [ false, %land.end.4 ], [ %68, %land.rhs.3 ]
  br i1 %69, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %70 = load i32, i32* %at.addr, align 4
  %71 = sitofp i64 %28 to double
  %72 = call i32 @llvm.fptosi.sat.i32.f64(double %71)
  %73 = icmp slt i32 %70, %72
  br label %land.end.2

land.end.2:
  %74 = phi i1 [ false, %land.end.3 ], [ %73, %land.rhs.2 ]
  br i1 %74, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %75 = load i32, i32* %at.addr, align 4
  %76 = sext i32 %75 to i64
  %77 = bitcast i8* %30 to i8**
  %78 = getelementptr inbounds i8*, i8** %77, i64 %76
  %79 = load i8*, i8** %78, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %80 = call zeroext i1 @nish_str_eq(i8* %79, i8* %key)
  br label %land.end.1

land.end.1:
  %81 = phi i1 [ false, %land.end.2 ], [ %80, %land.rhs.1 ]
  br i1 %81, label %if.then.2, label %if.end.2

if.then.2:
  %82 = load i32, i32* %bucket.addr, align 4
  %83 = load i32, i32* %at.addr, align 4
  %84 = tail call i64 @nish.foundAt(i32 %82, i32 %83)
  ret i64 %84

if.end.2:
  br label %if.end.1

if.end.1:
  %85 = load i32, i32* %bucket.addr, align 4
  %86 = add nsw i32 %85, 1
  %87 = and i32 %86, %mask
  store i32 %87, i32* %bucket.addr, align 4
  br label %while.cond

while.end:
  call void @nish_write(i8* bitcast ({ i64, [40 x i8] }* @.str.12 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable
}

define internal void @nish.compactEntries$str(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %12 = load i32, i32* %from.addr, align 4
  %13 = load i32, i32* %used.addr, align 4
  %14 = icmp slt i32 %12, %13
  br i1 %14, label %land.rhs, label %land.end

land.rhs:
  %15 = load i32, i32* %from.addr, align 4
  %16 = sitofp i64 %5 to double
  %17 = call i32 @llvm.fptosi.sat.i32.f64(double %16)
  %18 = icmp slt i32 %15, %17
  br label %land.end

land.end:
  %19 = phi i1 [ false, %for.cond ], [ %18, %land.rhs ]
  br i1 %19, label %for.body, label %for.end

for.body:
  %20 = load i32, i32* %from.addr, align 4
  %21 = sext i32 %20 to i64
  %22 = bitcast i8* %7 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %21
  %24 = load i32, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %25 = icmp ne i32 %24, 0
  br i1 %25, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %26 = load i32, i32* %to.addr, align 4
  %27 = icmp sge i32 %26, 0
  br label %land.end.3

land.end.3:
  %28 = phi i1 [ false, %for.body ], [ %27, %land.rhs.3 ]
  br i1 %28, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %29 = load i32, i32* %to.addr, align 4
  %30 = load i32, i32* %used.addr, align 4
  %31 = icmp slt i32 %29, %30
  br label %land.end.2

land.end.2:
  %32 = phi i1 [ false, %land.end.3 ], [ %31, %land.rhs.2 ]
  br i1 %32, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %33 = load i32, i32* %from.addr, align 4
  %34 = sitofp i64 %9 to double
  %35 = call i32 @llvm.fptosi.sat.i32.f64(double %34)
  %36 = icmp slt i32 %33, %35
  br label %land.end.1

land.end.1:
  %37 = phi i1 [ false, %land.end.2 ], [ %36, %land.rhs.1 ]
  br i1 %37, label %if.then, label %if.end

if.then:
  %38 = load i32, i32* %to.addr, align 4
  %39 = sext i32 %38 to i64
  %40 = load i32, i32* %from.addr, align 4
  %41 = sext i32 %40 to i64
  %42 = bitcast i8* %11 to i8**
  %43 = getelementptr inbounds i8*, i8** %42, i64 %41
  %44 = load i8*, i8** %43, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %45 = bitcast i8* %11 to i8**
  %46 = getelementptr inbounds i8*, i8** %45, i64 %39
  store i8* %44, i8** %46, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %47 = load i32, i32* %to.addr, align 4
  %48 = add nsw i32 %47, 1
  store i32 %48, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %49 = load i32, i32* %from.addr, align 4
  %50 = add nsw i32 %49, 1
  store i32 %50, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %53 = sitofp i64 %52 to double
  %54 = call i32 @llvm.fptosi.sat.i32.f64(double %53)
  %55 = load i32, i32* %to.addr, align 4
  %56 = icmp sgt i32 %54, %55
  br i1 %56, label %while.body, label %while.end

while.body:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %58 = load i64, i64* %57, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %59 = icmp eq i64 %58, 0
  br i1 %59, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %60 = sub i64 %58, 1
  store i64 %60, i64* %57, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %63 = bitcast i8* %62 to i8**
  %64 = getelementptr inbounds i8*, i8** %63, i64 %60
  %65 = load i8*, i8** %64, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  br label %while.cond

while.end:
  ret void
}

define internal void @nish.compactEntries$f64(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %items, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %hashes) #0 {
entry:
  %used.addr = alloca i32, align 4
  %to.addr = alloca i32, align 4
  %from.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = sitofp i64 %1 to double
  %3 = call i32 @llvm.fptosi.sat.i32.f64(double %2)
  store i32 %3, i32* %used.addr, align 4
  store i32 0, i32* %to.addr, align 4
  store i32 0, i32* %from.addr, align 4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %hashes, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond

for.cond:
  %12 = load i32, i32* %from.addr, align 4
  %13 = load i32, i32* %used.addr, align 4
  %14 = icmp slt i32 %12, %13
  br i1 %14, label %land.rhs, label %land.end

land.rhs:
  %15 = load i32, i32* %from.addr, align 4
  %16 = sitofp i64 %5 to double
  %17 = call i32 @llvm.fptosi.sat.i32.f64(double %16)
  %18 = icmp slt i32 %15, %17
  br label %land.end

land.end:
  %19 = phi i1 [ false, %for.cond ], [ %18, %land.rhs ]
  br i1 %19, label %for.body, label %for.end

for.body:
  %20 = load i32, i32* %from.addr, align 4
  %21 = sext i32 %20 to i64
  %22 = bitcast i8* %7 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 %21
  %24 = load i32, i32* %23, align 4, !alias.scope !4, !noalias !3, !tbaa !16
  %25 = icmp ne i32 %24, 0
  br i1 %25, label %land.rhs.3, label %land.end.3

land.rhs.3:
  %26 = load i32, i32* %to.addr, align 4
  %27 = icmp sge i32 %26, 0
  br label %land.end.3

land.end.3:
  %28 = phi i1 [ false, %for.body ], [ %27, %land.rhs.3 ]
  br i1 %28, label %land.rhs.2, label %land.end.2

land.rhs.2:
  %29 = load i32, i32* %to.addr, align 4
  %30 = load i32, i32* %used.addr, align 4
  %31 = icmp slt i32 %29, %30
  br label %land.end.2

land.end.2:
  %32 = phi i1 [ false, %land.end.3 ], [ %31, %land.rhs.2 ]
  br i1 %32, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %33 = load i32, i32* %from.addr, align 4
  %34 = sitofp i64 %9 to double
  %35 = call i32 @llvm.fptosi.sat.i32.f64(double %34)
  %36 = icmp slt i32 %33, %35
  br label %land.end.1

land.end.1:
  %37 = phi i1 [ false, %land.end.2 ], [ %36, %land.rhs.1 ]
  br i1 %37, label %if.then, label %if.end

if.then:
  %38 = load i32, i32* %to.addr, align 4
  %39 = sext i32 %38 to i64
  %40 = load i32, i32* %from.addr, align 4
  %41 = sext i32 %40 to i64
  %42 = bitcast i8* %11 to double*
  %43 = getelementptr inbounds double, double* %42, i64 %41
  %44 = load double, double* %43, align 8, !alias.scope !4, !noalias !3, !tbaa !29
  %45 = bitcast i8* %11 to double*
  %46 = getelementptr inbounds double, double* %45, i64 %39
  store double %44, double* %46, align 8, !alias.scope !4, !noalias !3, !tbaa !29
  %47 = load i32, i32* %to.addr, align 4
  %48 = add nsw i32 %47, 1
  store i32 %48, i32* %to.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %49 = load i32, i32* %from.addr, align 4
  %50 = add nsw i32 %49, 1
  store i32 %50, i32* %from.addr, align 4
  br label %for.cond

for.end:
  br label %while.cond

while.cond:
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %53 = sitofp i64 %52 to double
  %54 = call i32 @llvm.fptosi.sat.i32.f64(double %53)
  %55 = load i32, i32* %to.addr, align 4
  %56 = icmp sgt i32 %54, %55
  br i1 %56, label %while.body, label %while.end

while.body:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %58 = load i64, i64* %57, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %59 = icmp eq i64 %58, 0
  br i1 %59, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %60 = sub i64 %58, 1
  store i64 %60, i64* %57, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 2
  %62 = load i8*, i8** %61, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %63 = bitcast i8* %62 to double*
  %64 = getelementptr inbounds double, double* %63, i64 %60
  %65 = load double, double* %64, align 8, !alias.scope !4, !noalias !3, !tbaa !29
  br label %while.cond

while.end:
  ret void
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind willreturn memory(argmem: read) }
attributes #5 = { noreturn nounwind }
attributes #6 = { nounwind noreturn cold }
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
!15 = !{!"element i32", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{!"double", !6, i64 0}
!18 = !{!"ptr", !6, i64 0}
!19 = !{!"i32", !6, i64 0}
!20 = !{!"Map$str$f64", !17, i64 0, !18, i64 8, !19, i64 16, !19, i64 20, !18, i64 24, !18, i64 32, !18, i64 40}
!21 = !{!20, !17, i64 0}
!22 = !{!20, !19, i64 16}
!23 = !{!20, !19, i64 20}
!24 = !{!20, !18, i64 8}
!25 = !{!20, !18, i64 24}
!26 = !{!20, !18, i64 32}
!27 = !{!20, !18, i64 40}
!28 = !{!"element double", !6, i64 0}
!29 = !{!28, !28, i64 0}

%struct.Room = type { i32, double, i1, i32 }
%struct.Out = type { { %struct.nish_array, [1 x i32] }, { %struct.nish_array, [1 x double] }, { %struct.nish_array, [1 x i1] }, { %struct.nish_array, [1 x i32] } }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef i64 @nish_region_new() #0
declare i8* @nish_region_enter(i64 noundef) #0
declare void @nish_region_leave(i64 noundef, i8*) #0
declare void @nish_region_free(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #4

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

define internal void @Room.constructor(%struct.Room* noundef nonnull noalias align 8 dereferenceable(24) nocapture %this, i32 noundef %n) #0 {
entry:
  %0 = getelementptr inbounds %struct.Room, %struct.Room* %this, i32 0, i32 0
  store i32 %n, i32* %0, align 4, !tbaa !6
  %1 = sitofp i32 %n to double
  %2 = fdiv double %1, 0x4010000000000000
  %3 = getelementptr inbounds %struct.Room, %struct.Room* %this, i32 0, i32 1
  store double %2, double* %3, align 8, !tbaa !7
  %4 = srem i32 %n, 2
  %5 = icmp eq i32 %4, 0
  %6 = getelementptr inbounds %struct.Room, %struct.Room* %this, i32 0, i32 2
  store i1 %5, i1* %6, align 1, !tbaa !8
  %7 = icmp sgt i32 %n, 2
  br i1 %7, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %8 = phi i32 [ 1, %cond.true ], [ 0, %cond.false ]
  %9 = getelementptr inbounds %struct.Room, %struct.Room* %this, i32 0, i32 3
  store i32 %8, i32* %9, align 4, !tbaa !9
  ret void
}

define internal void @Out.constructor(%struct.Out* noundef nonnull noalias align 8 dereferenceable(128) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Out, %struct.Out* %this, i32 0, i32 0, i32 0
  %1 = getelementptr inbounds %struct.Out, %struct.Out* %this, i32 0, i32 0, i32 1, i64 0
  %2 = bitcast i32* %1 to i8*
  %3 = bitcast i8* %2 to i32*
  %4 = getelementptr inbounds i32, i32* %3, i64 0
  store i32 0, i32* %4, align 4, !alias.scope !14, !noalias !13, !tbaa !16
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  store i64 1, i64* %5, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %6 = getelementptr inbounds %struct.Out, %struct.Out* %this, i32 0, i32 1, i32 0
  %7 = getelementptr inbounds %struct.Out, %struct.Out* %this, i32 0, i32 1, i32 1, i64 0
  %8 = bitcast double* %7 to i8*
  %9 = bitcast i8* %8 to double*
  %10 = getelementptr inbounds double, double* %9, i64 0
  store double 0x0000000000000000, double* %10, align 8, !alias.scope !14, !noalias !13, !tbaa !22
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 1, i64* %11, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %12 = getelementptr inbounds %struct.Out, %struct.Out* %this, i32 0, i32 2, i32 0
  %13 = getelementptr inbounds %struct.Out, %struct.Out* %this, i32 0, i32 2, i32 1, i64 0
  %14 = bitcast i1* %13 to i8*
  %15 = bitcast i8* %14 to i1*
  %16 = getelementptr inbounds i1, i1* %15, i64 0
  store i1 false, i1* %16, align 1, !alias.scope !14, !noalias !13, !tbaa !24
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  store i64 1, i64* %17, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %18 = getelementptr inbounds %struct.Out, %struct.Out* %this, i32 0, i32 3, i32 0
  %19 = getelementptr inbounds %struct.Out, %struct.Out* %this, i32 0, i32 3, i32 1, i64 0
  %20 = bitcast i32* %19 to i8*
  %21 = bitcast i8* %20 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 0
  store i32 0, i32* %22, align 4, !alias.scope !14, !noalias !13, !tbaa !16
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  store i64 1, i64* %23, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  ret void
}

define hidden noundef nonnull align 8 dereferenceable(24) %struct.Room* @make$(i32 noundef %n) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.Room*
  call void @Room.constructor(%struct.Room* %1, i32 %n)
  ret %struct.Room* %1
}

define hidden noundef i32 @copyOut$(%struct.Room* noundef nonnull readonly align 8 dereferenceable(24) nocapture %room, %struct.Out* noundef nonnull align 8 dereferenceable(128) nocapture %out) #1 {
entry:
  %0 = getelementptr inbounds %struct.Out, %struct.Out* %out, i32 0, i32 0, i32 0
  %1 = getelementptr inbounds %struct.Room, %struct.Room* %room, i32 0, i32 0
  %2 = load i32, i32* %1, align 4, !tbaa !6
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %5 = icmp ult i64 0, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.Out, %struct.Out* %out, i32 0, i32 0, i32 1, i64 0
  %7 = bitcast i32* %6 to i8*
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 0
  store i32 %2, i32* %9, align 4, !alias.scope !14, !noalias !13, !tbaa !16
  %10 = getelementptr inbounds %struct.Out, %struct.Out* %out, i32 0, i32 1, i32 0
  %11 = getelementptr inbounds %struct.Room, %struct.Room* %room, i32 0, i32 1
  %12 = load double, double* %11, align 8, !tbaa !7
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %15 = icmp ult i64 0, %14
  br i1 %15, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %14)
  unreachable

bounds.ok.1:
  %16 = getelementptr inbounds %struct.Out, %struct.Out* %out, i32 0, i32 1, i32 1, i64 0
  %17 = bitcast double* %16 to i8*
  %18 = bitcast i8* %17 to double*
  %19 = getelementptr inbounds double, double* %18, i64 0
  store double %12, double* %19, align 8, !alias.scope !14, !noalias !13, !tbaa !22
  %20 = getelementptr inbounds %struct.Out, %struct.Out* %out, i32 0, i32 2, i32 0
  %21 = getelementptr inbounds %struct.Room, %struct.Room* %room, i32 0, i32 2
  %22 = load i1, i1* %21, align 1, !tbaa !8
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %25 = icmp ult i64 0, %24
  br i1 %25, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %24)
  unreachable

bounds.ok.2:
  %26 = getelementptr inbounds %struct.Out, %struct.Out* %out, i32 0, i32 2, i32 1, i64 0
  %27 = bitcast i1* %26 to i8*
  %28 = bitcast i8* %27 to i1*
  %29 = getelementptr inbounds i1, i1* %28, i64 0
  store i1 %22, i1* %29, align 1, !alias.scope !14, !noalias !13, !tbaa !24
  %30 = getelementptr inbounds %struct.Out, %struct.Out* %out, i32 0, i32 3, i32 0
  %31 = getelementptr inbounds %struct.Room, %struct.Room* %room, i32 0, i32 3
  %32 = load i32, i32* %31, align 4, !tbaa !9
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %35 = icmp ult i64 0, %34
  br i1 %35, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 0, i64 %34)
  unreachable

bounds.ok.3:
  %36 = getelementptr inbounds %struct.Out, %struct.Out* %out, i32 0, i32 3, i32 1, i64 0
  %37 = bitcast i32* %36 to i8*
  %38 = bitcast i8* %37 to i32*
  %39 = getelementptr inbounds i32, i32* %38, i64 0
  store i32 %32, i32* %39, align 4, !alias.scope !14, !noalias !13, !tbaa !16
  %40 = getelementptr inbounds %struct.Room, %struct.Room* %room, i32 0, i32 0
  %41 = load i32, i32* %40, align 4, !tbaa !6
  ret i32 %41
}

define hidden noundef i32 @nOf$(%struct.Room* noundef nonnull readonly align 8 dereferenceable(24) nocapture %room) #2 {
entry:
  %0 = getelementptr inbounds %struct.Room, %struct.Room* %room, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !6
  ret i32 %1
}

define hidden noundef double @wOf$(%struct.Room* noundef nonnull readonly align 8 dereferenceable(24) nocapture %room) #2 {
entry:
  %0 = getelementptr inbounds %struct.Room, %struct.Room* %room, i32 0, i32 1
  %1 = load double, double* %0, align 8, !tbaa !7
  ret double %1
}

define hidden noundef zeroext i1 @openOf$(%struct.Room* noundef nonnull readonly align 8 dereferenceable(24) nocapture %room) #2 {
entry:
  %0 = getelementptr inbounds %struct.Room, %struct.Room* %room, i32 0, i32 2
  %1 = load i1, i1* %0, align 1, !tbaa !8
  ret i1 %1
}

define hidden noundef i32 @moodOf$(%struct.Room* noundef nonnull readonly align 8 dereferenceable(24) nocapture %room) #2 {
entry:
  %0 = getelementptr inbounds %struct.Room, %struct.Room* %room, i32 0, i32 3
  %1 = load i32, i32* %0, align 4, !tbaa !9
  ret i32 %1
}

define internal noundef i32 @churn() #0 {
entry:
  %t.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !13, !noalias !14, !tbaa !25
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !13, !noalias !14, !tbaa !26
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %t.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, 4000
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = call i8* @nish_str_from_i32(i32 %6)
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %11 = load i64, i64* %10, align 8, !alias.scope !13, !noalias !14, !tbaa !25
  %12 = icmp eq i64 %9, %11
  br i1 %12, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 8)
  br label %push.store

push.store:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !13, !noalias !14, !tbaa !26
  %15 = bitcast i8* %14 to i8**
  %16 = getelementptr inbounds i8*, i8** %15, i64 %9
  store i8* %7, i8** %16, align 8, !alias.scope !14, !noalias !13, !tbaa !28
  %17 = add i64 %9, 1
  store i64 %17, i64* %8, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %18 = trunc i64 %17 to i32
  br label %for.inc

for.inc:
  %19 = load i32, i32* %i.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %21 = load %struct.nish_array*, %struct.nish_array** %t.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %24 = bitcast i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*) to i64*
  %25 = load i64, i64* %24, align 8
  %26 = sub i64 %23, 1
  %27 = mul i64 %25, %26
  %28 = icmp eq i64 %23, 0
  %29 = select i1 %28, i64 0, i64 %27
  store i64 %29, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %30 = load i64, i64* %join.at, align 8
  %31 = icmp ult i64 %30, %23
  br i1 %31, label %join.sum.body, label %join.copy

join.sum.body:
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !13, !noalias !14, !tbaa !26
  %34 = bitcast i8* %33 to i8**
  %35 = getelementptr inbounds i8*, i8** %34, i64 %30
  %36 = load i8*, i8** %35, align 8, !alias.scope !14, !noalias !13, !tbaa !28
  %37 = load i64, i64* %join.total, align 8
  %38 = bitcast i8* %36 to i64*
  %39 = load i64, i64* %38, align 8
  %40 = add i64 %37, %39
  store i64 %40, i64* %join.total, align 8
  %41 = add i64 %30, 1
  store i64 %41, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %42 = load i64, i64* %join.total, align 8
  %43 = icmp ugt i64 %42, 2147483647
  %44 = add i64 %42, 9
  %45 = select i1 %43, i64 4611686018427387904, i64 %44
  %46 = call i8* @nish_alloc_struct(i64 %45)
  %47 = bitcast i8* %46 to i64*
  store i64 %42, i64* %47, align 8
  %48 = getelementptr inbounds i8, i8* %46, i64 8
  store i8* %48, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %49 = load i64, i64* %join.at, align 8
  %50 = icmp ult i64 %49, %23
  br i1 %50, label %join.part, label %join.end

join.part:
  %51 = load i8*, i8** %join.p, align 8
  %52 = icmp eq i64 %49, 0
  %53 = select i1 %52, i64 0, i64 %25
  %54 = getelementptr inbounds i8, i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %51, i8* %54, i64 %53, i1 false)
  %55 = getelementptr inbounds i8, i8* %51, i64 %53
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  %57 = load i8*, i8** %56, align 8, !alias.scope !13, !noalias !14, !tbaa !26
  %58 = bitcast i8* %57 to i8**
  %59 = getelementptr inbounds i8*, i8** %58, i64 %49
  %60 = load i8*, i8** %59, align 8, !alias.scope !14, !noalias !13, !tbaa !28
  %61 = bitcast i8* %60 to i64*
  %62 = load i64, i64* %61, align 8
  %63 = getelementptr inbounds i8, i8* %60, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %55, i8* %63, i64 %62, i1 false)
  %64 = getelementptr inbounds i8, i8* %55, i64 %62
  store i8* %64, i8** %join.p, align 8
  %65 = add i64 %49, 1
  store i64 %65, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %66 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %66, align 1
  %67 = bitcast i8* %46 to i64*
  %68 = load i64, i64* %67, align 8
  %69 = trunc i64 %68 to i32
  ret i32 %69
}

define noundef i32 @nish_main() #1 {
entry:
  %out.addr = alloca %struct.Out*, align 8
  %Out.obj = alloca %struct.Out, align 8
  %held.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %r.addr = alloca i64, align 8
  %n.addr = alloca i32, align 4
  %w.addr = alloca double, align 8
  %open.addr = alloca i1, align 1
  %mood.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Out, %struct.Out* %Out.obj, i32 0, i32 0, i32 0
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  store i64 0, i64* %1, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 1
  store i64 1, i64* %2, align 8, !alias.scope !13, !noalias !14, !tbaa !25
  %3 = getelementptr inbounds %struct.Out, %struct.Out* %Out.obj, i32 0, i32 0, i32 1, i64 0
  %4 = bitcast i32* %3 to i8*
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !13, !noalias !14, !tbaa !26
  %6 = getelementptr inbounds %struct.Out, %struct.Out* %Out.obj, i32 0, i32 1, i32 0
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 0, i64* %7, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 1, i64* %8, align 8, !alias.scope !13, !noalias !14, !tbaa !25
  %9 = getelementptr inbounds %struct.Out, %struct.Out* %Out.obj, i32 0, i32 1, i32 1, i64 0
  %10 = bitcast double* %9 to i8*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !13, !noalias !14, !tbaa !26
  %12 = getelementptr inbounds %struct.Out, %struct.Out* %Out.obj, i32 0, i32 2, i32 0
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  store i64 0, i64* %13, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 1
  store i64 1, i64* %14, align 8, !alias.scope !13, !noalias !14, !tbaa !25
  %15 = getelementptr inbounds %struct.Out, %struct.Out* %Out.obj, i32 0, i32 2, i32 1, i64 0
  %16 = bitcast i1* %15 to i8*
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  store i8* %16, i8** %17, align 8, !alias.scope !13, !noalias !14, !tbaa !26
  %18 = getelementptr inbounds %struct.Out, %struct.Out* %Out.obj, i32 0, i32 3, i32 0
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  store i64 0, i64* %19, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 1
  store i64 1, i64* %20, align 8, !alias.scope !13, !noalias !14, !tbaa !25
  %21 = getelementptr inbounds %struct.Out, %struct.Out* %Out.obj, i32 0, i32 3, i32 1, i64 0
  %22 = bitcast i32* %21 to i8*
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  store i8* %22, i8** %23, align 8, !alias.scope !13, !noalias !14, !tbaa !26
  call void @Out.constructor(%struct.Out* %Out.obj)
  store %struct.Out* %Out.obj, %struct.Out** %out.addr, align 8
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %24, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %25, align 8, !alias.scope !13, !noalias !14, !tbaa !25
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %26, align 8, !alias.scope !13, !noalias !14, !tbaa !26
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %held.addr, align 8
  %27 = call i64 @nish.regionWith$i32$$Room$fn.4.make(i32 4)
  store i64 %27, i64* %r.addr, align 8
  %28 = load i64, i64* %r.addr, align 8
  %29 = call i32 @nish.enter$$Room$i32$fn.3.nOf(i64 %28)
  store i32 %29, i32* %n.addr, align 4
  %30 = load i64, i64* %r.addr, align 8
  %31 = call double @nish.enter$$Room$f64$fn.3.wOf(i64 %30)
  store double %31, double* %w.addr, align 8
  %32 = load i64, i64* %r.addr, align 8
  %33 = call i1 @nish.enter$$Room$bool$fn.6.openOf(i64 %32)
  store i1 %33, i1* %open.addr, align 1
  %34 = load i64, i64* %r.addr, align 8
  %35 = call i32 @nish.enter$$Room$en$Mood$fn.6.moodOf(i64 %34)
  store i32 %35, i32* %mood.addr, align 4
  %36 = load i64, i64* %r.addr, align 8
  %37 = load %struct.Out*, %struct.Out** %out.addr, align 8
  %38 = call i32 @nish.enterWith$$Room$$Out$i32$fn.7.copyOut(i64 %36, %struct.Out* %37)
  %39 = load %struct.nish_array*, %struct.nish_array** %held.addr, align 8
  %40 = call i64 @nish.regionWith$i32$$Room$fn.4.make(i32 3)
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 0
  %42 = load i64, i64* %41, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 1
  %44 = load i64, i64* %43, align 8, !alias.scope !13, !noalias !14, !tbaa !25
  %45 = icmp eq i64 %42, %44
  br i1 %45, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %39, i64 8)
  br label %push.store

push.store:
  %46 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 2
  %47 = load i8*, i8** %46, align 8, !alias.scope !13, !noalias !14, !tbaa !26
  %48 = bitcast i8* %47 to i64*
  %49 = getelementptr inbounds i64, i64* %48, i64 %42
  store i64 %40, i64* %49, align 8, !alias.scope !14, !noalias !13, !tbaa !30
  %50 = add i64 %42, 1
  store i64 %50, i64* %41, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %51 = trunc i64 %50 to i32
  %52 = load i64, i64* %r.addr, align 8
  call void @nish.free$$Room(i64 %52)
  %53 = call i32 @churn()
  %54 = icmp sgt i32 %53, 0
  %55 = select i1 %54, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  call void @nish_print(i8* %55)
  %56 = load i32, i32* %n.addr, align 4
  %57 = call i8* @nish_str_from_i32(i32 %56)
  %58 = call i8* @nish_str_concat(i8* %57, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %59 = load double, double* %w.addr, align 8
  %60 = call i8* @nish_str_from_f64(double %59)
  %61 = call i8* @nish_str_concat(i8* %58, i8* %60)
  %62 = call i8* @nish_str_concat(i8* %61, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %63 = load i1, i1* %open.addr, align 1
  %64 = select i1 %63, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %65 = call i8* @nish_str_concat(i8* %62, i8* %64)
  %66 = call i8* @nish_str_concat(i8* %65, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %67 = load i32, i32* %mood.addr, align 4
  %68 = icmp eq i32 %67, 1
  %69 = select i1 %68, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %70 = call i8* @nish_str_concat(i8* %66, i8* %69)
  call void @nish_print(i8* %70)
  %71 = load %struct.Out*, %struct.Out** %out.addr, align 8
  %72 = getelementptr inbounds %struct.Out, %struct.Out* %71, i32 0, i32 0, i32 0
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %72, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %75 = icmp ult i64 0, %74
  br i1 %75, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %74)
  unreachable

bounds.ok:
  %76 = getelementptr inbounds %struct.Out, %struct.Out* %71, i32 0, i32 0, i32 1, i64 0
  %77 = bitcast i32* %76 to i8*
  %78 = bitcast i8* %77 to i32*
  %79 = getelementptr inbounds i32, i32* %78, i64 0
  %80 = load i32, i32* %79, align 4, !alias.scope !14, !noalias !13, !tbaa !16
  %81 = call i8* @nish_str_from_i32(i32 %80)
  %82 = call i8* @nish_str_concat(i8* %81, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %83 = load %struct.Out*, %struct.Out** %out.addr, align 8
  %84 = getelementptr inbounds %struct.Out, %struct.Out* %83, i32 0, i32 1, i32 0
  %85 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %84, i64 0, i32 0
  %86 = load i64, i64* %85, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %87 = icmp ult i64 0, %86
  br i1 %87, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %86)
  unreachable

bounds.ok.1:
  %88 = getelementptr inbounds %struct.Out, %struct.Out* %83, i32 0, i32 1, i32 1, i64 0
  %89 = bitcast double* %88 to i8*
  %90 = bitcast i8* %89 to double*
  %91 = getelementptr inbounds double, double* %90, i64 0
  %92 = load double, double* %91, align 8, !alias.scope !14, !noalias !13, !tbaa !22
  %93 = call i8* @nish_str_from_f64(double %92)
  %94 = call i8* @nish_str_concat(i8* %82, i8* %93)
  %95 = call i8* @nish_str_concat(i8* %94, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %96 = load %struct.Out*, %struct.Out** %out.addr, align 8
  %97 = getelementptr inbounds %struct.Out, %struct.Out* %96, i32 0, i32 2, i32 0
  %98 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %97, i64 0, i32 0
  %99 = load i64, i64* %98, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %100 = icmp ult i64 0, %99
  br i1 %100, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %99)
  unreachable

bounds.ok.2:
  %101 = getelementptr inbounds %struct.Out, %struct.Out* %96, i32 0, i32 2, i32 1, i64 0
  %102 = bitcast i1* %101 to i8*
  %103 = bitcast i8* %102 to i1*
  %104 = getelementptr inbounds i1, i1* %103, i64 0
  %105 = load i1, i1* %104, align 1, !alias.scope !14, !noalias !13, !tbaa !24
  %106 = select i1 %105, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %107 = call i8* @nish_str_concat(i8* %95, i8* %106)
  %108 = call i8* @nish_str_concat(i8* %107, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %109 = load %struct.Out*, %struct.Out** %out.addr, align 8
  %110 = getelementptr inbounds %struct.Out, %struct.Out* %109, i32 0, i32 3, i32 0
  %111 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %110, i64 0, i32 0
  %112 = load i64, i64* %111, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %113 = icmp ult i64 0, %112
  br i1 %113, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 0, i64 %112)
  unreachable

bounds.ok.3:
  %114 = getelementptr inbounds %struct.Out, %struct.Out* %109, i32 0, i32 3, i32 1, i64 0
  %115 = bitcast i32* %114 to i8*
  %116 = bitcast i8* %115 to i32*
  %117 = getelementptr inbounds i32, i32* %116, i64 0
  %118 = load i32, i32* %117, align 4, !alias.scope !14, !noalias !13, !tbaa !16
  %119 = icmp eq i32 %118, 1
  %120 = select i1 %119, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %121 = call i8* @nish_str_concat(i8* %108, i8* %120)
  call void @nish_print(i8* %121)
  %122 = load %struct.nish_array*, %struct.nish_array** %held.addr, align 8
  %123 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %122, i64 0, i32 0
  %124 = load i64, i64* %123, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %125 = icmp ult i64 0, %124
  br i1 %125, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 0, i64 %124)
  unreachable

bounds.ok.4:
  %126 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %122, i64 0, i32 2
  %127 = load i8*, i8** %126, align 8, !alias.scope !13, !noalias !14, !tbaa !26
  %128 = bitcast i8* %127 to i64*
  %129 = getelementptr inbounds i64, i64* %128, i64 0
  %130 = load i64, i64* %129, align 8, !alias.scope !14, !noalias !13, !tbaa !30
  %131 = call i32 @nish.enter$$Room$i32$fn.3.nOf(i64 %130)
  %132 = call i8* @nish_str_from_i32(i32 %131)
  call void @nish_print(i8* %132)
  %133 = load %struct.nish_array*, %struct.nish_array** %held.addr, align 8
  %134 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %133, i64 0, i32 0
  %135 = load i64, i64* %134, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  %136 = icmp ult i64 0, %135
  br i1 %136, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 0, i64 %135)
  unreachable

bounds.ok.5:
  %137 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %133, i64 0, i32 2
  %138 = load i8*, i8** %137, align 8, !alias.scope !13, !noalias !14, !tbaa !26
  %139 = bitcast i8* %138 to i64*
  %140 = getelementptr inbounds i64, i64* %139, i64 0
  %141 = load i64, i64* %140, align 8, !alias.scope !14, !noalias !13, !tbaa !30
  call void @nish.free$$Room(i64 %141)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

define internal noundef i64 @nish.handleNew() #1 {
entry:
  %0 = call i64 @nish_region_new()
  ret i64 %0
}

define internal void @nish.open(i64 noundef %h) #1 {
entry:
  call i8* @nish_region_enter(i64 %h)
  ret void
}

define internal noundef i64 @nish.regionWith$i32$$Room$fn.4.make(i32 noundef %arg) #1 {
entry:
  %h.addr = alloca i64, align 8
  %0 = call i64 @nish.handleNew()
  store i64 %0, i64* %h.addr, align 8
  %1 = load i64, i64* %h.addr, align 8
  call void @nish.open(i64 %1)
  %2 = load i64, i64* %h.addr, align 8
  %3 = call %struct.Room* @make$(i32 %arg)
  %4 = call i64 @nish.close$$Room(i64 %2, %struct.Room* %3)
  ret i64 %4
}

define internal noundef i32 @nish.enter$$Room$i32$fn.3.nOf(i64 noundef %r) #1 {
entry:
  %root.addr = alloca %struct.Room*, align 8
  %result.addr = alloca i32, align 4
  %0 = call %struct.Room* @nish.reopen$$Room(i64 %r)
  store %struct.Room* %0, %struct.Room** %root.addr, align 8
  %1 = load %struct.Room*, %struct.Room** %root.addr, align 8
  %2 = call i32 @nOf$(%struct.Room* %1)
  store i32 %2, i32* %result.addr, align 4
  %3 = load %struct.Room*, %struct.Room** %root.addr, align 8
  call void @nish.leave$$Room(i64 %r, %struct.Room* %3)
  %4 = load i32, i32* %result.addr, align 4
  ret i32 %4
}

define internal noundef double @nish.enter$$Room$f64$fn.3.wOf(i64 noundef %r) #1 {
entry:
  %root.addr = alloca %struct.Room*, align 8
  %result.addr = alloca double, align 8
  %0 = call %struct.Room* @nish.reopen$$Room(i64 %r)
  store %struct.Room* %0, %struct.Room** %root.addr, align 8
  %1 = load %struct.Room*, %struct.Room** %root.addr, align 8
  %2 = call double @wOf$(%struct.Room* %1)
  store double %2, double* %result.addr, align 8
  %3 = load %struct.Room*, %struct.Room** %root.addr, align 8
  call void @nish.leave$$Room(i64 %r, %struct.Room* %3)
  %4 = load double, double* %result.addr, align 8
  ret double %4
}

define internal noundef zeroext i1 @nish.enter$$Room$bool$fn.6.openOf(i64 noundef %r) #1 {
entry:
  %root.addr = alloca %struct.Room*, align 8
  %result.addr = alloca i1, align 1
  %0 = call %struct.Room* @nish.reopen$$Room(i64 %r)
  store %struct.Room* %0, %struct.Room** %root.addr, align 8
  %1 = load %struct.Room*, %struct.Room** %root.addr, align 8
  %2 = call i1 @openOf$(%struct.Room* %1)
  store i1 %2, i1* %result.addr, align 1
  %3 = load %struct.Room*, %struct.Room** %root.addr, align 8
  call void @nish.leave$$Room(i64 %r, %struct.Room* %3)
  %4 = load i1, i1* %result.addr, align 1
  ret i1 %4
}

define internal noundef i32 @nish.enter$$Room$en$Mood$fn.6.moodOf(i64 noundef %r) #1 {
entry:
  %root.addr = alloca %struct.Room*, align 8
  %result.addr = alloca i32, align 4
  %0 = call %struct.Room* @nish.reopen$$Room(i64 %r)
  store %struct.Room* %0, %struct.Room** %root.addr, align 8
  %1 = load %struct.Room*, %struct.Room** %root.addr, align 8
  %2 = call i32 @moodOf$(%struct.Room* %1)
  store i32 %2, i32* %result.addr, align 4
  %3 = load %struct.Room*, %struct.Room** %root.addr, align 8
  call void @nish.leave$$Room(i64 %r, %struct.Room* %3)
  %4 = load i32, i32* %result.addr, align 4
  ret i32 %4
}

define internal noundef i32 @nish.enterWith$$Room$$Out$i32$fn.7.copyOut(i64 noundef %r, %struct.Out* noundef nonnull align 8 dereferenceable(128) nocapture %arg) #1 {
entry:
  %root.addr = alloca %struct.Room*, align 8
  %result.addr = alloca i32, align 4
  %0 = call %struct.Room* @nish.reopen$$Room(i64 %r)
  store %struct.Room* %0, %struct.Room** %root.addr, align 8
  %1 = load %struct.Room*, %struct.Room** %root.addr, align 8
  %2 = call i32 @copyOut$(%struct.Room* %1, %struct.Out* %arg)
  store i32 %2, i32* %result.addr, align 4
  %3 = load %struct.Room*, %struct.Room** %root.addr, align 8
  call void @nish.leave$$Room(i64 %r, %struct.Room* %3)
  %4 = load i32, i32* %result.addr, align 4
  ret i32 %4
}

define internal void @nish.free$$Room(i64 noundef %_r) #1 {
entry:
  call void @nish_region_free(i64 %_r)
  ret void
}

define internal noundef i64 @nish.close$$Room(i64 noundef %h, %struct.Room* noundef nonnull align 8 dereferenceable(24) %root) #1 {
entry:
  %0 = bitcast %struct.Room* %root to i8*
  call void @nish_region_leave(i64 %h, i8* %0)
  ret i64 %h
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.Room* @nish.reopen$$Room(i64 noundef %r) #1 {
entry:
  %0 = call i8* @nish_region_enter(i64 %r)
  %1 = bitcast i8* %0 to %struct.Room*
  ret %struct.Room* %1
}

define internal void @nish.leave$$Room(i64 noundef %r, %struct.Room* noundef nonnull align 8 dereferenceable(24) %root) #1 {
entry:
  %0 = bitcast %struct.Room* %root to i8*
  call void @nish_region_leave(i64 %r, i8* %0)
  ret void
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!31, !32, !33, !34, !35}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"double", !1, i64 0}
!4 = !{!"i1", !1, i64 0}
!5 = !{!"Room", !2, i64 0, !3, i64 8, !4, i64 16, !2, i64 20}
!6 = !{!5, !2, i64 0}
!7 = !{!5, !3, i64 8}
!8 = !{!5, !4, i64 16}
!9 = !{!5, !2, i64 20}
!10 = !{!"nish array"}
!11 = !{!"header", !10}
!12 = !{!"elements", !10}
!13 = !{!11}
!14 = !{!12}
!15 = !{!"element i32", !1, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{!"header i64", !1, i64 0}
!18 = !{!"header ptr", !1, i64 0}
!19 = !{!"array header", !17, i64 0, !17, i64 8, !18, i64 16}
!20 = !{!19, !17, i64 0}
!21 = !{!"element double", !1, i64 0}
!22 = !{!21, !21, i64 0}
!23 = !{!"element i1", !1, i64 0}
!24 = !{!23, !23, i64 0}
!25 = !{!19, !17, i64 8}
!26 = !{!19, !18, i64 16}
!27 = !{!"element ptr", !1, i64 0}
!28 = !{!27, !27, i64 0}
!29 = !{!"element i64", !1, i64 0}
!30 = !{!29, !29, i64 0}
!31 = !{i32 8, !"cf-protection-branch", i32 1}
!32 = !{i32 8, !"cf-protection-return", i32 1}
!33 = !{i32 8, !"branch-target-enforcement", i32 1}
!34 = !{i32 8, !"sign-return-address", i32 1}
!35 = !{i32 4, !"probe-stack", !"inline-asm"}

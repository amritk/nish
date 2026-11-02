%struct.Room = type { i32, double, i1, i32, float, i64, i8 }
%struct.Out = type { { %struct.nish_array, [1 x i32] }, { %struct.nish_array, [1 x double] }, { %struct.nish_array, [1 x i1] }, { %struct.nish_array, [1 x i32] }, { %struct.nish_array, [1 x float] }, { %struct.nish_array, [1 x i64] }, { %struct.nish_array, [1 x i8] } }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef i64 @nish_region_new() #1
declare i8* @nish_region_enter(i64 noundef) #1
declare void @nish_region_leave(i64 noundef, i8*) #1
declare void @nish_region_free(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5
declare { i64, i1 } @llvm.smul.with.overflow.i64(i64, i64) #5

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

define internal void @Room.constructor(%struct.Room* noundef nonnull noalias align 8 dereferenceable(48) nocapture %this, i32 noundef %n) #0 {
entry:
  %0 = getelementptr inbounds %struct.Room, %struct.Room* %this, i32 0, i32 0
  store i32 %n, i32* %0, align 4, !tbaa !9
  %1 = sitofp i32 %n to double
  %2 = fdiv double %1, 0x4010000000000000
  %3 = getelementptr inbounds %struct.Room, %struct.Room* %this, i32 0, i32 1
  store double %2, double* %3, align 8, !tbaa !10
  %4 = srem i32 %n, 2
  %5 = icmp eq i32 %4, 0
  %6 = getelementptr inbounds %struct.Room, %struct.Room* %this, i32 0, i32 2
  store i1 %5, i1* %6, align 1, !tbaa !11
  %7 = icmp sgt i32 %n, 2
  br i1 %7, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %8 = phi i32 [ 1, %cond.true ], [ 0, %cond.false ]
  %9 = getelementptr inbounds %struct.Room, %struct.Room* %this, i32 0, i32 3
  store i32 %8, i32* %9, align 4, !tbaa !12
  %10 = sitofp i32 %n to float
  %11 = fdiv float %10, 0x4020000000000000
  %12 = getelementptr inbounds %struct.Room, %struct.Room* %this, i32 0, i32 4
  store float %11, float* %12, align 4, !tbaa !13
  %13 = sext i32 %n to i64
  %14 = call { i64, i1 } @llvm.smul.with.overflow.i64(i64 %13, i64 1000000000000)
  %15 = extractvalue { i64, i1 } %14, 0
  %16 = extractvalue { i64, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok

ovf.ok:
  %17 = getelementptr inbounds %struct.Room, %struct.Room* %this, i32 0, i32 5
  store i64 %15, i64* %17, align 8, !tbaa !14
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %n, i32 250)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %21 = trunc i32 %19 to i8
  %22 = getelementptr inbounds %struct.Room, %struct.Room* %this, i32 0, i32 6
  store i8 %21, i8* %22, align 1, !tbaa !15
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 2, %cond.end ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @Out.constructor(%struct.Out* noundef nonnull noalias align 8 dereferenceable(224) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Out, %struct.Out* %this, i32 0, i32 0, i32 0
  %1 = getelementptr inbounds %struct.Out, %struct.Out* %this, i32 0, i32 0, i32 1, i64 0
  %2 = bitcast i32* %1 to i8*
  %3 = bitcast i8* %2 to i32*
  %4 = getelementptr inbounds i32, i32* %3, i64 0
  store i32 0, i32* %4, align 4, !alias.scope !20, !noalias !19, !tbaa !22
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  store i64 1, i64* %5, align 8, !alias.scope !19, !noalias !20, !tbaa !26
  %6 = getelementptr inbounds %struct.Out, %struct.Out* %this, i32 0, i32 1, i32 0
  %7 = getelementptr inbounds %struct.Out, %struct.Out* %this, i32 0, i32 1, i32 1, i64 0
  %8 = bitcast double* %7 to i8*
  %9 = bitcast i8* %8 to double*
  %10 = getelementptr inbounds double, double* %9, i64 0
  store double 0x0000000000000000, double* %10, align 8, !alias.scope !20, !noalias !19, !tbaa !28
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 1, i64* %11, align 8, !alias.scope !19, !noalias !20, !tbaa !26
  %12 = getelementptr inbounds %struct.Out, %struct.Out* %this, i32 0, i32 2, i32 0
  %13 = getelementptr inbounds %struct.Out, %struct.Out* %this, i32 0, i32 2, i32 1, i64 0
  %14 = bitcast i1* %13 to i8*
  %15 = bitcast i8* %14 to i1*
  %16 = getelementptr inbounds i1, i1* %15, i64 0
  store i1 false, i1* %16, align 1, !alias.scope !20, !noalias !19, !tbaa !30
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  store i64 1, i64* %17, align 8, !alias.scope !19, !noalias !20, !tbaa !26
  %18 = getelementptr inbounds %struct.Out, %struct.Out* %this, i32 0, i32 3, i32 0
  %19 = getelementptr inbounds %struct.Out, %struct.Out* %this, i32 0, i32 3, i32 1, i64 0
  %20 = bitcast i32* %19 to i8*
  %21 = bitcast i8* %20 to i32*
  %22 = getelementptr inbounds i32, i32* %21, i64 0
  store i32 0, i32* %22, align 4, !alias.scope !20, !noalias !19, !tbaa !22
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  store i64 1, i64* %23, align 8, !alias.scope !19, !noalias !20, !tbaa !26
  %24 = getelementptr inbounds %struct.Out, %struct.Out* %this, i32 0, i32 4, i32 0
  %25 = getelementptr inbounds %struct.Out, %struct.Out* %this, i32 0, i32 4, i32 1, i64 0
  %26 = bitcast float* %25 to i8*
  %27 = bitcast i8* %26 to float*
  %28 = getelementptr inbounds float, float* %27, i64 0
  store float 0x0000000000000000, float* %28, align 4, !alias.scope !20, !noalias !19, !tbaa !32
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  store i64 1, i64* %29, align 8, !alias.scope !19, !noalias !20, !tbaa !26
  %30 = getelementptr inbounds %struct.Out, %struct.Out* %this, i32 0, i32 5, i32 0
  %31 = getelementptr inbounds %struct.Out, %struct.Out* %this, i32 0, i32 5, i32 1, i64 0
  %32 = bitcast i64* %31 to i8*
  %33 = bitcast i8* %32 to i64*
  %34 = getelementptr inbounds i64, i64* %33, i64 0
  store i64 0, i64* %34, align 8, !alias.scope !20, !noalias !19, !tbaa !34
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 0
  store i64 1, i64* %35, align 8, !alias.scope !19, !noalias !20, !tbaa !26
  %36 = getelementptr inbounds %struct.Out, %struct.Out* %this, i32 0, i32 6, i32 0
  %37 = getelementptr inbounds %struct.Out, %struct.Out* %this, i32 0, i32 6, i32 1, i64 0
  %38 = bitcast i8* %37 to i8*
  %39 = bitcast i8* %38 to i8*
  %40 = getelementptr inbounds i8, i8* %39, i64 0
  store i8 0, i8* %40, align 1, !alias.scope !20, !noalias !19, !tbaa !36
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  store i64 1, i64* %41, align 8, !alias.scope !19, !noalias !20, !tbaa !26
  ret void
}

define hidden noundef nonnull align 8 dereferenceable(48) %struct.Room* @make$(i32 noundef %n) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 48)
  %1 = bitcast i8* %0 to %struct.Room*
  call void @Room.constructor(%struct.Room* %1, i32 %n)
  ret %struct.Room* %1
}

define hidden noundef i32 @copyOut$(%struct.Room* noundef nonnull readonly align 8 dereferenceable(48) nocapture %room, %struct.Out* noundef nonnull align 8 dereferenceable(224) nocapture %out) #0 {
entry:
  %0 = getelementptr inbounds %struct.Out, %struct.Out* %out, i32 0, i32 0, i32 0
  %1 = getelementptr inbounds %struct.Room, %struct.Room* %room, i32 0, i32 0
  %2 = load i32, i32* %1, align 4, !tbaa !9
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !19, !noalias !20, !tbaa !26
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
  store i32 %2, i32* %9, align 4, !alias.scope !20, !noalias !19, !tbaa !22
  %10 = getelementptr inbounds %struct.Out, %struct.Out* %out, i32 0, i32 1, i32 0
  %11 = getelementptr inbounds %struct.Room, %struct.Room* %room, i32 0, i32 1
  %12 = load double, double* %11, align 8, !tbaa !10
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !19, !noalias !20, !tbaa !26
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
  store double %12, double* %19, align 8, !alias.scope !20, !noalias !19, !tbaa !28
  %20 = getelementptr inbounds %struct.Out, %struct.Out* %out, i32 0, i32 2, i32 0
  %21 = getelementptr inbounds %struct.Room, %struct.Room* %room, i32 0, i32 2
  %22 = load i1, i1* %21, align 1, !tbaa !11
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !19, !noalias !20, !tbaa !26
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
  store i1 %22, i1* %29, align 1, !alias.scope !20, !noalias !19, !tbaa !30
  %30 = getelementptr inbounds %struct.Out, %struct.Out* %out, i32 0, i32 3, i32 0
  %31 = getelementptr inbounds %struct.Room, %struct.Room* %room, i32 0, i32 3
  %32 = load i32, i32* %31, align 4, !tbaa !12
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !19, !noalias !20, !tbaa !26
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
  store i32 %32, i32* %39, align 4, !alias.scope !20, !noalias !19, !tbaa !22
  %40 = getelementptr inbounds %struct.Out, %struct.Out* %out, i32 0, i32 4, i32 0
  %41 = getelementptr inbounds %struct.Room, %struct.Room* %room, i32 0, i32 4
  %42 = load float, float* %41, align 4, !tbaa !13
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 0
  %44 = load i64, i64* %43, align 8, !alias.scope !19, !noalias !20, !tbaa !26
  %45 = icmp ult i64 0, %44
  br i1 %45, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 0, i64 %44)
  unreachable

bounds.ok.4:
  %46 = getelementptr inbounds %struct.Out, %struct.Out* %out, i32 0, i32 4, i32 1, i64 0
  %47 = bitcast float* %46 to i8*
  %48 = bitcast i8* %47 to float*
  %49 = getelementptr inbounds float, float* %48, i64 0
  store float %42, float* %49, align 4, !alias.scope !20, !noalias !19, !tbaa !32
  %50 = getelementptr inbounds %struct.Out, %struct.Out* %out, i32 0, i32 5, i32 0
  %51 = getelementptr inbounds %struct.Room, %struct.Room* %room, i32 0, i32 5
  %52 = load i64, i64* %51, align 8, !tbaa !14
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %50, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !19, !noalias !20, !tbaa !26
  %55 = icmp ult i64 0, %54
  br i1 %55, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 0, i64 %54)
  unreachable

bounds.ok.5:
  %56 = getelementptr inbounds %struct.Out, %struct.Out* %out, i32 0, i32 5, i32 1, i64 0
  %57 = bitcast i64* %56 to i8*
  %58 = bitcast i8* %57 to i64*
  %59 = getelementptr inbounds i64, i64* %58, i64 0
  store i64 %52, i64* %59, align 8, !alias.scope !20, !noalias !19, !tbaa !34
  %60 = getelementptr inbounds %struct.Out, %struct.Out* %out, i32 0, i32 6, i32 0
  %61 = getelementptr inbounds %struct.Room, %struct.Room* %room, i32 0, i32 6
  %62 = load i8, i8* %61, align 1, !tbaa !15
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 0
  %64 = load i64, i64* %63, align 8, !alias.scope !19, !noalias !20, !tbaa !26
  %65 = icmp ult i64 0, %64
  br i1 %65, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @nish_panic_index(i64 0, i64 %64)
  unreachable

bounds.ok.6:
  %66 = getelementptr inbounds %struct.Out, %struct.Out* %out, i32 0, i32 6, i32 1, i64 0
  %67 = bitcast i8* %66 to i8*
  %68 = bitcast i8* %67 to i8*
  %69 = getelementptr inbounds i8, i8* %68, i64 0
  store i8 %62, i8* %69, align 1, !alias.scope !20, !noalias !19, !tbaa !36
  %70 = getelementptr inbounds %struct.Room, %struct.Room* %room, i32 0, i32 0
  %71 = load i32, i32* %70, align 4, !tbaa !9
  ret i32 %71
}

define hidden noundef i32 @nOf$(%struct.Room* noundef nonnull readonly align 8 dereferenceable(48) nocapture %room) #2 {
entry:
  %0 = getelementptr inbounds %struct.Room, %struct.Room* %room, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !9
  ret i32 %1
}

define hidden noundef double @wOf$(%struct.Room* noundef nonnull readonly align 8 dereferenceable(48) nocapture %room) #2 {
entry:
  %0 = getelementptr inbounds %struct.Room, %struct.Room* %room, i32 0, i32 1
  %1 = load double, double* %0, align 8, !tbaa !10
  ret double %1
}

define hidden noundef zeroext i1 @openOf$(%struct.Room* noundef nonnull readonly align 8 dereferenceable(48) nocapture %room) #2 {
entry:
  %0 = getelementptr inbounds %struct.Room, %struct.Room* %room, i32 0, i32 2
  %1 = load i1, i1* %0, align 1, !tbaa !11
  ret i1 %1
}

define hidden noundef i32 @moodOf$(%struct.Room* noundef nonnull readonly align 8 dereferenceable(48) nocapture %room) #2 {
entry:
  %0 = getelementptr inbounds %struct.Room, %struct.Room* %room, i32 0, i32 3
  %1 = load i32, i32* %0, align 4, !tbaa !12
  ret i32 %1
}

define hidden noundef float @hOf$(%struct.Room* noundef nonnull readonly align 8 dereferenceable(48) nocapture %room) #2 {
entry:
  %0 = getelementptr inbounds %struct.Room, %struct.Room* %room, i32 0, i32 4
  %1 = load float, float* %0, align 4, !tbaa !13
  ret float %1
}

define hidden noundef i64 @bigOf$(%struct.Room* noundef nonnull readonly align 8 dereferenceable(48) nocapture %room) #2 {
entry:
  %0 = getelementptr inbounds %struct.Room, %struct.Room* %room, i32 0, i32 5
  %1 = load i64, i64* %0, align 8, !tbaa !14
  ret i64 %1
}

define hidden noundef i8 @bOf$(%struct.Room* noundef nonnull readonly align 8 dereferenceable(48) nocapture %room) #2 {
entry:
  %0 = getelementptr inbounds %struct.Room, %struct.Room* %room, i32 0, i32 6
  %1 = load i8, i8* %0, align 1, !tbaa !15
  ret i8 %1
}

define internal noundef i32 @churn() #1 {
entry:
  %t.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !19, !noalias !20, !tbaa !26
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !19, !noalias !20, !tbaa !37
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !19, !noalias !20, !tbaa !38
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
  %9 = load i64, i64* %8, align 8, !alias.scope !19, !noalias !20, !tbaa !26
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %11 = load i64, i64* %10, align 8, !alias.scope !19, !noalias !20, !tbaa !37
  %12 = icmp eq i64 %9, %11
  br i1 %12, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 8)
  br label %push.store

push.store:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !19, !noalias !20, !tbaa !38
  %15 = bitcast i8* %14 to i8**
  %16 = getelementptr inbounds i8*, i8** %15, i64 %9
  store i8* %7, i8** %16, align 8, !alias.scope !20, !noalias !19, !tbaa !40
  %17 = add i64 %9, 1
  store i64 %17, i64* %8, align 8, !alias.scope !19, !noalias !20, !tbaa !26
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
  %23 = load i64, i64* %22, align 8, !alias.scope !19, !noalias !20, !tbaa !26
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
  %33 = load i8*, i8** %32, align 8, !alias.scope !19, !noalias !20, !tbaa !38
  %34 = bitcast i8* %33 to i8**
  %35 = getelementptr inbounds i8*, i8** %34, i64 %30
  %36 = load i8*, i8** %35, align 8, !alias.scope !20, !noalias !19, !tbaa !40
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
  %57 = load i8*, i8** %56, align 8, !alias.scope !19, !noalias !20, !tbaa !38
  %58 = bitcast i8* %57 to i8**
  %59 = getelementptr inbounds i8*, i8** %58, i64 %49
  %60 = load i8*, i8** %59, align 8, !alias.scope !20, !noalias !19, !tbaa !40
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

define noundef i32 @nish_main() #0 {
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
  %h.addr = alloca float, align 4
  %big.addr = alloca i64, align 8
  %b.addr = alloca i8, align 1
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Out, %struct.Out* %Out.obj, i32 0, i32 0, i32 0
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  store i64 0, i64* %1, align 8, !alias.scope !19, !noalias !20, !tbaa !26
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 1
  store i64 1, i64* %2, align 8, !alias.scope !19, !noalias !20, !tbaa !37
  %3 = getelementptr inbounds %struct.Out, %struct.Out* %Out.obj, i32 0, i32 0, i32 1, i64 0
  %4 = bitcast i32* %3 to i8*
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !19, !noalias !20, !tbaa !38
  %6 = getelementptr inbounds %struct.Out, %struct.Out* %Out.obj, i32 0, i32 1, i32 0
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  store i64 0, i64* %7, align 8, !alias.scope !19, !noalias !20, !tbaa !26
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 1
  store i64 1, i64* %8, align 8, !alias.scope !19, !noalias !20, !tbaa !37
  %9 = getelementptr inbounds %struct.Out, %struct.Out* %Out.obj, i32 0, i32 1, i32 1, i64 0
  %10 = bitcast double* %9 to i8*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  store i8* %10, i8** %11, align 8, !alias.scope !19, !noalias !20, !tbaa !38
  %12 = getelementptr inbounds %struct.Out, %struct.Out* %Out.obj, i32 0, i32 2, i32 0
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  store i64 0, i64* %13, align 8, !alias.scope !19, !noalias !20, !tbaa !26
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 1
  store i64 1, i64* %14, align 8, !alias.scope !19, !noalias !20, !tbaa !37
  %15 = getelementptr inbounds %struct.Out, %struct.Out* %Out.obj, i32 0, i32 2, i32 1, i64 0
  %16 = bitcast i1* %15 to i8*
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  store i8* %16, i8** %17, align 8, !alias.scope !19, !noalias !20, !tbaa !38
  %18 = getelementptr inbounds %struct.Out, %struct.Out* %Out.obj, i32 0, i32 3, i32 0
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  store i64 0, i64* %19, align 8, !alias.scope !19, !noalias !20, !tbaa !26
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 1
  store i64 1, i64* %20, align 8, !alias.scope !19, !noalias !20, !tbaa !37
  %21 = getelementptr inbounds %struct.Out, %struct.Out* %Out.obj, i32 0, i32 3, i32 1, i64 0
  %22 = bitcast i32* %21 to i8*
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 2
  store i8* %22, i8** %23, align 8, !alias.scope !19, !noalias !20, !tbaa !38
  %24 = getelementptr inbounds %struct.Out, %struct.Out* %Out.obj, i32 0, i32 4, i32 0
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  store i64 0, i64* %25, align 8, !alias.scope !19, !noalias !20, !tbaa !26
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 1
  store i64 1, i64* %26, align 8, !alias.scope !19, !noalias !20, !tbaa !37
  %27 = getelementptr inbounds %struct.Out, %struct.Out* %Out.obj, i32 0, i32 4, i32 1, i64 0
  %28 = bitcast float* %27 to i8*
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  store i8* %28, i8** %29, align 8, !alias.scope !19, !noalias !20, !tbaa !38
  %30 = getelementptr inbounds %struct.Out, %struct.Out* %Out.obj, i32 0, i32 5, i32 0
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 0
  store i64 0, i64* %31, align 8, !alias.scope !19, !noalias !20, !tbaa !26
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 1
  store i64 1, i64* %32, align 8, !alias.scope !19, !noalias !20, !tbaa !37
  %33 = getelementptr inbounds %struct.Out, %struct.Out* %Out.obj, i32 0, i32 5, i32 1, i64 0
  %34 = bitcast i64* %33 to i8*
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 2
  store i8* %34, i8** %35, align 8, !alias.scope !19, !noalias !20, !tbaa !38
  %36 = getelementptr inbounds %struct.Out, %struct.Out* %Out.obj, i32 0, i32 6, i32 0
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  store i64 0, i64* %37, align 8, !alias.scope !19, !noalias !20, !tbaa !26
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 1
  store i64 1, i64* %38, align 8, !alias.scope !19, !noalias !20, !tbaa !37
  %39 = getelementptr inbounds %struct.Out, %struct.Out* %Out.obj, i32 0, i32 6, i32 1, i64 0
  %40 = bitcast i8* %39 to i8*
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 2
  store i8* %40, i8** %41, align 8, !alias.scope !19, !noalias !20, !tbaa !38
  call void @Out.constructor(%struct.Out* %Out.obj)
  store %struct.Out* %Out.obj, %struct.Out** %out.addr, align 8
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %42, align 8, !alias.scope !19, !noalias !20, !tbaa !26
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %43, align 8, !alias.scope !19, !noalias !20, !tbaa !37
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %44, align 8, !alias.scope !19, !noalias !20, !tbaa !38
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %held.addr, align 8
  %45 = call i64 @nish.regionWith$i32$$Room$fn.4.make(i32 4)
  store i64 %45, i64* %r.addr, align 8
  %46 = load i64, i64* %r.addr, align 8
  %47 = call i32 @nish.enter$$Room$i32$fn.3.nOf(i64 %46)
  store i32 %47, i32* %n.addr, align 4
  %48 = load i64, i64* %r.addr, align 8
  %49 = call double @nish.enter$$Room$f64$fn.3.wOf(i64 %48)
  store double %49, double* %w.addr, align 8
  %50 = load i64, i64* %r.addr, align 8
  %51 = call i1 @nish.enter$$Room$bool$fn.6.openOf(i64 %50)
  store i1 %51, i1* %open.addr, align 1
  %52 = load i64, i64* %r.addr, align 8
  %53 = call i32 @nish.enter$$Room$en$Mood$fn.6.moodOf(i64 %52)
  store i32 %53, i32* %mood.addr, align 4
  %54 = load i64, i64* %r.addr, align 8
  %55 = call float @nish.enter$$Room$f32$fn.3.hOf(i64 %54)
  store float %55, float* %h.addr, align 4
  %56 = load i64, i64* %r.addr, align 8
  %57 = call i64 @nish.enter$$Room$i64$fn.5.bigOf(i64 %56)
  store i64 %57, i64* %big.addr, align 8
  %58 = load i64, i64* %r.addr, align 8
  %59 = call i8 @nish.enter$$Room$u8$fn.3.bOf(i64 %58)
  store i8 %59, i8* %b.addr, align 1
  %60 = load i64, i64* %r.addr, align 8
  %61 = load %struct.Out*, %struct.Out** %out.addr, align 8
  %62 = call i32 @nish.enterWith$$Room$$Out$i32$fn.7.copyOut(i64 %60, %struct.Out* %61)
  %63 = load %struct.nish_array*, %struct.nish_array** %held.addr, align 8
  %64 = call i64 @nish.regionWith$i32$$Room$fn.4.make(i32 3)
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 0
  %66 = load i64, i64* %65, align 8, !alias.scope !19, !noalias !20, !tbaa !26
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 1
  %68 = load i64, i64* %67, align 8, !alias.scope !19, !noalias !20, !tbaa !37
  %69 = icmp eq i64 %66, %68
  br i1 %69, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %63, i64 8)
  br label %push.store

push.store:
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 2
  %71 = load i8*, i8** %70, align 8, !alias.scope !19, !noalias !20, !tbaa !38
  %72 = bitcast i8* %71 to i64*
  %73 = getelementptr inbounds i64, i64* %72, i64 %66
  store i64 %64, i64* %73, align 8, !alias.scope !20, !noalias !19, !tbaa !34
  %74 = add i64 %66, 1
  store i64 %74, i64* %65, align 8, !alias.scope !19, !noalias !20, !tbaa !26
  %75 = trunc i64 %74 to i32
  %76 = load i64, i64* %r.addr, align 8
  call void @nish.free$$Room(i64 %76)
  %77 = call i32 @churn()
  %78 = icmp sgt i32 %77, 0
  %79 = select i1 %78, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  call void @nish_print(i8* %79)
  %80 = load i32, i32* %n.addr, align 4
  %81 = call i8* @nish_str_from_i32(i32 %80)
  %82 = call i8* @nish_str_concat(i8* %81, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %83 = load double, double* %w.addr, align 8
  %84 = call i8* @nish_str_from_f64(double %83)
  %85 = call i8* @nish_str_concat(i8* %82, i8* %84)
  %86 = call i8* @nish_str_concat(i8* %85, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %87 = load i1, i1* %open.addr, align 1
  %88 = select i1 %87, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %89 = call i8* @nish_str_concat(i8* %86, i8* %88)
  %90 = call i8* @nish_str_concat(i8* %89, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %91 = load i32, i32* %mood.addr, align 4
  %92 = icmp eq i32 %91, 1
  %93 = select i1 %92, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %94 = call i8* @nish_str_concat(i8* %90, i8* %93)
  call void @nish_print(i8* %94)
  %95 = load %struct.Out*, %struct.Out** %out.addr, align 8
  %96 = getelementptr inbounds %struct.Out, %struct.Out* %95, i32 0, i32 0, i32 0
  %97 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %96, i64 0, i32 0
  %98 = load i64, i64* %97, align 8, !alias.scope !19, !noalias !20, !tbaa !26
  %99 = icmp ult i64 0, %98
  br i1 %99, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %98)
  unreachable

bounds.ok:
  %100 = getelementptr inbounds %struct.Out, %struct.Out* %95, i32 0, i32 0, i32 1, i64 0
  %101 = bitcast i32* %100 to i8*
  %102 = bitcast i8* %101 to i32*
  %103 = getelementptr inbounds i32, i32* %102, i64 0
  %104 = load i32, i32* %103, align 4, !alias.scope !20, !noalias !19, !tbaa !22
  %105 = call i8* @nish_str_from_i32(i32 %104)
  %106 = call i8* @nish_str_concat(i8* %105, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %107 = load %struct.Out*, %struct.Out** %out.addr, align 8
  %108 = getelementptr inbounds %struct.Out, %struct.Out* %107, i32 0, i32 1, i32 0
  %109 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %108, i64 0, i32 0
  %110 = load i64, i64* %109, align 8, !alias.scope !19, !noalias !20, !tbaa !26
  %111 = icmp ult i64 0, %110
  br i1 %111, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %110)
  unreachable

bounds.ok.1:
  %112 = getelementptr inbounds %struct.Out, %struct.Out* %107, i32 0, i32 1, i32 1, i64 0
  %113 = bitcast double* %112 to i8*
  %114 = bitcast i8* %113 to double*
  %115 = getelementptr inbounds double, double* %114, i64 0
  %116 = load double, double* %115, align 8, !alias.scope !20, !noalias !19, !tbaa !28
  %117 = call i8* @nish_str_from_f64(double %116)
  %118 = call i8* @nish_str_concat(i8* %106, i8* %117)
  %119 = call i8* @nish_str_concat(i8* %118, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %120 = load %struct.Out*, %struct.Out** %out.addr, align 8
  %121 = getelementptr inbounds %struct.Out, %struct.Out* %120, i32 0, i32 2, i32 0
  %122 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %121, i64 0, i32 0
  %123 = load i64, i64* %122, align 8, !alias.scope !19, !noalias !20, !tbaa !26
  %124 = icmp ult i64 0, %123
  br i1 %124, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 0, i64 %123)
  unreachable

bounds.ok.2:
  %125 = getelementptr inbounds %struct.Out, %struct.Out* %120, i32 0, i32 2, i32 1, i64 0
  %126 = bitcast i1* %125 to i8*
  %127 = bitcast i8* %126 to i1*
  %128 = getelementptr inbounds i1, i1* %127, i64 0
  %129 = load i1, i1* %128, align 1, !alias.scope !20, !noalias !19, !tbaa !30
  %130 = select i1 %129, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %131 = call i8* @nish_str_concat(i8* %119, i8* %130)
  %132 = call i8* @nish_str_concat(i8* %131, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %133 = load %struct.Out*, %struct.Out** %out.addr, align 8
  %134 = getelementptr inbounds %struct.Out, %struct.Out* %133, i32 0, i32 3, i32 0
  %135 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %134, i64 0, i32 0
  %136 = load i64, i64* %135, align 8, !alias.scope !19, !noalias !20, !tbaa !26
  %137 = icmp ult i64 0, %136
  br i1 %137, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 0, i64 %136)
  unreachable

bounds.ok.3:
  %138 = getelementptr inbounds %struct.Out, %struct.Out* %133, i32 0, i32 3, i32 1, i64 0
  %139 = bitcast i32* %138 to i8*
  %140 = bitcast i8* %139 to i32*
  %141 = getelementptr inbounds i32, i32* %140, i64 0
  %142 = load i32, i32* %141, align 4, !alias.scope !20, !noalias !19, !tbaa !22
  %143 = icmp eq i32 %142, 1
  %144 = select i1 %143, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  %145 = call i8* @nish_str_concat(i8* %132, i8* %144)
  call void @nish_print(i8* %145)
  %146 = load float, float* %h.addr, align 4
  %147 = fpext float %146 to double
  %148 = call i8* @nish_str_from_f64(double %147)
  %149 = call i8* @nish_str_concat(i8* %148, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %150 = load i64, i64* %big.addr, align 8
  %151 = call i8* @nish_str_from_i64(i64 %150)
  %152 = call i8* @nish_str_concat(i8* %149, i8* %151)
  %153 = call i8* @nish_str_concat(i8* %152, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %154 = load i8, i8* %b.addr, align 1
  %155 = zext i8 %154 to i64
  %156 = call i8* @nish_str_from_u64(i64 %155)
  %157 = call i8* @nish_str_concat(i8* %153, i8* %156)
  call void @nish_print(i8* %157)
  %158 = load %struct.Out*, %struct.Out** %out.addr, align 8
  %159 = getelementptr inbounds %struct.Out, %struct.Out* %158, i32 0, i32 4, i32 0
  %160 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %159, i64 0, i32 0
  %161 = load i64, i64* %160, align 8, !alias.scope !19, !noalias !20, !tbaa !26
  %162 = icmp ult i64 0, %161
  br i1 %162, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 0, i64 %161)
  unreachable

bounds.ok.4:
  %163 = getelementptr inbounds %struct.Out, %struct.Out* %158, i32 0, i32 4, i32 1, i64 0
  %164 = bitcast float* %163 to i8*
  %165 = bitcast i8* %164 to float*
  %166 = getelementptr inbounds float, float* %165, i64 0
  %167 = load float, float* %166, align 4, !alias.scope !20, !noalias !19, !tbaa !32
  %168 = fpext float %167 to double
  %169 = call i8* @nish_str_from_f64(double %168)
  %170 = call i8* @nish_str_concat(i8* %169, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %171 = load %struct.Out*, %struct.Out** %out.addr, align 8
  %172 = getelementptr inbounds %struct.Out, %struct.Out* %171, i32 0, i32 5, i32 0
  %173 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %172, i64 0, i32 0
  %174 = load i64, i64* %173, align 8, !alias.scope !19, !noalias !20, !tbaa !26
  %175 = icmp ult i64 0, %174
  br i1 %175, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 0, i64 %174)
  unreachable

bounds.ok.5:
  %176 = getelementptr inbounds %struct.Out, %struct.Out* %171, i32 0, i32 5, i32 1, i64 0
  %177 = bitcast i64* %176 to i8*
  %178 = bitcast i8* %177 to i64*
  %179 = getelementptr inbounds i64, i64* %178, i64 0
  %180 = load i64, i64* %179, align 8, !alias.scope !20, !noalias !19, !tbaa !34
  %181 = call i8* @nish_str_from_i64(i64 %180)
  %182 = call i8* @nish_str_concat(i8* %170, i8* %181)
  %183 = call i8* @nish_str_concat(i8* %182, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %184 = load %struct.Out*, %struct.Out** %out.addr, align 8
  %185 = getelementptr inbounds %struct.Out, %struct.Out* %184, i32 0, i32 6, i32 0
  %186 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %185, i64 0, i32 0
  %187 = load i64, i64* %186, align 8, !alias.scope !19, !noalias !20, !tbaa !26
  %188 = icmp ult i64 0, %187
  br i1 %188, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @nish_panic_index(i64 0, i64 %187)
  unreachable

bounds.ok.6:
  %189 = getelementptr inbounds %struct.Out, %struct.Out* %184, i32 0, i32 6, i32 1, i64 0
  %190 = bitcast i8* %189 to i8*
  %191 = bitcast i8* %190 to i8*
  %192 = getelementptr inbounds i8, i8* %191, i64 0
  %193 = load i8, i8* %192, align 1, !alias.scope !20, !noalias !19, !tbaa !36
  %194 = zext i8 %193 to i64
  %195 = call i8* @nish_str_from_u64(i64 %194)
  %196 = call i8* @nish_str_concat(i8* %183, i8* %195)
  call void @nish_print(i8* %196)
  %197 = load %struct.nish_array*, %struct.nish_array** %held.addr, align 8
  %198 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %197, i64 0, i32 0
  %199 = load i64, i64* %198, align 8, !alias.scope !19, !noalias !20, !tbaa !26
  %200 = icmp ult i64 0, %199
  br i1 %200, label %bounds.ok.7, label %bounds.fail.7

bounds.fail.7:
  call void @nish_panic_index(i64 0, i64 %199)
  unreachable

bounds.ok.7:
  %201 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %197, i64 0, i32 2
  %202 = load i8*, i8** %201, align 8, !alias.scope !19, !noalias !20, !tbaa !38
  %203 = bitcast i8* %202 to i64*
  %204 = getelementptr inbounds i64, i64* %203, i64 0
  %205 = load i64, i64* %204, align 8, !alias.scope !20, !noalias !19, !tbaa !34
  %206 = call i32 @nish.enter$$Room$i32$fn.3.nOf(i64 %205)
  %207 = call i8* @nish_str_from_i32(i32 %206)
  call void @nish_print(i8* %207)
  %208 = load %struct.nish_array*, %struct.nish_array** %held.addr, align 8
  %209 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %208, i64 0, i32 0
  %210 = load i64, i64* %209, align 8, !alias.scope !19, !noalias !20, !tbaa !26
  %211 = icmp ult i64 0, %210
  br i1 %211, label %bounds.ok.8, label %bounds.fail.8

bounds.fail.8:
  call void @nish_panic_index(i64 0, i64 %210)
  unreachable

bounds.ok.8:
  %212 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %208, i64 0, i32 2
  %213 = load i8*, i8** %212, align 8, !alias.scope !19, !noalias !20, !tbaa !38
  %214 = bitcast i8* %213 to i64*
  %215 = getelementptr inbounds i64, i64* %214, i64 0
  %216 = load i64, i64* %215, align 8, !alias.scope !20, !noalias !19, !tbaa !34
  call void @nish.free$$Room(i64 %216)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

define internal noundef i64 @nish.handleNew() #0 {
entry:
  %0 = call i64 @nish_region_new()
  ret i64 %0
}

define internal void @nish.open(i64 noundef %h) #0 {
entry:
  call i8* @nish_region_enter(i64 %h)
  ret void
}

define internal noundef i64 @nish.regionWith$i32$$Room$fn.4.make(i32 noundef %arg) #0 {
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

define internal noundef i32 @nish.enter$$Room$i32$fn.3.nOf(i64 noundef %r) #0 {
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

define internal noundef double @nish.enter$$Room$f64$fn.3.wOf(i64 noundef %r) #0 {
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

define internal noundef zeroext i1 @nish.enter$$Room$bool$fn.6.openOf(i64 noundef %r) #0 {
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

define internal noundef i32 @nish.enter$$Room$en$Mood$fn.6.moodOf(i64 noundef %r) #0 {
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

define internal noundef float @nish.enter$$Room$f32$fn.3.hOf(i64 noundef %r) #0 {
entry:
  %root.addr = alloca %struct.Room*, align 8
  %result.addr = alloca float, align 4
  %0 = call %struct.Room* @nish.reopen$$Room(i64 %r)
  store %struct.Room* %0, %struct.Room** %root.addr, align 8
  %1 = load %struct.Room*, %struct.Room** %root.addr, align 8
  %2 = call float @hOf$(%struct.Room* %1)
  store float %2, float* %result.addr, align 4
  %3 = load %struct.Room*, %struct.Room** %root.addr, align 8
  call void @nish.leave$$Room(i64 %r, %struct.Room* %3)
  %4 = load float, float* %result.addr, align 4
  ret float %4
}

define internal noundef i64 @nish.enter$$Room$i64$fn.5.bigOf(i64 noundef %r) #0 {
entry:
  %root.addr = alloca %struct.Room*, align 8
  %result.addr = alloca i64, align 8
  %0 = call %struct.Room* @nish.reopen$$Room(i64 %r)
  store %struct.Room* %0, %struct.Room** %root.addr, align 8
  %1 = load %struct.Room*, %struct.Room** %root.addr, align 8
  %2 = call i64 @bigOf$(%struct.Room* %1)
  store i64 %2, i64* %result.addr, align 8
  %3 = load %struct.Room*, %struct.Room** %root.addr, align 8
  call void @nish.leave$$Room(i64 %r, %struct.Room* %3)
  %4 = load i64, i64* %result.addr, align 8
  ret i64 %4
}

define internal noundef i8 @nish.enter$$Room$u8$fn.3.bOf(i64 noundef %r) #0 {
entry:
  %root.addr = alloca %struct.Room*, align 8
  %result.addr = alloca i8, align 1
  %0 = call %struct.Room* @nish.reopen$$Room(i64 %r)
  store %struct.Room* %0, %struct.Room** %root.addr, align 8
  %1 = load %struct.Room*, %struct.Room** %root.addr, align 8
  %2 = call i8 @bOf$(%struct.Room* %1)
  store i8 %2, i8* %result.addr, align 1
  %3 = load %struct.Room*, %struct.Room** %root.addr, align 8
  call void @nish.leave$$Room(i64 %r, %struct.Room* %3)
  %4 = load i8, i8* %result.addr, align 1
  ret i8 %4
}

define internal noundef i32 @nish.enterWith$$Room$$Out$i32$fn.7.copyOut(i64 noundef %r, %struct.Out* noundef nonnull align 8 dereferenceable(224) nocapture %arg) #0 {
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

define internal void @nish.free$$Room(i64 noundef %_r) #0 {
entry:
  call void @nish_region_free(i64 %_r)
  ret void
}

define internal noundef i64 @nish.close$$Room(i64 noundef %h, %struct.Room* noundef nonnull align 8 dereferenceable(48) %root) #0 {
entry:
  %0 = bitcast %struct.Room* %root to i8*
  call void @nish_region_leave(i64 %h, i8* %0)
  ret i64 %h
}

define internal noundef nonnull align 8 dereferenceable(48) %struct.Room* @nish.reopen$$Room(i64 noundef %r) #0 {
entry:
  %0 = call i8* @nish_region_enter(i64 %r)
  %1 = bitcast i8* %0 to %struct.Room*
  ret %struct.Room* %1
}

define internal void @nish.leave$$Room(i64 noundef %r, %struct.Room* noundef nonnull align 8 dereferenceable(48) %root) #0 {
entry:
  %0 = bitcast %struct.Room* %root to i8*
  call void @nish_region_leave(i64 %r, i8* %0)
  ret void
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #5 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!41, !42, !43, !44, !45}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"double", !1, i64 0}
!4 = !{!"i1", !1, i64 0}
!5 = !{!"float", !1, i64 0}
!6 = !{!"i64", !1, i64 0}
!7 = !{!"i8", !1, i64 0}
!8 = !{!"Room", !2, i64 0, !3, i64 8, !4, i64 16, !2, i64 20, !5, i64 24, !6, i64 32, !7, i64 40}
!9 = !{!8, !2, i64 0}
!10 = !{!8, !3, i64 8}
!11 = !{!8, !4, i64 16}
!12 = !{!8, !2, i64 20}
!13 = !{!8, !5, i64 24}
!14 = !{!8, !6, i64 32}
!15 = !{!8, !7, i64 40}
!16 = !{!"nish array"}
!17 = !{!"header", !16}
!18 = !{!"elements", !16}
!19 = !{!17}
!20 = !{!18}
!21 = !{!"element i32", !1, i64 0}
!22 = !{!21, !21, i64 0}
!23 = !{!"header i64", !1, i64 0}
!24 = !{!"header ptr", !1, i64 0}
!25 = !{!"array header", !23, i64 0, !23, i64 8, !24, i64 16}
!26 = !{!25, !23, i64 0}
!27 = !{!"element double", !1, i64 0}
!28 = !{!27, !27, i64 0}
!29 = !{!"element i1", !1, i64 0}
!30 = !{!29, !29, i64 0}
!31 = !{!"element float", !1, i64 0}
!32 = !{!31, !31, i64 0}
!33 = !{!"element i64", !1, i64 0}
!34 = !{!33, !33, i64 0}
!35 = !{!"element i8", !1, i64 0}
!36 = !{!35, !35, i64 0}
!37 = !{!25, !23, i64 8}
!38 = !{!25, !24, i64 16}
!39 = !{!"element ptr", !1, i64 0}
!40 = !{!39, !39, i64 0}
!41 = !{i32 8, !"cf-protection-branch", i32 1}
!42 = !{i32 8, !"cf-protection-return", i32 1}
!43 = !{i32 8, !"branch-target-enforcement", i32 1}
!44 = !{i32 8, !"sign-return-address", i32 1}
!45 = !{i32 4, !"probe-stack", !"inline-asm"}

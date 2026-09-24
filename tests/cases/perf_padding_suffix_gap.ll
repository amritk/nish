%struct.Four = type { i32 }
%struct.FourGap = type { i32, double, i32, double }
%struct.One = type { i1 }
%struct.OneGap = type { i1, double, i1, i32, double }
%struct.Item = type { i32 }
%struct.Mixed = type { i1, i16, i8*, i8, %struct.nish_array*, float, %struct.Item*, i64 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #2 {
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

define void @Mixed.constructor(%struct.Mixed* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %this, i32 0, i32 0
  store i1 false, i1* %0, align 1
  %1 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %this, i32 0, i32 1
  store i16 0, i16* %1, align 2
  %2 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %this, i32 0, i32 2
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %2, align 8
  %3 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %this, i32 0, i32 3
  store i8 0, i8* %3, align 1
  %4 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %this, i32 0, i32 5
  store float 0x0000000000000000, float* %4, align 4
  %5 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %this, i32 0, i32 6
  store %struct.Item* null, %struct.Item** %5, align 8
  %6 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %this, i32 0, i32 7
  store i64 0, i64* %6, align 8
  %7 = call i8* @nish_alloc_struct(i64 24)
  %8 = bitcast i8* %7 to %struct.nish_array*
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  store i64 0, i64* %9, align 8, !alias.scope !3, !noalias !4
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 1
  store i64 0, i64* %10, align 8, !alias.scope !3, !noalias !4
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  store i8* null, i8** %11, align 8, !alias.scope !3, !noalias !4
  %12 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %this, i32 0, i32 4
  store %struct.nish_array* %8, %struct.nish_array** %12, align 8
  ret void
}

define noundef i32 @test() #0 {
entry:
  %four.addr = alloca %struct.FourGap*, align 8
  %FourGap.obj = alloca %struct.FourGap, align 8
  %one.addr = alloca %struct.OneGap*, align 8
  %OneGap.obj = alloca %struct.OneGap, align 8
  %mixed.addr = alloca %struct.Mixed*, align 8
  %Mixed.obj = alloca %struct.Mixed, align 8
  %view.addr = alloca %struct.One*, align 8
  %0 = getelementptr inbounds %struct.FourGap, %struct.FourGap* %FourGap.obj, i32 0, i32 0
  store i32 0, i32* %0, align 4
  %1 = getelementptr inbounds %struct.FourGap, %struct.FourGap* %FourGap.obj, i32 0, i32 1
  store double 0x0000000000000000, double* %1, align 8
  %2 = getelementptr inbounds %struct.FourGap, %struct.FourGap* %FourGap.obj, i32 0, i32 2
  store i32 0, i32* %2, align 4
  %3 = getelementptr inbounds %struct.FourGap, %struct.FourGap* %FourGap.obj, i32 0, i32 3
  store double 0x0000000000000000, double* %3, align 8
  store %struct.FourGap* %FourGap.obj, %struct.FourGap** %four.addr, align 8
  %4 = load %struct.FourGap*, %struct.FourGap** %four.addr, align 8
  %5 = getelementptr inbounds %struct.FourGap, %struct.FourGap* %4, i32 0, i32 2
  store i32 2, i32* %5, align 4
  %6 = getelementptr inbounds %struct.OneGap, %struct.OneGap* %OneGap.obj, i32 0, i32 0
  store i1 false, i1* %6, align 1
  %7 = getelementptr inbounds %struct.OneGap, %struct.OneGap* %OneGap.obj, i32 0, i32 1
  store double 0x0000000000000000, double* %7, align 8
  %8 = getelementptr inbounds %struct.OneGap, %struct.OneGap* %OneGap.obj, i32 0, i32 2
  store i1 false, i1* %8, align 1
  %9 = getelementptr inbounds %struct.OneGap, %struct.OneGap* %OneGap.obj, i32 0, i32 3
  store i32 0, i32* %9, align 4
  %10 = getelementptr inbounds %struct.OneGap, %struct.OneGap* %OneGap.obj, i32 0, i32 4
  store double 0x0000000000000000, double* %10, align 8
  store %struct.OneGap* %OneGap.obj, %struct.OneGap** %one.addr, align 8
  %11 = load %struct.OneGap*, %struct.OneGap** %one.addr, align 8
  %12 = getelementptr inbounds %struct.OneGap, %struct.OneGap* %11, i32 0, i32 3
  store i32 3, i32* %12, align 4
  call void @Mixed.constructor(%struct.Mixed* %Mixed.obj)
  store %struct.Mixed* %Mixed.obj, %struct.Mixed** %mixed.addr, align 8
  %13 = load %struct.Mixed*, %struct.Mixed** %mixed.addr, align 8
  %14 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %13, i32 0, i32 3
  store i8 4, i8* %14, align 1
  %15 = load %struct.Mixed*, %struct.Mixed** %mixed.addr, align 8
  %16 = bitcast %struct.Mixed* %15 to %struct.One*
  store %struct.One* %16, %struct.One** %view.addr, align 8
  %17 = load %struct.FourGap*, %struct.FourGap** %four.addr, align 8
  %18 = getelementptr inbounds %struct.FourGap, %struct.FourGap* %17, i32 0, i32 2
  %19 = load i32, i32* %18, align 4
  %20 = load %struct.OneGap*, %struct.OneGap** %one.addr, align 8
  %21 = getelementptr inbounds %struct.OneGap, %struct.OneGap* %20, i32 0, i32 3
  %22 = load i32, i32* %21, align 4
  %23 = add nsw i32 %19, %22
  %24 = load %struct.Mixed*, %struct.Mixed** %mixed.addr, align 8
  %25 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %24, i32 0, i32 3
  %26 = load i8, i8* %25, align 1
  %27 = zext i8 %26 to i32
  %28 = add nsw i32 %23, %27
  %29 = load %struct.One*, %struct.One** %view.addr, align 8
  %30 = getelementptr inbounds %struct.One, %struct.One* %29, i32 0, i32 0
  %31 = load i1, i1* %30, align 1
  br i1 %31, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %32 = phi i32 [ 1, %cond.true ], [ 0, %cond.false ]
  %33 = add nsw i32 %28, %32
  %34 = load %struct.Mixed*, %struct.Mixed** %mixed.addr, align 8
  %35 = getelementptr inbounds %struct.Mixed, %struct.Mixed* %34, i32 0, i32 4
  %36 = load %struct.nish_array*, %struct.nish_array** %35, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4
  %39 = trunc i64 %38 to i32
  %40 = add nsw i32 %33, %39
  ret i32 %40
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}

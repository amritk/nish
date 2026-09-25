%struct.Box$i32 = type { i32 }
%struct.nish_result.i32.i32 = type { i1, i32, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"four\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare void @nish_panic_index(i64 noundef, i64 noundef) #5

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

define internal noundef i32 @firstOf(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %0 = call %struct.nish_array* @identity$roarr.i32(%struct.nish_array* %xs)
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ult i64 0, %2
  br i1 %3, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %2)
  unreachable

bounds.ok:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %5 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  %8 = load i32, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  ret i32 %8
}

define void @Box$i32.constructor(%struct.Box$i32* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %v) #1 {
entry:
  %0 = getelementptr inbounds %struct.Box$i32, %struct.Box$i32* %this, i32 0, i32 0
  store i32 %v, i32* %0, align 4, !tbaa !16
  ret void
}

define noundef i32 @Box$i32.get(%struct.Box$i32* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this) #2 {
entry:
  %0 = getelementptr inbounds %struct.Box$i32, %struct.Box$i32* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !16
  ret i32 %1
}

define internal noundef i32 @orZero(%struct.Box$i32* noundef align 8 %b) #2 {
entry:
  %same.addr = alloca %struct.Box$i32*, align 8
  %0 = call %struct.Box$i32* @identity$opt.$Box$i32(%struct.Box$i32* %b)
  store %struct.Box$i32* %0, %struct.Box$i32** %same.addr, align 8
  %1 = load %struct.Box$i32*, %struct.Box$i32** %same.addr, align 8
  %2 = icmp ne %struct.Box$i32* %1, null
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = load %struct.Box$i32*, %struct.Box$i32** %same.addr, align 8
  %4 = getelementptr inbounds %struct.Box$i32, %struct.Box$i32* %3, i32 0, i32 0
  %5 = load i32, i32* %4, align 4, !tbaa !16
  ret i32 %5

if.end:
  ret i32 0
}

define internal noundef i32 @okOr({ i1, i32, i32 } %r, i32 noundef %other) #1 {
entry:
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %same.addr = alloca %struct.nish_result.i32.i32*, align 8
  %nish_result.i32.i32.obj.1 = alloca %struct.nish_result.i32.i32, align 8
  %0 = extractvalue { i1, i32, i32 } %r, 0
  %1 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 %0, i1* %1, align 1
  %2 = extractvalue { i1, i32, i32 } %r, 1
  %3 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %2, i32* %3, align 4
  %4 = extractvalue { i1, i32, i32 } %r, 2
  %5 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  store i32 %4, i32* %5, align 4
  %6 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  %7 = load i1, i1* %6, align 1
  %8 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  %9 = load i32, i32* %8, align 4
  %10 = zext i32 %9 to i64
  %11 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  %12 = load i32, i32* %11, align 4
  %13 = zext i32 %12 to i64
  %14 = select i1 %7, i64 %13, i64 %10
  %15 = shl i64 %14, 32
  %16 = zext i1 %7 to i64
  %17 = or i64 %15, %16
  %18 = call i64 @identity$res.i32.i32(i64 %17)
  %19 = trunc i64 %18 to i1
  %20 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 0
  store i1 %19, i1* %20, align 1
  %21 = lshr i64 %18, 32
  %22 = trunc i64 %21 to i32
  %23 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 1
  store i32 %22, i32* %23, align 4
  %24 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 2
  store i32 %22, i32* %24, align 4
  store %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, %struct.nish_result.i32.i32** %same.addr, align 8
  %25 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %same.addr, align 8
  %26 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %25, i32 0, i32 0
  %27 = load i1, i1* %26, align 1
  br i1 %27, label %if.then, label %if.end

if.then:
  %28 = load %struct.nish_result.i32.i32*, %struct.nish_result.i32.i32** %same.addr, align 8
  %29 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %28, i32 0, i32 1
  %30 = load i32, i32* %29, align 4
  ret i32 %30

if.end:
  ret i32 %other
}

define noundef i32 @test() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %box.addr = alloca %struct.Box$i32*, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 3, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 3, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !17
  %4 = call i8* @nish_alloc_struct(i64 12)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 4, i32* %7, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 5, i32* %8, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 6, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !13
  store %struct.nish_array* %1, %struct.nish_array** %xs.addr, align 8
  %10 = call i8* @nish_alloc_struct(i64 4)
  %11 = bitcast i8* %10 to %struct.Box$i32*
  call void @Box$i32.constructor(%struct.Box$i32* %11, i32 20)
  %12 = call %struct.Box$i32* @identity$$Box$i32(%struct.Box$i32* %11)
  store %struct.Box$i32* %12, %struct.Box$i32** %box.addr, align 8
  %13 = call i32 @identity$i32(i32 1)
  %14 = call i8* @identity$str(i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*))
  %15 = bitcast i8* %14 to i64*
  %16 = load i64, i64* %15, align 8
  %17 = trunc i64 %16 to i32
  %18 = add nsw i32 %13, %17
  %19 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %20 = call %struct.nish_array* @identity$arr.i32(%struct.nish_array* %19)
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %23 = trunc i64 %22 to i32
  %24 = add nsw i32 %18, %23
  %25 = load %struct.Box$i32*, %struct.Box$i32** %box.addr, align 8
  %26 = call i32 @Box$i32.get(%struct.Box$i32* %25)
  %27 = add nsw i32 %24, %26
  %28 = load %struct.Box$i32*, %struct.Box$i32** %box.addr, align 8
  %29 = call i32 @orZero(%struct.Box$i32* %28)
  %30 = add nsw i32 %27, %29
  %31 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %32 = call i32 @firstOf(%struct.nish_array* %31)
  %33 = add nsw i32 %30, %32
  %34 = insertvalue { i1, i32, i32 } { i1 true, i32 undef, i32 undef }, i32 3, 1
  %35 = call i32 @okOr({ i1, i32, i32 } %34, i32 0)
  %36 = add nsw i32 %33, %35
  ret i32 %36
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @identity$roarr.i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %x) #3 {
entry:
  ret %struct.nish_array* %x
}

define noundef align 8 %struct.Box$i32* @identity$opt.$Box$i32(%struct.Box$i32* noundef align 8 %x) #3 {
entry:
  ret %struct.Box$i32* %x
}

define noundef i64 @identity$res.i32.i32(i64 noundef %x) #3 {
entry:
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %0 = trunc i64 %x to i1
  %1 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 %0, i1* %1, align 1
  %2 = lshr i64 %x, 32
  %3 = trunc i64 %2 to i32
  %4 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %3, i32* %4, align 4
  %5 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  store i32 %3, i32* %5, align 4
  %6 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  %7 = load i1, i1* %6, align 1
  %8 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  %9 = load i32, i32* %8, align 4
  %10 = zext i32 %9 to i64
  %11 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  %12 = load i32, i32* %11, align 4
  %13 = zext i32 %12 to i64
  %14 = select i1 %7, i64 %13, i64 %10
  %15 = shl i64 %14, 32
  %16 = zext i1 %7 to i64
  %17 = or i64 %15, %16
  ret i64 %17
}

define noundef nonnull align 8 dereferenceable(4) %struct.Box$i32* @identity$$Box$i32(%struct.Box$i32* noundef nonnull align 8 dereferenceable(4) %x) #3 {
entry:
  ret %struct.Box$i32* %x
}

define noundef i32 @identity$i32(i32 noundef %x) #3 {
entry:
  ret i32 %x
}

define noundef nonnull align 8 i8* @identity$str(i8* noundef nonnull noalias readonly align 8 %x) #3 {
entry:
  ret i8* %x
}

define noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @identity$arr.i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %x) #3 {
entry:
  ret %struct.nish_array* %x
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn readonly }
attributes #3 = { nounwind willreturn readnone }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) }
attributes #5 = { nounwind noreturn cold }
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
!11 = !{!9, !8, i64 16}
!12 = !{!"element i32", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!"i32", !6, i64 0}
!15 = !{!"Box$i32", !14, i64 0}
!16 = !{!15, !14, i64 0}
!17 = !{!9, !7, i64 8}

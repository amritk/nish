%struct.Random = type { i32 }
%struct.ArrayTree = type { %struct.nish_array* }
%struct.Storage = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef i64 @nish_arena_used() #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare void @nish_panic_div(i1 noundef zeroext) #3

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
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

define internal noundef i32 @Random.next(%struct.Random* noundef nonnull align 8 dereferenceable(4) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Random, %struct.Random* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  %2 = mul nsw i32 %1, 1309
  %3 = add nsw i32 %2, 13849
  %4 = and i32 %3, 65535
  %5 = getelementptr inbounds %struct.Random, %struct.Random* %this, i32 0, i32 0
  store i32 %4, i32* %5, align 4, !tbaa !4
  %6 = getelementptr inbounds %struct.Random, %struct.Random* %this, i32 0, i32 0
  %7 = load i32, i32* %6, align 4, !tbaa !4
  ret i32 %7
}

define internal void @ArrayTree.constructor(%struct.ArrayTree* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %children) #0 {
entry:
  %0 = getelementptr inbounds %struct.ArrayTree, %struct.ArrayTree* %this, i32 0, i32 0
  store %struct.nish_array* %children, %struct.nish_array** %0, align 8, !tbaa !7
  ret void
}

define internal noundef i32 @Storage.benchmark(%struct.Storage* noundef nonnull align 8 dereferenceable(4) nocapture %this) #1 {
entry:
  %random.addr = alloca %struct.Random*, align 8
  %Random.obj = alloca %struct.Random, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Random, %struct.Random* %Random.obj, i32 0, i32 0
  store i32 74755, i32* %0, align 4, !tbaa !4
  store %struct.Random* %Random.obj, %struct.Random** %random.addr, align 8
  %1 = getelementptr inbounds %struct.Storage, %struct.Storage* %this, i32 0, i32 0
  store i32 0, i32* %1, align 4, !tbaa !9
  %2 = load %struct.Random*, %struct.Random** %random.addr, align 8
  %3 = call %struct.nish_array* @Storage.buildTreeDepth(%struct.Storage* %this, i32 5, %struct.Random* %2)
  %4 = getelementptr inbounds %struct.Storage, %struct.Storage* %this, i32 0, i32 0
  %5 = load i32, i32* %4, align 4, !tbaa !9
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %5
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @Storage.buildTreeDepth(%struct.Storage* noundef nonnull align 8 dereferenceable(4) nocapture %this, i32 noundef %depth, %struct.Random* noundef nonnull align 8 dereferenceable(4) nocapture %random) #1 {
entry:
  %arr.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Storage, %struct.Storage* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = add nsw i32 %1, 1
  store i32 %2, i32* %0, align 4
  %3 = icmp eq i32 %depth, 1
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = call i32 @Random.next(%struct.Random* %random)
  %5 = icmp eq i32 10, 0
  %6 = icmp eq i32 %4, -2147483648
  %7 = icmp eq i32 10, -1
  %8 = and i1 %6, %7
  %9 = or i1 %5, %8
  br i1 %9, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %5)
  unreachable

div.ok:
  %10 = srem i32 %4, 10
  %11 = add nsw i32 %10, 1
  %12 = sext i32 %11 to i64
  %13 = call i8* @nish_alloc_struct(i64 24)
  %14 = bitcast i8* %13 to %struct.nish_array*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  store i64 %12, i64* %15, align 8, !alias.scope !13, !noalias !14
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  store i64 %12, i64* %16, align 8, !alias.scope !13, !noalias !14
  %17 = mul i64 %12, 8
  %18 = call i8* @nish_alloc_struct(i64 %17)
  call void @llvm.memset.p0i8.i64(i8* align 8 %18, i8 0, i64 %17, i1 false), !alias.scope !14, !noalias !13
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  store i8* %18, i8** %19, align 8, !alias.scope !13, !noalias !14
  ret %struct.nish_array* %14

if.end:
  %20 = call i8* @nish_alloc_struct(i64 24)
  %21 = bitcast i8* %20 to %struct.nish_array*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  store i64 4, i64* %22, align 8, !alias.scope !13, !noalias !14
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 1
  store i64 4, i64* %23, align 8, !alias.scope !13, !noalias !14
  %24 = mul i64 4, 8
  %25 = call i8* @nish_alloc_struct(i64 %24)
  call void @llvm.memset.p0i8.i64(i8* align 8 %25, i8 0, i64 %24, i1 false), !alias.scope !14, !noalias !13
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 2
  store i8* %25, i8** %26, align 8, !alias.scope !13, !noalias !14
  store %struct.nish_array* %21, %struct.nish_array** %arr.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %27 = load %struct.nish_array*, %struct.nish_array** %arr.addr, align 8
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !13, !noalias !14
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  %31 = load i8*, i8** %30, align 8, !alias.scope !13, !noalias !14
  br label %for.cond

for.cond:
  %32 = load i32, i32* %i.addr, align 4
  %33 = icmp slt i32 %32, 4
  br i1 %33, label %for.body, label %for.end

for.body:
  %34 = load i32, i32* %i.addr, align 4
  %35 = sext i32 %34 to i64
  %36 = call i8* @nish_alloc_struct(i64 8)
  %37 = bitcast i8* %36 to %struct.ArrayTree*
  %38 = sub nsw i32 %depth, 1
  %39 = call %struct.nish_array* @Storage.buildTreeDepth(%struct.Storage* %this, i32 %38, %struct.Random* %random)
  call void @ArrayTree.constructor(%struct.ArrayTree* %37, %struct.nish_array* %39)
  %40 = icmp ult i64 %35, %29
  br i1 %40, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %35, i64 %29)
  unreachable

bounds.ok:
  %41 = bitcast i8* %31 to %struct.ArrayTree**
  %42 = getelementptr inbounds %struct.ArrayTree*, %struct.ArrayTree** %41, i64 %35
  store %struct.ArrayTree* %37, %struct.ArrayTree** %42, align 8, !alias.scope !14, !noalias !13
  br label %for.inc

for.inc:
  %43 = load i32, i32* %i.addr, align 4
  %44 = add nsw i32 %43, 1
  store i32 %44, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %45 = load %struct.nish_array*, %struct.nish_array** %arr.addr, align 8
  ret %struct.nish_array* %45
}

define noundef i32 @nish_main() #1 {
entry:
  %storage.addr = alloca %struct.Storage*, align 8
  %Storage.obj = alloca %struct.Storage, align 8
  %after.addr = alloca i64, align 8
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Storage, %struct.Storage* %Storage.obj, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !9
  store %struct.Storage* %Storage.obj, %struct.Storage** %storage.addr, align 8
  %1 = load %struct.Storage*, %struct.Storage** %storage.addr, align 8
  %2 = call i32 @Storage.benchmark(%struct.Storage* %1)
  %3 = call i8* @nish_str_from_i32(i32 %2)
  call void @nish_print(i8* %3)
  %4 = call i64 @nish_arena_used()
  store i64 %4, i64* %after.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp slt i32 %5, 10000
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load %struct.Storage*, %struct.Storage** %storage.addr, align 8
  %8 = call i32 @Storage.benchmark(%struct.Storage* %7)
  br label %for.inc

for.inc:
  %9 = load i32, i32* %i.addr, align 4
  %10 = add nsw i32 %9, 1
  store i32 %10, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %11 = call i64 @nish_arena_used()
  %12 = load i64, i64* %after.addr, align 8
  %13 = icmp eq i64 %11, %12
  %14 = select i1 %13, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @nish_print(i8* %14)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Random", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"ptr", !1, i64 0}
!6 = !{!"ArrayTree", !5, i64 0}
!7 = !{!6, !5, i64 0}
!8 = !{!"Storage", !2, i64 0}
!9 = !{!8, !2, i64 0}
!10 = !{!"nish array"}
!11 = !{!"header", !10}
!12 = !{!"elements", !10}
!13 = !{!11}
!14 = !{!12}

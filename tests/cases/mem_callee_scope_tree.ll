%struct.Random = type { i32 }
%struct.ArrayTree = type { %struct.nish_array* }
%struct.Storage = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef i64 @nish_arena_used() #1
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_exit(i32 noundef) #3
declare void @nish_panic_div(i1 noundef zeroext) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #5

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

define internal noundef i32 @Random.next(%struct.Random* noundef nonnull align 8 dereferenceable(4) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Random, %struct.Random* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  %2 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %1, i32 1309)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %3, i32 13849)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %8 = and i32 %6, 65535
  %9 = getelementptr inbounds %struct.Random, %struct.Random* %this, i32 0, i32 0
  store i32 %8, i32* %9, align 4, !tbaa !4
  %10 = getelementptr inbounds %struct.Random, %struct.Random* %this, i32 0, i32 0
  %11 = load i32, i32* %10, align 4, !tbaa !4
  ret i32 %11

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @ArrayTree.constructor(%struct.ArrayTree* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %children) #1 {
entry:
  %0 = getelementptr inbounds %struct.ArrayTree, %struct.ArrayTree* %this, i32 0, i32 0
  store %struct.nish_array* %children, %struct.nish_array** %0, align 8, !tbaa !7
  ret void
}

define internal noundef i32 @Storage.benchmark(%struct.Storage* noundef nonnull align 8 dereferenceable(4) nocapture %this) #0 {
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

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @Storage.buildTreeDepth(%struct.Storage* noundef nonnull align 8 dereferenceable(4) nocapture %this, i32 noundef %depth, %struct.Random* noundef nonnull align 8 dereferenceable(4) nocapture %random) #0 {
entry:
  %arr.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Storage, %struct.Storage* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %3, i32* %0, align 4
  %5 = icmp eq i32 %depth, 1
  br i1 %5, label %if.then, label %if.end

if.then:
  %6 = call i32 @Random.next(%struct.Random* %random)
  %7 = icmp eq i32 10, 0
  %8 = icmp eq i32 %6, -2147483648
  %9 = icmp eq i32 10, -1
  %10 = and i1 %8, %9
  %11 = or i1 %7, %10
  br i1 %11, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %7)
  unreachable

div.ok:
  %12 = srem i32 %6, 10
  %13 = add nsw i32 %12, 1
  %14 = sext i32 %13 to i64
  %15 = icmp ule i64 %14, 2147483647
  br i1 %15, label %len.ok, label %len.fail

len.fail:
  call void @nish_write(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

len.ok:
  %16 = call i8* @nish_alloc_struct(i64 24)
  %17 = bitcast i8* %16 to %struct.nish_array*
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  store i64 %14, i64* %18, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 1
  store i64 %14, i64* %19, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %20 = mul i64 %14, 8
  %21 = call i8* @nish_alloc_struct(i64 %20)
  call void @llvm.memset.p0i8.i64(i8* align 8 %21, i8 0, i64 %20, i1 false), !alias.scope !14, !noalias !13
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  store i8* %21, i8** %22, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  ret %struct.nish_array* %17

if.end:
  %23 = call i8* @nish_alloc_struct(i64 24)
  %24 = bitcast i8* %23 to %struct.nish_array*
  %25 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 0
  store i64 4, i64* %25, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 1
  store i64 4, i64* %26, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %27 = mul i64 4, 8
  %28 = call i8* @nish_alloc_struct(i64 %27)
  call void @llvm.memset.p0i8.i64(i8* align 8 %28, i8 0, i64 %27, i1 false), !alias.scope !14, !noalias !13
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %24, i64 0, i32 2
  store i8* %28, i8** %29, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  store %struct.nish_array* %24, %struct.nish_array** %arr.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %30 = load %struct.nish_array*, %struct.nish_array** %arr.addr, align 8
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !13, !noalias !14, !tbaa !20
  br label %for.cond

for.cond:
  %33 = load i32, i32* %i.addr, align 4
  %34 = icmp slt i32 %33, 4
  br i1 %34, label %for.body, label %for.end

for.body:
  %35 = load i32, i32* %i.addr, align 4
  %36 = sext i32 %35 to i64
  %37 = call i8* @nish_alloc_struct(i64 8)
  %38 = bitcast i8* %37 to %struct.ArrayTree*
  %39 = sub nsw i32 %depth, 1
  %40 = call %struct.nish_array* @Storage.buildTreeDepth(%struct.Storage* %this, i32 %39, %struct.Random* %random)
  call void @ArrayTree.constructor(%struct.ArrayTree* %38, %struct.nish_array* %40)
  %41 = bitcast i8* %32 to %struct.ArrayTree**
  %42 = getelementptr inbounds %struct.ArrayTree*, %struct.ArrayTree** %41, i64 %36
  store %struct.ArrayTree* %38, %struct.ArrayTree** %42, align 8, !alias.scope !14, !noalias !13, !tbaa !22
  br label %for.inc

for.inc:
  %43 = load i32, i32* %i.addr, align 4
  %44 = add nsw i32 %43, 1
  store i32 %44, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %45 = load %struct.nish_array*, %struct.nish_array** %arr.addr, align 8
  ret %struct.nish_array* %45

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #0 {
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
  %14 = select i1 %13, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*)
  call void @nish_print(i8* %14)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { noreturn nounwind }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { nounwind willreturn readnone }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

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
!15 = !{!"header i64", !1, i64 0}
!16 = !{!"header ptr", !1, i64 0}
!17 = !{!"array header", !15, i64 0, !15, i64 8, !16, i64 16}
!18 = !{!17, !15, i64 0}
!19 = !{!17, !15, i64 8}
!20 = !{!17, !16, i64 16}
!21 = !{!"element ptr", !1, i64 0}
!22 = !{!21, !21, i64 0}

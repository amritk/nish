%struct.Point = type { i32, i32 }
%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"point \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"released\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"kept\00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef i64 @nish_arena_used() #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0

define internal void @Point.constructor(%struct.Point* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %x, i32 noundef %y) #0 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  store i32 %x, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1
  store i32 %y, i32* %1, align 4, !tbaa !5
  ret void
}

define void @nish_main() #1 {
entry:
  %before.addr = alloca i64, align 8
  %total.addr = alloca i32, align 4
  %a.addr = alloca i64, align 8
  %label.addr = alloca i8*, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %p.addr = alloca %struct.Point*, align 8
  %Point.obj = alloca %struct.Point, align 8
  %after.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish_arena_used()
  store i64 %0, i64* %before.addr, align 8
  store i32 0, i32* %total.addr, align 4
  %1 = call i64 @nish_arena_mark()
  store i64 %1, i64* %a.addr, align 8
  %2 = load i64, i64* %a.addr, align 8
  %3 = load i32, i32* %total.addr, align 4
  %4 = call i8* @nish_str_from_i32(i32 %3)
  %5 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*), i8* %4)
  store i8* %5, i8** %label.addr, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %6, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %7, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %8, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %9 = load i32, i32* %i.addr, align 4
  %10 = icmp slt i32 %9, 100
  br i1 %10, label %for.body, label %for.end

for.body:
  %11 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %12 = load i32, i32* %i.addr, align 4
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 1
  %16 = load i64, i64* %15, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %17 = icmp eq i64 %14, %16
  br i1 %17, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %11, i64 4)
  br label %push.store

push.store:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %20 = bitcast i8* %19 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 %14
  store i32 %12, i32* %21, align 4, !alias.scope !10, !noalias !9, !tbaa !18
  %22 = add i64 %14, 1
  store i64 %22, i64* %13, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %23 = trunc i64 %22 to i32
  br label %for.inc

for.inc:
  %24 = load i32, i32* %i.addr, align 4
  %25 = add nsw i32 %24, 1
  store i32 %25, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %26 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %26, i64 0, i32 0
  %28 = load i64, i64* %27, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %29 = trunc i64 %28 to i32
  %30 = load i8*, i8** %label.addr, align 8
  %31 = bitcast i8* %30 to i64*
  %32 = load i64, i64* %31, align 8
  %33 = trunc i64 %32 to i32
  call void @Point.constructor(%struct.Point* %Point.obj, i32 %29, i32 %33)
  store %struct.Point* %Point.obj, %struct.Point** %p.addr, align 8
  %34 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %35 = getelementptr inbounds %struct.Point, %struct.Point* %34, i32 0, i32 0
  %36 = load i32, i32* %35, align 4, !tbaa !4
  %37 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %38 = getelementptr inbounds %struct.Point, %struct.Point* %37, i32 0, i32 1
  %39 = load i32, i32* %38, align 4, !tbaa !5
  %40 = add nsw i32 %36, %39
  store i32 %40, i32* %total.addr, align 4
  call void @nish_arena_release(i64 %2)
  %41 = call i64 @nish_arena_used()
  store i64 %41, i64* %after.addr, align 8
  %42 = load i32, i32* %total.addr, align 4
  %43 = call i8* @nish_str_from_i32(i32 %42)
  call void @nish_print(i8* %43)
  %44 = load i64, i64* %after.addr, align 8
  %45 = load i64, i64* %before.addr, align 8
  %46 = icmp eq i64 %44, %45
  br i1 %46, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %47 = phi i8* [ bitcast ({ i64, [9 x i8] }* @.str.1 to i8*), %cond.true ], [ bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), %cond.false ]
  call void @nish_print(i8* %47)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Point", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
!6 = !{!"nish array"}
!7 = !{!"header", !6}
!8 = !{!"elements", !6}
!9 = !{!7}
!10 = !{!8}
!11 = !{!"header i64", !1, i64 0}
!12 = !{!"header ptr", !1, i64 0}
!13 = !{!"array header", !11, i64 0, !11, i64 8, !12, i64 16}
!14 = !{!13, !11, i64 0}
!15 = !{!13, !11, i64 8}
!16 = !{!13, !12, i64 16}
!17 = !{!"element i32", !1, i64 0}
!18 = !{!17, !17, i64 0}

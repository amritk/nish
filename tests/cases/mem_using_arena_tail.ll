%struct.Tally = type { i8* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"inside\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"released\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"run \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef i64 @nish_arena_used() #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #3 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %in.cap = icmp ule i64 %new.off, %cap
  %bounded = icmp ule i64 %size, 4611686018427387904
  %fits = and i1 %in.cap, %bounded
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %request = select i1 %bounded, i64 %size.aligned, i64 %size
  %grown = call i8* @nish_arena_grow(i64 %request)
  ret i8* %grown
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @fill(i32 noundef %k) #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %xs.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp slt i32 %5, %k
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %8 = load i32, i32* %i.addr, align 4
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 1
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %13 = icmp eq i64 %10, %12
  br i1 %13, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %7, i64 4)
  br label %push.store

push.store:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %16 = bitcast i8* %15 to i32*
  %17 = getelementptr inbounds i32, i32* %16, i64 %10
  store i32 %8, i32* %17, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %18 = add i64 %10, 1
  store i64 %18, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = trunc i64 %18 to i32
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %22 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  ret %struct.nish_array* %22
}

define internal void @report(i64 noundef %base) #0 {
entry:
  %0 = call i64 @nish_arena_used()
  %1 = icmp sgt i64 %0, %base
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %2 = phi i8* [ bitcast ({ i64, [7 x i8] }* @.str.0 to i8*), %cond.true ], [ bitcast ({ i64, [9 x i8] }* @.str.1 to i8*), %cond.false ]
  call void @nish_print(i8* %2)
  ret void
}

define internal void @quiet(i32 noundef %n) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_from_i32(i32 %n)
  call void @nish_print(i8* %0)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal void @run(%struct.Tally* noundef nonnull align 8 dereferenceable(8) nocapture %t, i32 noundef %k, i1 noundef zeroext %loud) #0 {
entry:
  %base.addr = alloca i64, align 8
  %a.addr = alloca i64, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %0 = call i8* @nish_str_from_i32(i32 %k)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* %0)
  %2 = getelementptr inbounds %struct.Tally, %struct.Tally* %t, i32 0, i32 0
  store i8* %1, i8** %2, align 8, !tbaa !17
  %3 = call i64 @nish_arena_used()
  store i64 %3, i64* %base.addr, align 8
  %4 = call i64 @nish_arena_mark()
  store i64 %4, i64* %a.addr, align 8
  %5 = load i64, i64* %a.addr, align 8
  %6 = call %struct.nish_array* @fill(i32 %k)
  store %struct.nish_array* %6, %struct.nish_array** %xs.addr, align 8
  br i1 %loud, label %if.then, label %if.end

if.then:
  %7 = load i64, i64* %base.addr, align 8
  call void @report(i64 %7)
  call void @nish_arena_release(i64 %5)
  ret void

if.end:
  %8 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = trunc i64 %10 to i32
  call void @nish_arena_release(i64 %5)
  tail call void @quiet(i32 %11)
  ret void
}

define void @nish_main() #0 {
entry:
  %t.addr = alloca %struct.Tally*, align 8
  %Tally.obj = alloca %struct.Tally, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Tally, %struct.Tally* %Tally.obj, i32 0, i32 0
  store i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*), i8** %0, align 8, !tbaa !17
  store %struct.Tally* %Tally.obj, %struct.Tally** %t.addr, align 8
  %1 = load %struct.Tally*, %struct.Tally** %t.addr, align 8
  call void @run(%struct.Tally* %1, i32 1000, i1 true)
  %2 = load %struct.Tally*, %struct.Tally** %t.addr, align 8
  call void @run(%struct.Tally* %2, i32 1000, i1 false)
  %3 = load %struct.Tally*, %struct.Tally** %t.addr, align 8
  %4 = getelementptr inbounds %struct.Tally, %struct.Tally* %3, i32 0, i32 0
  %5 = load i8*, i8** %4, align 8, !tbaa !17
  call void @nish_print(i8* %5)
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
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) }

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
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"ptr", !6, i64 0}
!16 = !{!"Tally", !15, i64 0}
!17 = !{!16, !15, i64 0}

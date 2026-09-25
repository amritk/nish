%struct.H = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"n=\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3

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

define internal void @H.constructor(%struct.H* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  %0 = getelementptr inbounds %struct.H, %struct.H* %this, i32 0, i32 0
  store %struct.nish_array* %xs, %struct.nish_array** %0, align 8, !tbaa !4
  ret void
}

define internal void @shrink(%struct.H* noundef nonnull align 8 dereferenceable(8) nocapture %h) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 1, i64* %2, align 8, !alias.scope !8, !noalias !9
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 1, i64* %3, align 8, !alias.scope !8, !noalias !9
  %4 = call i8* @nish_alloc_struct(i64 4)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !8, !noalias !9
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 5, i32* %7, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %8 = getelementptr inbounds %struct.H, %struct.H* %h, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %8, align 8, !tbaa !4
  ret void
}

define noundef i32 @nish_main() #1 {
entry:
  %h.addr = alloca %struct.H*, align 8
  %H.obj = alloca %struct.H, align 8
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 4, i64* %2, align 8, !alias.scope !8, !noalias !9
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 4, i64* %3, align 8, !alias.scope !8, !noalias !9
  %4 = call i8* @nish_alloc_struct(i64 16)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !8, !noalias !9
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 1, i32* %7, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 2, i32* %8, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 3, i32* %9, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %10 = getelementptr inbounds i32, i32* %6, i64 3
  store i32 4, i32* %10, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  call void @H.constructor(%struct.H* %H.obj, %struct.nish_array* %1)
  store %struct.H* %H.obj, %struct.H** %h.addr, align 8
  store i32 0, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %do.body

do.body:
  %11 = load i32, i32* %n.addr, align 4
  %12 = add nsw i32 %11, 1
  store i32 %12, i32* %n.addr, align 4
  %13 = load i32, i32* %n.addr, align 4
  %14 = icmp eq i32 %13, 1
  br i1 %14, label %if.then, label %if.end

if.then:
  store i32 3, i32* %i.addr, align 4
  br label %if.end

if.end:
  %15 = load i32, i32* %i.addr, align 4
  %16 = icmp slt i32 %15, 0
  br i1 %16, label %lor.end, label %lor.rhs

lor.rhs:
  %17 = load i32, i32* %i.addr, align 4
  %18 = load %struct.H*, %struct.H** %h.addr, align 8
  %19 = getelementptr inbounds %struct.H, %struct.H* %18, i32 0, i32 0
  %20 = load %struct.nish_array*, %struct.nish_array** %19, align 8, !tbaa !4
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %20, i64 0, i32 0
  %22 = load i64, i64* %21, align 8, !alias.scope !8, !noalias !9
  %23 = trunc i64 %22 to i32
  %24 = icmp sge i32 %17, %23
  br label %lor.end

lor.end:
  %25 = phi i1 [ true, %if.end ], [ %24, %lor.rhs ]
  br i1 %25, label %if.then.1, label %if.end.1

if.then.1:
  br label %do.end

if.end.1:
  %26 = load i32, i32* %n.addr, align 4
  %27 = icmp eq i32 %26, 2
  br i1 %27, label %if.then.2, label %if.end.2

if.then.2:
  %28 = load %struct.H*, %struct.H** %h.addr, align 8
  call void @shrink(%struct.H* %28)
  br label %do.cond

if.end.2:
  br label %do.cond

do.cond:
  %29 = load %struct.H*, %struct.H** %h.addr, align 8
  %30 = getelementptr inbounds %struct.H, %struct.H* %29, i32 0, i32 0
  %31 = load %struct.nish_array*, %struct.nish_array** %30, align 8, !tbaa !4
  %32 = load i32, i32* %i.addr, align 4
  %33 = sext i32 %32 to i64
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !8, !noalias !9
  %36 = icmp ult i64 %33, %35
  br i1 %36, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %33, i64 %35)
  unreachable

bounds.ok:
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %31, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !8, !noalias !9
  %39 = bitcast i8* %38 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 %33
  %41 = load i32, i32* %40, align 4, !alias.scope !9, !noalias !8, !tbaa !11
  %42 = icmp sgt i32 %41, 0
  br i1 %42, label %land.rhs, label %land.end

land.rhs:
  %43 = load i32, i32* %n.addr, align 4
  %44 = icmp slt i32 %43, 5
  br label %land.end

land.end:
  %45 = phi i1 [ false, %bounds.ok ], [ %44, %land.rhs ]
  br i1 %45, label %do.body, label %do.end

do.end:
  %46 = load i32, i32* %n.addr, align 4
  %47 = call i8* @nish_str_from_i32(i32 %46)
  %48 = call i8* @nish_str_concat(i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8* %47)
  call void @nish_print(i8* %48)
  call void @nish_arena_release(i64 %arena.mark)
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
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"H", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"element i32", !1, i64 0}
!11 = !{!10, !10, i64 0}

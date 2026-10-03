%struct.Stack$res.i32.str = type { %struct.nish_array* }
%struct.nish_result.i32.str = type { i1, i32, i8* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"negative \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"ok \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"err \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
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

define internal noundef nonnull align 8 dereferenceable(16) %struct.nish_result.i32.str* @parse(i32 noundef %n) #0 {
entry:
  %0 = icmp slt i32 %n, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = call i8* @nish_str_from_i32(i32 %n)
  %2 = call i8* @nish_str_concat(i8* bitcast ({ i64, [10 x i8] }* @.str.0 to i8*), i8* %1)
  %3 = call i8* @nish_alloc_struct(i64 16)
  %4 = bitcast i8* %3 to %struct.nish_result.i32.str*
  %5 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %4, i32 0, i32 0
  store i1 false, i1* %5, align 1
  %6 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %4, i32 0, i32 2
  store i8* %2, i8** %6, align 8
  br label %cond.end

cond.false:
  %7 = call i8* @nish_alloc_struct(i64 16)
  %8 = bitcast i8* %7 to %struct.nish_result.i32.str*
  %9 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %8, i32 0, i32 0
  store i1 true, i1* %9, align 1
  %10 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %8, i32 0, i32 1
  store i32 %n, i32* %10, align 4
  br label %cond.end

cond.end:
  %11 = phi %struct.nish_result.i32.str* [ %4, %cond.true ], [ %8, %cond.false ]
  ret %struct.nish_result.i32.str* %11
}

define internal noundef nonnull align 8 i8* @describe(%struct.nish_result.i32.str* noundef nonnull align 8 dereferenceable(16) readonly nocapture %r) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %r, i32 0, i32 0
  %1 = load i1, i1* %0, align 1
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  %2 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %r, i32 0, i32 1
  %3 = load i32, i32* %2, align 4
  %4 = call i8* @nish_str_from_i32(i32 %3)
  %5 = call i8* @nish_str_concat(i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*), i8* %4)
  br label %cond.end

cond.false:
  %6 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %r, i32 0, i32 2
  %7 = load i8*, i8** %6, align 8
  %8 = call i8* @nish_str_concat(i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), i8* %7)
  br label %cond.end

cond.end:
  %9 = phi i8* [ %5, %cond.true ], [ %8, %cond.false ]
  ret i8* %9
}

define noundef i32 @nish_main() #0 {
entry:
  %rs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x %struct.nish_result.i32.str*], align 8
  %r2.addr = alloca %struct.nish_result.i32.str*, align 8
  %r1.addr = alloca %struct.nish_result.i32.str*, align 8
  %s.addr = alloca %struct.Stack$res.i32.str*, align 8
  %Stack$res.i32.str.obj = alloca %struct.Stack$res.i32.str, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.nish_result.i32.str* @parse(i32 1)
  %1 = call %struct.nish_result.i32.str* @parse(i32 -2)
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = bitcast [2 x %struct.nish_result.i32.str*]* %arr.data to i8*
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to %struct.nish_result.i32.str**
  %7 = getelementptr inbounds %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %6, i64 0
  store %struct.nish_result.i32.str* %0, %struct.nish_result.i32.str** %7, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %6, i64 1
  store %struct.nish_result.i32.str* %1, %struct.nish_result.i32.str** %8, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %rs.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %rs.addr, align 8
  %10 = load %struct.nish_array*, %struct.nish_array** %rs.addr, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %12 = load i8*, i8** %11, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %13 = bitcast i8* %12 to %struct.nish_result.i32.str**
  %14 = getelementptr inbounds %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %13, i64 1
  %15 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %14, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %18 = bitcast i8* %17 to %struct.nish_result.i32.str**
  %19 = getelementptr inbounds %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %18, i64 0
  store %struct.nish_result.i32.str* %15, %struct.nish_result.i32.str** %19, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %20 = call %struct.nish_result.i32.str* @parse(i32 3)
  store %struct.nish_result.i32.str* %20, %struct.nish_result.i32.str** %r2.addr, align 8
  %21 = call %struct.nish_result.i32.str* @parse(i32 -4)
  store %struct.nish_result.i32.str* %21, %struct.nish_result.i32.str** %r1.addr, align 8
  %22 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r2.addr, align 8
  %23 = call i64 @nish_arena_mark()
  %24 = call i8* @describe(%struct.nish_result.i32.str* %22)
  %25 = call i8* @nish_arena_keep(i64 %23, i8* %24)
  call void @nish_print(i8* %25)
  %26 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r1.addr, align 8
  store %struct.nish_result.i32.str* %26, %struct.nish_result.i32.str** %r2.addr, align 8
  %27 = load %struct.nish_array*, %struct.nish_array** %rs.addr, align 8
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %30 = icmp ult i64 0, %29
  br i1 %30, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %29)
  unreachable

bounds.ok:
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %33 = bitcast i8* %32 to %struct.nish_result.i32.str**
  %34 = getelementptr inbounds %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %33, i64 0
  %35 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %34, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %36 = call i64 @nish_arena_mark()
  %37 = call i8* @describe(%struct.nish_result.i32.str* %35)
  %38 = call i8* @nish_arena_keep(i64 %36, i8* %37)
  %39 = call i8* @nish_str_concat(i8* %38, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %40 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r2.addr, align 8
  %41 = call i64 @nish_arena_mark()
  %42 = call i8* @describe(%struct.nish_result.i32.str* %40)
  %43 = call i8* @nish_arena_keep(i64 %41, i8* %42)
  %44 = call i8* @nish_str_concat(i8* %39, i8* %43)
  call void @nish_print(i8* %44)
  call void @Stack$res.i32.str.constructor(%struct.Stack$res.i32.str* %Stack$res.i32.str.obj)
  store %struct.Stack$res.i32.str* %Stack$res.i32.str.obj, %struct.Stack$res.i32.str** %s.addr, align 8
  %45 = load %struct.Stack$res.i32.str*, %struct.Stack$res.i32.str** %s.addr, align 8
  %46 = call %struct.nish_result.i32.str* @parse(i32 5)
  call void @Stack$res.i32.str.push(%struct.Stack$res.i32.str* %45, %struct.nish_result.i32.str* %46)
  %47 = load %struct.Stack$res.i32.str*, %struct.Stack$res.i32.str** %s.addr, align 8
  %48 = call %struct.nish_result.i32.str* @parse(i32 -6)
  call void @Stack$res.i32.str.push(%struct.Stack$res.i32.str* %47, %struct.nish_result.i32.str* %48)
  %49 = load %struct.Stack$res.i32.str*, %struct.Stack$res.i32.str** %s.addr, align 8
  call void @Stack$res.i32.str.drop(%struct.Stack$res.i32.str* %49)
  %50 = load %struct.Stack$res.i32.str*, %struct.Stack$res.i32.str** %s.addr, align 8
  %51 = getelementptr inbounds %struct.Stack$res.i32.str, %struct.Stack$res.i32.str* %50, i32 0, i32 0
  %52 = load %struct.nish_array*, %struct.nish_array** %51, align 8, !tbaa !17
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %52, i64 0, i32 0
  %54 = load i64, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %55 = trunc i64 %54 to i32
  %56 = call i8* @nish_str_from_i32(i32 %55)
  %57 = call i8* @nish_str_concat(i8* %56, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %58 = load %struct.Stack$res.i32.str*, %struct.Stack$res.i32.str** %s.addr, align 8
  %59 = getelementptr inbounds %struct.Stack$res.i32.str, %struct.Stack$res.i32.str* %58, i32 0, i32 0
  %60 = load %struct.nish_array*, %struct.nish_array** %59, align 8, !tbaa !17
  %61 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 0
  %62 = load i64, i64* %61, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %63 = icmp ult i64 0, %62
  br i1 %63, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %62)
  unreachable

bounds.ok.1:
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %60, i64 0, i32 2
  %65 = load i8*, i8** %64, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %66 = bitcast i8* %65 to %struct.nish_result.i32.str**
  %67 = getelementptr inbounds %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %66, i64 0
  %68 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %67, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %69 = call i64 @nish_arena_mark()
  %70 = call i8* @describe(%struct.nish_result.i32.str* %68)
  %71 = call i8* @nish_arena_keep(i64 %69, i8* %70)
  %72 = call i8* @nish_str_concat(i8* %57, i8* %71)
  call void @nish_print(i8* %72)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define internal void @Stack$res.i32.str.constructor(%struct.Stack$res.i32.str* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this) #1 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %5 = getelementptr inbounds %struct.Stack$res.i32.str, %struct.Stack$res.i32.str* %this, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %5, align 8, !tbaa !17
  ret void
}

define internal void @Stack$res.i32.str.push(%struct.Stack$res.i32.str* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this, %struct.nish_result.i32.str* noundef nonnull align 8 dereferenceable(16) %item) #1 {
entry:
  %0 = getelementptr inbounds %struct.Stack$res.i32.str, %struct.Stack$res.i32.str* %this, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !17
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = icmp eq i64 %3, %5
  br i1 %6, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %1, i64 8)
  br label %push.store

push.store:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %9 = bitcast i8* %8 to %struct.nish_result.i32.str**
  %10 = getelementptr inbounds %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %9, i64 %3
  store %struct.nish_result.i32.str* %item, %struct.nish_result.i32.str** %10, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %11 = add i64 %3, 1
  store i64 %11, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = trunc i64 %11 to i32
  ret void
}

define internal void @Stack$res.i32.str.drop(%struct.Stack$res.i32.str* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Stack$res.i32.str, %struct.Stack$res.i32.str* %this, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !17
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = icmp eq i64 %3, 0
  br i1 %4, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %5 = sub i64 %3, 1
  store i64 %5, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %8 = bitcast i8* %7 to %struct.nish_result.i32.str**
  %9 = getelementptr inbounds %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %8, i64 %5
  %10 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %9, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  ret void
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
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

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
!15 = !{!"ptr", !6, i64 0}
!16 = !{!"Stack$res.i32.str", !15, i64 0}
!17 = !{!16, !15, i64 0}

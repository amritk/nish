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
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
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

define noundef i32 @nish_main() #1 {
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
  %1 = sub nsw i32 0, 2
  %2 = call %struct.nish_result.i32.str* @parse(i32 %1)
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = bitcast [2 x %struct.nish_result.i32.str*]* %arr.data to i8*
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %7 = bitcast i8* %5 to %struct.nish_result.i32.str**
  %8 = getelementptr inbounds %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %7, i64 0
  store %struct.nish_result.i32.str* %0, %struct.nish_result.i32.str** %8, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %7, i64 1
  store %struct.nish_result.i32.str* %2, %struct.nish_result.i32.str** %9, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %rs.addr, align 8
  %10 = load %struct.nish_array*, %struct.nish_array** %rs.addr, align 8
  %11 = load %struct.nish_array*, %struct.nish_array** %rs.addr, align 8
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %14 = bitcast i8* %13 to %struct.nish_result.i32.str**
  %15 = getelementptr inbounds %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %14, i64 1
  %16 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %15, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  %18 = load i8*, i8** %17, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %19 = bitcast i8* %18 to %struct.nish_result.i32.str**
  %20 = getelementptr inbounds %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %19, i64 0
  store %struct.nish_result.i32.str* %16, %struct.nish_result.i32.str** %20, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %21 = call %struct.nish_result.i32.str* @parse(i32 3)
  store %struct.nish_result.i32.str* %21, %struct.nish_result.i32.str** %r2.addr, align 8
  %22 = sub nsw i32 0, 4
  %23 = call %struct.nish_result.i32.str* @parse(i32 %22)
  store %struct.nish_result.i32.str* %23, %struct.nish_result.i32.str** %r1.addr, align 8
  %24 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r2.addr, align 8
  %25 = call i64 @nish_arena_mark()
  %26 = call i8* @describe(%struct.nish_result.i32.str* %24)
  %27 = call i8* @nish_arena_keep(i64 %25, i8* %26)
  call void @nish_print(i8* %27)
  %28 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r1.addr, align 8
  store %struct.nish_result.i32.str* %28, %struct.nish_result.i32.str** %r2.addr, align 8
  %29 = load %struct.nish_array*, %struct.nish_array** %rs.addr, align 8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = icmp ult i64 0, %31
  br i1 %32, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %31)
  unreachable

bounds.ok:
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  %34 = load i8*, i8** %33, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %35 = bitcast i8* %34 to %struct.nish_result.i32.str**
  %36 = getelementptr inbounds %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %35, i64 0
  %37 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %36, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %38 = call i64 @nish_arena_mark()
  %39 = call i8* @describe(%struct.nish_result.i32.str* %37)
  %40 = call i8* @nish_arena_keep(i64 %38, i8* %39)
  %41 = call i8* @nish_str_concat(i8* %40, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %42 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %r2.addr, align 8
  %43 = call i64 @nish_arena_mark()
  %44 = call i8* @describe(%struct.nish_result.i32.str* %42)
  %45 = call i8* @nish_arena_keep(i64 %43, i8* %44)
  %46 = call i8* @nish_str_concat(i8* %41, i8* %45)
  call void @nish_print(i8* %46)
  call void @Stack$res.i32.str.constructor(%struct.Stack$res.i32.str* %Stack$res.i32.str.obj)
  store %struct.Stack$res.i32.str* %Stack$res.i32.str.obj, %struct.Stack$res.i32.str** %s.addr, align 8
  %47 = load %struct.Stack$res.i32.str*, %struct.Stack$res.i32.str** %s.addr, align 8
  %48 = call %struct.nish_result.i32.str* @parse(i32 5)
  call void @Stack$res.i32.str.push(%struct.Stack$res.i32.str* %47, %struct.nish_result.i32.str* %48)
  %49 = load %struct.Stack$res.i32.str*, %struct.Stack$res.i32.str** %s.addr, align 8
  %50 = sub nsw i32 0, 6
  %51 = call %struct.nish_result.i32.str* @parse(i32 %50)
  call void @Stack$res.i32.str.push(%struct.Stack$res.i32.str* %49, %struct.nish_result.i32.str* %51)
  %52 = load %struct.Stack$res.i32.str*, %struct.Stack$res.i32.str** %s.addr, align 8
  call void @Stack$res.i32.str.drop(%struct.Stack$res.i32.str* %52)
  %53 = load %struct.Stack$res.i32.str*, %struct.Stack$res.i32.str** %s.addr, align 8
  %54 = getelementptr inbounds %struct.Stack$res.i32.str, %struct.Stack$res.i32.str* %53, i32 0, i32 0
  %55 = load %struct.nish_array*, %struct.nish_array** %54, align 8, !tbaa !17
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 0
  %57 = load i64, i64* %56, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %58 = trunc i64 %57 to i32
  %59 = call i8* @nish_str_from_i32(i32 %58)
  %60 = call i8* @nish_str_concat(i8* %59, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %61 = load %struct.Stack$res.i32.str*, %struct.Stack$res.i32.str** %s.addr, align 8
  %62 = getelementptr inbounds %struct.Stack$res.i32.str, %struct.Stack$res.i32.str* %61, i32 0, i32 0
  %63 = load %struct.nish_array*, %struct.nish_array** %62, align 8, !tbaa !17
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 0
  %65 = load i64, i64* %64, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %66 = icmp ult i64 0, %65
  br i1 %66, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %65)
  unreachable

bounds.ok.1:
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 2
  %68 = load i8*, i8** %67, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %69 = bitcast i8* %68 to %struct.nish_result.i32.str**
  %70 = getelementptr inbounds %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %69, i64 0
  %71 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %70, align 8, !alias.scope !4, !noalias !3, !tbaa !14
  %72 = call i64 @nish_arena_mark()
  %73 = call i8* @describe(%struct.nish_result.i32.str* %71)
  %74 = call i8* @nish_arena_keep(i64 %72, i8* %73)
  %75 = call i8* @nish_str_concat(i8* %60, i8* %74)
  call void @nish_print(i8* %75)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define internal void @Stack$res.i32.str.constructor(%struct.Stack$res.i32.str* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this) #0 {
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

define internal void @Stack$res.i32.str.push(%struct.Stack$res.i32.str* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this, %struct.nish_result.i32.str* noundef nonnull align 8 dereferenceable(16) %item) #0 {
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

define internal void @Stack$res.i32.str.drop(%struct.Stack$res.i32.str* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #1 {
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

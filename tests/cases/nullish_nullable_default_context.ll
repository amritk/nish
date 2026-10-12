%struct.Named = type { i8* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"literal\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"none\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0

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

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @firstOrEmpty(%struct.nish_array* noundef align 8 %xs) #0 {
entry:
  %0 = icmp ne %struct.nish_array* %xs, null
  br i1 %0, label %nullish.end, label %nullish.default

nullish.default:
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 0, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* null, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %nullish.end

nullish.end:
  %6 = phi %struct.nish_array* [ %xs, %entry ], [ %2, %nullish.default ]
  ret %struct.nish_array* %6
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Named* @named(%struct.Named* noundef align 8 %n) #0 {
entry:
  %0 = icmp ne %struct.Named* %n, null
  br i1 %0, label %nullish.end, label %nullish.default

nullish.default:
  %1 = call i8* @nish_alloc_struct(i64 8)
  %2 = bitcast i8* %1 to %struct.Named*
  %3 = getelementptr inbounds %struct.Named, %struct.Named* %2, i32 0, i32 0
  store i8* bitcast ({ i64, [8 x i8] }* @.str.0 to i8*), i8** %3, align 8
  br label %nullish.end

nullish.end:
  %4 = phi %struct.Named* [ %n, %entry ], [ %2, %nullish.default ]
  ret %struct.Named* %4
}

define internal noundef align 8 i8* @either(i8* noundef noalias readonly align 8 %a, i8* noundef noalias readonly align 8 %b, i1 noundef zeroext %c) #1 {
entry:
  %0 = icmp ne i8* %a, null
  br i1 %0, label %nullish.end, label %nullish.default

nullish.default:
  br i1 %c, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %1 = phi i8* [ %b, %cond.true ], [ null, %cond.false ]
  br label %nullish.end

nullish.end:
  %2 = phi i8* [ %a, %entry ], [ %1, %cond.end ]
  ret i8* %2
}

define internal noundef align 8 i8* @orNull(i8* noundef noalias readonly align 8 %a) #1 {
entry:
  %0 = icmp ne i8* %a, null
  %1 = select i1 %0, i8* %a, i8* null
  ret i8* %1
}

define noundef i32 @nish_main() #2 {
entry:
  %ys.addr = alloca %struct.nish_array*, align 8
  %e.addr = alloca i8*, align 8
  %f.addr = alloca i8*, align 8
  %g.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.nish_array* @firstOrEmpty(%struct.nish_array* null)
  store %struct.nish_array* %0, %struct.nish_array** %ys.addr, align 8
  %1 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = icmp eq i64 %3, %5
  br i1 %6, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %1, i64 4)
  br label %push.store

push.store:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %9 = bitcast i8* %8 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 %3
  store i32 4, i32* %10, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %11 = add i64 %3, 1
  store i64 %11, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = trunc i64 %11 to i32
  %13 = call i8* @either(i8* null, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i1 true)
  store i8* %13, i8** %e.addr, align 8
  %14 = call i8* @either(i8* null, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i1 false)
  store i8* %14, i8** %f.addr, align 8
  %15 = call i8* @orNull(i8* null)
  store i8* %15, i8** %g.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = trunc i64 %18 to i32
  %20 = call i8* @nish_str_from_i32(i32 %19)
  %21 = call i8* @nish_str_concat(i8* %20, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %22 = call %struct.Named* @named(%struct.Named* null)
  %23 = getelementptr inbounds %struct.Named, %struct.Named* %22, i32 0, i32 0
  %24 = load i8*, i8** %23, align 8
  %25 = call i8* @nish_str_concat(i8* %21, i8* %24)
  %26 = call i8* @nish_str_concat(i8* %25, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %27 = load i8*, i8** %e.addr, align 8
  %28 = icmp eq i8* %27, null
  br i1 %28, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %29 = load i8*, i8** %e.addr, align 8
  br label %cond.end

cond.end:
  %30 = phi i8* [ bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), %cond.true ], [ %29, %cond.false ]
  %31 = call i8* @nish_str_concat(i8* %26, i8* %30)
  %32 = call i8* @nish_str_concat(i8* %31, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %33 = load i8*, i8** %f.addr, align 8
  %34 = icmp eq i8* %33, null
  br i1 %34, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  %35 = load i8*, i8** %f.addr, align 8
  br label %cond.end.1

cond.end.1:
  %36 = phi i8* [ bitcast ({ i64, [5 x i8] }* @.str.3 to i8*), %cond.true.1 ], [ %35, %cond.false.1 ]
  %37 = call i8* @nish_str_concat(i8* %32, i8* %36)
  %38 = call i8* @nish_str_concat(i8* %37, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %39 = load i8*, i8** %g.addr, align 8
  %40 = icmp eq i8* %39, null
  %41 = select i1 %40, i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.5 to i8*)
  %42 = call i8* @nish_str_concat(i8* %38, i8* %41)
  call void @nish_print(i8* %42)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
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
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}

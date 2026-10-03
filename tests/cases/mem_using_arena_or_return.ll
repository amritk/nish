%struct.nish_result.i32.i32 = type { i1, i32, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"released\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"kept\00" }, align 8
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

define internal { i1, i32, i32 } @checked(i32 noundef %n) #0 {
entry:
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %nish_result.i32.i32.obj.1 = alloca %struct.nish_result.i32.i32, align 8
  %0 = icmp sge i32 %n, 0
  br i1 %0, label %cond.true, label %cond.false

cond.true:
  %1 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 true, i1* %1, align 1
  %2 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %n, i32* %2, align 4
  br label %cond.end

cond.false:
  %3 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 0
  store i1 false, i1* %3, align 1
  %4 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 2
  store i32 %n, i32* %4, align 4
  br label %cond.end

cond.end:
  %5 = phi %struct.nish_result.i32.i32* [ %nish_result.i32.i32.obj, %cond.true ], [ %nish_result.i32.i32.obj.1, %cond.false ]
  %6 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %5, i32 0, i32 0
  %7 = load i1, i1* %6, align 1
  %8 = insertvalue { i1, i32, i32 } undef, i1 %7, 0
  %9 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %5, i32 0, i32 2
  %10 = load i32, i32* %9, align 4
  %11 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %5, i32 0, i32 1
  %12 = load i32, i32* %11, align 4
  %13 = insertvalue { i1, i32, i32 } %8, i32 %12, 1
  %14 = insertvalue { i1, i32, i32 } %13, i32 %10, 2
  ret { i1, i32, i32 } %14
}

define internal { i1, i32, i32 } @propagate(i32 noundef %n, i32 noundef %k) #0 {
entry:
  %a.addr = alloca i64, align 8
  %xs.addr = alloca %struct.nish_array*, align 8
  %v.addr = alloca i32, align 4
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %0 = call i64 @nish_arena_mark()
  store i64 %0, i64* %a.addr, align 8
  %1 = load i64, i64* %a.addr, align 8
  %2 = call %struct.nish_array* @fill(i32 %k)
  store %struct.nish_array* %2, %struct.nish_array** %xs.addr, align 8
  %3 = call { i1, i32, i32 } @checked(i32 %n)
  %4 = extractvalue { i1, i32, i32 } %3, 0
  %5 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 %4, i1* %5, align 1
  %6 = extractvalue { i1, i32, i32 } %3, 1
  %7 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %6, i32* %7, align 4
  %8 = extractvalue { i1, i32, i32 } %3, 2
  %9 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  store i32 %8, i32* %9, align 4
  %10 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  %11 = load i1, i1* %10, align 1
  br i1 %11, label %res.ok, label %res.propagate

res.propagate:
  %12 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  %13 = load i32, i32* %12, align 4
  %14 = insertvalue { i1, i32, i32 } { i1 false, i32 undef, i32 undef }, i32 %13, 2
  call void @nish_arena_release(i64 %1)
  ret { i1, i32, i32 } %14

res.ok:
  %15 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  %16 = load i32, i32* %15, align 4
  store i32 %16, i32* %v.addr, align 4
  %17 = load i32, i32* %v.addr, align 4
  %18 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = trunc i64 %20 to i32
  %22 = add nsw i32 %17, %21
  %23 = insertvalue { i1, i32, i32 } { i1 true, i32 undef, i32 undef }, i32 %22, 1
  call void @nish_arena_release(i64 %1)
  ret { i1, i32, i32 } %23
}

define void @nish_main() #0 {
entry:
  %before.addr = alloca i64, align 8
  %ok.addr = alloca i32, align 4
  %nish_result.i32.i32.obj = alloca %struct.nish_result.i32.i32, align 8
  %err.addr = alloca i32, align 4
  %nish_result.i32.i32.obj.1 = alloca %struct.nish_result.i32.i32, align 8
  %after.addr = alloca i64, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish_arena_used()
  store i64 %0, i64* %before.addr, align 8
  %1 = call { i1, i32, i32 } @propagate(i32 4, i32 1000)
  %2 = extractvalue { i1, i32, i32 } %1, 0
  %3 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  store i1 %2, i1* %3, align 1
  %4 = extractvalue { i1, i32, i32 } %1, 1
  %5 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  store i32 %4, i32* %5, align 4
  %6 = extractvalue { i1, i32, i32 } %1, 2
  %7 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 2
  store i32 %6, i32* %7, align 4
  %8 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 0
  %9 = load i1, i1* %8, align 1
  br i1 %9, label %res.ok, label %res.alt

res.ok:
  %10 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj, i32 0, i32 1
  %11 = load i32, i32* %10, align 4
  br label %res.end

res.alt:
  br label %res.end

res.end:
  %12 = phi i32 [ %11, %res.ok ], [ -1, %res.alt ]
  store i32 %12, i32* %ok.addr, align 4
  %13 = call { i1, i32, i32 } @propagate(i32 -2, i32 1000)
  %14 = extractvalue { i1, i32, i32 } %13, 0
  %15 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 0
  store i1 %14, i1* %15, align 1
  %16 = extractvalue { i1, i32, i32 } %13, 1
  %17 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 1
  store i32 %16, i32* %17, align 4
  %18 = extractvalue { i1, i32, i32 } %13, 2
  %19 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 2
  store i32 %18, i32* %19, align 4
  %20 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 0
  %21 = load i1, i1* %20, align 1
  br i1 %21, label %res.ok.1, label %res.alt.1

res.ok.1:
  %22 = getelementptr inbounds %struct.nish_result.i32.i32, %struct.nish_result.i32.i32* %nish_result.i32.i32.obj.1, i32 0, i32 1
  %23 = load i32, i32* %22, align 4
  br label %res.end.1

res.alt.1:
  br label %res.end.1

res.end.1:
  %24 = phi i32 [ %23, %res.ok.1 ], [ -1, %res.alt.1 ]
  store i32 %24, i32* %err.addr, align 4
  %25 = call i64 @nish_arena_used()
  store i64 %25, i64* %after.addr, align 8
  %26 = load i32, i32* %ok.addr, align 4
  %27 = call i8* @nish_str_from_i32(i32 %26)
  %28 = call i8* @nish_str_concat(i8* %27, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %29 = load i32, i32* %err.addr, align 4
  %30 = call i8* @nish_str_from_i32(i32 %29)
  %31 = call i8* @nish_str_concat(i8* %28, i8* %30)
  call void @nish_print(i8* %31)
  %32 = load i64, i64* %after.addr, align 8
  %33 = load i64, i64* %before.addr, align 8
  %34 = icmp eq i64 %32, %33
  br i1 %34, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %35 = phi i8* [ bitcast ({ i64, [9 x i8] }* @.str.1 to i8*), %cond.true ], [ bitcast ({ i64, [5 x i8] }* @.str.2 to i8*), %cond.false ]
  call void @nish_print(i8* %35)
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

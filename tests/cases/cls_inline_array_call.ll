%struct.Rows = type { { %struct.nish_array, [16 x i1] } }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #4

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #5 {
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

define internal void @Rows.constructor(%struct.Rows* noundef nonnull noalias align 8 dereferenceable(40) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Rows, %struct.Rows* %this, i32 0, i32 0, i32 0
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  ret void
}

define internal void @Rows.fill(%struct.Rows* noundef nonnull align 8 dereferenceable(40) nocapture %this, i32 noundef %n) #1 {
entry:
  %0 = icmp eq i32 %n, 8
  br i1 %0, label %if.then, label %if.else

if.then:
  %1 = call %struct.nish_array* @filled(i32 8)
  %2 = getelementptr inbounds %struct.Rows, %struct.Rows* %this, i32 0, i32 0, i32 0
  %3 = getelementptr inbounds %struct.Rows, %struct.Rows* %this, i32 0, i32 0, i32 1, i64 0
  %4 = bitcast i1* %3 to i8*
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 8 %4, i8* align 8 %6, i64 8, i1 false), !alias.scope !4, !noalias !3
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 8, i64* %7, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %if.end

if.else:
  %8 = call %struct.nish_array* @filled(i32 16)
  %9 = getelementptr inbounds %struct.Rows, %struct.Rows* %this, i32 0, i32 0, i32 0
  %10 = getelementptr inbounds %struct.Rows, %struct.Rows* %this, i32 0, i32 0, i32 1, i64 0
  %11 = bitcast i1* %10 to i8*
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 8 %11, i8* align 8 %13, i64 16, i1 false), !alias.scope !4, !noalias !3
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  store i64 16, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  br label %if.end

if.end:
  ret void
}

define internal noundef i32 @Rows.count(%struct.Rows* noundef nonnull readonly align 8 dereferenceable(40) nocapture %this) #2 {
entry:
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.Rows, %struct.Rows* %this, i32 0, i32 0, i32 0
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.Rows, %struct.Rows* %this, i32 0, i32 0, i32 1, i64 0
  %4 = bitcast i1* %3 to i8*
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = trunc i64 %2 to i32
  %7 = icmp slt i32 %5, %6
  br i1 %7, label %for.body, label %for.end

for.body:
  %8 = load i32, i32* %i.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = bitcast i8* %4 to i1*
  %11 = getelementptr inbounds i1, i1* %10, i64 %9
  %12 = load i1, i1* %11, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  br i1 %12, label %if.then, label %if.end

if.then:
  %13 = load i32, i32* %n.addr, align 4
  %14 = add nsw i32 %13, 1
  store i32 %14, i32* %n.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %15 = load i32, i32* %i.addr, align 4
  %16 = add nsw i32 %15, 1
  store i32 %16, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %17 = load i32, i32* %n.addr, align 4
  ret i32 %17
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @filled(i32 noundef %n) #1 {
entry:
  %arr.addr = alloca %struct.nish_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = sext i32 %n to i64
  %1 = call i8* @nish_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.nish_array*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 %0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 %0, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %5 = call i8* @nish_alloc_struct(i64 %0)
  call void @llvm.memset.p0i8.i64(i8* align 8 %5, i8 0, i64 %0, i1 false), !alias.scope !4, !noalias !3
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  store %struct.nish_array* %2, %struct.nish_array** %arr.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %7 = load %struct.nish_array*, %struct.nish_array** %arr.addr, align 8
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %11 = load i8*, i8** %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  br label %for.cond

for.cond:
  %12 = load i32, i32* %i.addr, align 4
  %13 = trunc i64 %9 to i32
  %14 = icmp slt i32 %12, %13
  br i1 %14, label %for.body, label %for.end

for.body:
  %15 = load i32, i32* %i.addr, align 4
  %16 = sext i32 %15 to i64
  %17 = bitcast i8* %11 to i1*
  %18 = getelementptr inbounds i1, i1* %17, i64 %16
  store i1 true, i1* %18, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  br label %for.inc

for.inc:
  %19 = load i32, i32* %i.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %21 = load %struct.nish_array*, %struct.nish_array** %arr.addr, align 8
  ret %struct.nish_array* %21
}

define noundef i32 @nish_main() #1 {
entry:
  %r.addr = alloca %struct.Rows*, align 8
  %Rows.obj = alloca %struct.Rows, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Rows, %struct.Rows* %Rows.obj, i32 0, i32 0, i32 0
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 1
  store i64 16, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !14
  %3 = getelementptr inbounds %struct.Rows, %struct.Rows* %Rows.obj, i32 0, i32 0, i32 1, i64 0
  %4 = bitcast i1* %3 to i8*
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  call void @Rows.constructor(%struct.Rows* %Rows.obj)
  store %struct.Rows* %Rows.obj, %struct.Rows** %r.addr, align 8
  %6 = load %struct.Rows*, %struct.Rows** %r.addr, align 8
  %7 = call i32 @Rows.count(%struct.Rows* %6)
  %8 = call i8* @nish_str_from_i32(i32 %7)
  %9 = call i8* @nish_str_concat(i8* %8, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %10 = load %struct.Rows*, %struct.Rows** %r.addr, align 8
  %11 = getelementptr inbounds %struct.Rows, %struct.Rows* %10, i32 0, i32 0, i32 0
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %13 = load i64, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %14 = trunc i64 %13 to i32
  %15 = call i8* @nish_str_from_i32(i32 %14)
  %16 = call i8* @nish_str_concat(i8* %9, i8* %15)
  call void @nish_print(i8* %16)
  %17 = load %struct.Rows*, %struct.Rows** %r.addr, align 8
  call void @Rows.fill(%struct.Rows* %17, i32 8)
  %18 = load %struct.Rows*, %struct.Rows** %r.addr, align 8
  %19 = getelementptr inbounds %struct.Rows, %struct.Rows* %18, i32 0, i32 0, i32 0
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %19, i64 0, i32 0
  %21 = load i64, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %22 = icmp ult i64 3, %21
  br i1 %22, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 3, i64 %21)
  unreachable

bounds.ok:
  %23 = getelementptr inbounds %struct.Rows, %struct.Rows* %18, i32 0, i32 0, i32 1, i64 0
  %24 = bitcast i1* %23 to i8*
  %25 = bitcast i8* %24 to i1*
  %26 = getelementptr inbounds i1, i1* %25, i64 3
  store i1 false, i1* %26, align 1, !alias.scope !4, !noalias !3, !tbaa !13
  %27 = load %struct.Rows*, %struct.Rows** %r.addr, align 8
  %28 = call i32 @Rows.count(%struct.Rows* %27)
  %29 = call i8* @nish_str_from_i32(i32 %28)
  %30 = call i8* @nish_str_concat(i8* %29, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %31 = load %struct.Rows*, %struct.Rows** %r.addr, align 8
  %32 = getelementptr inbounds %struct.Rows, %struct.Rows* %31, i32 0, i32 0, i32 0
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %32, i64 0, i32 0
  %34 = load i64, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %35 = trunc i64 %34 to i32
  %36 = call i8* @nish_str_from_i32(i32 %35)
  %37 = call i8* @nish_str_concat(i8* %30, i8* %36)
  call void @nish_print(i8* %37)
  %38 = load %struct.Rows*, %struct.Rows** %r.addr, align 8
  call void @Rows.fill(%struct.Rows* %38, i32 16)
  %39 = load %struct.Rows*, %struct.Rows** %r.addr, align 8
  %40 = call i32 @Rows.count(%struct.Rows* %39)
  %41 = call i8* @nish_str_from_i32(i32 %40)
  %42 = call i8* @nish_str_concat(i8* %41, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %43 = load %struct.Rows*, %struct.Rows** %r.addr, align 8
  %44 = getelementptr inbounds %struct.Rows, %struct.Rows* %43, i32 0, i32 0, i32 0
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  %46 = load i64, i64* %45, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %47 = trunc i64 %46 to i32
  %48 = call i8* @nish_str_from_i32(i32 %47)
  %49 = call i8* @nish_str_concat(i8* %42, i8* %48)
  call void @nish_print(i8* %49)
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
attributes #2 = { nounwind readonly }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

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
!12 = !{!"element i1", !6, i64 0}
!13 = !{!12, !12, i64 0}
!14 = !{!9, !7, i64 8}

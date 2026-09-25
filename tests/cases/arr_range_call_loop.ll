%struct.Counts = type { %struct.nish_array*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
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

define internal void @Counts.constructor(%struct.Counts* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %n) #0 {
entry:
  %0 = getelementptr inbounds %struct.Counts, %struct.Counts* %this, i32 0, i32 1
  store i32 0, i32* %0, align 4, !tbaa !5
  %1 = sext i32 %n to i64
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 %1, i64* %4, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %1, i64* %5, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %6 = mul i64 %1, 4
  %7 = call i8* @nish_alloc_struct(i64 %6)
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %6, i1 false), !alias.scope !10, !noalias !9
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %7, i8** %8, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %9 = getelementptr inbounds %struct.Counts, %struct.Counts* %this, i32 0, i32 0
  store %struct.nish_array* %3, %struct.nish_array** %9, align 8, !tbaa !17
  ret void
}

define internal void @Counts.touch(%struct.Counts* noundef nonnull align 8 dereferenceable(16) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Counts, %struct.Counts* %this, i32 0, i32 1
  %1 = load i32, i32* %0, align 4
  %2 = add nsw i32 %1, 1
  store i32 %2, i32* %0, align 4
  ret void
}

define internal void @Counts.bump(%struct.Counts* noundef nonnull readonly align 8 dereferenceable(16) nocapture %this, i32 noundef %i, i32 noundef %by) #0 {
entry:
  %0 = getelementptr inbounds %struct.Counts, %struct.Counts* %this, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !17
  %2 = sext i32 %i to i64
  %3 = getelementptr inbounds %struct.Counts, %struct.Counts* %this, i32 0, i32 0
  %4 = load %struct.nish_array*, %struct.nish_array** %3, align 8, !tbaa !17
  %5 = sext i32 %i to i64
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %4, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %8 = bitcast i8* %7 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 %5
  %10 = load i32, i32* %9, align 4, !alias.scope !10, !noalias !9, !tbaa !19
  %11 = add nsw i32 %10, %by
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %14 = bitcast i8* %13 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 %2
  store i32 %11, i32* %15, align 4, !alias.scope !10, !noalias !9, !tbaa !19
  ret void
}

define internal void @Counts.fill(%struct.Counts* noundef nonnull readonly align 8 dereferenceable(16) nocapture %this) #1 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = getelementptr inbounds %struct.Counts, %struct.Counts* %this, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !17
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %0, %5
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %i.addr, align 4
  %8 = load i32, i32* %i.addr, align 4
  call void @Counts.bump(%struct.Counts* %this, i32 %7, i32 %8)
  %9 = load i32, i32* %i.addr, align 4
  call void @Counts.bump(%struct.Counts* %this, i32 %9, i32 1)
  br label %for.inc

for.inc:
  %10 = load i32, i32* %i.addr, align 4
  %11 = add nsw i32 %10, 1
  store i32 %11, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define internal noundef i32 @total(%struct.Counts* noundef nonnull align 8 dereferenceable(16) nocapture %c, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #1 {
entry:
  %s.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %s.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = trunc i64 %1 to i32
  %6 = icmp slt i32 %4, %5
  br i1 %6, label %for.body, label %for.end

for.body:
  call void @Counts.touch(%struct.Counts* %c)
  %7 = load i32, i32* %s.addr, align 4
  %8 = load i32, i32* %i.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = bitcast i8* %3 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %9
  %12 = load i32, i32* %11, align 4, !alias.scope !10, !noalias !9, !tbaa !19
  %13 = add nsw i32 %7, %12
  store i32 %13, i32* %s.addr, align 4
  br label %for.inc

for.inc:
  %14 = load i32, i32* %i.addr, align 4
  %15 = add nsw i32 %14, 1
  store i32 %15, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %16 = load i32, i32* %s.addr, align 4
  ret i32 %16
}

define noundef i32 @nish_main() #1 {
entry:
  %c.addr = alloca %struct.Counts*, align 8
  %Counts.obj = alloca %struct.Counts, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Counts.constructor(%struct.Counts* %Counts.obj, i32 4)
  store %struct.Counts* %Counts.obj, %struct.Counts** %c.addr, align 8
  %0 = load %struct.Counts*, %struct.Counts** %c.addr, align 8
  call void @Counts.fill(%struct.Counts* %0)
  %1 = load %struct.Counts*, %struct.Counts** %c.addr, align 8
  %2 = getelementptr inbounds %struct.Counts, %struct.Counts* %1, i32 0, i32 0
  %3 = load %struct.nish_array*, %struct.nish_array** %2, align 8, !tbaa !17
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %6 = icmp ult i64 0, %5
  br i1 %6, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %5)
  unreachable

bounds.ok:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %9 = bitcast i8* %8 to i32*
  %10 = getelementptr inbounds i32, i32* %9, i64 0
  %11 = load i32, i32* %10, align 4, !alias.scope !10, !noalias !9, !tbaa !19
  %12 = call i8* @nish_str_from_i32(i32 %11)
  %13 = call i8* @nish_str_concat(i8* %12, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %14 = load %struct.Counts*, %struct.Counts** %c.addr, align 8
  %15 = getelementptr inbounds %struct.Counts, %struct.Counts* %14, i32 0, i32 0
  %16 = load %struct.nish_array*, %struct.nish_array** %15, align 8, !tbaa !17
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %19 = icmp ult i64 1, %18
  br i1 %19, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %18)
  unreachable

bounds.ok.1:
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  %21 = load i8*, i8** %20, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %22 = bitcast i8* %21 to i32*
  %23 = getelementptr inbounds i32, i32* %22, i64 1
  %24 = load i32, i32* %23, align 4, !alias.scope !10, !noalias !9, !tbaa !19
  %25 = call i8* @nish_str_from_i32(i32 %24)
  %26 = call i8* @nish_str_concat(i8* %13, i8* %25)
  %27 = call i8* @nish_str_concat(i8* %26, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %28 = load %struct.Counts*, %struct.Counts** %c.addr, align 8
  %29 = getelementptr inbounds %struct.Counts, %struct.Counts* %28, i32 0, i32 0
  %30 = load %struct.nish_array*, %struct.nish_array** %29, align 8, !tbaa !17
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %33 = icmp ult i64 2, %32
  br i1 %33, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 2, i64 %32)
  unreachable

bounds.ok.2:
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 2
  %35 = load i8*, i8** %34, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %36 = bitcast i8* %35 to i32*
  %37 = getelementptr inbounds i32, i32* %36, i64 2
  %38 = load i32, i32* %37, align 4, !alias.scope !10, !noalias !9, !tbaa !19
  %39 = call i8* @nish_str_from_i32(i32 %38)
  %40 = call i8* @nish_str_concat(i8* %27, i8* %39)
  %41 = call i8* @nish_str_concat(i8* %40, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %42 = load %struct.Counts*, %struct.Counts** %c.addr, align 8
  %43 = getelementptr inbounds %struct.Counts, %struct.Counts* %42, i32 0, i32 0
  %44 = load %struct.nish_array*, %struct.nish_array** %43, align 8, !tbaa !17
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  %46 = load i64, i64* %45, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %47 = icmp ult i64 3, %46
  br i1 %47, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 3, i64 %46)
  unreachable

bounds.ok.3:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %50 = bitcast i8* %49 to i32*
  %51 = getelementptr inbounds i32, i32* %50, i64 3
  %52 = load i32, i32* %51, align 4, !alias.scope !10, !noalias !9, !tbaa !19
  %53 = call i8* @nish_str_from_i32(i32 %52)
  %54 = call i8* @nish_str_concat(i8* %41, i8* %53)
  call void @nish_print(i8* %54)
  %55 = load %struct.Counts*, %struct.Counts** %c.addr, align 8
  %56 = load %struct.Counts*, %struct.Counts** %c.addr, align 8
  %57 = getelementptr inbounds %struct.Counts, %struct.Counts* %56, i32 0, i32 0
  %58 = load %struct.nish_array*, %struct.nish_array** %57, align 8, !tbaa !17
  %59 = call i32 @total(%struct.Counts* %55, %struct.nish_array* %58)
  %60 = call i8* @nish_str_from_i32(i32 %59)
  call void @nish_print(i8* %60)
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
!3 = !{!"i32", !1, i64 0}
!4 = !{!"Counts", !2, i64 0, !3, i64 8}
!5 = !{!4, !3, i64 8}
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
!17 = !{!4, !2, i64 0}
!18 = !{!"element i32", !1, i64 0}
!19 = !{!18, !18, i64 0}

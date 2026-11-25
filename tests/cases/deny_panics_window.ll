%struct.Queue = type { %struct.nish_array*, i32, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #1
declare noundef i32 @nish_write_bytes(%struct.nish_array* noundef nonnull align 8 nocapture readonly, i64 noundef, i64 noundef) #0

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #3 {
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

define internal void @window(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %buf, i32 noundef %start, i32 noundef %end) #0 {
entry:
  %0 = icmp sge i32 %start, 0
  br i1 %0, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %1 = icmp sle i32 %start, %end
  br label %land.end.1

land.end.1:
  %2 = phi i1 [ false, %entry ], [ %1, %land.rhs.1 ]
  br i1 %2, label %land.rhs, label %land.end

land.rhs:
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %buf, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = trunc i64 %4 to i32
  %6 = icmp sle i32 %end, %5
  br label %land.end

land.end:
  %7 = phi i1 [ false, %land.end.1 ], [ %6, %land.rhs ]
  br i1 %7, label %if.then, label %if.end

if.then:
  %8 = sext i32 %start to i64
  %9 = sub nsw i32 %end, %start
  %10 = sext i32 %9 to i64
  %11 = call i32 @nish_write_bytes(%struct.nish_array* %buf, i64 %8, i64 %10)
  br label %if.end

if.end:
  ret void
}

define internal void @Queue.constructor(%struct.Queue* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %out) #1 {
entry:
  %0 = getelementptr inbounds %struct.Queue, %struct.Queue* %this, i32 0, i32 1
  store i32 0, i32* %0, align 4, !tbaa !14
  %1 = getelementptr inbounds %struct.Queue, %struct.Queue* %this, i32 0, i32 2
  store i32 0, i32* %1, align 4, !tbaa !15
  %2 = getelementptr inbounds %struct.Queue, %struct.Queue* %this, i32 0, i32 0
  store %struct.nish_array* %out, %struct.nish_array** %2, align 8, !tbaa !16
  ret void
}

define internal void @Queue.flush(%struct.Queue* noundef nonnull align 8 dereferenceable(16) nocapture %this) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %start.addr = alloca i32, align 4
  %end.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Queue, %struct.Queue* %this, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !16
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %2 = getelementptr inbounds %struct.Queue, %struct.Queue* %this, i32 0, i32 1
  %3 = load i32, i32* %2, align 4, !tbaa !14
  store i32 %3, i32* %start.addr, align 4
  %4 = getelementptr inbounds %struct.Queue, %struct.Queue* %this, i32 0, i32 2
  %5 = load i32, i32* %4, align 4, !tbaa !15
  store i32 %5, i32* %end.addr, align 4
  %6 = load i32, i32* %start.addr, align 4
  %7 = icmp slt i32 %6, 0
  br i1 %7, label %lor.end.1, label %lor.rhs.1

lor.rhs.1:
  %8 = load i32, i32* %start.addr, align 4
  %9 = load i32, i32* %end.addr, align 4
  %10 = icmp sgt i32 %8, %9
  br label %lor.end.1

lor.end.1:
  %11 = phi i1 [ true, %entry ], [ %10, %lor.rhs.1 ]
  br i1 %11, label %lor.end, label %lor.rhs

lor.rhs:
  %12 = load i32, i32* %end.addr, align 4
  %13 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = trunc i64 %15 to i32
  %17 = icmp sgt i32 %12, %16
  br label %lor.end

lor.end:
  %18 = phi i1 [ true, %lor.end.1 ], [ %17, %lor.rhs ]
  br i1 %18, label %if.then, label %if.end

if.then:
  ret void

if.end:
  %19 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %20 = load i32, i32* %start.addr, align 4
  %21 = sext i32 %20 to i64
  %22 = load i32, i32* %end.addr, align 4
  %23 = load i32, i32* %start.addr, align 4
  %24 = sub nsw i32 %22, %23
  %25 = sext i32 %24 to i64
  %26 = call i32 @nish_write_bytes(%struct.nish_array* %19, i64 %21, i64 %25)
  %27 = load i32, i32* %end.addr, align 4
  %28 = getelementptr inbounds %struct.Queue, %struct.Queue* %this, i32 0, i32 1
  store i32 %27, i32* %28, align 4, !tbaa !14
  ret void
}

define noundef i32 @nish_main() #0 {
entry:
  %b.addr = alloca %struct.nish_array*, align 8
  %q.addr = alloca %struct.Queue*, align 8
  %Queue.obj = alloca %struct.Queue, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 9, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 9, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !17
  %4 = call i8* @nish_alloc_struct(i64 9)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !18
  %6 = bitcast i8* %4 to i8*
  %7 = getelementptr inbounds i8, i8* %6, i64 0
  store i8 104, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !20
  %8 = getelementptr inbounds i8, i8* %6, i64 1
  store i8 105, i8* %8, align 1, !alias.scope !4, !noalias !3, !tbaa !20
  %9 = getelementptr inbounds i8, i8* %6, i64 2
  store i8 32, i8* %9, align 1, !alias.scope !4, !noalias !3, !tbaa !20
  %10 = getelementptr inbounds i8, i8* %6, i64 3
  store i8 116, i8* %10, align 1, !alias.scope !4, !noalias !3, !tbaa !20
  %11 = getelementptr inbounds i8, i8* %6, i64 4
  store i8 104, i8* %11, align 1, !alias.scope !4, !noalias !3, !tbaa !20
  %12 = getelementptr inbounds i8, i8* %6, i64 5
  store i8 101, i8* %12, align 1, !alias.scope !4, !noalias !3, !tbaa !20
  %13 = getelementptr inbounds i8, i8* %6, i64 6
  store i8 114, i8* %13, align 1, !alias.scope !4, !noalias !3, !tbaa !20
  %14 = getelementptr inbounds i8, i8* %6, i64 7
  store i8 101, i8* %14, align 1, !alias.scope !4, !noalias !3, !tbaa !20
  %15 = getelementptr inbounds i8, i8* %6, i64 8
  store i8 10, i8* %15, align 1, !alias.scope !4, !noalias !3, !tbaa !20
  store %struct.nish_array* %1, %struct.nish_array** %b.addr, align 8
  %16 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  call void @window(%struct.nish_array* %16, i32 3, i32 9)
  %17 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  call void @Queue.constructor(%struct.Queue* %Queue.obj, %struct.nish_array* %17)
  store %struct.Queue* %Queue.obj, %struct.Queue** %q.addr, align 8
  %18 = load %struct.Queue*, %struct.Queue** %q.addr, align 8
  %19 = getelementptr inbounds %struct.Queue, %struct.Queue* %18, i32 0, i32 2
  store i32 3, i32* %19, align 4, !tbaa !15
  %20 = load %struct.Queue*, %struct.Queue** %q.addr, align 8
  call void @Queue.flush(%struct.Queue* %20)
  %21 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  call void @window(%struct.nish_array* %21, i32 8, i32 9)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!21, !22, !23, !24, !25}
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
!11 = !{!"ptr", !6, i64 0}
!12 = !{!"i32", !6, i64 0}
!13 = !{!"Queue", !11, i64 0, !12, i64 8, !12, i64 12}
!14 = !{!13, !12, i64 8}
!15 = !{!13, !12, i64 12}
!16 = !{!13, !11, i64 0}
!17 = !{!9, !7, i64 8}
!18 = !{!9, !8, i64 16}
!19 = !{!"element i8", !6, i64 0}
!20 = !{!19, !19, i64 0}
!21 = !{i32 8, !"cf-protection-branch", i32 1}
!22 = !{i32 8, !"cf-protection-return", i32 1}
!23 = !{i32 8, !"branch-target-enforcement", i32 1}
!24 = !{i32 8, !"sign-return-address", i32 1}
!25 = !{i32 4, !"probe-stack", !"inline-asm"}

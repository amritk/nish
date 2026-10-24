%struct.Node = type { i32, %struct.Node* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

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

define internal void @Node.constructor(%struct.Node* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %value) #0 {
entry:
  %0 = getelementptr inbounds %struct.Node, %struct.Node* %this, i32 0, i32 1
  store %struct.Node* null, %struct.Node** %0, align 8, !tbaa !5
  %1 = getelementptr inbounds %struct.Node, %struct.Node* %this, i32 0, i32 0
  store i32 %value, i32* %1, align 4, !tbaa !6
  ret void
}

define internal noundef nonnull align 8 dereferenceable(16) %struct.Node* @last(%struct.Node* noundef nonnull align 8 dereferenceable(16) %head) #1 {
entry:
  %cur.addr = alloca %struct.Node*, align 8
  %i.addr = alloca i32, align 4
  store %struct.Node* %head, %struct.Node** %cur.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 10
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load %struct.Node*, %struct.Node** %cur.addr, align 8
  %3 = getelementptr inbounds %struct.Node, %struct.Node* %2, i32 0, i32 1
  %4 = load %struct.Node*, %struct.Node** %3, align 8, !tbaa !5
  %5 = icmp ne %struct.Node* %4, null
  %6 = load %struct.Node*, %struct.Node** %cur.addr, align 8
  %7 = select i1 %5, %struct.Node* %4, %struct.Node* %6
  store %struct.Node* %7, %struct.Node** %cur.addr, align 8
  br label %for.inc

for.inc:
  %8 = load i32, i32* %i.addr, align 4
  %9 = add nsw i32 %8, 1
  store i32 %9, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %10 = load %struct.Node*, %struct.Node** %cur.addr, align 8
  ret %struct.Node* %10
}

define noundef i32 @nish_main() #2 {
entry:
  %head.addr = alloca %struct.Node*, align 8
  %second.addr = alloca %struct.Node*, align 8
  %0 = call i8* @nish_alloc_struct(i64 16)
  %1 = bitcast i8* %0 to %struct.Node*
  call void @Node.constructor(%struct.Node* %1, i32 1)
  store %struct.Node* %1, %struct.Node** %head.addr, align 8
  %2 = load %struct.Node*, %struct.Node** %head.addr, align 8
  %3 = call i8* @nish_alloc_struct(i64 16)
  %4 = bitcast i8* %3 to %struct.Node*
  call void @Node.constructor(%struct.Node* %4, i32 2)
  %5 = getelementptr inbounds %struct.Node, %struct.Node* %2, i32 0, i32 1
  store %struct.Node* %4, %struct.Node** %5, align 8, !tbaa !5
  %6 = load %struct.Node*, %struct.Node** %head.addr, align 8
  %7 = getelementptr inbounds %struct.Node, %struct.Node* %6, i32 0, i32 1
  %8 = load %struct.Node*, %struct.Node** %7, align 8, !tbaa !5
  %9 = icmp ne %struct.Node* %8, null
  %10 = load %struct.Node*, %struct.Node** %head.addr, align 8
  %11 = select i1 %9, %struct.Node* %8, %struct.Node* %10
  store %struct.Node* %11, %struct.Node** %second.addr, align 8
  %12 = load %struct.Node*, %struct.Node** %second.addr, align 8
  %13 = call i8* @nish_alloc_struct(i64 16)
  %14 = bitcast i8* %13 to %struct.Node*
  call void @Node.constructor(%struct.Node* %14, i32 3)
  %15 = getelementptr inbounds %struct.Node, %struct.Node* %12, i32 0, i32 1
  store %struct.Node* %14, %struct.Node** %15, align 8, !tbaa !5
  %16 = load %struct.Node*, %struct.Node** %head.addr, align 8
  %17 = call %struct.Node* @last(%struct.Node* %16)
  %18 = getelementptr inbounds %struct.Node, %struct.Node* %17, i32 0, i32 0
  %19 = load i32, i32* %18, align 4, !tbaa !6
  %20 = call i8* @nish_str_from_i32(i32 %19)
  %21 = call i8* @nish_str_concat(i8* %20, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %22 = load %struct.Node*, %struct.Node** %second.addr, align 8
  %23 = getelementptr inbounds %struct.Node, %struct.Node* %22, i32 0, i32 1
  %24 = load %struct.Node*, %struct.Node** %23, align 8, !tbaa !5
  %25 = icmp ne %struct.Node* %24, null
  %26 = load %struct.Node*, %struct.Node** %head.addr, align 8
  %27 = select i1 %25, %struct.Node* %24, %struct.Node* %26
  %28 = getelementptr inbounds %struct.Node, %struct.Node* %27, i32 0, i32 0
  %29 = load i32, i32* %28, align 4, !tbaa !6
  %30 = call i8* @nish_str_from_i32(i32 %29)
  %31 = call i8* @nish_str_concat(i8* %21, i8* %30)
  %32 = call i8* @nish_str_concat(i8* %31, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %33 = load %struct.Node*, %struct.Node** %head.addr, align 8
  %34 = getelementptr inbounds %struct.Node, %struct.Node* %33, i32 0, i32 1
  %35 = load %struct.Node*, %struct.Node** %34, align 8, !tbaa !5
  %36 = icmp ne %struct.Node* %35, null
  %37 = load %struct.Node*, %struct.Node** %second.addr, align 8
  %38 = select i1 %36, %struct.Node* %35, %struct.Node* %37
  %39 = getelementptr inbounds %struct.Node, %struct.Node* %38, i32 0, i32 0
  %40 = load i32, i32* %39, align 4, !tbaa !6
  %41 = call i8* @nish_str_from_i32(i32 %40)
  %42 = call i8* @nish_str_concat(i8* %32, i8* %41)
  call void @nish_print(i8* %42)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #2 = { nounwind "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!7, !8, !9, !10, !11}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ptr", !1, i64 0}
!4 = !{!"Node", !2, i64 0, !3, i64 8}
!5 = !{!4, !3, i64 8}
!6 = !{!4, !2, i64 0}
!7 = !{i32 8, !"cf-protection-branch", i32 1}
!8 = !{i32 8, !"cf-protection-return", i32 1}
!9 = !{i32 8, !"branch-target-enforcement", i32 1}
!10 = !{i32 8, !"sign-return-address", i32 1}
!11 = !{i32 4, !"probe-stack", !"inline-asm"}

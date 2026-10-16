%struct.Node = type { i8*, %struct.Node* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"made \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"linked \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"overwrite \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c" overwrite \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"root\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"p\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"q\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
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

define internal void @Node.constructor(%struct.Node* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i8* noundef nonnull noalias readonly align 8 %label) #0 {
entry:
  %0 = getelementptr inbounds %struct.Node, %struct.Node* %this, i32 0, i32 1
  store %struct.Node* null, %struct.Node** %0, align 8, !tbaa !4
  %1 = getelementptr inbounds %struct.Node, %struct.Node* %this, i32 0, i32 0
  store i8* %label, i8** %1, align 8, !tbaa !5
  ret void
}

define internal noundef nonnull align 8 dereferenceable(16) %struct.Node* @pick(%struct.Node* noundef align 8 %n, i8* noundef nonnull noalias readonly align 8 nocapture %k) #1 {
entry:
  %0 = icmp ne %struct.Node* %n, null
  br i1 %0, label %nullish.end, label %nullish.default

nullish.default:
  %1 = call i8* @nish_alloc_struct(i64 16)
  %2 = bitcast i8* %1 to %struct.Node*
  %3 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8* %k)
  call void @Node.constructor(%struct.Node* %2, i8* %3)
  br label %nullish.end

nullish.end:
  %4 = phi %struct.Node* [ %n, %entry ], [ %2, %nullish.default ]
  ret %struct.Node* %4
}

define internal void @link$(%struct.Node* noundef nonnull align 8 dereferenceable(16) nocapture %n, i8* noundef nonnull noalias readonly align 8 nocapture %k) #1 {
entry:
  %0 = getelementptr inbounds %struct.Node, %struct.Node* %n, i32 0, i32 1
  %1 = load %struct.Node*, %struct.Node** %0, align 8, !tbaa !4
  %2 = icmp ne %struct.Node* %1, null
  br i1 %2, label %nullish.end, label %nullish.default

nullish.default:
  %3 = call i8* @nish_alloc_struct(i64 16)
  %4 = bitcast i8* %3 to %struct.Node*
  %5 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.1 to i8*), i8* %k)
  call void @Node.constructor(%struct.Node* %4, i8* %5)
  br label %nullish.end

nullish.end:
  %6 = phi %struct.Node* [ %1, %entry ], [ %4, %nullish.default ]
  %7 = getelementptr inbounds %struct.Node, %struct.Node* %n, i32 0, i32 1
  store %struct.Node* %6, %struct.Node** %7, align 8, !tbaa !4
  ret void
}

define internal noundef i32 @churn() #1 {
entry:
  %junk.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %junk.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, 200
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.nish_array*, %struct.nish_array** %junk.addr, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = call i8* @nish_str_from_i32(i32 %6)
  %8 = call i8* @nish_str_concat(i8* bitcast ({ i64, [11 x i8] }* @.str.2 to i8*), i8* %7)
  %9 = call i8* @nish_str_concat(i8* %8, i8* bitcast ({ i64, [12 x i8] }* @.str.3 to i8*))
  %10 = load i32, i32* %i.addr, align 4
  %11 = call i8* @nish_str_from_i32(i32 %10)
  %12 = call i8* @nish_str_concat(i8* %9, i8* %11)
  %13 = call i8* @nish_str_concat(i8* %12, i8* bitcast ({ i64, [12 x i8] }* @.str.3 to i8*))
  %14 = load i32, i32* %i.addr, align 4
  %15 = call i8* @nish_str_from_i32(i32 %14)
  %16 = call i8* @nish_str_concat(i8* %13, i8* %15)
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %20 = load i64, i64* %19, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %21 = icmp eq i64 %18, %20
  br i1 %21, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 8)
  br label %push.store

push.store:
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %24 = bitcast i8* %23 to i8**
  %25 = getelementptr inbounds i8*, i8** %24, i64 %18
  store i8* %16, i8** %25, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %26 = add i64 %18, 1
  store i64 %26, i64* %17, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %27 = trunc i64 %26 to i32
  br label %for.inc

for.inc:
  %28 = load i32, i32* %i.addr, align 4
  %29 = add nsw i32 %28, 1
  store i32 %29, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %30 = load %struct.nish_array*, %struct.nish_array** %junk.addr, align 8
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %30, i64 0, i32 0
  %32 = load i64, i64* %31, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %33 = trunc i64 %32 to i32
  ret i32 %33
}

define noundef i32 @nish_main() #1 {
entry:
  %root.addr = alloca %struct.Node*, align 8
  %p.addr = alloca %struct.Node*, align 8
  %q.addr = alloca %struct.Node*, align 8
  %n.addr = alloca i32, align 4
  %next.addr = alloca %struct.Node*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 16)
  %1 = bitcast i8* %0 to %struct.Node*
  call void @Node.constructor(%struct.Node* %1, i8* bitcast ({ i64, [5 x i8] }* @.str.4 to i8*))
  store %struct.Node* %1, %struct.Node** %root.addr, align 8
  %2 = load %struct.Node*, %struct.Node** %root.addr, align 8
  call void @link$(%struct.Node* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %3 = load %struct.Node*, %struct.Node** %root.addr, align 8
  call void @link$(%struct.Node* %3, i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*))
  %4 = call %struct.Node* @pick(%struct.Node* null, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  store %struct.Node* %4, %struct.Node** %p.addr, align 8
  %5 = load %struct.Node*, %struct.Node** %root.addr, align 8
  %6 = call %struct.Node* @pick(%struct.Node* %5, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  store %struct.Node* %6, %struct.Node** %q.addr, align 8
  %7 = call i32 @churn()
  store i32 %7, i32* %n.addr, align 4
  %8 = load %struct.Node*, %struct.Node** %root.addr, align 8
  %9 = getelementptr inbounds %struct.Node, %struct.Node* %8, i32 0, i32 1
  %10 = load %struct.Node*, %struct.Node** %9, align 8, !tbaa !4
  %11 = icmp ne %struct.Node* %10, null
  %12 = load %struct.Node*, %struct.Node** %root.addr, align 8
  %13 = select i1 %11, %struct.Node* %10, %struct.Node* %12
  store %struct.Node* %13, %struct.Node** %next.addr, align 8
  %14 = load %struct.Node*, %struct.Node** %p.addr, align 8
  %15 = getelementptr inbounds %struct.Node, %struct.Node* %14, i32 0, i32 0
  %16 = load i8*, i8** %15, align 8, !tbaa !5
  %17 = call i8* @nish_str_concat(i8* %16, i8* bitcast ({ i64, [2 x i8] }* @.str.9 to i8*))
  %18 = load %struct.Node*, %struct.Node** %q.addr, align 8
  %19 = getelementptr inbounds %struct.Node, %struct.Node* %18, i32 0, i32 0
  %20 = load i8*, i8** %19, align 8, !tbaa !5
  %21 = call i8* @nish_str_concat(i8* %17, i8* %20)
  %22 = call i8* @nish_str_concat(i8* %21, i8* bitcast ({ i64, [2 x i8] }* @.str.9 to i8*))
  %23 = load %struct.Node*, %struct.Node** %next.addr, align 8
  %24 = getelementptr inbounds %struct.Node, %struct.Node* %23, i32 0, i32 0
  %25 = load i8*, i8** %24, align 8, !tbaa !5
  %26 = call i8* @nish_str_concat(i8* %22, i8* %25)
  %27 = call i8* @nish_str_concat(i8* %26, i8* bitcast ({ i64, [2 x i8] }* @.str.9 to i8*))
  %28 = load i32, i32* %n.addr, align 4
  %29 = call i8* @nish_str_from_i32(i32 %28)
  %30 = call i8* @nish_str_concat(i8* %27, i8* %29)
  call void @nish_print(i8* %30)
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
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Node", !2, i64 0, !2, i64 8}
!4 = !{!3, !2, i64 8}
!5 = !{!3, !2, i64 0}
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
!17 = !{!"element ptr", !1, i64 0}
!18 = !{!17, !17, i64 0}

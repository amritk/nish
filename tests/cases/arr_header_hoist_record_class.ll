%struct.Node = type { i32 }
%struct.Grid = type { %struct.nish_array*, %struct.nish_array*, %struct.Node* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare void @nish_panic_div(i1 noundef zeroext) #3

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

define internal void @Node.constructor(%struct.Node* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %v) #0 {
entry:
  %0 = getelementptr inbounds %struct.Node, %struct.Node* %this, i32 0, i32 0
  store i32 %v, i32* %0, align 4, !tbaa !4
  ret void
}

define internal void @Grid.constructor(%struct.Grid* noundef nonnull noalias align 8 dereferenceable(24) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %nodes, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %src, %struct.Node* noundef nonnull align 8 dereferenceable(4) %spare) #0 {
entry:
  %0 = getelementptr inbounds %struct.Grid, %struct.Grid* %this, i32 0, i32 0
  store %struct.nish_array* %nodes, %struct.nish_array** %0, align 8, !tbaa !7
  %1 = getelementptr inbounds %struct.Grid, %struct.Grid* %this, i32 0, i32 1
  store %struct.nish_array* %src, %struct.nish_array** %1, align 8, !tbaa !8
  %2 = getelementptr inbounds %struct.Grid, %struct.Grid* %this, i32 0, i32 2
  store %struct.Node* %spare, %struct.Node** %2, align 8, !tbaa !9
  ret void
}

define internal noundef i32 @Grid.sumAndStamp(%struct.Grid* noundef nonnull readonly align 8 dereferenceable(24) nocapture %this) #1 {
entry:
  %t.addr = alloca i32, align 4
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %t.addr, align 4
  %0 = getelementptr inbounds %struct.Grid, %struct.Grid* %this, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !7
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %5 = getelementptr inbounds %struct.Grid, %struct.Grid* %this, i32 0, i32 1
  %6 = load %struct.nish_array*, %struct.nish_array** %5, align 8, !tbaa !8
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 0
  %8 = load i64, i64* %7, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %6, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %11 = getelementptr inbounds %struct.Grid, %struct.Grid* %this, i32 0, i32 0
  %12 = load %struct.nish_array*, %struct.nish_array** %11, align 8, !tbaa !7
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  br label %for.cond

for.cond:
  %17 = load i32, i32* %i.addr, align 4
  %18 = trunc i64 %8 to i32
  %19 = icmp slt i32 %17, %18
  br i1 %19, label %for.body, label %for.end

for.body:
  %20 = load i32, i32* %t.addr, align 4
  %21 = load i32, i32* %i.addr, align 4
  %22 = sext i32 %21 to i64
  %23 = bitcast i8* %10 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 %22
  %25 = load i32, i32* %24, align 4, !alias.scope !14, !noalias !13, !tbaa !21
  %26 = add nsw i32 %20, %25
  store i32 %26, i32* %t.addr, align 4
  %27 = load i32, i32* %i.addr, align 4
  %28 = load i32, i32* %n.addr, align 4
  %29 = icmp eq i32 %28, 0
  %30 = icmp eq i32 %27, -2147483648
  %31 = icmp eq i32 %28, -1
  %32 = and i1 %30, %31
  %33 = or i1 %29, %32
  br i1 %33, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %29)
  unreachable

div.ok:
  %34 = srem i32 %27, %28
  %35 = sext i32 %34 to i64
  %36 = getelementptr inbounds %struct.Grid, %struct.Grid* %this, i32 0, i32 2
  %37 = load %struct.Node*, %struct.Node** %36, align 8, !tbaa !9
  %38 = icmp ult i64 %35, %14
  br i1 %38, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %35, i64 %14)
  unreachable

bounds.ok:
  %39 = bitcast i8* %16 to %struct.Node**
  %40 = getelementptr inbounds %struct.Node*, %struct.Node** %39, i64 %35
  store %struct.Node* %37, %struct.Node** %40, align 8, !alias.scope !14, !noalias !13, !tbaa !23
  br label %for.inc

for.inc:
  %41 = load i32, i32* %i.addr, align 4
  %42 = add nsw i32 %41, 1
  store i32 %42, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %43 = load i32, i32* %t.addr, align 4
  ret i32 %43
}

define noundef i32 @nish_main() #1 {
entry:
  %g.addr = alloca %struct.Grid*, align 8
  %Grid.obj = alloca %struct.Grid, align 8
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.Node*
  call void @Node.constructor(%struct.Node* %1, i32 1)
  %2 = call i8* @nish_alloc_struct(i64 4)
  %3 = bitcast i8* %2 to %struct.Node*
  call void @Node.constructor(%struct.Node* %3, i32 2)
  %4 = call i8* @nish_alloc_struct(i64 24)
  %5 = bitcast i8* %4 to %struct.nish_array*
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  store i64 2, i64* %6, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  store i64 2, i64* %7, align 8, !alias.scope !13, !noalias !14, !tbaa !24
  %8 = call i8* @nish_alloc_struct(i64 16)
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  store i8* %8, i8** %9, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %10 = bitcast i8* %8 to %struct.Node**
  %11 = getelementptr inbounds %struct.Node*, %struct.Node** %10, i64 0
  store %struct.Node* %1, %struct.Node** %11, align 8, !alias.scope !14, !noalias !13, !tbaa !23
  %12 = getelementptr inbounds %struct.Node*, %struct.Node** %10, i64 1
  store %struct.Node* %3, %struct.Node** %12, align 8, !alias.scope !14, !noalias !13, !tbaa !23
  %13 = call i8* @nish_alloc_struct(i64 24)
  %14 = bitcast i8* %13 to %struct.nish_array*
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  store i64 5, i64* %15, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  store i64 5, i64* %16, align 8, !alias.scope !13, !noalias !14, !tbaa !24
  %17 = call i8* @nish_alloc_struct(i64 20)
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  store i8* %17, i8** %18, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %19 = bitcast i8* %17 to i32*
  %20 = getelementptr inbounds i32, i32* %19, i64 0
  store i32 10, i32* %20, align 4, !alias.scope !14, !noalias !13, !tbaa !21
  %21 = getelementptr inbounds i32, i32* %19, i64 1
  store i32 20, i32* %21, align 4, !alias.scope !14, !noalias !13, !tbaa !21
  %22 = getelementptr inbounds i32, i32* %19, i64 2
  store i32 30, i32* %22, align 4, !alias.scope !14, !noalias !13, !tbaa !21
  %23 = getelementptr inbounds i32, i32* %19, i64 3
  store i32 40, i32* %23, align 4, !alias.scope !14, !noalias !13, !tbaa !21
  %24 = getelementptr inbounds i32, i32* %19, i64 4
  store i32 50, i32* %24, align 4, !alias.scope !14, !noalias !13, !tbaa !21
  %25 = call i8* @nish_alloc_struct(i64 4)
  %26 = bitcast i8* %25 to %struct.Node*
  call void @Node.constructor(%struct.Node* %26, i32 9)
  call void @Grid.constructor(%struct.Grid* %Grid.obj, %struct.nish_array* %5, %struct.nish_array* %14, %struct.Node* %26)
  store %struct.Grid* %Grid.obj, %struct.Grid** %g.addr, align 8
  %27 = load %struct.Grid*, %struct.Grid** %g.addr, align 8
  %28 = call i32 @Grid.sumAndStamp(%struct.Grid* %27)
  %29 = call i8* @nish_str_from_i32(i32 %28)
  %30 = call i8* @nish_str_concat(i8* %29, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %31 = load %struct.Grid*, %struct.Grid** %g.addr, align 8
  %32 = getelementptr inbounds %struct.Grid, %struct.Grid* %31, i32 0, i32 0
  %33 = load %struct.nish_array*, %struct.nish_array** %32, align 8, !tbaa !7
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %36 = icmp ult i64 0, %35
  br i1 %36, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %35)
  unreachable

bounds.ok:
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %39 = bitcast i8* %38 to %struct.Node**
  %40 = getelementptr inbounds %struct.Node*, %struct.Node** %39, i64 0
  %41 = load %struct.Node*, %struct.Node** %40, align 8, !alias.scope !14, !noalias !13, !tbaa !23
  %42 = getelementptr inbounds %struct.Node, %struct.Node* %41, i32 0, i32 0
  %43 = load i32, i32* %42, align 4, !tbaa !4
  %44 = call i8* @nish_str_from_i32(i32 %43)
  %45 = call i8* @nish_str_concat(i8* %30, i8* %44)
  %46 = call i8* @nish_str_concat(i8* %45, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %47 = load %struct.Grid*, %struct.Grid** %g.addr, align 8
  %48 = getelementptr inbounds %struct.Grid, %struct.Grid* %47, i32 0, i32 0
  %49 = load %struct.nish_array*, %struct.nish_array** %48, align 8, !tbaa !7
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 0
  %51 = load i64, i64* %50, align 8, !alias.scope !13, !noalias !14, !tbaa !18
  %52 = icmp ult i64 1, %51
  br i1 %52, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %51)
  unreachable

bounds.ok.1:
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %49, i64 0, i32 2
  %54 = load i8*, i8** %53, align 8, !alias.scope !13, !noalias !14, !tbaa !19
  %55 = bitcast i8* %54 to %struct.Node**
  %56 = getelementptr inbounds %struct.Node*, %struct.Node** %55, i64 1
  %57 = load %struct.Node*, %struct.Node** %56, align 8, !alias.scope !14, !noalias !13, !tbaa !23
  %58 = getelementptr inbounds %struct.Node, %struct.Node* %57, i32 0, i32 0
  %59 = load i32, i32* %58, align 4, !tbaa !4
  %60 = call i8* @nish_str_from_i32(i32 %59)
  %61 = call i8* @nish_str_concat(i8* %46, i8* %60)
  call void @nish_print(i8* %61)
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
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Node", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"ptr", !1, i64 0}
!6 = !{!"Grid", !5, i64 0, !5, i64 8, !5, i64 16}
!7 = !{!6, !5, i64 0}
!8 = !{!6, !5, i64 8}
!9 = !{!6, !5, i64 16}
!10 = !{!"nish array"}
!11 = !{!"header", !10}
!12 = !{!"elements", !10}
!13 = !{!11}
!14 = !{!12}
!15 = !{!"header i64", !1, i64 0}
!16 = !{!"header ptr", !1, i64 0}
!17 = !{!"array header", !15, i64 0, !15, i64 8, !16, i64 16}
!18 = !{!17, !15, i64 0}
!19 = !{!17, !16, i64 16}
!20 = !{!"element i32", !1, i64 0}
!21 = !{!20, !20, i64 0}
!22 = !{!"element ptr", !1, i64 0}
!23 = !{!22, !22, i64 0}
!24 = !{!17, !15, i64 8}

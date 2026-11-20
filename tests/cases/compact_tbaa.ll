%struct.Cell = type { i32, i32 }
%struct.Node = type { i32, i32 }
%struct.Tag = type { i32 }
%struct.Holder = type { i32, %struct.Tag* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8
@nish_arena_range_abi = external constant i32, align 4

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #3 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off.raw = load i64, i64* %off.ptr, align 8
  %off.p7 = add i64 %off.raw, 7
  %off = and i64 %off.p7, -8
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
  %abi = load volatile i32, i32* @nish_arena_range_abi, align 4
  %grown = call i8* @nish_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define internal noalias noundef nonnull align 4 i8* @nish_alloc_ref(i64 noundef %size) #3 {
entry:
  %size.p3 = add i64 %size, 3
  %size.aligned = and i64 %size.p3, -4
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
  %abi = load volatile i32, i32* @nish_arena_range_abi, align 4
  %grown = call i8* @nish_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define internal void @Cell.constructor(%struct.Cell* noundef nonnull noalias align 4 dereferenceable(8) nocapture %this, i32 noundef %value, %struct.Cell* noundef align 4 %next) #0 {
entry:
  %0 = getelementptr inbounds %struct.Cell, %struct.Cell* %this, i32 0, i32 0
  store i32 %value, i32* %0, align 4, !tbaa !5
  %1 = getelementptr inbounds %struct.Cell, %struct.Cell* %this, i32 0, i32 1
  %2 = ptrtoint %struct.Cell* %next to i64
  %3 = lshr i64 %2, 2
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %1, align 4, !tbaa !6
  ret void
}

define internal void @Node.constructor(%struct.Node* noundef nonnull noalias align 4 dereferenceable(8) nocapture %this, i32 noundef %key, %struct.Cell* noundef align 4 %next) #0 {
entry:
  %0 = getelementptr inbounds %struct.Node, %struct.Node* %this, i32 0, i32 0
  store i32 %key, i32* %0, align 4, !tbaa !8
  %1 = getelementptr inbounds %struct.Node, %struct.Node* %this, i32 0, i32 1
  %2 = ptrtoint %struct.Cell* %next to i64
  %3 = lshr i64 %2, 2
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %1, align 4, !tbaa !9
  ret void
}

define internal void @Tag.constructor(%struct.Tag* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %id) #0 {
entry:
  %0 = getelementptr inbounds %struct.Tag, %struct.Tag* %this, i32 0, i32 0
  store i32 %id, i32* %0, align 4, !tbaa !11
  ret void
}

define internal void @Holder.constructor(%struct.Holder* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %count, %struct.Tag* noundef nonnull align 8 dereferenceable(4) %held) #0 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  store i32 %count, i32* %0, align 4, !tbaa !14
  %1 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 1
  store %struct.Tag* %held, %struct.Tag** %1, align 8, !tbaa !15
  ret void
}

define noundef i32 @relinkCount(i1 noundef zeroext %k, %struct.Cell* noundef nonnull align 4 dereferenceable(8) nocapture %p, %struct.Node* noundef nonnull align 4 dereferenceable(8) nocapture %q, %struct.Cell* noundef nonnull align 4 dereferenceable(8) %c, %struct.Holder* noundef nonnull align 8 dereferenceable(16) nocapture %h) #0 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  store i32 1, i32* %0, align 4, !tbaa !14
  br i1 %k, label %if.then, label %if.else

if.then:
  %1 = getelementptr inbounds %struct.Cell, %struct.Cell* %p, i32 0, i32 1
  %2 = ptrtoint %struct.Cell* %c to i64
  %3 = lshr i64 %2, 2
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %1, align 4, !tbaa !6
  br label %if.end

if.else:
  %5 = getelementptr inbounds %struct.Node, %struct.Node* %q, i32 0, i32 1
  %6 = ptrtoint %struct.Cell* %c to i64
  %7 = lshr i64 %6, 2
  %8 = trunc i64 %7 to i32
  store i32 %8, i32* %5, align 4, !tbaa !9
  br label %if.end

if.end:
  %9 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 0
  %10 = load i32, i32* %9, align 4, !tbaa !14
  ret i32 %10
}

define noundef nonnull align 8 dereferenceable(4) %struct.Tag* @relinkHeld(i1 noundef zeroext %k, %struct.Cell* noundef nonnull align 4 dereferenceable(8) nocapture %p, %struct.Node* noundef nonnull align 4 dereferenceable(8) nocapture %q, %struct.Cell* noundef nonnull align 4 dereferenceable(8) %c, %struct.Holder* noundef nonnull align 8 dereferenceable(16) nocapture %h, %struct.Tag* noundef nonnull align 8 dereferenceable(4) %t) #0 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 1
  store %struct.Tag* %t, %struct.Tag** %0, align 8, !tbaa !15
  br i1 %k, label %if.then, label %if.else

if.then:
  %1 = getelementptr inbounds %struct.Cell, %struct.Cell* %p, i32 0, i32 1
  %2 = ptrtoint %struct.Cell* %c to i64
  %3 = lshr i64 %2, 2
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %1, align 4, !tbaa !6
  br label %if.end

if.else:
  %5 = getelementptr inbounds %struct.Node, %struct.Node* %q, i32 0, i32 1
  %6 = ptrtoint %struct.Cell* %c to i64
  %7 = lshr i64 %6, 2
  %8 = trunc i64 %7 to i32
  store i32 %8, i32* %5, align 4, !tbaa !9
  br label %if.end

if.end:
  %9 = getelementptr inbounds %struct.Holder, %struct.Holder* %h, i32 0, i32 1
  %10 = load %struct.Tag*, %struct.Tag** %9, align 8, !tbaa !15
  ret %struct.Tag* %10
}

define noundef i32 @nish_main() #0 {
entry:
  %c.addr = alloca %struct.Cell*, align 8
  %p.addr = alloca %struct.Cell*, align 8
  %q.addr = alloca %struct.Node*, align 8
  %h.addr = alloca %struct.Holder*, align 8
  %Holder.obj = alloca %struct.Holder, align 8
  %pn.addr = alloca %struct.Cell*, align 8
  %qn.addr = alloca %struct.Cell*, align 8
  %0 = call i8* @nish_alloc_ref(i64 8)
  %1 = bitcast i8* %0 to %struct.Cell*
  call void @Cell.constructor(%struct.Cell* %1, i32 3, %struct.Cell* null)
  store %struct.Cell* %1, %struct.Cell** %c.addr, align 8
  %2 = call i8* @nish_alloc_ref(i64 8)
  %3 = bitcast i8* %2 to %struct.Cell*
  call void @Cell.constructor(%struct.Cell* %3, i32 2, %struct.Cell* null)
  store %struct.Cell* %3, %struct.Cell** %p.addr, align 8
  %4 = call i8* @nish_alloc_ref(i64 8)
  %5 = bitcast i8* %4 to %struct.Node*
  call void @Node.constructor(%struct.Node* %5, i32 1, %struct.Cell* null)
  store %struct.Node* %5, %struct.Node** %q.addr, align 8
  %6 = call i8* @nish_alloc_struct(i64 4)
  %7 = bitcast i8* %6 to %struct.Tag*
  call void @Tag.constructor(%struct.Tag* %7, i32 5)
  call void @Holder.constructor(%struct.Holder* %Holder.obj, i32 0, %struct.Tag* %7)
  store %struct.Holder* %Holder.obj, %struct.Holder** %h.addr, align 8
  %8 = load %struct.Cell*, %struct.Cell** %p.addr, align 8
  %9 = load %struct.Node*, %struct.Node** %q.addr, align 8
  %10 = load %struct.Cell*, %struct.Cell** %c.addr, align 8
  %11 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %12 = call i32 @relinkCount(i1 true, %struct.Cell* %8, %struct.Node* %9, %struct.Cell* %10, %struct.Holder* %11)
  %13 = call i8* @nish_str_from_i32(i32 %12)
  call void @nish_print(i8* %13)
  %14 = load %struct.Cell*, %struct.Cell** %p.addr, align 8
  %15 = load %struct.Node*, %struct.Node** %q.addr, align 8
  %16 = load %struct.Cell*, %struct.Cell** %c.addr, align 8
  %17 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %18 = call i8* @nish_alloc_struct(i64 4)
  %19 = bitcast i8* %18 to %struct.Tag*
  call void @Tag.constructor(%struct.Tag* %19, i32 7)
  %20 = call %struct.Tag* @relinkHeld(i1 false, %struct.Cell* %14, %struct.Node* %15, %struct.Cell* %16, %struct.Holder* %17, %struct.Tag* %19)
  %21 = getelementptr inbounds %struct.Tag, %struct.Tag* %20, i32 0, i32 0
  %22 = load i32, i32* %21, align 4, !tbaa !11
  %23 = call i8* @nish_str_from_i32(i32 %22)
  call void @nish_print(i8* %23)
  %24 = load %struct.Cell*, %struct.Cell** %p.addr, align 8
  %25 = getelementptr inbounds %struct.Cell, %struct.Cell* %24, i32 0, i32 1
  %26 = load i32, i32* %25, align 4, !tbaa !6
  %27 = zext i32 %26 to i64
  %28 = shl nuw nsw i64 %27, 2
  %29 = inttoptr i64 %28 to %struct.Cell*
  store %struct.Cell* %29, %struct.Cell** %pn.addr, align 8
  %30 = load %struct.Node*, %struct.Node** %q.addr, align 8
  %31 = getelementptr inbounds %struct.Node, %struct.Node* %30, i32 0, i32 1
  %32 = load i32, i32* %31, align 4, !tbaa !9
  %33 = zext i32 %32 to i64
  %34 = shl nuw nsw i64 %33, 2
  %35 = inttoptr i64 %34 to %struct.Cell*
  store %struct.Cell* %35, %struct.Cell** %qn.addr, align 8
  %36 = load %struct.Cell*, %struct.Cell** %pn.addr, align 8
  %37 = icmp ne %struct.Cell* %36, null
  br i1 %37, label %cond.true, label %cond.false

cond.true:
  %38 = load %struct.Cell*, %struct.Cell** %pn.addr, align 8
  %39 = getelementptr inbounds %struct.Cell, %struct.Cell* %38, i32 0, i32 0
  %40 = load i32, i32* %39, align 4, !tbaa !5
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %41 = phi i32 [ %40, %cond.true ], [ -1, %cond.false ]
  %42 = call i8* @nish_str_from_i32(i32 %41)
  call void @nish_print(i8* %42)
  %43 = load %struct.Cell*, %struct.Cell** %qn.addr, align 8
  %44 = icmp ne %struct.Cell* %43, null
  br i1 %44, label %cond.true.1, label %cond.false.1

cond.true.1:
  %45 = load %struct.Cell*, %struct.Cell** %qn.addr, align 8
  %46 = getelementptr inbounds %struct.Cell, %struct.Cell* %45, i32 0, i32 0
  %47 = load i32, i32* %46, align 4, !tbaa !5
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %48 = phi i32 [ %47, %cond.true.1 ], [ -1, %cond.false.1 ]
  %49 = call i8* @nish_str_from_i32(i32 %48)
  call void @nish_print(i8* %49)
  %50 = load %struct.Cell*, %struct.Cell** %p.addr, align 8
  %51 = getelementptr inbounds %struct.Cell, %struct.Cell* %50, i32 0, i32 0
  store i32 4, i32* %51, align 4, !tbaa !5
  %52 = load %struct.Cell*, %struct.Cell** %p.addr, align 8
  %53 = load %struct.Cell*, %struct.Cell** %p.addr, align 8
  %54 = getelementptr inbounds %struct.Cell, %struct.Cell* %52, i32 0, i32 1
  %55 = ptrtoint %struct.Cell* %53 to i64
  %56 = lshr i64 %55, 2
  %57 = trunc i64 %56 to i32
  store i32 %57, i32* %54, align 4, !tbaa !6
  %58 = load %struct.Cell*, %struct.Cell** %p.addr, align 8
  %59 = getelementptr inbounds %struct.Cell, %struct.Cell* %58, i32 0, i32 0
  %60 = load i32, i32* %59, align 4, !tbaa !5
  %61 = call i8* @nish_str_from_i32(i32 %60)
  call void @nish_print(i8* %61)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!16, !17, !18, !19, !20}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ref32", !1, i64 0}
!4 = !{!"Cell", !2, i64 0, !3, i64 4}
!5 = !{!4, !2, i64 0}
!6 = !{!4, !3, i64 4}
!7 = !{!"Node", !2, i64 0, !3, i64 4}
!8 = !{!7, !2, i64 0}
!9 = !{!7, !3, i64 4}
!10 = !{!"Tag", !2, i64 0}
!11 = !{!10, !2, i64 0}
!12 = !{!"ptr", !1, i64 0}
!13 = !{!"Holder", !2, i64 0, !12, i64 8}
!14 = !{!13, !2, i64 0}
!15 = !{!13, !12, i64 8}
!16 = !{i32 8, !"cf-protection-branch", i32 1}
!17 = !{i32 8, !"cf-protection-return", i32 1}
!18 = !{i32 8, !"branch-target-enforcement", i32 1}
!19 = !{i32 8, !"sign-return-address", i32 1}
!20 = !{i32 4, !"probe-stack", !"inline-asm"}

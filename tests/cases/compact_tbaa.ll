%struct.Cell = type { i32, i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8
@nish_arena_range_abi = external constant i32, align 4

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

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

define noundef i32 @relink(%struct.Cell* noundef nonnull align 4 dereferenceable(8) nocapture %a, %struct.Cell* noundef nonnull align 4 dereferenceable(8) nocapture %b, %struct.Cell* noundef nonnull align 4 dereferenceable(8) %c) #0 {
entry:
  %0 = getelementptr inbounds %struct.Cell, %struct.Cell* %a, i32 0, i32 0
  store i32 1, i32* %0, align 4, !tbaa !5
  %1 = getelementptr inbounds %struct.Cell, %struct.Cell* %b, i32 0, i32 1
  %2 = ptrtoint %struct.Cell* %c to i64
  %3 = lshr i64 %2, 2
  %4 = trunc i64 %3 to i32
  store i32 %4, i32* %1, align 4, !tbaa !6
  %5 = getelementptr inbounds %struct.Cell, %struct.Cell* %a, i32 0, i32 0
  %6 = load i32, i32* %5, align 4, !tbaa !5
  ret i32 %6
}

define noundef i32 @nish_main() #0 {
entry:
  %c.addr = alloca %struct.Cell*, align 8
  %b.addr = alloca %struct.Cell*, align 8
  %a.addr = alloca %struct.Cell*, align 8
  %next.addr = alloca %struct.Cell*, align 8
  %0 = call i8* @nish_alloc_ref(i64 8)
  %1 = bitcast i8* %0 to %struct.Cell*
  call void @Cell.constructor(%struct.Cell* %1, i32 3, %struct.Cell* null)
  store %struct.Cell* %1, %struct.Cell** %c.addr, align 8
  %2 = call i8* @nish_alloc_ref(i64 8)
  %3 = bitcast i8* %2 to %struct.Cell*
  call void @Cell.constructor(%struct.Cell* %3, i32 2, %struct.Cell* null)
  store %struct.Cell* %3, %struct.Cell** %b.addr, align 8
  %4 = call i8* @nish_alloc_ref(i64 8)
  %5 = bitcast i8* %4 to %struct.Cell*
  %6 = load %struct.Cell*, %struct.Cell** %b.addr, align 8
  call void @Cell.constructor(%struct.Cell* %5, i32 0, %struct.Cell* %6)
  store %struct.Cell* %5, %struct.Cell** %a.addr, align 8
  %7 = load %struct.Cell*, %struct.Cell** %a.addr, align 8
  %8 = load %struct.Cell*, %struct.Cell** %b.addr, align 8
  %9 = load %struct.Cell*, %struct.Cell** %c.addr, align 8
  %10 = call i32 @relink(%struct.Cell* %7, %struct.Cell* %8, %struct.Cell* %9)
  %11 = call i8* @nish_str_from_i32(i32 %10)
  call void @nish_print(i8* %11)
  %12 = load %struct.Cell*, %struct.Cell** %b.addr, align 8
  %13 = load %struct.Cell*, %struct.Cell** %b.addr, align 8
  %14 = load %struct.Cell*, %struct.Cell** %c.addr, align 8
  %15 = call i32 @relink(%struct.Cell* %12, %struct.Cell* %13, %struct.Cell* %14)
  %16 = call i8* @nish_str_from_i32(i32 %15)
  call void @nish_print(i8* %16)
  %17 = load %struct.Cell*, %struct.Cell** %b.addr, align 8
  %18 = getelementptr inbounds %struct.Cell, %struct.Cell* %17, i32 0, i32 1
  %19 = load i32, i32* %18, align 4, !tbaa !6
  %20 = zext i32 %19 to i64
  %21 = shl nuw nsw i64 %20, 2
  %22 = inttoptr i64 %21 to %struct.Cell*
  store %struct.Cell* %22, %struct.Cell** %next.addr, align 8
  %23 = load %struct.Cell*, %struct.Cell** %next.addr, align 8
  %24 = icmp ne %struct.Cell* %23, null
  br i1 %24, label %cond.true, label %cond.false

cond.true:
  %25 = load %struct.Cell*, %struct.Cell** %next.addr, align 8
  %26 = getelementptr inbounds %struct.Cell, %struct.Cell* %25, i32 0, i32 0
  %27 = load i32, i32* %26, align 4, !tbaa !5
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %28 = phi i32 [ %27, %cond.true ], [ -1, %cond.false ]
  %29 = call i8* @nish_str_from_i32(i32 %28)
  call void @nish_print(i8* %29)
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

!llvm.module.flags = !{!7, !8, !9, !10, !11}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ref32", !1, i64 0}
!4 = !{!"Cell", !2, i64 0, !3, i64 4}
!5 = !{!4, !2, i64 0}
!6 = !{!4, !3, i64 4}
!7 = !{i32 8, !"cf-protection-branch", i32 1}
!8 = !{i32 8, !"cf-protection-return", i32 1}
!9 = !{i32 8, !"branch-target-enforcement", i32 1}
!10 = !{i32 8, !"sign-return-address", i32 1}
!11 = !{i32 4, !"probe-stack", !"inline-asm"}

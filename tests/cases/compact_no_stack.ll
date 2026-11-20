%struct.Cell = type { i32, i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8
@nish_arena_range_abi = external constant i32, align 4

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

define internal noalias noundef nonnull align 4 i8* @nish_alloc_ref(i64 noundef %size) #5 {
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

define internal noundef i32 @pairSum(i32 noundef %a, i32 noundef %b) #1 {
entry:
  %cell.addr = alloca %struct.Cell*, align 8
  %next.addr = alloca %struct.Cell*, align 8
  %0 = call i8* @nish_alloc_ref(i64 8)
  %1 = bitcast i8* %0 to %struct.Cell*
  %2 = call i8* @nish_alloc_ref(i64 8)
  %3 = bitcast i8* %2 to %struct.Cell*
  call void @Cell.constructor(%struct.Cell* %3, i32 %b, %struct.Cell* null)
  call void @Cell.constructor(%struct.Cell* %1, i32 %a, %struct.Cell* %3)
  store %struct.Cell* %1, %struct.Cell** %cell.addr, align 8
  %4 = load %struct.Cell*, %struct.Cell** %cell.addr, align 8
  %5 = getelementptr inbounds %struct.Cell, %struct.Cell* %4, i32 0, i32 1
  %6 = load i32, i32* %5, align 4, !tbaa !6
  %7 = zext i32 %6 to i64
  %8 = shl nuw nsw i64 %7, 2
  %9 = inttoptr i64 %8 to %struct.Cell*
  store %struct.Cell* %9, %struct.Cell** %next.addr, align 8
  %10 = load %struct.Cell*, %struct.Cell** %next.addr, align 8
  %11 = icmp eq %struct.Cell* %10, null
  br i1 %11, label %cond.true, label %cond.false

cond.true:
  %12 = load %struct.Cell*, %struct.Cell** %cell.addr, align 8
  %13 = getelementptr inbounds %struct.Cell, %struct.Cell* %12, i32 0, i32 0
  %14 = load i32, i32* %13, align 4, !tbaa !5
  br label %cond.end

cond.false:
  %15 = load %struct.Cell*, %struct.Cell** %cell.addr, align 8
  %16 = getelementptr inbounds %struct.Cell, %struct.Cell* %15, i32 0, i32 0
  %17 = load i32, i32* %16, align 4, !tbaa !5
  %18 = load %struct.Cell*, %struct.Cell** %next.addr, align 8
  %19 = getelementptr inbounds %struct.Cell, %struct.Cell* %18, i32 0, i32 0
  %20 = load i32, i32* %19, align 4, !tbaa !5
  %21 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %17, i32 %20)
  %22 = extractvalue { i32, i1 } %21, 0
  %23 = extractvalue { i32, i1 } %21, 1
  br i1 %23, label %ovf.fail, label %ovf.ok

ovf.ok:
  br label %cond.end

cond.end:
  %24 = phi i32 [ %14, %cond.true ], [ %22, %ovf.ok ]
  ret i32 %24

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #1 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @pairSum(i32 3, i32 4)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  call void @nish_print(i8* %1)
  call void @nish_arena_release(i64 %arena.mark)
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
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

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

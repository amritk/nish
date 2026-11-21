target datalayout = "e-m:o-i64:64-i128:128-n32:64-S128"
target triple = "aarch64-apple-darwin"

%struct.Cell = type { i32, i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_ref_base = external global i8*, align 8
@nish_arena = external global %struct.nish_arena, align 8
@nish_arena_range_abi = external constant i32, align 4

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
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
  %3 = load i8*, i8** @nish_ref_base, align 8, !invariant.load !6
  %4 = ptrtoint i8* %3 to i64
  %5 = sub i64 %2, %4
  %6 = lshr i64 %5, 2
  %7 = trunc i64 %6 to i32
  %8 = icmp eq %struct.Cell* %next, null
  %9 = select i1 %8, i32 0, i32 %7
  store i32 %9, i32* %1, align 4, !tbaa !7
  ret void
}

define noundef i32 @nish_main() #1 {
entry:
  %cell.addr = alloca %struct.Cell*, align 8
  %next.addr = alloca %struct.Cell*, align 8
  %0 = call i8* @nish_alloc_ref(i64 8)
  %1 = bitcast i8* %0 to %struct.Cell*
  %2 = call i8* @nish_alloc_ref(i64 8)
  %3 = bitcast i8* %2 to %struct.Cell*
  call void @Cell.constructor(%struct.Cell* %3, i32 1, %struct.Cell* null)
  call void @Cell.constructor(%struct.Cell* %1, i32 2, %struct.Cell* %3)
  store %struct.Cell* %1, %struct.Cell** %cell.addr, align 8
  %4 = load %struct.Cell*, %struct.Cell** %cell.addr, align 8
  %5 = getelementptr inbounds %struct.Cell, %struct.Cell* %4, i32 0, i32 1
  %6 = load i32, i32* %5, align 4, !tbaa !7
  %7 = zext i32 %6 to i64
  %8 = shl nuw nsw i64 %7, 2
  %9 = load i8*, i8** @nish_ref_base, align 8, !invariant.load !6
  %10 = getelementptr inbounds i8, i8* %9, i64 %8
  %11 = bitcast i8* %10 to %struct.Cell*
  %12 = icmp eq i32 %6, 0
  %13 = select i1 %12, %struct.Cell* null, %struct.Cell* %11
  store %struct.Cell* %13, %struct.Cell** %next.addr, align 8
  %14 = load %struct.Cell*, %struct.Cell** %next.addr, align 8
  %15 = icmp eq %struct.Cell* %14, null
  br i1 %15, label %cond.true, label %cond.false

cond.true:
  %16 = load %struct.Cell*, %struct.Cell** %cell.addr, align 8
  %17 = getelementptr inbounds %struct.Cell, %struct.Cell* %16, i32 0, i32 0
  %18 = load i32, i32* %17, align 4, !tbaa !5
  br label %cond.end

cond.false:
  %19 = load %struct.Cell*, %struct.Cell** %cell.addr, align 8
  %20 = getelementptr inbounds %struct.Cell, %struct.Cell* %19, i32 0, i32 0
  %21 = load i32, i32* %20, align 4, !tbaa !5
  %22 = load %struct.Cell*, %struct.Cell** %next.addr, align 8
  %23 = getelementptr inbounds %struct.Cell, %struct.Cell* %22, i32 0, i32 0
  %24 = load i32, i32* %23, align 4, !tbaa !5
  %25 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %21, i32 %24)
  %26 = extractvalue { i32, i1 } %25, 0
  %27 = extractvalue { i32, i1 } %25, 1
  br i1 %27, label %ovf.fail, label %ovf.ok

ovf.ok:
  br label %cond.end

cond.end:
  %28 = phi i32 [ %18, %cond.true ], [ %26, %ovf.ok ]
  ret i32 %28

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
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

!llvm.module.flags = !{!8, !9, !10, !11, !12}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ref32", !1, i64 0}
!4 = !{!"Cell", !2, i64 0, !3, i64 4}
!5 = !{!4, !2, i64 0}
!6 = !{}
!7 = !{!4, !3, i64 4}
!8 = !{i32 8, !"cf-protection-branch", i32 1}
!9 = !{i32 8, !"cf-protection-return", i32 1}
!10 = !{i32 8, !"branch-target-enforcement", i32 1}
!11 = !{i32 8, !"sign-return-address", i32 1}
!12 = !{i32 4, !"probe-stack", !"inline-asm"}

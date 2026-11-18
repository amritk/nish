%struct.Node = type { i32 }
%struct.Cell = type { i32, i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8
@nish_arena_range_abi = external constant i32, align 4

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5

define internal noalias noundef nonnull align 4 i8* @nish_alloc_ref(i64 noundef %size) #6 {
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

define internal void @Cell.constructor(%struct.Cell* noundef nonnull noalias align 4 dereferenceable(8) nocapture %this, i32 noundef %value) #0 {
entry:
  %0 = getelementptr inbounds %struct.Cell, %struct.Cell* %this, i32 0, i32 1
  %1 = ptrtoint %struct.Cell* null to i64
  %2 = lshr i64 %1, 2
  %3 = trunc i64 %2 to i32
  store i32 %3, i32* %0, align 4
  %4 = getelementptr inbounds %struct.Cell, %struct.Cell* %this, i32 0, i32 0
  store i32 %value, i32* %4, align 4
  ret void
}

define internal noundef i32 @read$(%struct.Node* noundef nonnull readonly align 4 dereferenceable(4) nocapture %n) #1 {
entry:
  %0 = getelementptr inbounds %struct.Node, %struct.Node* %n, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  ret i32 %1
}

define noundef i32 @nish_main() #2 {
entry:
  %a.addr = alloca %struct.Cell*, align 8
  %b.addr = alloca %struct.Cell*, align 8
  %0 = call i8* @nish_alloc_ref(i64 8)
  %1 = bitcast i8* %0 to %struct.Cell*
  call void @Cell.constructor(%struct.Cell* %1, i32 4)
  store %struct.Cell* %1, %struct.Cell** %a.addr, align 8
  %2 = load %struct.Cell*, %struct.Cell** %a.addr, align 8
  %3 = call i8* @nish_alloc_ref(i64 8)
  %4 = bitcast i8* %3 to %struct.Cell*
  call void @Cell.constructor(%struct.Cell* %4, i32 5)
  %5 = getelementptr inbounds %struct.Cell, %struct.Cell* %2, i32 0, i32 1
  %6 = ptrtoint %struct.Cell* %4 to i64
  %7 = lshr i64 %6, 2
  %8 = trunc i64 %7 to i32
  store i32 %8, i32* %5, align 4
  %9 = load %struct.Cell*, %struct.Cell** %a.addr, align 8
  %10 = getelementptr inbounds %struct.Cell, %struct.Cell* %9, i32 0, i32 1
  %11 = load i32, i32* %10, align 4
  %12 = zext i32 %11 to i64
  %13 = shl nuw nsw i64 %12, 2
  %14 = inttoptr i64 %13 to %struct.Cell*
  store %struct.Cell* %14, %struct.Cell** %b.addr, align 8
  %15 = load %struct.Cell*, %struct.Cell** %a.addr, align 8
  %16 = bitcast %struct.Cell* %15 to %struct.Node*
  %17 = call i32 @read$(%struct.Node* %16)
  %18 = load %struct.Cell*, %struct.Cell** %b.addr, align 8
  %19 = icmp eq %struct.Cell* %18, null
  br i1 %19, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  %20 = load %struct.Cell*, %struct.Cell** %b.addr, align 8
  %21 = bitcast %struct.Cell* %20 to %struct.Node*
  %22 = call i32 @read$(%struct.Node* %21)
  br label %cond.end

cond.end:
  %23 = phi i32 [ 0, %cond.true ], [ %22, %cond.false ]
  %24 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %17, i32 %23)
  %25 = extractvalue { i32, i1 } %24, 0
  %26 = extractvalue { i32, i1 } %24, 1
  br i1 %26, label %ovf.fail, label %ovf.ok

ovf.ok:
  %27 = call i8* @nish_str_from_i32(i32 %25)
  call void @nish_print(i8* %27)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
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
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #5 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}

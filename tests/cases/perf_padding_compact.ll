%struct.Spill = type { i32, double, i32 }
%struct.Pair = type { i32, i32, i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8
@nish_arena_range_abi = external constant i32, align 4

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
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

define internal noalias noundef nonnull align 4 i8* @nish_alloc_ref(i64 noundef %size) #4 {
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

define noundef i32 @test() #0 {
entry:
  %s.addr = alloca %struct.Spill*, align 8
  %p.addr = alloca %struct.Pair*, align 8
  %next.addr = alloca %struct.Spill*, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.Spill*
  %2 = getelementptr inbounds %struct.Spill, %struct.Spill* %1, i32 0, i32 0
  %3 = ptrtoint %struct.Spill* null to i64
  %4 = lshr i64 %3, 2
  %5 = trunc i64 %4 to i32
  store i32 %5, i32* %2, align 4
  %6 = getelementptr inbounds %struct.Spill, %struct.Spill* %1, i32 0, i32 1
  store double 0x0000000000000000, double* %6, align 8, !tbaa !6
  %7 = getelementptr inbounds %struct.Spill, %struct.Spill* %1, i32 0, i32 2
  store i32 0, i32* %7, align 4, !tbaa !7
  store %struct.Spill* %1, %struct.Spill** %s.addr, align 8
  %8 = load %struct.Spill*, %struct.Spill** %s.addr, align 8
  %9 = getelementptr inbounds %struct.Spill, %struct.Spill* %8, i32 0, i32 2
  store i32 7, i32* %9, align 4, !tbaa !7
  %10 = load %struct.Spill*, %struct.Spill** %s.addr, align 8
  %11 = call i8* @nish_alloc_struct(i64 24)
  %12 = bitcast i8* %11 to %struct.Spill*
  %13 = getelementptr inbounds %struct.Spill, %struct.Spill* %12, i32 0, i32 0
  %14 = ptrtoint %struct.Spill* null to i64
  %15 = lshr i64 %14, 2
  %16 = trunc i64 %15 to i32
  store i32 %16, i32* %13, align 4
  %17 = getelementptr inbounds %struct.Spill, %struct.Spill* %12, i32 0, i32 1
  store double 0x0000000000000000, double* %17, align 8, !tbaa !6
  %18 = getelementptr inbounds %struct.Spill, %struct.Spill* %12, i32 0, i32 2
  store i32 0, i32* %18, align 4, !tbaa !7
  %19 = getelementptr inbounds %struct.Spill, %struct.Spill* %10, i32 0, i32 0
  %20 = ptrtoint %struct.Spill* %12 to i64
  %21 = lshr i64 %20, 2
  %22 = trunc i64 %21 to i32
  store i32 %22, i32* %19, align 4
  %23 = call i8* @nish_alloc_ref(i64 12)
  %24 = bitcast i8* %23 to %struct.Pair*
  %25 = getelementptr inbounds %struct.Pair, %struct.Pair* %24, i32 0, i32 0
  store i32 0, i32* %25, align 4, !tbaa !9
  %26 = getelementptr inbounds %struct.Pair, %struct.Pair* %24, i32 0, i32 1
  %27 = ptrtoint %struct.Pair* null to i64
  %28 = lshr i64 %27, 2
  %29 = trunc i64 %28 to i32
  store i32 %29, i32* %26, align 4
  %30 = getelementptr inbounds %struct.Pair, %struct.Pair* %24, i32 0, i32 2
  %31 = ptrtoint %struct.Pair* null to i64
  %32 = lshr i64 %31, 2
  %33 = trunc i64 %32 to i32
  store i32 %33, i32* %30, align 4
  store %struct.Pair* %24, %struct.Pair** %p.addr, align 8
  %34 = load %struct.Pair*, %struct.Pair** %p.addr, align 8
  %35 = getelementptr inbounds %struct.Pair, %struct.Pair* %34, i32 0, i32 0
  store i32 3, i32* %35, align 4, !tbaa !9
  %36 = load %struct.Pair*, %struct.Pair** %p.addr, align 8
  %37 = call i8* @nish_alloc_ref(i64 12)
  %38 = bitcast i8* %37 to %struct.Pair*
  %39 = getelementptr inbounds %struct.Pair, %struct.Pair* %38, i32 0, i32 0
  store i32 0, i32* %39, align 4, !tbaa !9
  %40 = getelementptr inbounds %struct.Pair, %struct.Pair* %38, i32 0, i32 1
  %41 = ptrtoint %struct.Pair* null to i64
  %42 = lshr i64 %41, 2
  %43 = trunc i64 %42 to i32
  store i32 %43, i32* %40, align 4
  %44 = getelementptr inbounds %struct.Pair, %struct.Pair* %38, i32 0, i32 2
  %45 = ptrtoint %struct.Pair* null to i64
  %46 = lshr i64 %45, 2
  %47 = trunc i64 %46 to i32
  store i32 %47, i32* %44, align 4
  %48 = getelementptr inbounds %struct.Pair, %struct.Pair* %36, i32 0, i32 1
  %49 = ptrtoint %struct.Pair* %38 to i64
  %50 = lshr i64 %49, 2
  %51 = trunc i64 %50 to i32
  store i32 %51, i32* %48, align 4
  %52 = load %struct.Spill*, %struct.Spill** %s.addr, align 8
  %53 = getelementptr inbounds %struct.Spill, %struct.Spill* %52, i32 0, i32 0
  %54 = load i32, i32* %53, align 4
  %55 = zext i32 %54 to i64
  %56 = shl nuw nsw i64 %55, 2
  %57 = inttoptr i64 %56 to %struct.Spill*
  store %struct.Spill* %57, %struct.Spill** %next.addr, align 8
  %58 = load %struct.Spill*, %struct.Spill** %s.addr, align 8
  %59 = getelementptr inbounds %struct.Spill, %struct.Spill* %58, i32 0, i32 2
  %60 = load i32, i32* %59, align 4, !tbaa !7
  %61 = load %struct.Pair*, %struct.Pair** %p.addr, align 8
  %62 = getelementptr inbounds %struct.Pair, %struct.Pair* %61, i32 0, i32 0
  %63 = load i32, i32* %62, align 4, !tbaa !9
  %64 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %60, i32 %63)
  %65 = extractvalue { i32, i1 } %64, 0
  %66 = extractvalue { i32, i1 } %64, 1
  br i1 %66, label %ovf.fail, label %ovf.ok

ovf.ok:
  %67 = load %struct.Spill*, %struct.Spill** %next.addr, align 8
  %68 = icmp eq %struct.Spill* %67, null
  br i1 %68, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %69 = phi i32 [ 0, %cond.true ], [ 1, %cond.false ]
  %70 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %65, i32 %69)
  %71 = extractvalue { i32, i1 } %70, 0
  %72 = extractvalue { i32, i1 } %70, 1
  br i1 %72, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %73 = load %struct.Pair*, %struct.Pair** %p.addr, align 8
  %74 = getelementptr inbounds %struct.Pair, %struct.Pair* %73, i32 0, i32 1
  %75 = load i32, i32* %74, align 4
  %76 = zext i32 %75 to i64
  %77 = shl nuw nsw i64 %76, 2
  %78 = inttoptr i64 %77 to %struct.Pair*
  %79 = icmp eq %struct.Pair* %78, null
  br i1 %79, label %cond.true.1, label %cond.false.1

cond.true.1:
  br label %cond.end.1

cond.false.1:
  br label %cond.end.1

cond.end.1:
  %80 = phi i32 [ 0, %cond.true.1 ], [ 1, %cond.false.1 ]
  %81 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %71, i32 %80)
  %82 = extractvalue { i32, i1 } %81, 0
  %83 = extractvalue { i32, i1 } %81, 1
  br i1 %83, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  ret i32 %82

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!10, !11, !12, !13, !14}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"double", !1, i64 0}
!4 = !{!"i32", !1, i64 0}
!5 = !{!"Spill", !2, i64 0, !3, i64 8, !4, i64 16}
!6 = !{!5, !3, i64 8}
!7 = !{!5, !4, i64 16}
!8 = !{!"Pair", !4, i64 0, !2, i64 4, !2, i64 8}
!9 = !{!8, !4, i64 0}
!10 = !{i32 8, !"cf-protection-branch", i32 1}
!11 = !{i32 8, !"cf-protection-return", i32 1}
!12 = !{i32 8, !"branch-target-enforcement", i32 1}
!13 = !{i32 8, !"sign-return-address", i32 1}
!14 = !{i32 4, !"probe-stack", !"inline-asm"}

%struct.Point = type { i32, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #4
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #4

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #5 {
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

define internal void @Point.constructor(%struct.Point* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %x, i32 noundef %y) #0 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  store i32 %x, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 1
  store i32 %y, i32* %1, align 4, !tbaa !5
  ret void
}

define void @nish_main() #1 {
entry:
  %points.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x %struct.Point*], align 8
  %pattern.306.addr = alloca %struct.Point*, align 8
  %forof.idx = alloca i64, align 8
  %x.addr = alloca i32, align 4
  %y.addr = alloca i32, align 4
  %pairs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [2 x %struct.nish_array*], align 8
  %pattern.401.addr = alloca %struct.nish_array*, align 8
  %forof.idx.1 = alloca i64, align 8
  %lo.addr = alloca i32, align 4
  %hi.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Point*
  call void @Point.constructor(%struct.Point* %1, i32 1, i32 2)
  %2 = call i8* @nish_alloc_struct(i64 8)
  %3 = bitcast i8* %2 to %struct.Point*
  call void @Point.constructor(%struct.Point* %3, i32 5, i32 6)
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %4, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %5, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %6 = bitcast [2 x %struct.Point*]* %arr.data to i8*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %8 = bitcast i8* %6 to %struct.Point**
  %9 = getelementptr inbounds %struct.Point*, %struct.Point** %8, i64 0
  store %struct.Point* %1, %struct.Point** %9, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %10 = getelementptr inbounds %struct.Point*, %struct.Point** %8, i64 1
  store %struct.Point* %3, %struct.Point** %10, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %points.addr, align 8
  %11 = load %struct.nish_array*, %struct.nish_array** %points.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %12 = load i64, i64* %forof.idx, align 8
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  %14 = load i64, i64* %13, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %15 = icmp ult i64 %12, %14
  br i1 %15, label %forof.body, label %forof.end

forof.body:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %18 = bitcast i8* %17 to %struct.Point**
  %19 = getelementptr inbounds %struct.Point*, %struct.Point** %18, i64 %12
  %20 = load %struct.Point*, %struct.Point** %19, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  store %struct.Point* %20, %struct.Point** %pattern.306.addr, align 8
  %21 = load %struct.Point*, %struct.Point** %pattern.306.addr, align 8
  %22 = getelementptr inbounds %struct.Point, %struct.Point* %21, i32 0, i32 0
  %23 = load i32, i32* %22, align 4, !tbaa !4
  store i32 %23, i32* %x.addr, align 4
  %24 = load %struct.Point*, %struct.Point** %pattern.306.addr, align 8
  %25 = getelementptr inbounds %struct.Point, %struct.Point* %24, i32 0, i32 1
  %26 = load i32, i32* %25, align 4, !tbaa !5
  store i32 %26, i32* %y.addr, align 4
  %27 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %28 = load i8*, i8** %27, align 8
  %29 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %30 = load i64, i64* %29, align 8
  %31 = load i32, i32* %x.addr, align 4
  %32 = load i32, i32* %y.addr, align 4
  %33 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %31, i32 %32)
  %34 = extractvalue { i32, i1 } %33, 0
  %35 = extractvalue { i32, i1 } %33, 1
  br i1 %35, label %ovf.fail, label %ovf.ok

ovf.ok:
  %36 = call i8* @nish_str_from_i32(i32 %34)
  call void @nish_print(i8* %36)
  %37 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %38 = load i8*, i8** %37, align 8
  %39 = icmp eq i8* %38, %28
  br i1 %39, label %pass.rewind, label %pass.free

pass.rewind:
  %40 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %30, i64* %40, align 8
  br label %pass.done

pass.free:
  %41 = ptrtoint i8* %28 to i64
  %42 = add i64 %41, %30
  call void @nish_arena_release(i64 %42)
  br label %pass.done

pass.done:
  br label %forof.inc

forof.inc:
  %43 = load i64, i64* %forof.idx, align 8
  %44 = add i64 %43, 1
  store i64 %44, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %45 = call i8* @nish_alloc_struct(i64 24)
  %46 = bitcast i8* %45 to %struct.nish_array*
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  store i64 2, i64* %47, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 1
  store i64 2, i64* %48, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %49 = call i8* @nish_alloc_struct(i64 8)
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  store i8* %49, i8** %50, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %51 = bitcast i8* %49 to i32*
  %52 = getelementptr inbounds i32, i32* %51, i64 0
  store i32 1, i32* %52, align 4, !alias.scope !10, !noalias !9, !tbaa !20
  %53 = getelementptr inbounds i32, i32* %51, i64 1
  store i32 4, i32* %53, align 4, !alias.scope !10, !noalias !9, !tbaa !20
  %54 = call i8* @nish_alloc_struct(i64 24)
  %55 = bitcast i8* %54 to %struct.nish_array*
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 0
  store i64 2, i64* %56, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 1
  store i64 2, i64* %57, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %58 = call i8* @nish_alloc_struct(i64 8)
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %55, i64 0, i32 2
  store i8* %58, i8** %59, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %60 = bitcast i8* %58 to i32*
  %61 = getelementptr inbounds i32, i32* %60, i64 0
  store i32 9, i32* %61, align 4, !alias.scope !10, !noalias !9, !tbaa !20
  %62 = getelementptr inbounds i32, i32* %60, i64 1
  store i32 2, i32* %62, align 4, !alias.scope !10, !noalias !9, !tbaa !20
  %63 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %63, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %64, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %65 = bitcast [2 x %struct.nish_array*]* %arr.data.1 to i8*
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %65, i8** %66, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %67 = bitcast i8* %65 to %struct.nish_array**
  %68 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %67, i64 0
  store %struct.nish_array* %46, %struct.nish_array** %68, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  %69 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %67, i64 1
  store %struct.nish_array* %55, %struct.nish_array** %69, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %pairs.addr, align 8
  %70 = load %struct.nish_array*, %struct.nish_array** %pairs.addr, align 8
  store i64 0, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.cond.1:
  %71 = load i64, i64* %forof.idx.1, align 8
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 0
  %73 = load i64, i64* %72, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %74 = icmp ult i64 %71, %73
  br i1 %74, label %forof.body.1, label %forof.end.1

forof.body.1:
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %70, i64 0, i32 2
  %76 = load i8*, i8** %75, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %77 = bitcast i8* %76 to %struct.nish_array**
  %78 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %77, i64 %71
  %79 = load %struct.nish_array*, %struct.nish_array** %78, align 8, !alias.scope !10, !noalias !9, !tbaa !18
  store %struct.nish_array* %79, %struct.nish_array** %pattern.401.addr, align 8
  %80 = load %struct.nish_array*, %struct.nish_array** %pattern.401.addr, align 8
  %81 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %80, i64 0, i32 0
  %82 = load i64, i64* %81, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %83 = icmp ult i64 0, %82
  br i1 %83, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %82)
  unreachable

bounds.ok:
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %80, i64 0, i32 2
  %85 = load i8*, i8** %84, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %86 = bitcast i8* %85 to i32*
  %87 = getelementptr inbounds i32, i32* %86, i64 0
  %88 = load i32, i32* %87, align 4, !alias.scope !10, !noalias !9, !tbaa !20
  store i32 %88, i32* %lo.addr, align 4
  %89 = load %struct.nish_array*, %struct.nish_array** %pattern.401.addr, align 8
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %89, i64 0, i32 0
  %91 = load i64, i64* %90, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %92 = icmp ult i64 1, %91
  br i1 %92, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %91)
  unreachable

bounds.ok.1:
  %93 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %89, i64 0, i32 2
  %94 = load i8*, i8** %93, align 8, !alias.scope !9, !noalias !10, !tbaa !16
  %95 = bitcast i8* %94 to i32*
  %96 = getelementptr inbounds i32, i32* %95, i64 1
  %97 = load i32, i32* %96, align 4, !alias.scope !10, !noalias !9, !tbaa !20
  store i32 %97, i32* %hi.addr, align 4
  %98 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %99 = load i8*, i8** %98, align 8
  %100 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %101 = load i64, i64* %100, align 8
  %102 = load i32, i32* %hi.addr, align 4
  %103 = load i32, i32* %lo.addr, align 4
  %104 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %102, i32 %103)
  %105 = extractvalue { i32, i1 } %104, 0
  %106 = extractvalue { i32, i1 } %104, 1
  br i1 %106, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %107 = call i8* @nish_str_from_i32(i32 %105)
  call void @nish_print(i8* %107)
  %108 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %109 = load i8*, i8** %108, align 8
  %110 = icmp eq i8* %109, %99
  br i1 %110, label %pass.rewind.1, label %pass.free.1

pass.rewind.1:
  %111 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %101, i64* %111, align 8
  br label %pass.done.1

pass.free.1:
  %112 = ptrtoint i8* %99 to i64
  %113 = add i64 %112, %101
  call void @nish_arena_release(i64 %113)
  br label %pass.done.1

pass.done.1:
  br label %forof.inc.1

forof.inc.1:
  %114 = load i64, i64* %forof.idx.1, align 8
  %115 = add i64 %114, 1
  store i64 %115, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.end.1:
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 2, %forof.body ], [ 1, %bounds.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!21, !22, !23, !24, !25}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Point", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
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
!19 = !{!"element i32", !1, i64 0}
!20 = !{!19, !19, i64 0}
!21 = !{i32 8, !"cf-protection-branch", i32 1}
!22 = !{i32 8, !"cf-protection-return", i32 1}
!23 = !{i32 8, !"branch-target-enforcement", i32 1}
!24 = !{i32 8, !"sign-return-address", i32 1}
!25 = !{i32 4, !"probe-stack", !"inline-asm"}

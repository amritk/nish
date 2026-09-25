%struct.Cell = type { i32, %struct.nish_array* }
%struct.Board = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #3

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

define void @Board.constructor(%struct.Board* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4
  %5 = getelementptr inbounds %struct.Board, %struct.Board* %this, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %5, align 8, !tbaa !9
  ret void
}

define noundef i32 @Board.swap(%struct.Board* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this, i32 noundef %i, i32 noundef %j) #1 {
entry:
  %c.addr = alloca %struct.Cell*, align 8
  %before.addr = alloca i32, align 4
  %tmp.addr = alloca %struct.Cell*, align 8
  %Cell.obj = alloca %struct.Cell, align 8
  %0 = getelementptr inbounds %struct.Board, %struct.Board* %this, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !9
  %2 = sext i32 %i to i64
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4
  %5 = icmp ult i64 %2, %4
  br i1 %5, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %2, i64 %4)
  unreachable

bounds.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4
  %8 = bitcast i8* %7 to %struct.Cell*
  %9 = getelementptr inbounds %struct.Cell, %struct.Cell* %8, i64 %2
  store %struct.Cell* %9, %struct.Cell** %c.addr, align 8
  %10 = load %struct.Cell*, %struct.Cell** %c.addr, align 8
  %11 = getelementptr inbounds %struct.Cell, %struct.Cell* %10, i32 0, i32 0
  %12 = load i32, i32* %11, align 4
  store i32 %12, i32* %before.addr, align 4
  %13 = getelementptr inbounds %struct.Board, %struct.Board* %this, i32 0, i32 0
  %14 = load %struct.nish_array*, %struct.nish_array** %13, align 8, !tbaa !9
  %15 = sext i32 %i to i64
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4
  %18 = icmp ult i64 %15, %17
  br i1 %18, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %15, i64 %17)
  unreachable

bounds.ok.1:
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4
  %21 = bitcast i8* %20 to %struct.Cell*
  %22 = getelementptr inbounds %struct.Cell, %struct.Cell* %21, i64 %15
  %23 = getelementptr inbounds %struct.Cell, %struct.Cell* %22, i32 0, i32 0
  %24 = load i32, i32* %23, align 4
  %25 = getelementptr inbounds %struct.Cell, %struct.Cell* %Cell.obj, i32 0, i32 0
  store i32 %24, i32* %25, align 4
  %26 = getelementptr inbounds %struct.Board, %struct.Board* %this, i32 0, i32 0
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !9
  %28 = sext i32 %i to i64
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  %30 = load i64, i64* %29, align 8, !alias.scope !3, !noalias !4
  %31 = icmp ult i64 %28, %30
  br i1 %31, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 %28, i64 %30)
  unreachable

bounds.ok.2:
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !3, !noalias !4
  %34 = bitcast i8* %33 to %struct.Cell*
  %35 = getelementptr inbounds %struct.Cell, %struct.Cell* %34, i64 %28
  %36 = getelementptr inbounds %struct.Cell, %struct.Cell* %35, i32 0, i32 1
  %37 = load %struct.nish_array*, %struct.nish_array** %36, align 8
  %38 = getelementptr inbounds %struct.Cell, %struct.Cell* %Cell.obj, i32 0, i32 1
  store %struct.nish_array* %37, %struct.nish_array** %38, align 8
  store %struct.Cell* %Cell.obj, %struct.Cell** %tmp.addr, align 8
  %39 = getelementptr inbounds %struct.Board, %struct.Board* %this, i32 0, i32 0
  %40 = load %struct.nish_array*, %struct.nish_array** %39, align 8, !tbaa !9
  %41 = sext i32 %i to i64
  %42 = getelementptr inbounds %struct.Board, %struct.Board* %this, i32 0, i32 0
  %43 = load %struct.nish_array*, %struct.nish_array** %42, align 8, !tbaa !9
  %44 = sext i32 %j to i64
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 0
  %46 = load i64, i64* %45, align 8, !alias.scope !3, !noalias !4
  %47 = icmp ult i64 %44, %46
  br i1 %47, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 %44, i64 %46)
  unreachable

bounds.ok.3:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %43, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8, !alias.scope !3, !noalias !4
  %50 = bitcast i8* %49 to %struct.Cell*
  %51 = getelementptr inbounds %struct.Cell, %struct.Cell* %50, i64 %44
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 0
  %53 = load i64, i64* %52, align 8, !alias.scope !3, !noalias !4
  %54 = icmp ult i64 %41, %53
  br i1 %54, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 %41, i64 %53)
  unreachable

bounds.ok.4:
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %40, i64 0, i32 2
  %56 = load i8*, i8** %55, align 8, !alias.scope !3, !noalias !4
  %57 = bitcast i8* %56 to %struct.Cell*
  %58 = getelementptr inbounds %struct.Cell, %struct.Cell* %57, i64 %41
  %59 = bitcast %struct.Cell* %58 to i8*
  %60 = bitcast %struct.Cell* %51 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 8 %59, i8* align 8 %60, i64 16, i1 false), !alias.scope !4, !noalias !3
  %61 = getelementptr inbounds %struct.Board, %struct.Board* %this, i32 0, i32 0
  %62 = load %struct.nish_array*, %struct.nish_array** %61, align 8, !tbaa !9
  %63 = sext i32 %j to i64
  %64 = load %struct.Cell*, %struct.Cell** %tmp.addr, align 8
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 0
  %66 = load i64, i64* %65, align 8, !alias.scope !3, !noalias !4
  %67 = icmp ult i64 %63, %66
  br i1 %67, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 %63, i64 %66)
  unreachable

bounds.ok.5:
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %62, i64 0, i32 2
  %69 = load i8*, i8** %68, align 8, !alias.scope !3, !noalias !4
  %70 = bitcast i8* %69 to %struct.Cell*
  %71 = getelementptr inbounds %struct.Cell, %struct.Cell* %70, i64 %63
  %72 = bitcast %struct.Cell* %71 to i8*
  %73 = bitcast %struct.Cell* %64 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 8 %72, i8* align 8 %73, i64 16, i1 false), !alias.scope !4, !noalias !3
  %74 = load i32, i32* %before.addr, align 4
  %75 = mul nsw i32 %74, 100
  %76 = load %struct.Cell*, %struct.Cell** %c.addr, align 8
  %77 = getelementptr inbounds %struct.Cell, %struct.Cell* %76, i32 0, i32 0
  %78 = load i32, i32* %77, align 4
  %79 = mul nsw i32 %78, 10
  %80 = add nsw i32 %75, %79
  %81 = load %struct.Cell*, %struct.Cell** %c.addr, align 8
  %82 = getelementptr inbounds %struct.Cell, %struct.Cell* %81, i32 0, i32 1
  %83 = load %struct.nish_array*, %struct.nish_array** %82, align 8
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %83, i64 0, i32 0
  %85 = load i64, i64* %84, align 8, !alias.scope !3, !noalias !4
  %86 = icmp ult i64 0, %85
  br i1 %86, label %bounds.ok.6, label %bounds.fail.6

bounds.fail.6:
  call void @nish_panic_index(i64 0, i64 %85)
  unreachable

bounds.ok.6:
  %87 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %83, i64 0, i32 2
  %88 = load i8*, i8** %87, align 8, !alias.scope !3, !noalias !4
  %89 = bitcast i8* %88 to i32*
  %90 = getelementptr inbounds i32, i32* %89, i64 0
  %91 = load i32, i32* %90, align 4, !alias.scope !4, !noalias !3, !tbaa !11
  %92 = add nsw i32 %80, %91
  ret i32 %92
}

define noundef i32 @test() #1 {
entry:
  %b.addr = alloca %struct.Board*, align 8
  %Board.obj = alloca %struct.Board, align 8
  %Cell.obj = alloca %struct.Cell, align 8
  %Cell.obj.1 = alloca %struct.Cell, align 8
  call void @Board.constructor(%struct.Board* %Board.obj)
  store %struct.Board* %Board.obj, %struct.Board** %b.addr, align 8
  %0 = load %struct.Board*, %struct.Board** %b.addr, align 8
  %1 = getelementptr inbounds %struct.Cell, %struct.Cell* %Cell.obj, i32 0, i32 0
  store i32 1, i32* %1, align 4
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 1, i64* %4, align 8, !alias.scope !3, !noalias !4
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 1, i64* %5, align 8, !alias.scope !3, !noalias !4
  %6 = call i8* @nish_alloc_struct(i64 4)
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !3, !noalias !4
  %8 = bitcast i8* %6 to i32*
  %9 = getelementptr inbounds i32, i32* %8, i64 0
  store i32 4, i32* %9, align 4, !alias.scope !4, !noalias !3, !tbaa !11
  %10 = getelementptr inbounds %struct.Cell, %struct.Cell* %Cell.obj, i32 0, i32 1
  store %struct.nish_array* %3, %struct.nish_array** %10, align 8
  %11 = getelementptr inbounds %struct.Cell, %struct.Cell* %Cell.obj.1, i32 0, i32 0
  store i32 2, i32* %11, align 4
  %12 = call i8* @nish_alloc_struct(i64 24)
  %13 = bitcast i8* %12 to %struct.nish_array*
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  store i64 1, i64* %14, align 8, !alias.scope !3, !noalias !4
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1
  store i64 1, i64* %15, align 8, !alias.scope !3, !noalias !4
  %16 = call i8* @nish_alloc_struct(i64 4)
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  store i8* %16, i8** %17, align 8, !alias.scope !3, !noalias !4
  %18 = bitcast i8* %16 to i32*
  %19 = getelementptr inbounds i32, i32* %18, i64 0
  store i32 5, i32* %19, align 4, !alias.scope !4, !noalias !3, !tbaa !11
  %20 = getelementptr inbounds %struct.Cell, %struct.Cell* %Cell.obj.1, i32 0, i32 1
  store %struct.nish_array* %13, %struct.nish_array** %20, align 8
  %21 = call i8* @nish_alloc_struct(i64 24)
  %22 = bitcast i8* %21 to %struct.nish_array*
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  store i64 2, i64* %23, align 8, !alias.scope !3, !noalias !4
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 1
  store i64 2, i64* %24, align 8, !alias.scope !3, !noalias !4
  %25 = call i8* @nish_alloc_struct(i64 32)
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  store i8* %25, i8** %26, align 8, !alias.scope !3, !noalias !4
  %27 = bitcast i8* %25 to %struct.Cell*
  %28 = getelementptr inbounds %struct.Cell, %struct.Cell* %27, i64 0
  %29 = bitcast %struct.Cell* %28 to i8*
  %30 = bitcast %struct.Cell* %Cell.obj to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 8 %29, i8* align 8 %30, i64 16, i1 false), !alias.scope !4, !noalias !3
  %31 = getelementptr inbounds %struct.Cell, %struct.Cell* %27, i64 1
  %32 = bitcast %struct.Cell* %31 to i8*
  %33 = bitcast %struct.Cell* %Cell.obj.1 to i8*
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* align 8 %32, i8* align 8 %33, i64 16, i1 false), !alias.scope !4, !noalias !3
  %34 = getelementptr inbounds %struct.Board, %struct.Board* %0, i32 0, i32 0
  store %struct.nish_array* %22, %struct.nish_array** %34, align 8, !tbaa !9
  %35 = load %struct.Board*, %struct.Board** %b.addr, align 8
  %36 = call i32 @Board.swap(%struct.Board* %35, i32 0, i32 1)
  ret i32 %36
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"ptr", !6, i64 0}
!8 = !{!"Board", !7, i64 0}
!9 = !{!8, !7, i64 0}
!10 = !{!"element i32", !6, i64 0}
!11 = !{!10, !10, i64 0}

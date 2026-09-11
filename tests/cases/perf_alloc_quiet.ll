%struct.Point = type { i32, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
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

define noundef i32 @test() #0 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %fixed.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x i32], align 8
  %i.addr.1 = alloca i32, align 4
  %p.addr = alloca %struct.Point*, align 8
  %Point.obj = alloca %struct.Point, align 8
  %pair.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [2 x i32], align 8
  %kept.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %width.addr = alloca i32, align 4
  %i.addr.2 = alloca i32, align 4
  %row.addr = alloca %struct.nish_array*, align 8
  %once.addr = alloca %struct.nish_array*, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 3
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %2, align 8, !alias.scope !3, !noalias !4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %3, align 8, !alias.scope !3, !noalias !4
  %4 = mul i64 4, 4
  %5 = bitcast [4 x i32]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %5, i8 0, i64 %4, i1 false), !alias.scope !4, !noalias !3
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %5, i8** %6, align 8, !alias.scope !3, !noalias !4
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %fixed.addr, align 8
  %7 = load %struct.nish_array*, %struct.nish_array** %fixed.addr, align 8
  %8 = load i32, i32* %i.addr, align 4
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4
  %11 = icmp ult i64 0, %10
  br i1 %11, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %10)
  unreachable

bounds.ok:
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %13 = load i8*, i8** %12, align 8, !alias.scope !3, !noalias !4
  %14 = bitcast i8* %13 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 0
  store i32 %8, i32* %15, align 4, !alias.scope !4, !noalias !3
  %16 = load i32, i32* %total.addr, align 4
  %17 = load %struct.nish_array*, %struct.nish_array** %fixed.addr, align 8
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 0
  %19 = load i64, i64* %18, align 8, !alias.scope !3, !noalias !4
  %20 = icmp ult i64 0, %19
  br i1 %20, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %19)
  unreachable

bounds.ok.1:
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %17, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !3, !noalias !4
  %23 = bitcast i8* %22 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 0
  %25 = load i32, i32* %24, align 4, !alias.scope !4, !noalias !3
  %26 = add nsw i32 %16, %25
  %27 = load %struct.nish_array*, %struct.nish_array** %fixed.addr, align 8
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 0
  %29 = load i64, i64* %28, align 8, !alias.scope !3, !noalias !4
  %30 = trunc i64 %29 to i32
  %31 = add nsw i32 %26, %30
  store i32 %31, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %32 = load i32, i32* %i.addr, align 4
  %33 = add nsw i32 %32, 1
  store i32 %33, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %i.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %34 = load i32, i32* %i.addr.1, align 4
  %35 = icmp slt i32 %34, 3
  br i1 %35, label %for.body.1, label %for.end.1

for.body.1:
  %36 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 0
  store i32 0, i32* %36, align 4
  %37 = getelementptr inbounds %struct.Point, %struct.Point* %Point.obj, i32 0, i32 1
  store i32 0, i32* %37, align 4
  store %struct.Point* %Point.obj, %struct.Point** %p.addr, align 8
  %38 = load i32, i32* %i.addr.1, align 4
  %39 = load i32, i32* %i.addr.1, align 4
  %40 = add nsw i32 %39, 1
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %41, align 8, !alias.scope !3, !noalias !4
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %42, align 8, !alias.scope !3, !noalias !4
  %43 = bitcast [2 x i32]* %arr.data.1 to i8*
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %43, i8** %44, align 8, !alias.scope !3, !noalias !4
  %45 = bitcast i8* %43 to i32*
  %46 = getelementptr inbounds i32, i32* %45, i64 0
  store i32 %38, i32* %46, align 4, !alias.scope !4, !noalias !3
  %47 = getelementptr inbounds i32, i32* %45, i64 1
  store i32 %40, i32* %47, align 4, !alias.scope !4, !noalias !3
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %pair.addr, align 8
  %48 = load i32, i32* %total.addr, align 4
  %49 = load %struct.Point*, %struct.Point** %p.addr, align 8
  %50 = getelementptr inbounds %struct.Point, %struct.Point* %49, i32 0, i32 0
  %51 = load i32, i32* %50, align 4
  %52 = add nsw i32 %48, %51
  %53 = load %struct.nish_array*, %struct.nish_array** %pair.addr, align 8
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 0
  %55 = load i64, i64* %54, align 8, !alias.scope !3, !noalias !4
  %56 = icmp ult i64 1, %55
  br i1 %56, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 1, i64 %55)
  unreachable

bounds.ok.2:
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 2
  %58 = load i8*, i8** %57, align 8, !alias.scope !3, !noalias !4
  %59 = bitcast i8* %58 to i32*
  %60 = getelementptr inbounds i32, i32* %59, i64 1
  %61 = load i32, i32* %60, align 4, !alias.scope !4, !noalias !3
  %62 = add nsw i32 %52, %61
  store i32 %62, i32* %total.addr, align 4
  br label %for.inc.1

for.inc.1:
  %63 = load i32, i32* %i.addr.1, align 4
  %64 = add nsw i32 %63, 1
  store i32 %64, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 0, i64* %65, align 8, !alias.scope !3, !noalias !4
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 0, i64* %66, align 8, !alias.scope !3, !noalias !4
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* null, i8** %67, align 8, !alias.scope !3, !noalias !4
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %kept.addr, align 8
  store i32 2, i32* %width.addr, align 4
  store i32 0, i32* %i.addr.2, align 4
  br label %for.cond.2

for.cond.2:
  %68 = load i32, i32* %i.addr.2, align 4
  %69 = icmp slt i32 %68, 3
  br i1 %69, label %for.body.2, label %for.end.2

for.body.2:
  %70 = load i32, i32* %width.addr, align 4
  %71 = load i32, i32* %i.addr.2, align 4
  %72 = add nsw i32 %70, %71
  %73 = sext i32 %72 to i64
  %74 = call i8* @nish_alloc_struct(i64 24)
  %75 = bitcast i8* %74 to %struct.nish_array*
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 0
  store i64 %73, i64* %76, align 8, !alias.scope !3, !noalias !4
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 1
  store i64 %73, i64* %77, align 8, !alias.scope !3, !noalias !4
  %78 = mul i64 %73, 4
  %79 = call i8* @nish_alloc_struct(i64 %78)
  call void @llvm.memset.p0i8.i64(i8* align 8 %79, i8 0, i64 %78, i1 false), !alias.scope !4, !noalias !3
  %80 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %75, i64 0, i32 2
  store i8* %79, i8** %80, align 8, !alias.scope !3, !noalias !4
  store %struct.nish_array* %75, %struct.nish_array** %row.addr, align 8
  %81 = load %struct.nish_array*, %struct.nish_array** %row.addr, align 8
  %82 = load i32, i32* %i.addr.2, align 4
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 0
  %84 = load i64, i64* %83, align 8, !alias.scope !3, !noalias !4
  %85 = icmp ult i64 0, %84
  br i1 %85, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 0, i64 %84)
  unreachable

bounds.ok.3:
  %86 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %81, i64 0, i32 2
  %87 = load i8*, i8** %86, align 8, !alias.scope !3, !noalias !4
  %88 = bitcast i8* %87 to i32*
  %89 = getelementptr inbounds i32, i32* %88, i64 0
  store i32 %82, i32* %89, align 4, !alias.scope !4, !noalias !3
  %90 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %91 = load %struct.nish_array*, %struct.nish_array** %row.addr, align 8
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %90, i64 0, i32 0
  %93 = load i64, i64* %92, align 8, !alias.scope !3, !noalias !4
  %94 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %90, i64 0, i32 1
  %95 = load i64, i64* %94, align 8, !alias.scope !3, !noalias !4
  %96 = icmp eq i64 %93, %95
  br i1 %96, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %90, i64 8)
  br label %push.store

push.store:
  %97 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %90, i64 0, i32 2
  %98 = load i8*, i8** %97, align 8, !alias.scope !3, !noalias !4
  %99 = bitcast i8* %98 to %struct.nish_array**
  %100 = getelementptr inbounds %struct.nish_array*, %struct.nish_array** %99, i64 %93
  store %struct.nish_array* %91, %struct.nish_array** %100, align 8, !alias.scope !4, !noalias !3
  %101 = add i64 %93, 1
  store i64 %101, i64* %92, align 8, !alias.scope !3, !noalias !4
  %102 = trunc i64 %101 to i32
  br label %for.inc.2

for.inc.2:
  %103 = load i32, i32* %i.addr.2, align 4
  %104 = add nsw i32 %103, 1
  store i32 %104, i32* %i.addr.2, align 4
  br label %for.cond.2

for.end.2:
  %105 = load i32, i32* %width.addr, align 4
  %106 = sext i32 %105 to i64
  %107 = call i8* @nish_alloc_struct(i64 24)
  %108 = bitcast i8* %107 to %struct.nish_array*
  %109 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %108, i64 0, i32 0
  store i64 %106, i64* %109, align 8, !alias.scope !3, !noalias !4
  %110 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %108, i64 0, i32 1
  store i64 %106, i64* %110, align 8, !alias.scope !3, !noalias !4
  %111 = mul i64 %106, 4
  %112 = call i8* @nish_alloc_struct(i64 %111)
  call void @llvm.memset.p0i8.i64(i8* align 8 %112, i8 0, i64 %111, i1 false), !alias.scope !4, !noalias !3
  %113 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %108, i64 0, i32 2
  store i8* %112, i8** %113, align 8, !alias.scope !3, !noalias !4
  store %struct.nish_array* %108, %struct.nish_array** %once.addr, align 8
  %114 = load %struct.nish_array*, %struct.nish_array** %once.addr, align 8
  %115 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %114, i64 0, i32 0
  %116 = load i64, i64* %115, align 8, !alias.scope !3, !noalias !4
  %117 = icmp ult i64 0, %116
  br i1 %117, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 0, i64 %116)
  unreachable

bounds.ok.4:
  %118 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %114, i64 0, i32 2
  %119 = load i8*, i8** %118, align 8, !alias.scope !3, !noalias !4
  %120 = bitcast i8* %119 to i32*
  %121 = getelementptr inbounds i32, i32* %120, i64 0
  store i32 7, i32* %121, align 4, !alias.scope !4, !noalias !3
  %122 = load i32, i32* %total.addr, align 4
  %123 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %124 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %123, i64 0, i32 0
  %125 = load i64, i64* %124, align 8, !alias.scope !3, !noalias !4
  %126 = trunc i64 %125 to i32
  %127 = add nsw i32 %122, %126
  %128 = load %struct.nish_array*, %struct.nish_array** %once.addr, align 8
  %129 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %128, i64 0, i32 0
  %130 = load i64, i64* %129, align 8, !alias.scope !3, !noalias !4
  %131 = icmp ult i64 0, %130
  br i1 %131, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 0, i64 %130)
  unreachable

bounds.ok.5:
  %132 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %128, i64 0, i32 2
  %133 = load i8*, i8** %132, align 8, !alias.scope !3, !noalias !4
  %134 = bitcast i8* %133 to i32*
  %135 = getelementptr inbounds i32, i32* %134, i64 0
  %136 = load i32, i32* %135, align 4, !alias.scope !4, !noalias !3
  %137 = add nsw i32 %127, %136
  ret i32 %137
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}

%struct.Box$em.p1.en$Kind = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #0
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #0

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

define internal noundef i32 @array() #0 {
entry:
  ret i32 1
}

define noundef i32 @test() #1 {
entry:
  %a.addr = alloca i32, align 4
  %c.addr = alloca i1, align 1
  %t.addr = alloca i32, align 4
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i32], align 8
  %m.addr = alloca %struct.nish_array*, align 8
  %ys.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [1 x i32], align 8
  %zs.addr = alloca %struct.nish_array*, align 8
  %u.addr = alloca i32, align 4
  %fromCall.addr = alloca i32, align 4
  %p.addr = alloca i32, align 4
  %q.addr = alloca i32, align 4
  %box.addr = alloca %struct.Box$em.p1.en$Kind*, align 8
  %Box$em.p1.en$Kind.obj = alloca %struct.Box$em.p1.en$Kind, align 8
  %r.addr = alloca i32, align 4
  %s.addr = alloca i32, align 4
  %all.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [9 x i32], align 8
  %same.addr = alloca i32, align 4
  %k.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %0 = call i32 @array()
  store i32 %0, i32* %a.addr, align 4
  %1 = load i32, i32* %a.addr, align 4
  %2 = icmp eq i32 %1, 1
  store i1 %2, i1* %c.addr, align 1
  %3 = load i1, i1* %c.addr, align 1
  br i1 %3, label %cond.true, label %cond.false

cond.true:
  %4 = load i32, i32* %a.addr, align 4
  br label %cond.end

cond.false:
  %5 = load i32, i32* %a.addr, align 4
  br label %cond.end

cond.end:
  %6 = phi i32 [ %4, %cond.true ], [ %5, %cond.false ]
  store i32 %6, i32* %t.addr, align 4
  %7 = load i1, i1* %c.addr, align 1
  br i1 %7, label %cond.true.1, label %cond.false.1

cond.true.1:
  %8 = load i1, i1* %c.addr, align 1
  br i1 %8, label %cond.true.2, label %cond.false.2

cond.true.2:
  %9 = load i32, i32* %a.addr, align 4
  br label %cond.end.2

cond.false.2:
  %10 = load i32, i32* %a.addr, align 4
  br label %cond.end.2

cond.end.2:
  %11 = phi i32 [ %9, %cond.true.2 ], [ %10, %cond.false.2 ]
  br label %cond.end.1

cond.false.1:
  %12 = load i32, i32* %a.addr, align 4
  br label %cond.end.1

cond.end.1:
  %13 = phi i32 [ %11, %cond.end.2 ], [ %12, %cond.false.1 ]
  store i32 %13, i32* %t.addr, align 4
  %14 = load i32, i32* %a.addr, align 4
  %15 = load i32, i32* %t.addr, align 4
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %18 = bitcast [2 x i32]* %arr.data to i8*
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %18, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %20 = bitcast i8* %18 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 0
  store i32 %14, i32* %21, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %22 = getelementptr inbounds i32, i32* %20, i64 1
  store i32 %15, i32* %22, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %23 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 1
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %28 = icmp eq i64 %25, %27
  br i1 %28, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %23, i64 4)
  br label %push.store

push.store:
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %23, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %31 = bitcast i8* %30 to i32*
  %32 = getelementptr inbounds i32, i32* %31, i64 %25
  store i32 1, i32* %32, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %33 = add i64 %25, 1
  store i64 %33, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %34 = trunc i64 %33 to i32
  %35 = load i1, i1* %c.addr, align 1
  br i1 %35, label %cond.true.3, label %cond.false.3

cond.true.3:
  %36 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  br label %cond.end.3

cond.false.3:
  br label %cond.end.3

cond.end.3:
  %37 = phi %struct.nish_array* [ %36, %cond.true.3 ], [ null, %cond.false.3 ]
  store %struct.nish_array* %37, %struct.nish_array** %m.addr, align 8
  %38 = load %struct.nish_array*, %struct.nish_array** %m.addr, align 8
  %39 = icmp ne %struct.nish_array* %38, null
  br i1 %39, label %nullish.end, label %nullish.default

nullish.default:
  %40 = load i32, i32* %a.addr, align 4
  %41 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 1, i64* %41, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 1, i64* %42, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %43 = bitcast [1 x i32]* %arr.data.1 to i8*
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %43, i8** %44, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %45 = bitcast i8* %43 to i32*
  %46 = getelementptr inbounds i32, i32* %45, i64 0
  store i32 %40, i32* %46, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  br label %nullish.end

nullish.end:
  %47 = phi %struct.nish_array* [ %38, %cond.end.3 ], [ %arr.hdr.1, %nullish.default ]
  store %struct.nish_array* %47, %struct.nish_array** %ys.addr, align 8
  %48 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %49 = load i32, i32* %t.addr, align 4
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 0
  %51 = load i64, i64* %50, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 1
  %53 = load i64, i64* %52, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %54 = icmp eq i64 %51, %53
  br i1 %54, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %48, i64 4)
  br label %push.store.1

push.store.1:
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 2
  %56 = load i8*, i8** %55, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %57 = bitcast i8* %56 to i32*
  %58 = getelementptr inbounds i32, i32* %57, i64 %51
  store i32 %49, i32* %58, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %59 = add i64 %51, 1
  store i64 %59, i64* %50, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %60 = trunc i64 %59 to i32
  %61 = load i32, i32* %a.addr, align 4
  %62 = call i8* @nish_alloc_struct(i64 24)
  %63 = bitcast i8* %62 to %struct.nish_array*
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 0
  store i64 1, i64* %64, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %65 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 1
  store i64 1, i64* %65, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %66 = call i8* @nish_alloc_struct(i64 4)
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 2
  store i8* %66, i8** %67, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %68 = bitcast i8* %66 to i32*
  %69 = getelementptr inbounds i32, i32* %68, i64 0
  store i32 %61, i32* %69, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %70 = call %struct.nish_array* @wrap$em.p1.en$Kind(%struct.nish_array* %63)
  store %struct.nish_array* %70, %struct.nish_array** %zs.addr, align 8
  %71 = load %struct.nish_array*, %struct.nish_array** %zs.addr, align 8
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %71, i64 0, i32 0
  %73 = load i64, i64* %72, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %74 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %71, i64 0, i32 1
  %75 = load i64, i64* %74, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %76 = icmp eq i64 %73, %75
  br i1 %76, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %71, i64 4)
  br label %push.store.2

push.store.2:
  %77 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %71, i64 0, i32 2
  %78 = load i8*, i8** %77, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %79 = bitcast i8* %78 to i32*
  %80 = getelementptr inbounds i32, i32* %79, i64 %73
  store i32 1, i32* %80, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %81 = add i64 %73, 1
  store i64 %81, i64* %72, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %82 = trunc i64 %81 to i32
  %83 = load i1, i1* %c.addr, align 1
  br i1 %83, label %cond.true.4, label %cond.false.4

cond.true.4:
  %84 = load i32, i32* %a.addr, align 4
  br label %cond.end.4

cond.false.4:
  %85 = load i32, i32* %a.addr, align 4
  br label %cond.end.4

cond.end.4:
  %86 = phi i32 [ %84, %cond.true.4 ], [ %85, %cond.false.4 ]
  %87 = call i32 @id$em.p1.en$Kind(i32 %86)
  store i32 %87, i32* %u.addr, align 4
  %88 = call i32 @array()
  store i32 %88, i32* %fromCall.addr, align 4
  %89 = call i32 @tag$i32(i32 3, i32 1)
  store i32 %89, i32* %p.addr, align 4
  %90 = load i32, i32* %fromCall.addr, align 4
  %91 = call i32 @tag$i32(i32 4, i32 %90)
  store i32 %91, i32* %q.addr, align 4
  %92 = load i32, i32* %a.addr, align 4
  call void @Box$em.p1.en$Kind.constructor(%struct.Box$em.p1.en$Kind* %Box$em.p1.en$Kind.obj, i32 %92)
  store %struct.Box$em.p1.en$Kind* %Box$em.p1.en$Kind.obj, %struct.Box$em.p1.en$Kind** %box.addr, align 8
  %93 = load %struct.Box$em.p1.en$Kind*, %struct.Box$em.p1.en$Kind** %box.addr, align 8
  %94 = call i32 @Box$em.p1.en$Kind.with(%struct.Box$em.p1.en$Kind* %93, i32 1)
  store i32 %94, i32* %r.addr, align 4
  %95 = load %struct.Box$em.p1.en$Kind*, %struct.Box$em.p1.en$Kind** %box.addr, align 8
  %96 = load i32, i32* %u.addr, align 4
  %97 = call i32 @Box$em.p1.en$Kind.with(%struct.Box$em.p1.en$Kind* %95, i32 %96)
  store i32 %97, i32* %s.addr, align 4
  %98 = load i32, i32* %t.addr, align 4
  %99 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %100 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %99, i64 0, i32 0
  %101 = load i64, i64* %100, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %102 = icmp ult i64 2, %101
  br i1 %102, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 2, i64 %101)
  unreachable

bounds.ok:
  %103 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %99, i64 0, i32 2
  %104 = load i8*, i8** %103, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %105 = bitcast i8* %104 to i32*
  %106 = getelementptr inbounds i32, i32* %105, i64 2
  %107 = load i32, i32* %106, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %108 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %109 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %108, i64 0, i32 0
  %110 = load i64, i64* %109, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %111 = icmp ult i64 0, %110
  br i1 %111, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %110)
  unreachable

bounds.ok.1:
  %112 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %108, i64 0, i32 2
  %113 = load i8*, i8** %112, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %114 = bitcast i8* %113 to i32*
  %115 = getelementptr inbounds i32, i32* %114, i64 0
  %116 = load i32, i32* %115, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %117 = load %struct.nish_array*, %struct.nish_array** %zs.addr, align 8
  %118 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %117, i64 0, i32 0
  %119 = load i64, i64* %118, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %120 = icmp ult i64 1, %119
  br i1 %120, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 1, i64 %119)
  unreachable

bounds.ok.2:
  %121 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %117, i64 0, i32 2
  %122 = load i8*, i8** %121, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %123 = bitcast i8* %122 to i32*
  %124 = getelementptr inbounds i32, i32* %123, i64 1
  %125 = load i32, i32* %124, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %126 = load i32, i32* %u.addr, align 4
  %127 = load i32, i32* %p.addr, align 4
  %128 = load i32, i32* %q.addr, align 4
  %129 = load i32, i32* %r.addr, align 4
  %130 = load i32, i32* %s.addr, align 4
  %131 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 9, i64* %131, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %132 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 9, i64* %132, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %133 = bitcast [9 x i32]* %arr.data.2 to i8*
  %134 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %133, i8** %134, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %135 = bitcast i8* %133 to i32*
  %136 = getelementptr inbounds i32, i32* %135, i64 0
  store i32 %98, i32* %136, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %137 = getelementptr inbounds i32, i32* %135, i64 1
  store i32 %107, i32* %137, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %138 = getelementptr inbounds i32, i32* %135, i64 2
  store i32 %116, i32* %138, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %139 = getelementptr inbounds i32, i32* %135, i64 3
  store i32 %125, i32* %139, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %140 = getelementptr inbounds i32, i32* %135, i64 4
  store i32 %126, i32* %140, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %141 = getelementptr inbounds i32, i32* %135, i64 5
  store i32 %127, i32* %141, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %142 = getelementptr inbounds i32, i32* %135, i64 6
  store i32 %128, i32* %142, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %143 = getelementptr inbounds i32, i32* %135, i64 7
  store i32 %129, i32* %143, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %144 = getelementptr inbounds i32, i32* %135, i64 8
  store i32 %130, i32* %144, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %all.addr, align 8
  store i32 0, i32* %same.addr, align 4
  %145 = load %struct.nish_array*, %struct.nish_array** %all.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %146 = load i64, i64* %forof.idx, align 8
  %147 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %145, i64 0, i32 0
  %148 = load i64, i64* %147, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %149 = icmp ult i64 %146, %148
  br i1 %149, label %forof.body, label %forof.end

forof.body:
  %150 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %145, i64 0, i32 2
  %151 = load i8*, i8** %150, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %152 = bitcast i8* %151 to i32*
  %153 = getelementptr inbounds i32, i32* %152, i64 %146
  %154 = load i32, i32* %153, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %154, i32* %k.addr, align 4
  %155 = load i32, i32* %same.addr, align 4
  %156 = load i32, i32* %k.addr, align 4
  %157 = icmp eq i32 %156, 1
  br i1 %157, label %cond.true.5, label %cond.false.5

cond.true.5:
  br label %cond.end.5

cond.false.5:
  br label %cond.end.5

cond.end.5:
  %158 = phi i32 [ 1, %cond.true.5 ], [ 0, %cond.false.5 ]
  %159 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %155, i32 %158)
  %160 = extractvalue { i32, i1 } %159, 0
  %161 = extractvalue { i32, i1 } %159, 1
  br i1 %161, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %160, i32* %same.addr, align 4
  br label %forof.inc

forof.inc:
  %162 = load i64, i64* %forof.idx, align 8
  %163 = add i64 %162, 1
  store i64 %163, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %164 = load i32, i32* %same.addr, align 4
  %165 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %164, i32 10)
  %166 = extractvalue { i32, i1 } %165, 0
  %167 = extractvalue { i32, i1 } %165, 1
  br i1 %167, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %168 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %169 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %168, i64 0, i32 0
  %170 = load i64, i64* %169, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %171 = trunc i64 %170 to i32
  %172 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %166, i32 %171)
  %173 = extractvalue { i32, i1 } %172, 0
  %174 = extractvalue { i32, i1 } %172, 1
  br i1 %174, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %175 = load %struct.nish_array*, %struct.nish_array** %ys.addr, align 8
  %176 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %175, i64 0, i32 0
  %177 = load i64, i64* %176, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %178 = trunc i64 %177 to i32
  %179 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %173, i32 %178)
  %180 = extractvalue { i32, i1 } %179, 0
  %181 = extractvalue { i32, i1 } %179, 1
  br i1 %181, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  ret i32 %180

ovf.fail:
  %ovf.op = phi i32 [ 0, %cond.end.5 ], [ 2, %forof.end ], [ 0, %ovf.ok.1 ], [ 0, %ovf.ok.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define internal void @Box$em.p1.en$Kind.constructor(%struct.Box$em.p1.en$Kind* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %v) #2 {
entry:
  %0 = getelementptr inbounds %struct.Box$em.p1.en$Kind, %struct.Box$em.p1.en$Kind* %this, i32 0, i32 0
  store i32 %v, i32* %0, align 4, !tbaa !17
  ret void
}

define internal noundef i32 @Box$em.p1.en$Kind.with(%struct.Box$em.p1.en$Kind* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this, i32 noundef %x) #0 {
entry:
  ret i32 %x
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @wrap$em.p1.en$Kind(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %xs) #0 {
entry:
  ret %struct.nish_array* %xs
}

define internal noundef i32 @id$em.p1.en$Kind(i32 noundef %x) #0 {
entry:
  ret i32 %x
}

define internal noundef i32 @tag$i32(i32 noundef %x, i32 noundef %k) #0 {
entry:
  ret i32 %k
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!18, !19, !20, !21, !22}
!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"i32", !6, i64 0}
!16 = !{!"Box$em.p1.en$Kind", !15, i64 0}
!17 = !{!16, !15, i64 0}
!18 = !{i32 8, !"cf-protection-branch", i32 1}
!19 = !{i32 8, !"cf-protection-return", i32 1}
!20 = !{i32 8, !"branch-target-enforcement", i32 1}
!21 = !{i32 8, !"sign-return-address", i32 1}
!22 = !{i32 4, !"probe-stack", !"inline-asm"}

%struct.Cell = type { i32, i32 }
%struct.Tree = type { i32, i32, i32 }
%struct.Holder = type { i8*, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"list\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8
@nish_arena_range_abi = external constant i32, align 4

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
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

define internal void @Tree.constructor(%struct.Tree* noundef nonnull noalias align 4 dereferenceable(12) nocapture %this, i32 noundef %depth) #1 {
entry:
  %0 = getelementptr inbounds %struct.Tree, %struct.Tree* %this, i32 0, i32 0
  %1 = ptrtoint %struct.Tree* null to i64
  %2 = lshr i64 %1, 2
  %3 = trunc i64 %2 to i32
  store i32 %3, i32* %0, align 4, !tbaa !8
  %4 = getelementptr inbounds %struct.Tree, %struct.Tree* %this, i32 0, i32 1
  %5 = ptrtoint %struct.Tree* null to i64
  %6 = lshr i64 %5, 2
  %7 = trunc i64 %6 to i32
  store i32 %7, i32* %4, align 4, !tbaa !9
  %8 = getelementptr inbounds %struct.Tree, %struct.Tree* %this, i32 0, i32 2
  store i32 %depth, i32* %8, align 4, !tbaa !10
  %9 = icmp sgt i32 %depth, 0
  br i1 %9, label %if.then, label %if.end

if.then:
  %10 = call i8* @nish_alloc_ref(i64 12)
  %11 = bitcast i8* %10 to %struct.Tree*
  %12 = sub nsw i32 %depth, 1
  call void @Tree.constructor(%struct.Tree* %11, i32 %12)
  %13 = getelementptr inbounds %struct.Tree, %struct.Tree* %this, i32 0, i32 0
  %14 = ptrtoint %struct.Tree* %11 to i64
  %15 = lshr i64 %14, 2
  %16 = trunc i64 %15 to i32
  store i32 %16, i32* %13, align 4, !tbaa !8
  %17 = call i8* @nish_alloc_ref(i64 12)
  %18 = bitcast i8* %17 to %struct.Tree*
  %19 = sub nsw i32 %depth, 1
  call void @Tree.constructor(%struct.Tree* %18, i32 %19)
  %20 = getelementptr inbounds %struct.Tree, %struct.Tree* %this, i32 0, i32 1
  %21 = ptrtoint %struct.Tree* %18 to i64
  %22 = lshr i64 %21, 2
  %23 = trunc i64 %22 to i32
  store i32 %23, i32* %20, align 4, !tbaa !9
  br label %if.end

if.end:
  ret void
}

define internal void @Holder.constructor(%struct.Holder* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i8* noundef nonnull noalias readonly align 8 %name) #0 {
entry:
  %0 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 1
  %1 = ptrtoint %struct.Cell* null to i64
  %2 = lshr i64 %1, 2
  %3 = trunc i64 %2 to i32
  store i32 %3, i32* %0, align 4, !tbaa !13
  %4 = getelementptr inbounds %struct.Holder, %struct.Holder* %this, i32 0, i32 0
  store i8* %name, i8** %4, align 8, !tbaa !14
  ret void
}

define internal noundef i32 @count(%struct.Tree* noundef readonly align 4 nocapture %t.in) #1 {
entry:
  br label %rec.head

rec.head:
  %t = phi %struct.Tree* [ %t.in, %entry ], [ %17, %ovf.ok.1 ]
  %rec.prev = phi i32 [ 0, %entry ], [ %rec.sum, %ovf.ok.1 ]
  %rec.last = phi i32 [ 0, %entry ], [ %11, %ovf.ok.1 ]
  %rec.sum = add i32 %rec.prev, %rec.last
  %rec.signs = or i32 %rec.last, %rec.sum
  %rec.cold = icmp slt i32 %rec.signs, 0
  %0 = icmp eq %struct.Tree* %t, null
  %rec.leave = or i1 %0, %rec.cold
  br i1 %rec.leave, label %rec.exit, label %if.end

if.then:
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.sum, i32 0)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %2

if.end:
  %4 = getelementptr inbounds %struct.Tree, %struct.Tree* %t, i32 0, i32 0
  %5 = load i32, i32* %4, align 4, !tbaa !8
  %6 = zext i32 %5 to i64
  %7 = shl nuw nsw i64 %6, 2
  %8 = inttoptr i64 %7 to %struct.Tree*
  %9 = call i32 @count(%struct.Tree* %8)
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 1, i32 %9)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %13 = getelementptr inbounds %struct.Tree, %struct.Tree* %t, i32 0, i32 1
  %14 = load i32, i32* %13, align 4, !tbaa !9
  %15 = zext i32 %14 to i64
  %16 = shl nuw nsw i64 %15, 2
  %17 = inttoptr i64 %16 to %struct.Tree*
  br label %rec.head

rec.exit:
  br i1 %rec.cold, label %rec.call, label %if.then

rec.call:
  %18 = call i32 @count(%struct.Tree* %t)
  %19 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.last, i32 %18)
  %20 = extractvalue { i32, i1 } %19, 0
  %21 = extractvalue { i32, i1 } %19, 1
  br i1 %21, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %22 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %rec.prev, i32 %20)
  %23 = extractvalue { i32, i1 } %22, 0
  %24 = extractvalue { i32, i1 } %22, 1
  br i1 %24, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  ret i32 %23

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #1 {
entry:
  %head.addr = alloca %struct.Cell*, align 8
  %i.addr = alloca i32, align 4
  %sum.addr = alloca i32, align 4
  %c.addr = alloca %struct.Cell*, align 8
  %h.addr = alloca %struct.Holder*, align 8
  %Holder.obj = alloca %struct.Holder, align 8
  %first.addr = alloca %struct.Cell*, align 8
  %second.addr = alloca %struct.Cell*, align 8
  %cells.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %back.addr = alloca %struct.Cell*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store %struct.Cell* null, %struct.Cell** %head.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 5
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = call i8* @nish_alloc_ref(i64 8)
  %3 = bitcast i8* %2 to %struct.Cell*
  %4 = load i32, i32* %i.addr, align 4
  %5 = load %struct.Cell*, %struct.Cell** %head.addr, align 8
  call void @Cell.constructor(%struct.Cell* %3, i32 %4, %struct.Cell* %5)
  store %struct.Cell* %3, %struct.Cell** %head.addr, align 8
  br label %for.inc

for.inc:
  %6 = load i32, i32* %i.addr, align 4
  %7 = add nsw i32 %6, 1
  store i32 %7, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %sum.addr, align 4
  %8 = load %struct.Cell*, %struct.Cell** %head.addr, align 8
  store %struct.Cell* %8, %struct.Cell** %c.addr, align 8
  br label %while.cond

while.cond:
  %9 = load %struct.Cell*, %struct.Cell** %c.addr, align 8
  %10 = icmp ne %struct.Cell* %9, null
  br i1 %10, label %while.body, label %while.end

while.body:
  %11 = load i32, i32* %sum.addr, align 4
  %12 = load %struct.Cell*, %struct.Cell** %c.addr, align 8
  %13 = getelementptr inbounds %struct.Cell, %struct.Cell* %12, i32 0, i32 0
  %14 = load i32, i32* %13, align 4, !tbaa !5
  %15 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %11, i32 %14)
  %16 = extractvalue { i32, i1 } %15, 0
  %17 = extractvalue { i32, i1 } %15, 1
  br i1 %17, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %16, i32* %sum.addr, align 4
  %18 = load %struct.Cell*, %struct.Cell** %c.addr, align 8
  %19 = getelementptr inbounds %struct.Cell, %struct.Cell* %18, i32 0, i32 1
  %20 = load i32, i32* %19, align 4, !tbaa !6
  %21 = zext i32 %20 to i64
  %22 = shl nuw nsw i64 %21, 2
  %23 = inttoptr i64 %22 to %struct.Cell*
  store %struct.Cell* %23, %struct.Cell** %c.addr, align 8
  br label %while.cond

while.end:
  %24 = load i32, i32* %sum.addr, align 4
  %25 = call i8* @nish_str_from_i32(i32 %24)
  call void @nish_print(i8* %25)
  call void @Holder.constructor(%struct.Holder* %Holder.obj, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*))
  store %struct.Holder* %Holder.obj, %struct.Holder** %h.addr, align 8
  %26 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %27 = load %struct.Cell*, %struct.Cell** %head.addr, align 8
  %28 = getelementptr inbounds %struct.Holder, %struct.Holder* %26, i32 0, i32 1
  %29 = ptrtoint %struct.Cell* %27 to i64
  %30 = lshr i64 %29, 2
  %31 = trunc i64 %30 to i32
  store i32 %31, i32* %28, align 4, !tbaa !13
  %32 = load %struct.Holder*, %struct.Holder** %h.addr, align 8
  %33 = getelementptr inbounds %struct.Holder, %struct.Holder* %32, i32 0, i32 1
  %34 = load i32, i32* %33, align 4, !tbaa !13
  %35 = zext i32 %34 to i64
  %36 = shl nuw nsw i64 %35, 2
  %37 = inttoptr i64 %36 to %struct.Cell*
  store %struct.Cell* %37, %struct.Cell** %first.addr, align 8
  %38 = load %struct.Cell*, %struct.Cell** %first.addr, align 8
  %39 = icmp ne %struct.Cell* %38, null
  br i1 %39, label %if.then, label %if.end

if.then:
  %40 = load %struct.Cell*, %struct.Cell** %first.addr, align 8
  %41 = getelementptr inbounds %struct.Cell, %struct.Cell* %40, i32 0, i32 1
  %42 = load i32, i32* %41, align 4, !tbaa !6
  %43 = zext i32 %42 to i64
  %44 = shl nuw nsw i64 %43, 2
  %45 = inttoptr i64 %44 to %struct.Cell*
  store %struct.Cell* %45, %struct.Cell** %second.addr, align 8
  %46 = load %struct.Cell*, %struct.Cell** %second.addr, align 8
  %47 = icmp ne %struct.Cell* %46, null
  br i1 %47, label %if.then.1, label %if.end.1

if.then.1:
  %48 = load %struct.Cell*, %struct.Cell** %second.addr, align 8
  %49 = getelementptr inbounds %struct.Cell, %struct.Cell* %48, i32 0, i32 0
  %50 = load i32, i32* %49, align 4
  %51 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %50, i32 10)
  %52 = extractvalue { i32, i1 } %51, 0
  %53 = extractvalue { i32, i1 } %51, 1
  br i1 %53, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %52, i32* %49, align 4
  %54 = load %struct.Cell*, %struct.Cell** %second.addr, align 8
  %55 = getelementptr inbounds %struct.Cell, %struct.Cell* %54, i32 0, i32 0
  %56 = load i32, i32* %55, align 4, !tbaa !5
  %57 = call i8* @nish_str_from_i32(i32 %56)
  call void @nish_print(i8* %57)
  br label %if.end.1

if.end.1:
  br label %if.end

if.end:
  %58 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %58, align 8, !alias.scope !18, !noalias !19, !tbaa !23
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %59, align 8, !alias.scope !18, !noalias !19, !tbaa !24
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %60, align 8, !alias.scope !18, !noalias !19, !tbaa !25
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %cells.addr, align 8
  %61 = load %struct.Cell*, %struct.Cell** %head.addr, align 8
  store %struct.Cell* %61, %struct.Cell** %c.addr, align 8
  br label %while.cond.1

while.cond.1:
  %62 = load %struct.Cell*, %struct.Cell** %c.addr, align 8
  %63 = icmp ne %struct.Cell* %62, null
  br i1 %63, label %while.body.1, label %while.end.1

while.body.1:
  %64 = load %struct.nish_array*, %struct.nish_array** %cells.addr, align 8
  %65 = load %struct.Cell*, %struct.Cell** %c.addr, align 8
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 0
  %67 = load i64, i64* %66, align 8, !alias.scope !18, !noalias !19, !tbaa !23
  %68 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 1
  %69 = load i64, i64* %68, align 8, !alias.scope !18, !noalias !19, !tbaa !24
  %70 = icmp eq i64 %67, %69
  br i1 %70, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %64, i64 8)
  br label %push.store

push.store:
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %64, i64 0, i32 2
  %72 = load i8*, i8** %71, align 8, !alias.scope !18, !noalias !19, !tbaa !25
  %73 = bitcast i8* %72 to %struct.Cell**
  %74 = getelementptr inbounds %struct.Cell*, %struct.Cell** %73, i64 %67
  store %struct.Cell* %65, %struct.Cell** %74, align 8, !alias.scope !19, !noalias !18, !tbaa !27
  %75 = add i64 %67, 1
  store i64 %75, i64* %66, align 8, !alias.scope !18, !noalias !19, !tbaa !23
  %76 = trunc i64 %75 to i32
  %77 = load %struct.Cell*, %struct.Cell** %c.addr, align 8
  %78 = getelementptr inbounds %struct.Cell, %struct.Cell* %77, i32 0, i32 1
  %79 = load i32, i32* %78, align 4, !tbaa !6
  %80 = zext i32 %79 to i64
  %81 = shl nuw nsw i64 %80, 2
  %82 = inttoptr i64 %81 to %struct.Cell*
  store %struct.Cell* %82, %struct.Cell** %c.addr, align 8
  br label %while.cond.1

while.end.1:
  %83 = load %struct.nish_array*, %struct.nish_array** %cells.addr, align 8
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %83, i64 0, i32 0
  %85 = load i64, i64* %84, align 8, !alias.scope !18, !noalias !19, !tbaa !23
  %86 = trunc i64 %85 to i32
  %87 = call i8* @nish_str_from_i32(i32 %86)
  call void @nish_print(i8* %87)
  %88 = load %struct.nish_array*, %struct.nish_array** %cells.addr, align 8
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %88, i64 0, i32 0
  %90 = load i64, i64* %89, align 8, !alias.scope !18, !noalias !19, !tbaa !23
  %91 = icmp ult i64 4, %90
  br i1 %91, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 4, i64 %90)
  unreachable

bounds.ok:
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %88, i64 0, i32 2
  %93 = load i8*, i8** %92, align 8, !alias.scope !18, !noalias !19, !tbaa !25
  %94 = bitcast i8* %93 to %struct.Cell**
  %95 = getelementptr inbounds %struct.Cell*, %struct.Cell** %94, i64 4
  %96 = load %struct.Cell*, %struct.Cell** %95, align 8, !alias.scope !19, !noalias !18, !tbaa !27
  %97 = load %struct.nish_array*, %struct.nish_array** %cells.addr, align 8
  %98 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %97, i64 0, i32 2
  %99 = load i8*, i8** %98, align 8, !alias.scope !18, !noalias !19, !tbaa !25
  %100 = bitcast i8* %99 to %struct.Cell**
  %101 = getelementptr inbounds %struct.Cell*, %struct.Cell** %100, i64 0
  %102 = load %struct.Cell*, %struct.Cell** %101, align 8, !alias.scope !19, !noalias !18, !tbaa !27
  %103 = getelementptr inbounds %struct.Cell, %struct.Cell* %96, i32 0, i32 1
  %104 = ptrtoint %struct.Cell* %102 to i64
  %105 = lshr i64 %104, 2
  %106 = trunc i64 %105 to i32
  store i32 %106, i32* %103, align 4, !tbaa !6
  %107 = load %struct.nish_array*, %struct.nish_array** %cells.addr, align 8
  %108 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %107, i64 0, i32 2
  %109 = load i8*, i8** %108, align 8, !alias.scope !18, !noalias !19, !tbaa !25
  %110 = bitcast i8* %109 to %struct.Cell**
  %111 = getelementptr inbounds %struct.Cell*, %struct.Cell** %110, i64 4
  %112 = load %struct.Cell*, %struct.Cell** %111, align 8, !alias.scope !19, !noalias !18, !tbaa !27
  %113 = getelementptr inbounds %struct.Cell, %struct.Cell* %112, i32 0, i32 1
  %114 = load i32, i32* %113, align 4, !tbaa !6
  %115 = zext i32 %114 to i64
  %116 = shl nuw nsw i64 %115, 2
  %117 = inttoptr i64 %116 to %struct.Cell*
  store %struct.Cell* %117, %struct.Cell** %back.addr, align 8
  %118 = load %struct.Cell*, %struct.Cell** %back.addr, align 8
  %119 = icmp ne %struct.Cell* %118, null
  br i1 %119, label %cond.true, label %cond.false

cond.true:
  %120 = load %struct.Cell*, %struct.Cell** %back.addr, align 8
  %121 = getelementptr inbounds %struct.Cell, %struct.Cell* %120, i32 0, i32 0
  %122 = load i32, i32* %121, align 4, !tbaa !5
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %123 = phi i32 [ %122, %cond.true ], [ -1, %cond.false ]
  %124 = call i8* @nish_str_from_i32(i32 %123)
  call void @nish_print(i8* %124)
  %125 = call i8* @nish_alloc_ref(i64 12)
  %126 = bitcast i8* %125 to %struct.Tree*
  call void @Tree.constructor(%struct.Tree* %126, i32 10)
  %127 = call i32 @count(%struct.Tree* %126)
  %128 = call i8* @nish_str_from_i32(i32 %127)
  call void @nish_print(i8* %128)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

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

!llvm.module.flags = !{!28, !29, !30, !31, !32}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"ref32", !1, i64 0}
!4 = !{!"Cell", !2, i64 0, !3, i64 4}
!5 = !{!4, !2, i64 0}
!6 = !{!4, !3, i64 4}
!7 = !{!"Tree", !3, i64 0, !3, i64 4, !2, i64 8}
!8 = !{!7, !3, i64 0}
!9 = !{!7, !3, i64 4}
!10 = !{!7, !2, i64 8}
!11 = !{!"ptr", !1, i64 0}
!12 = !{!"Holder", !11, i64 0, !3, i64 8}
!13 = !{!12, !3, i64 8}
!14 = !{!12, !11, i64 0}
!15 = !{!"nish array"}
!16 = !{!"header", !15}
!17 = !{!"elements", !15}
!18 = !{!16}
!19 = !{!17}
!20 = !{!"header i64", !1, i64 0}
!21 = !{!"header ptr", !1, i64 0}
!22 = !{!"array header", !20, i64 0, !20, i64 8, !21, i64 16}
!23 = !{!22, !20, i64 0}
!24 = !{!22, !20, i64 8}
!25 = !{!22, !21, i64 16}
!26 = !{!"element ptr", !1, i64 0}
!27 = !{!26, !26, i64 0}
!28 = !{i32 8, !"cf-protection-branch", i32 1}
!29 = !{i32 8, !"cf-protection-return", i32 1}
!30 = !{i32 8, !"branch-target-enforcement", i32 1}
!31 = !{i32 8, !"sign-return-address", i32 1}
!32 = !{i32 4, !"probe-stack", !"inline-asm"}

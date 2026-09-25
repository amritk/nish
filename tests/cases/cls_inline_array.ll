%struct.Board = type { { %struct.nish_array, [8 x i32] }, { %struct.nish_array, [3 x i1] }, i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare void @nish_panic_div(i1 noundef zeroext) #4

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

define internal void @Board.constructor(%struct.Board* noundef nonnull noalias align 8 dereferenceable(96) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Board, %struct.Board* %this, i32 0, i32 2
  store i32 0, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Board, %struct.Board* %this, i32 0, i32 0, i32 0
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %3 = getelementptr inbounds %struct.Board, %struct.Board* %this, i32 0, i32 1, i32 0
  %4 = getelementptr inbounds %struct.Board, %struct.Board* %this, i32 0, i32 1, i32 1, i64 0
  %5 = bitcast i1* %4 to i8*
  %6 = bitcast i8* %5 to i1*
  %7 = getelementptr inbounds i1, i1* %6, i64 0
  store i1 false, i1* %7, align 1, !alias.scope !9, !noalias !8, !tbaa !15
  %8 = getelementptr inbounds i1, i1* %6, i64 1
  store i1 false, i1* %8, align 1, !alias.scope !9, !noalias !8, !tbaa !15
  %9 = getelementptr inbounds i1, i1* %6, i64 2
  store i1 false, i1* %9, align 1, !alias.scope !9, !noalias !8, !tbaa !15
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 3, i64* %10, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  ret void
}

define internal void @Board.reset(%struct.Board* noundef nonnull align 8 dereferenceable(96) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Board, %struct.Board* %this, i32 0, i32 0, i32 0
  %1 = getelementptr inbounds %struct.Board, %struct.Board* %this, i32 0, i32 0, i32 1, i64 0
  %2 = bitcast i32* %1 to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %2, i8 0, i64 32, i1 false), !alias.scope !9, !noalias !8
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  store i64 8, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %4 = getelementptr inbounds %struct.Board, %struct.Board* %this, i32 0, i32 2
  store i32 0, i32* %4, align 4, !tbaa !4
  ret void
}

define internal void @Board.mark(%struct.Board* noundef nonnull align 8 dereferenceable(96) nocapture %this, i32 noundef %i, i32 noundef %v) #1 {
entry:
  %0 = getelementptr inbounds %struct.Board, %struct.Board* %this, i32 0, i32 0, i32 0
  %1 = sext i32 %i to i64
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %4 = icmp ult i64 %1, %3
  br i1 %4, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %1, i64 %3)
  unreachable

bounds.ok:
  %5 = getelementptr inbounds %struct.Board, %struct.Board* %this, i32 0, i32 0, i32 1, i64 0
  %6 = bitcast i32* %5 to i8*
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 %1
  store i32 %v, i32* %8, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %9 = getelementptr inbounds %struct.Board, %struct.Board* %this, i32 0, i32 1, i32 0
  %10 = icmp eq i32 3, 0
  %11 = icmp eq i32 %i, -2147483648
  %12 = icmp eq i32 3, -1
  %13 = and i1 %11, %12
  %14 = or i1 %10, %13
  br i1 %14, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %10)
  unreachable

div.ok:
  %15 = srem i32 %i, 3
  %16 = sext i32 %15 to i64
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %19 = icmp ult i64 %16, %18
  br i1 %19, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 %16, i64 %18)
  unreachable

bounds.ok.1:
  %20 = getelementptr inbounds %struct.Board, %struct.Board* %this, i32 0, i32 1, i32 1, i64 0
  %21 = bitcast i1* %20 to i8*
  %22 = bitcast i8* %21 to i1*
  %23 = getelementptr inbounds i1, i1* %22, i64 %16
  store i1 true, i1* %23, align 1, !alias.scope !9, !noalias !8, !tbaa !15
  %24 = getelementptr inbounds %struct.Board, %struct.Board* %this, i32 0, i32 2
  %25 = load i32, i32* %24, align 4
  %26 = add nsw i32 %25, 1
  store i32 %26, i32* %24, align 4
  ret void
}

define internal noundef i32 @Board.sum(%struct.Board* noundef nonnull readonly align 8 dereferenceable(96) nocapture %this) #2 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.Board, %struct.Board* %this, i32 0, i32 0, i32 0
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %3 = getelementptr inbounds %struct.Board, %struct.Board* %this, i32 0, i32 0, i32 1, i64 0
  %4 = bitcast i32* %3 to i8*
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = trunc i64 %2 to i32
  %7 = icmp slt i32 %5, %6
  br i1 %7, label %for.body, label %for.end

for.body:
  %8 = load i32, i32* %total.addr, align 4
  %9 = load i32, i32* %i.addr, align 4
  %10 = sext i32 %9 to i64
  %11 = bitcast i8* %4 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 %10
  %13 = load i32, i32* %12, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %14 = add nsw i32 %8, %13
  store i32 %14, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %15 = load i32, i32* %i.addr, align 4
  %16 = add nsw i32 %15, 1
  store i32 %16, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %17 = load i32, i32* %total.addr, align 4
  ret i32 %17
}

define internal void @bump(%struct.Board* noundef nonnull align 8 dereferenceable(96) nocapture %b, i32 noundef %i) #1 {
entry:
  %0 = getelementptr inbounds %struct.Board, %struct.Board* %b, i32 0, i32 0, i32 0
  %1 = sext i32 %i to i64
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %4 = icmp ult i64 %1, %3
  br i1 %4, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %1, i64 %3)
  unreachable

bounds.ok:
  %5 = getelementptr inbounds %struct.Board, %struct.Board* %b, i32 0, i32 0, i32 1, i64 0
  %6 = bitcast i32* %5 to i8*
  %7 = bitcast i8* %6 to i32*
  %8 = getelementptr inbounds i32, i32* %7, i64 %1
  %9 = load i32, i32* %8, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %10 = add nsw i32 %9, 100
  store i32 %10, i32* %8, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  ret void
}

define internal noundef i32 @marked(%struct.Board* noundef nonnull readonly align 8 dereferenceable(96) nocapture %b) #2 {
entry:
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.Board, %struct.Board* %b, i32 0, i32 1, i32 0
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %3 = getelementptr inbounds %struct.Board, %struct.Board* %b, i32 0, i32 1, i32 1, i64 0
  %4 = bitcast i1* %3 to i8*
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = trunc i64 %2 to i32
  %7 = icmp slt i32 %5, %6
  br i1 %7, label %for.body, label %for.end

for.body:
  %8 = load i32, i32* %i.addr, align 4
  %9 = sext i32 %8 to i64
  %10 = bitcast i8* %4 to i1*
  %11 = getelementptr inbounds i1, i1* %10, i64 %9
  %12 = load i1, i1* %11, align 1, !alias.scope !9, !noalias !8, !tbaa !15
  br i1 %12, label %if.then, label %if.end

if.then:
  %13 = load i32, i32* %n.addr, align 4
  %14 = add nsw i32 %13, 1
  store i32 %14, i32* %n.addr, align 4
  br label %if.end

if.end:
  br label %for.inc

for.inc:
  %15 = load i32, i32* %i.addr, align 4
  %16 = add nsw i32 %15, 1
  store i32 %16, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %17 = load i32, i32* %n.addr, align 4
  ret i32 %17
}

define noundef i32 @nish_main() #1 {
entry:
  %boards.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x %struct.Board*], align 8
  %b.addr = alloca %struct.Board*, align 8
  %local.addr = alloca %struct.Board*, align 8
  %Board.obj = alloca %struct.Board, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 96)
  %1 = bitcast i8* %0 to %struct.Board*
  %2 = getelementptr inbounds %struct.Board, %struct.Board* %1, i32 0, i32 0, i32 0
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  store i64 0, i64* %3, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1
  store i64 8, i64* %4, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %5 = getelementptr inbounds %struct.Board, %struct.Board* %1, i32 0, i32 0, i32 1, i64 0
  %6 = bitcast i32* %5 to i8*
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %8 = getelementptr inbounds %struct.Board, %struct.Board* %1, i32 0, i32 1, i32 0
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  store i64 0, i64* %9, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 1
  store i64 3, i64* %10, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %11 = getelementptr inbounds %struct.Board, %struct.Board* %1, i32 0, i32 1, i32 1, i64 0
  %12 = bitcast i1* %11 to i8*
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2
  store i8* %12, i8** %13, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  call void @Board.constructor(%struct.Board* %1)
  %14 = call i8* @nish_alloc_struct(i64 96)
  %15 = bitcast i8* %14 to %struct.Board*
  %16 = getelementptr inbounds %struct.Board, %struct.Board* %15, i32 0, i32 0, i32 0
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 0
  store i64 0, i64* %17, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 1
  store i64 8, i64* %18, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %19 = getelementptr inbounds %struct.Board, %struct.Board* %15, i32 0, i32 0, i32 1, i64 0
  %20 = bitcast i32* %19 to i8*
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %16, i64 0, i32 2
  store i8* %20, i8** %21, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %22 = getelementptr inbounds %struct.Board, %struct.Board* %15, i32 0, i32 1, i32 0
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  store i64 0, i64* %23, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 1
  store i64 3, i64* %24, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %25 = getelementptr inbounds %struct.Board, %struct.Board* %15, i32 0, i32 1, i32 1, i64 0
  %26 = bitcast i1* %25 to i8*
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 2
  store i8* %26, i8** %27, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  call void @Board.constructor(%struct.Board* %15)
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %28, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %29, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %30 = bitcast [2 x %struct.Board*]* %arr.data to i8*
  %31 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %30, i8** %31, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %32 = bitcast i8* %30 to %struct.Board**
  %33 = getelementptr inbounds %struct.Board*, %struct.Board** %32, i64 0
  store %struct.Board* %1, %struct.Board** %33, align 8, !alias.scope !9, !noalias !8, !tbaa !21
  %34 = getelementptr inbounds %struct.Board*, %struct.Board** %32, i64 1
  store %struct.Board* %15, %struct.Board** %34, align 8, !alias.scope !9, !noalias !8, !tbaa !21
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %boards.addr, align 8
  %35 = load %struct.nish_array*, %struct.nish_array** %boards.addr, align 8
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 2
  %37 = load i8*, i8** %36, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %38 = bitcast i8* %37 to %struct.Board**
  %39 = getelementptr inbounds %struct.Board*, %struct.Board** %38, i64 0
  %40 = load %struct.Board*, %struct.Board** %39, align 8, !alias.scope !9, !noalias !8, !tbaa !21
  %41 = getelementptr inbounds %struct.Board, %struct.Board* %40, i32 0, i32 0, i32 0
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %41, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %44 = trunc i64 %43 to i32
  %45 = call i8* @nish_str_from_i32(i32 %44)
  %46 = call i8* @nish_str_concat(i8* %45, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %47 = load %struct.nish_array*, %struct.nish_array** %boards.addr, align 8
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %50 = bitcast i8* %49 to %struct.Board**
  %51 = getelementptr inbounds %struct.Board*, %struct.Board** %50, i64 0
  %52 = load %struct.Board*, %struct.Board** %51, align 8, !alias.scope !9, !noalias !8, !tbaa !21
  %53 = getelementptr inbounds %struct.Board, %struct.Board* %52, i32 0, i32 1, i32 0
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %53, i64 0, i32 0
  %55 = load i64, i64* %54, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %56 = trunc i64 %55 to i32
  %57 = call i8* @nish_str_from_i32(i32 %56)
  %58 = call i8* @nish_str_concat(i8* %46, i8* %57)
  call void @nish_print(i8* %58)
  %59 = load %struct.nish_array*, %struct.nish_array** %boards.addr, align 8
  %60 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %59, i64 0, i32 2
  %61 = load i8*, i8** %60, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %62 = bitcast i8* %61 to %struct.Board**
  %63 = getelementptr inbounds %struct.Board*, %struct.Board** %62, i64 0
  %64 = load %struct.Board*, %struct.Board** %63, align 8, !alias.scope !9, !noalias !8, !tbaa !21
  call void @Board.reset(%struct.Board* %64)
  %65 = load %struct.nish_array*, %struct.nish_array** %boards.addr, align 8
  %66 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %65, i64 0, i32 2
  %67 = load i8*, i8** %66, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %68 = bitcast i8* %67 to %struct.Board**
  %69 = getelementptr inbounds %struct.Board*, %struct.Board** %68, i64 1
  %70 = load %struct.Board*, %struct.Board** %69, align 8, !alias.scope !9, !noalias !8, !tbaa !21
  call void @Board.reset(%struct.Board* %70)
  %71 = load %struct.nish_array*, %struct.nish_array** %boards.addr, align 8
  %72 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %71, i64 0, i32 2
  %73 = load i8*, i8** %72, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %74 = bitcast i8* %73 to %struct.Board**
  %75 = getelementptr inbounds %struct.Board*, %struct.Board** %74, i64 0
  %76 = load %struct.Board*, %struct.Board** %75, align 8, !alias.scope !9, !noalias !8, !tbaa !21
  call void @Board.mark(%struct.Board* %76, i32 2, i32 5)
  %77 = load %struct.nish_array*, %struct.nish_array** %boards.addr, align 8
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %77, i64 0, i32 2
  %79 = load i8*, i8** %78, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %80 = bitcast i8* %79 to %struct.Board**
  %81 = getelementptr inbounds %struct.Board*, %struct.Board** %80, i64 0
  %82 = load %struct.Board*, %struct.Board** %81, align 8, !alias.scope !9, !noalias !8, !tbaa !21
  call void @Board.mark(%struct.Board* %82, i32 7, i32 9)
  %83 = load %struct.nish_array*, %struct.nish_array** %boards.addr, align 8
  %84 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %83, i64 0, i32 2
  %85 = load i8*, i8** %84, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %86 = bitcast i8* %85 to %struct.Board**
  %87 = getelementptr inbounds %struct.Board*, %struct.Board** %86, i64 0
  %88 = load %struct.Board*, %struct.Board** %87, align 8, !alias.scope !9, !noalias !8, !tbaa !21
  call void @bump(%struct.Board* %88, i32 2)
  %89 = load %struct.nish_array*, %struct.nish_array** %boards.addr, align 8
  %90 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %89, i64 0, i32 2
  %91 = load i8*, i8** %90, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %92 = bitcast i8* %91 to %struct.Board**
  %93 = getelementptr inbounds %struct.Board*, %struct.Board** %92, i64 1
  %94 = load %struct.Board*, %struct.Board** %93, align 8, !alias.scope !9, !noalias !8, !tbaa !21
  call void @Board.mark(%struct.Board* %94, i32 0, i32 1)
  %95 = load %struct.nish_array*, %struct.nish_array** %boards.addr, align 8
  %96 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %95, i64 0, i32 2
  %97 = load i8*, i8** %96, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %98 = bitcast i8* %97 to %struct.Board**
  %99 = getelementptr inbounds %struct.Board*, %struct.Board** %98, i64 0
  %100 = load %struct.Board*, %struct.Board** %99, align 8, !alias.scope !9, !noalias !8, !tbaa !21
  %101 = getelementptr inbounds %struct.Board, %struct.Board* %100, i32 0, i32 0, i32 0
  %102 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %101, i64 0, i32 0
  %103 = load i64, i64* %102, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %104 = trunc i64 %103 to i32
  %105 = call i8* @nish_str_from_i32(i32 %104)
  %106 = call i8* @nish_str_concat(i8* %105, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %107 = load %struct.nish_array*, %struct.nish_array** %boards.addr, align 8
  %108 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %107, i64 0, i32 2
  %109 = load i8*, i8** %108, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %110 = bitcast i8* %109 to %struct.Board**
  %111 = getelementptr inbounds %struct.Board*, %struct.Board** %110, i64 0
  %112 = load %struct.Board*, %struct.Board** %111, align 8, !alias.scope !9, !noalias !8, !tbaa !21
  %113 = call i32 @Board.sum(%struct.Board* %112)
  %114 = call i8* @nish_str_from_i32(i32 %113)
  %115 = call i8* @nish_str_concat(i8* %106, i8* %114)
  %116 = call i8* @nish_str_concat(i8* %115, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %117 = load %struct.nish_array*, %struct.nish_array** %boards.addr, align 8
  %118 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %117, i64 0, i32 2
  %119 = load i8*, i8** %118, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %120 = bitcast i8* %119 to %struct.Board**
  %121 = getelementptr inbounds %struct.Board*, %struct.Board** %120, i64 1
  %122 = load %struct.Board*, %struct.Board** %121, align 8, !alias.scope !9, !noalias !8, !tbaa !21
  %123 = call i32 @Board.sum(%struct.Board* %122)
  %124 = call i8* @nish_str_from_i32(i32 %123)
  %125 = call i8* @nish_str_concat(i8* %116, i8* %124)
  %126 = call i8* @nish_str_concat(i8* %125, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %127 = load %struct.nish_array*, %struct.nish_array** %boards.addr, align 8
  %128 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %127, i64 0, i32 2
  %129 = load i8*, i8** %128, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %130 = bitcast i8* %129 to %struct.Board**
  %131 = getelementptr inbounds %struct.Board*, %struct.Board** %130, i64 0
  %132 = load %struct.Board*, %struct.Board** %131, align 8, !alias.scope !9, !noalias !8, !tbaa !21
  %133 = call i32 @marked(%struct.Board* %132)
  %134 = call i8* @nish_str_from_i32(i32 %133)
  %135 = call i8* @nish_str_concat(i8* %126, i8* %134)
  call void @nish_print(i8* %135)
  %136 = load %struct.nish_array*, %struct.nish_array** %boards.addr, align 8
  %137 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %136, i64 0, i32 2
  %138 = load i8*, i8** %137, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %139 = bitcast i8* %138 to %struct.Board**
  %140 = getelementptr inbounds %struct.Board*, %struct.Board** %139, i64 0
  %141 = load %struct.Board*, %struct.Board** %140, align 8, !alias.scope !9, !noalias !8, !tbaa !21
  store %struct.Board* %141, %struct.Board** %b.addr, align 8
  %142 = load %struct.Board*, %struct.Board** %b.addr, align 8
  %143 = getelementptr inbounds %struct.Board, %struct.Board* %142, i32 0, i32 0, i32 0
  %144 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %143, i64 0, i32 0
  %145 = load i64, i64* %144, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %146 = icmp ult i64 0, %145
  br i1 %146, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %145)
  unreachable

bounds.ok:
  %147 = getelementptr inbounds %struct.Board, %struct.Board* %142, i32 0, i32 0, i32 1, i64 0
  %148 = bitcast i32* %147 to i8*
  %149 = bitcast i8* %148 to i32*
  %150 = getelementptr inbounds i32, i32* %149, i64 0
  store i32 3, i32* %150, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %151 = load %struct.nish_array*, %struct.nish_array** %boards.addr, align 8
  %152 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %151, i64 0, i32 2
  %153 = load i8*, i8** %152, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %154 = bitcast i8* %153 to %struct.Board**
  %155 = getelementptr inbounds %struct.Board*, %struct.Board** %154, i64 0
  %156 = load %struct.Board*, %struct.Board** %155, align 8, !alias.scope !9, !noalias !8, !tbaa !21
  %157 = getelementptr inbounds %struct.Board, %struct.Board* %156, i32 0, i32 0, i32 0
  %158 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %157, i64 0, i32 0
  %159 = load i64, i64* %158, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %160 = icmp ult i64 0, %159
  br i1 %160, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %159)
  unreachable

bounds.ok.1:
  %161 = getelementptr inbounds %struct.Board, %struct.Board* %156, i32 0, i32 0, i32 1, i64 0
  %162 = bitcast i32* %161 to i8*
  %163 = bitcast i8* %162 to i32*
  %164 = getelementptr inbounds i32, i32* %163, i64 0
  %165 = load i32, i32* %164, align 4, !alias.scope !9, !noalias !8, !tbaa !17
  %166 = call i8* @nish_str_from_i32(i32 %165)
  %167 = call i8* @nish_str_concat(i8* %166, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %168 = load %struct.nish_array*, %struct.nish_array** %boards.addr, align 8
  %169 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %168, i64 0, i32 2
  %170 = load i8*, i8** %169, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %171 = bitcast i8* %170 to %struct.Board**
  %172 = getelementptr inbounds %struct.Board*, %struct.Board** %171, i64 0
  %173 = load %struct.Board*, %struct.Board** %172, align 8, !alias.scope !9, !noalias !8, !tbaa !21
  %174 = getelementptr inbounds %struct.Board, %struct.Board* %173, i32 0, i32 2
  %175 = load i32, i32* %174, align 4, !tbaa !4
  %176 = call i8* @nish_str_from_i32(i32 %175)
  %177 = call i8* @nish_str_concat(i8* %167, i8* %176)
  call void @nish_print(i8* %177)
  %178 = load %struct.nish_array*, %struct.nish_array** %boards.addr, align 8
  %179 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %178, i64 0, i32 2
  %180 = load i8*, i8** %179, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %181 = bitcast i8* %180 to %struct.Board**
  %182 = getelementptr inbounds %struct.Board*, %struct.Board** %181, i64 0
  %183 = load %struct.Board*, %struct.Board** %182, align 8, !alias.scope !9, !noalias !8, !tbaa !21
  call void @Board.reset(%struct.Board* %183)
  %184 = load %struct.nish_array*, %struct.nish_array** %boards.addr, align 8
  %185 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %184, i64 0, i32 2
  %186 = load i8*, i8** %185, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %187 = bitcast i8* %186 to %struct.Board**
  %188 = getelementptr inbounds %struct.Board*, %struct.Board** %187, i64 0
  %189 = load %struct.Board*, %struct.Board** %188, align 8, !alias.scope !9, !noalias !8, !tbaa !21
  %190 = call i32 @Board.sum(%struct.Board* %189)
  %191 = call i8* @nish_str_from_i32(i32 %190)
  %192 = call i8* @nish_str_concat(i8* %191, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %193 = load %struct.nish_array*, %struct.nish_array** %boards.addr, align 8
  %194 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %193, i64 0, i32 2
  %195 = load i8*, i8** %194, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %196 = bitcast i8* %195 to %struct.Board**
  %197 = getelementptr inbounds %struct.Board*, %struct.Board** %196, i64 1
  %198 = load %struct.Board*, %struct.Board** %197, align 8, !alias.scope !9, !noalias !8, !tbaa !21
  %199 = call i32 @Board.sum(%struct.Board* %198)
  %200 = call i8* @nish_str_from_i32(i32 %199)
  %201 = call i8* @nish_str_concat(i8* %192, i8* %200)
  call void @nish_print(i8* %201)
  %202 = getelementptr inbounds %struct.Board, %struct.Board* %Board.obj, i32 0, i32 0, i32 0
  %203 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %202, i64 0, i32 0
  store i64 0, i64* %203, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %204 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %202, i64 0, i32 1
  store i64 8, i64* %204, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %205 = getelementptr inbounds %struct.Board, %struct.Board* %Board.obj, i32 0, i32 0, i32 1, i64 0
  %206 = bitcast i32* %205 to i8*
  %207 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %202, i64 0, i32 2
  store i8* %206, i8** %207, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  %208 = getelementptr inbounds %struct.Board, %struct.Board* %Board.obj, i32 0, i32 1, i32 0
  %209 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %208, i64 0, i32 0
  store i64 0, i64* %209, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %210 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %208, i64 0, i32 1
  store i64 3, i64* %210, align 8, !alias.scope !8, !noalias !9, !tbaa !18
  %211 = getelementptr inbounds %struct.Board, %struct.Board* %Board.obj, i32 0, i32 1, i32 1, i64 0
  %212 = bitcast i1* %211 to i8*
  %213 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %208, i64 0, i32 2
  store i8* %212, i8** %213, align 8, !alias.scope !8, !noalias !9, !tbaa !19
  call void @Board.constructor(%struct.Board* %Board.obj)
  store %struct.Board* %Board.obj, %struct.Board** %local.addr, align 8
  %214 = load %struct.Board*, %struct.Board** %local.addr, align 8
  call void @Board.reset(%struct.Board* %214)
  %215 = load %struct.Board*, %struct.Board** %local.addr, align 8
  call void @Board.mark(%struct.Board* %215, i32 1, i32 4)
  %216 = load %struct.Board*, %struct.Board** %local.addr, align 8
  %217 = call i32 @Board.sum(%struct.Board* %216)
  %218 = icmp eq i32 %217, 4
  br i1 %218, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %219 = phi i32 [ 0, %cond.true ], [ 1, %cond.false ]
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %219
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind readonly }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Board", !2, i64 88}
!4 = !{!3, !2, i64 88}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"header i64", !1, i64 0}
!11 = !{!"header ptr", !1, i64 0}
!12 = !{!"array header", !10, i64 0, !10, i64 8, !11, i64 16}
!13 = !{!12, !10, i64 0}
!14 = !{!"element i1", !1, i64 0}
!15 = !{!14, !14, i64 0}
!16 = !{!"element i32", !1, i64 0}
!17 = !{!16, !16, i64 0}
!18 = !{!12, !10, i64 8}
!19 = !{!12, !11, i64 16}
!20 = !{!"element ptr", !1, i64 0}
!21 = !{!20, !20, i64 0}

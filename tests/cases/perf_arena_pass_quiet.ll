%struct.Registry = type { %struct.nish_array* }
%struct.Item = type { i32 }
%struct.Node = type { i32, %struct.Node* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"ant\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"bee\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"cat\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"dog\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"!\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"<\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c">\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"fixed\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"t\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"none\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"s\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

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

define internal void @Registry.constructor(%struct.Registry* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %5 = getelementptr inbounds %struct.Registry, %struct.Registry* %this, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %5, align 8, !tbaa !15
  ret void
}

define internal void @Item.constructor(%struct.Item* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %id) #0 {
entry:
  %0 = getelementptr inbounds %struct.Item, %struct.Item* %this, i32 0, i32 0
  store i32 %id, i32* %0, align 4, !tbaa !18
  ret void
}

define internal void @Item.attach(%struct.Item* noundef nonnull align 8 dereferenceable(4) %this, %struct.Registry* noundef nonnull readonly align 8 dereferenceable(8) nocapture %r) #0 {
entry:
  %0 = getelementptr inbounds %struct.Registry, %struct.Registry* %r, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !15
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %6 = icmp eq i64 %3, %5
  br i1 %6, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %1, i64 8)
  br label %push.store

push.store:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %9 = bitcast i8* %8 to %struct.Item**
  %10 = getelementptr inbounds %struct.Item*, %struct.Item** %9, i64 %3
  store %struct.Item* %this, %struct.Item** %10, align 8, !alias.scope !4, !noalias !3, !tbaa !20
  %11 = add i64 %3, 1
  store i64 %11, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = trunc i64 %11 to i32
  ret void
}

define internal void @Node.constructor(%struct.Node* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i32 noundef %value, %struct.Node* noundef align 8 %next) #0 {
entry:
  %0 = getelementptr inbounds %struct.Node, %struct.Node* %this, i32 0, i32 0
  store i32 %value, i32* %0, align 4, !tbaa !22
  %1 = getelementptr inbounds %struct.Node, %struct.Node* %this, i32 0, i32 1
  store %struct.Node* %next, %struct.Node** %1, align 8, !tbaa !23
  ret void
}

define void @nish_main() #1 {
entry:
  %words.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [4 x i8*], align 8
  %found.addr = alloca i8*, align 8
  %w.addr = alloca i8*, align 8
  %forof.idx = alloca i64, align 8
  %kept.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %line.addr = alloca i8*, align 8
  %w.addr.1 = alloca i8*, align 8
  %forof.idx.1 = alloca i64, align 8
  %head.addr = alloca %struct.Node*, align 8
  %i.addr = alloca i32, align 4
  %lengths.addr = alloca i32, align 4
  %w.addr.2 = alloca i8*, align 8
  %forof.idx.2 = alloca i64, align 8
  %piece.addr = alloca i8*, align 8
  %pick.addr = alloca i8*, align 8
  %i.addr.1 = alloca i32, align 4
  %once.addr = alloca i8*, align 8
  %picks.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %tag.addr = alloca i8*, align 8
  %i.addr.2 = alloca i32, align 4
  %reg.addr = alloca %struct.Registry*, align 8
  %Registry.obj = alloca %struct.Registry, align 8
  %cur.addr = alloca %struct.Item*, align 8
  %i.addr.3 = alloca i32, align 4
  %single.addr = alloca i8*, align 8
  %sum.addr = alloca i32, align 4
  %at.addr = alloca %struct.Node*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 4, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 4, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [4 x i8*]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i8**
  %5 = getelementptr inbounds i8*, i8** %4, i64 0
  store i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*), i8** %5, align 8, !alias.scope !4, !noalias !3, !tbaa !20
  %6 = getelementptr inbounds i8*, i8** %4, i64 1
  store i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*), i8** %6, align 8, !alias.scope !4, !noalias !3, !tbaa !20
  %7 = getelementptr inbounds i8*, i8** %4, i64 2
  store i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*), i8** %7, align 8, !alias.scope !4, !noalias !3, !tbaa !20
  %8 = getelementptr inbounds i8*, i8** %4, i64 3
  store i8* bitcast ({ i64, [4 x i8] }* @.str.3 to i8*), i8** %8, align 8, !alias.scope !4, !noalias !3, !tbaa !20
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %words.addr, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.4 to i8*), i8** %found.addr, align 8
  %9 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %10 = load i64, i64* %forof.idx, align 8
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = icmp ult i64 %10, %12
  br i1 %13, label %forof.body, label %forof.end

forof.body:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %16 = bitcast i8* %15 to i8**
  %17 = getelementptr inbounds i8*, i8** %16, i64 %10
  %18 = load i8*, i8** %17, align 8, !alias.scope !4, !noalias !3, !tbaa !20
  store i8* %18, i8** %w.addr, align 8
  %19 = load i8*, i8** %w.addr, align 8
  %20 = bitcast i8* %19 to i64*
  %21 = load i64, i64* %20, align 8
  %22 = icmp ult i64 0, %21
  br i1 %22, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %21)
  unreachable

bounds.ok:
  %23 = getelementptr inbounds i8, i8* %19, i64 8
  %24 = getelementptr inbounds i8, i8* %23, i64 0
  %25 = load i8, i8* %24, align 1
  %26 = zext i8 %25 to i32
  %27 = icmp eq i32 %26, 99
  br i1 %27, label %if.then, label %if.end

if.then:
  %28 = load i8*, i8** %w.addr, align 8
  %29 = call i8* @nish_str_concat(i8* %28, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  store i8* %29, i8** %found.addr, align 8
  br label %forof.end

if.end:
  br label %forof.inc

forof.inc:
  %30 = load i64, i64* %forof.idx, align 8
  %31 = add i64 %30, 1
  store i64 %31, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 0, i64* %32, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %33 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 0, i64* %33, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* null, i8** %34, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %kept.addr, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.4 to i8*), i8** %line.addr, align 8
  %35 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  store i64 0, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.cond.1:
  %36 = load i64, i64* %forof.idx.1, align 8
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = icmp ult i64 %36, %38
  br i1 %39, label %forof.body.1, label %forof.end.1

forof.body.1:
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %35, i64 0, i32 2
  %41 = load i8*, i8** %40, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %42 = bitcast i8* %41 to i8**
  %43 = getelementptr inbounds i8*, i8** %42, i64 %36
  %44 = load i8*, i8** %43, align 8, !alias.scope !4, !noalias !3, !tbaa !20
  store i8* %44, i8** %w.addr.1, align 8
  %45 = load i8*, i8** %w.addr.1, align 8
  %46 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*), i8* %45)
  %47 = call i8* @nish_str_concat(i8* %46, i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*))
  store i8* %47, i8** %line.addr, align 8
  %48 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %49 = load i8*, i8** %line.addr, align 8
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 0
  %51 = load i64, i64* %50, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 1
  %53 = load i64, i64* %52, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %54 = icmp eq i64 %51, %53
  br i1 %54, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %48, i64 8)
  br label %push.store

push.store:
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %48, i64 0, i32 2
  %56 = load i8*, i8** %55, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %57 = bitcast i8* %56 to i8**
  %58 = getelementptr inbounds i8*, i8** %57, i64 %51
  store i8* %49, i8** %58, align 8, !alias.scope !4, !noalias !3, !tbaa !20
  %59 = add i64 %51, 1
  store i64 %59, i64* %50, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %60 = trunc i64 %59 to i32
  br label %forof.inc.1

forof.inc.1:
  %61 = load i64, i64* %forof.idx.1, align 8
  %62 = add i64 %61, 1
  store i64 %62, i64* %forof.idx.1, align 8
  br label %forof.cond.1

forof.end.1:
  store %struct.Node* null, %struct.Node** %head.addr, align 8
  store i32 1, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %63 = load i32, i32* %i.addr, align 4
  %64 = icmp sle i32 %63, 4
  br i1 %64, label %for.body, label %for.end

for.body:
  %65 = call i8* @nish_alloc_struct(i64 16)
  %66 = bitcast i8* %65 to %struct.Node*
  %67 = load i32, i32* %i.addr, align 4
  %68 = load %struct.Node*, %struct.Node** %head.addr, align 8
  call void @Node.constructor(%struct.Node* %66, i32 %67, %struct.Node* %68)
  store %struct.Node* %66, %struct.Node** %head.addr, align 8
  br label %for.inc

for.inc:
  %69 = load i32, i32* %i.addr, align 4
  %70 = add nsw i32 %69, 1
  store i32 %70, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %lengths.addr, align 4
  %71 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  store i64 0, i64* %forof.idx.2, align 8
  br label %forof.cond.2

forof.cond.2:
  %72 = load i64, i64* %forof.idx.2, align 8
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %71, i64 0, i32 0
  %74 = load i64, i64* %73, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %75 = icmp ult i64 %72, %74
  br i1 %75, label %forof.body.2, label %forof.end.2

forof.body.2:
  %76 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %71, i64 0, i32 2
  %77 = load i8*, i8** %76, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %78 = bitcast i8* %77 to i8**
  %79 = getelementptr inbounds i8*, i8** %78, i64 %72
  %80 = load i8*, i8** %79, align 8, !alias.scope !4, !noalias !3, !tbaa !20
  store i8* %80, i8** %w.addr.2, align 8
  %81 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %82 = load i8*, i8** %81, align 8
  %83 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %84 = load i64, i64* %83, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.4 to i8*), i8** %piece.addr, align 8
  %85 = load i8*, i8** %w.addr.2, align 8
  %86 = load i8*, i8** %w.addr.2, align 8
  %87 = call i8* @nish_str_concat(i8* %85, i8* %86)
  store i8* %87, i8** %piece.addr, align 8
  %88 = load i32, i32* %lengths.addr, align 4
  %89 = load i8*, i8** %piece.addr, align 8
  %90 = bitcast i8* %89 to i64*
  %91 = load i64, i64* %90, align 8
  %92 = trunc i64 %91 to i32
  %93 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %88, i32 %92)
  %94 = extractvalue { i32, i1 } %93, 0
  %95 = extractvalue { i32, i1 } %93, 1
  br i1 %95, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %94, i32* %lengths.addr, align 4
  %96 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %97 = load i8*, i8** %96, align 8
  %98 = icmp eq i8* %97, %82
  br i1 %98, label %pass.rewind, label %pass.free

pass.rewind:
  %99 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %84, i64* %99, align 8
  br label %pass.done

pass.free:
  %100 = ptrtoint i8* %82 to i64
  %101 = add i64 %100, %84
  call void @nish_arena_release(i64 %101)
  br label %pass.done

pass.done:
  br label %forof.inc.2

forof.inc.2:
  %102 = load i64, i64* %forof.idx.2, align 8
  %103 = add i64 %102, 1
  store i64 %103, i64* %forof.idx.2, align 8
  br label %forof.cond.2

forof.end.2:
  store i8* bitcast ({ i64, [1 x i8] }* @.str.4 to i8*), i8** %pick.addr, align 8
  store i32 0, i32* %i.addr.1, align 4
  %104 = load %struct.nish_array*, %struct.nish_array** %words.addr, align 8
  %105 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %104, i64 0, i32 0
  %106 = load i64, i64* %105, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %107 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %104, i64 0, i32 2
  %108 = load i8*, i8** %107, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  br label %for.cond.1

for.cond.1:
  %109 = load i32, i32* %i.addr.1, align 4
  %110 = trunc i64 %106 to i32
  %111 = icmp slt i32 %109, %110
  br i1 %111, label %for.body.1, label %for.end.1

for.body.1:
  %112 = load i32, i32* %i.addr.1, align 4
  %113 = sext i32 %112 to i64
  %114 = bitcast i8* %108 to i8**
  %115 = getelementptr inbounds i8*, i8** %114, i64 %113
  %116 = load i8*, i8** %115, align 8, !alias.scope !4, !noalias !3, !tbaa !20
  store i8* %116, i8** %pick.addr, align 8
  store i8* bitcast ({ i64, [6 x i8] }* @.str.8 to i8*), i8** %pick.addr, align 8
  br label %for.inc.1

for.inc.1:
  %117 = load i32, i32* %i.addr.1, align 4
  %118 = add nsw i32 %117, 1
  store i32 %118, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  store i8* bitcast ({ i64, [1 x i8] }* @.str.4 to i8*), i8** %once.addr, align 8
  br label %while.cond

while.cond:
  %119 = load i32, i32* %lengths.addr, align 4
  %120 = icmp sgt i32 %119, 0
  br i1 %120, label %while.body, label %while.end

while.body:
  %121 = load i32, i32* %lengths.addr, align 4
  %122 = call i8* @nish_str_from_i32(i32 %121)
  store i8* %122, i8** %once.addr, align 8
  br label %while.end

while.end:
  %123 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 0, i64* %123, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %124 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 0, i64* %124, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %125 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* null, i8** %125, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr.2, %struct.nish_array** %picks.addr, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.4 to i8*), i8** %tag.addr, align 8
  store i32 0, i32* %i.addr.2, align 4
  br label %for.cond.2

for.cond.2:
  %126 = load i32, i32* %i.addr.2, align 4
  %127 = icmp slt i32 %126, 3
  br i1 %127, label %for.body.2, label %for.end.2

for.body.2:
  %128 = load i32, i32* %i.addr.2, align 4
  %129 = call i8* @nish_str_from_i32(i32 %128)
  %130 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.9 to i8*), i8* %129)
  store i8* %130, i8** %tag.addr, align 8
  %131 = load %struct.nish_array*, %struct.nish_array** %picks.addr, align 8
  %132 = load i32, i32* %i.addr.2, align 4
  %133 = icmp sgt i32 %132, 0
  br i1 %133, label %cond.true, label %cond.false

cond.true:
  %134 = load i8*, i8** %tag.addr, align 8
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %135 = phi i8* [ %134, %cond.true ], [ bitcast ({ i64, [5 x i8] }* @.str.10 to i8*), %cond.false ]
  %136 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %131, i64 0, i32 0
  %137 = load i64, i64* %136, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %138 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %131, i64 0, i32 1
  %139 = load i64, i64* %138, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %140 = icmp eq i64 %137, %139
  br i1 %140, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %131, i64 8)
  br label %push.store.1

push.store.1:
  %141 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %131, i64 0, i32 2
  %142 = load i8*, i8** %141, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %143 = bitcast i8* %142 to i8**
  %144 = getelementptr inbounds i8*, i8** %143, i64 %137
  store i8* %135, i8** %144, align 8, !alias.scope !4, !noalias !3, !tbaa !20
  %145 = add i64 %137, 1
  store i64 %145, i64* %136, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %146 = trunc i64 %145 to i32
  br label %for.inc.2

for.inc.2:
  %147 = load i32, i32* %i.addr.2, align 4
  %148 = add nsw i32 %147, 1
  store i32 %148, i32* %i.addr.2, align 4
  br label %for.cond.2

for.end.2:
  call void @Registry.constructor(%struct.Registry* %Registry.obj)
  store %struct.Registry* %Registry.obj, %struct.Registry** %reg.addr, align 8
  %149 = call i8* @nish_alloc_struct(i64 4)
  %150 = bitcast i8* %149 to %struct.Item*
  call void @Item.constructor(%struct.Item* %150, i32 0)
  store %struct.Item* %150, %struct.Item** %cur.addr, align 8
  store i32 1, i32* %i.addr.3, align 4
  br label %for.cond.3

for.cond.3:
  %151 = load i32, i32* %i.addr.3, align 4
  %152 = icmp slt i32 %151, 4
  br i1 %152, label %for.body.3, label %for.end.3

for.body.3:
  %153 = call i8* @nish_alloc_struct(i64 4)
  %154 = bitcast i8* %153 to %struct.Item*
  %155 = load i32, i32* %i.addr.3, align 4
  call void @Item.constructor(%struct.Item* %154, i32 %155)
  store %struct.Item* %154, %struct.Item** %cur.addr, align 8
  %156 = load %struct.Item*, %struct.Item** %cur.addr, align 8
  %157 = load %struct.Registry*, %struct.Registry** %reg.addr, align 8
  call void @Item.attach(%struct.Item* %156, %struct.Registry* %157)
  br label %for.inc.3

for.inc.3:
  %158 = load i32, i32* %i.addr.3, align 4
  %159 = add nsw i32 %158, 1
  store i32 %159, i32* %i.addr.3, align 4
  br label %for.cond.3

for.end.3:
  store i8* bitcast ({ i64, [1 x i8] }* @.str.4 to i8*), i8** %single.addr, align 8
  br label %do.body

do.body:
  %160 = load i32, i32* %lengths.addr, align 4
  %161 = call i8* @nish_str_from_i32(i32 %160)
  %162 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.11 to i8*), i8* %161)
  store i8* %162, i8** %single.addr, align 8
  br label %do.cond

do.cond:
  br i1 false, label %do.body, label %do.end

do.end:
  store i32 0, i32* %sum.addr, align 4
  %163 = load %struct.Node*, %struct.Node** %head.addr, align 8
  store %struct.Node* %163, %struct.Node** %at.addr, align 8
  br label %while.cond.1

while.cond.1:
  %164 = load %struct.Node*, %struct.Node** %at.addr, align 8
  %165 = icmp ne %struct.Node* %164, null
  br i1 %165, label %while.body.1, label %while.end.1

while.body.1:
  %166 = load i32, i32* %sum.addr, align 4
  %167 = load %struct.Node*, %struct.Node** %at.addr, align 8
  %168 = getelementptr inbounds %struct.Node, %struct.Node* %167, i32 0, i32 0
  %169 = load i32, i32* %168, align 4, !tbaa !22
  %170 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %166, i32 %169)
  %171 = extractvalue { i32, i1 } %170, 0
  %172 = extractvalue { i32, i1 } %170, 1
  br i1 %172, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %171, i32* %sum.addr, align 4
  %173 = load %struct.Node*, %struct.Node** %at.addr, align 8
  %174 = getelementptr inbounds %struct.Node, %struct.Node* %173, i32 0, i32 1
  %175 = load %struct.Node*, %struct.Node** %174, align 8, !tbaa !23
  store %struct.Node* %175, %struct.Node** %at.addr, align 8
  br label %while.cond.1

while.end.1:
  %176 = load i8*, i8** %found.addr, align 8
  %177 = call i8* @nish_str_concat(i8* %176, i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*))
  %178 = load %struct.nish_array*, %struct.nish_array** %kept.addr, align 8
  %179 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %178, i64 0, i32 0
  %180 = load i64, i64* %179, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %181 = trunc i64 %180 to i32
  %182 = call i8* @nish_str_from_i32(i32 %181)
  %183 = call i8* @nish_str_concat(i8* %177, i8* %182)
  %184 = call i8* @nish_str_concat(i8* %183, i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*))
  %185 = load i8*, i8** %line.addr, align 8
  %186 = call i8* @nish_str_concat(i8* %184, i8* %185)
  %187 = call i8* @nish_str_concat(i8* %186, i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*))
  %188 = load i32, i32* %sum.addr, align 4
  %189 = call i8* @nish_str_from_i32(i32 %188)
  %190 = call i8* @nish_str_concat(i8* %187, i8* %189)
  %191 = call i8* @nish_str_concat(i8* %190, i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*))
  %192 = load i32, i32* %lengths.addr, align 4
  %193 = call i8* @nish_str_from_i32(i32 %192)
  %194 = call i8* @nish_str_concat(i8* %191, i8* %193)
  %195 = call i8* @nish_str_concat(i8* %194, i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*))
  %196 = load i8*, i8** %pick.addr, align 8
  %197 = call i8* @nish_str_concat(i8* %195, i8* %196)
  %198 = call i8* @nish_str_concat(i8* %197, i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*))
  %199 = load i8*, i8** %once.addr, align 8
  %200 = call i8* @nish_str_concat(i8* %198, i8* %199)
  call void @nish_print(i8* %200)
  %201 = load %struct.nish_array*, %struct.nish_array** %picks.addr, align 8
  %202 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %201, i64 0, i32 0
  %203 = load i64, i64* %202, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %204 = icmp ult i64 2, %203
  br i1 %204, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 2, i64 %203)
  unreachable

bounds.ok.1:
  %205 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %201, i64 0, i32 2
  %206 = load i8*, i8** %205, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %207 = bitcast i8* %206 to i8**
  %208 = getelementptr inbounds i8*, i8** %207, i64 2
  %209 = load i8*, i8** %208, align 8, !alias.scope !4, !noalias !3, !tbaa !20
  %210 = call i8* @nish_str_concat(i8* %209, i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*))
  %211 = load i8*, i8** %tag.addr, align 8
  %212 = call i8* @nish_str_concat(i8* %210, i8* %211)
  %213 = call i8* @nish_str_concat(i8* %212, i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*))
  %214 = load %struct.Registry*, %struct.Registry** %reg.addr, align 8
  %215 = getelementptr inbounds %struct.Registry, %struct.Registry* %214, i32 0, i32 0
  %216 = load %struct.nish_array*, %struct.nish_array** %215, align 8, !tbaa !15
  %217 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %216, i64 0, i32 0
  %218 = load i64, i64* %217, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %219 = trunc i64 %218 to i32
  %220 = call i8* @nish_str_from_i32(i32 %219)
  %221 = call i8* @nish_str_concat(i8* %213, i8* %220)
  %222 = call i8* @nish_str_concat(i8* %221, i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*))
  %223 = load %struct.Item*, %struct.Item** %cur.addr, align 8
  %224 = getelementptr inbounds %struct.Item, %struct.Item* %223, i32 0, i32 0
  %225 = load i32, i32* %224, align 4, !tbaa !18
  %226 = call i8* @nish_str_from_i32(i32 %225)
  %227 = call i8* @nish_str_concat(i8* %222, i8* %226)
  %228 = call i8* @nish_str_concat(i8* %227, i8* bitcast ({ i64, [2 x i8] }* @.str.12 to i8*))
  %229 = load i8*, i8** %single.addr, align 8
  %230 = call i8* @nish_str_concat(i8* %228, i8* %229)
  call void @nish_print(i8* %230)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

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
!13 = !{!"ptr", !6, i64 0}
!14 = !{!"Registry", !13, i64 0}
!15 = !{!14, !13, i64 0}
!16 = !{!"i32", !6, i64 0}
!17 = !{!"Item", !16, i64 0}
!18 = !{!17, !16, i64 0}
!19 = !{!"element ptr", !6, i64 0}
!20 = !{!19, !19, i64 0}
!21 = !{!"Node", !16, i64 0, !13, i64 8}
!22 = !{!21, !16, i64 0}
!23 = !{!21, !13, i64 8}

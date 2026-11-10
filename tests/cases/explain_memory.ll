%struct.Box = type { i8* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"n=\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"n\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"item \00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c".\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"x\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"h\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"s\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define internal void @Box.constructor(%struct.Box* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Box, %struct.Box* %this, i32 0, i32 0
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %0, align 8, !tbaa !4
  ret void
}

define internal noundef i32 @width(i32 noundef %n) #1 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_from_i32(i32 %n)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*), i8* %0)
  %2 = bitcast i8* %1 to i64*
  %3 = load i64, i64* %2, align 8
  %4 = trunc i64 %3 to i32
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %4
}

define internal noundef i32 @remember(%struct.Box* noundef nonnull align 8 dereferenceable(8) nocapture %box, i32 noundef %n) #1 {
entry:
  %0 = call i8* @nish_str_from_i32(i32 %n)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i8* %0)
  %2 = getelementptr inbounds %struct.Box, %struct.Box* %box, i32 0, i32 0
  store i8* %1, i8** %2, align 8, !tbaa !4
  %3 = getelementptr inbounds %struct.Box, %struct.Box* %box, i32 0, i32 0
  %4 = load i8*, i8** %3, align 8, !tbaa !4
  %5 = bitcast i8* %4 to i64*
  %6 = load i64, i64* %5, align 8
  %7 = trunc i64 %6 to i32
  ret i32 %7
}

define internal noundef nonnull align 8 i8* @named(i32 noundef %n) #1 {
entry:
  %0 = call i8* @nish_str_from_i32(i32 %n)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.3 to i8*), i8* %0)
  ret i8* %1
}

define internal noundef i32 @counted(i32 noundef %n) #1 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %total.addr, align 4
  %3 = load i32, i32* %i.addr, align 4
  %4 = call i32 @width(i32 %3)
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %4)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %6, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %8 = load i32, i32* %i.addr, align 4
  %9 = add nsw i32 %8, 1
  store i32 %9, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %10 = load i32, i32* %total.addr, align 4
  ret i32 %10

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @extra() #1 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %j.addr = alloca i32, align 4
  %a.addr = alloca i64, align 8
  %t.addr = alloca i8*, align 8
  %held.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %d.addr = alloca i32, align 4
  %i.addr.1 = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 3
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = add nsw i32 %6, 1
  store i32 %7, i32* %j.addr, align 4
  %8 = call i64 @nish_arena_mark()
  store i64 %8, i64* %a.addr, align 8
  %9 = load i64, i64* %a.addr, align 8
  %10 = load i32, i32* %total.addr, align 4
  %11 = load i32, i32* %j.addr, align 4
  %12 = call i64 @nish_arena_mark()
  %13 = call i8* @named(i32 %11)
  %14 = call i8* @nish_arena_keep(i64 %12, i8* %13)
  %15 = bitcast i8* %14 to i64*
  %16 = load i64, i64* %15, align 8
  %17 = trunc i64 %16 to i32
  %18 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %10, i32 %17)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %19, i32* %total.addr, align 4
  call void @nish_arena_release(i64 %9)
  %21 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %22 = load i8*, i8** %21, align 8
  %23 = icmp eq i8* %22, %3
  br i1 %23, label %pass.rewind, label %pass.free

pass.rewind:
  %24 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %24, align 8
  br label %pass.done

pass.free:
  %25 = ptrtoint i8* %3 to i64
  %26 = add i64 %25, %5
  call void @nish_arena_release(i64 %26)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %27 = load i32, i32* %i.addr, align 4
  %28 = add nsw i32 %27, 1
  store i32 %28, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %t.addr, align 8
  br label %for.cond.1

for.cond.1:
  %29 = load i8*, i8** %t.addr, align 8
  %30 = call i8* @nish_str_concat(i8* %29, i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*))
  %31 = bitcast i8* %30 to i64*
  %32 = load i64, i64* %31, align 8
  %33 = trunc i64 %32 to i32
  %34 = icmp slt i32 %33, 4
  br i1 %34, label %for.body.1, label %for.end.1

for.body.1:
  %35 = load i32, i32* %total.addr, align 4
  %36 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %35, i32 1)
  %37 = extractvalue { i32, i1 } %36, 0
  %38 = extractvalue { i32, i1 } %36, 1
  br i1 %38, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %37, i32* %total.addr, align 4
  br label %for.inc.1

for.inc.1:
  %39 = load i32, i32* %total.addr, align 4
  %40 = call i8* @nish_str_from_i32(i32 %39)
  %41 = call i8* @nish_str_concat(i8* %40, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  store i8* %41, i8** %t.addr, align 8
  br label %for.cond.1

for.end.1:
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %42, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %43, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %44, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %held.addr, align 8
  store i32 0, i32* %d.addr, align 4
  br label %do.body

do.body:
  store i32 0, i32* %i.addr.1, align 4
  br label %for.cond.2

for.cond.2:
  %45 = load i32, i32* %i.addr.1, align 4
  %46 = icmp slt i32 %45, 2
  br i1 %46, label %for.body.2, label %for.end.2

for.body.2:
  %47 = load %struct.nish_array*, %struct.nish_array** %held.addr, align 8
  %48 = load i32, i32* %i.addr.1, align 4
  %49 = call i8* @nish_str_from_i32(i32 %48)
  %50 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.6 to i8*), i8* %49)
  %51 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 0
  %52 = load i64, i64* %51, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 1
  %54 = load i64, i64* %53, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %55 = icmp eq i64 %52, %54
  br i1 %55, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %47, i64 8)
  br label %push.store

push.store:
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %47, i64 0, i32 2
  %57 = load i8*, i8** %56, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %58 = bitcast i8* %57 to i8**
  %59 = getelementptr inbounds i8*, i8** %58, i64 %52
  store i8* %50, i8** %59, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %60 = add i64 %52, 1
  store i64 %60, i64* %51, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %61 = trunc i64 %60 to i32
  br label %for.inc.2

for.inc.2:
  %62 = load i32, i32* %i.addr.1, align 4
  %63 = add nsw i32 %62, 1
  store i32 %63, i32* %i.addr.1, align 4
  br label %for.cond.2

for.end.2:
  %64 = load i32, i32* %d.addr, align 4
  %65 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %64, i32 1)
  %66 = extractvalue { i32, i1 } %65, 0
  %67 = extractvalue { i32, i1 } %65, 1
  br i1 %67, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %66, i32* %d.addr, align 4
  br label %do.cond

do.cond:
  %68 = load i32, i32* %d.addr, align 4
  %69 = call i8* @nish_str_from_i32(i32 %68)
  %70 = bitcast i8* %69 to i64*
  %71 = load i64, i64* %70, align 8
  %72 = trunc i64 %71 to i32
  %73 = icmp slt i32 %72, 2
  br i1 %73, label %land.rhs, label %land.end

land.rhs:
  %74 = load i32, i32* %d.addr, align 4
  %75 = icmp slt i32 %74, 3
  br label %land.end

land.end:
  %76 = phi i1 [ false, %do.cond ], [ %75, %land.rhs ]
  br i1 %76, label %do.body, label %do.end

do.end:
  %77 = load i32, i32* %total.addr, align 4
  %78 = load i32, i32* %d.addr, align 4
  %79 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %77, i32 %78)
  %80 = extractvalue { i32, i1 } %79, 0
  %81 = extractvalue { i32, i1 } %79, 1
  br i1 %81, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %82 = load %struct.nish_array*, %struct.nish_array** %held.addr, align 8
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %82, i64 0, i32 0
  %84 = load i64, i64* %83, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %85 = trunc i64 %84 to i32
  %86 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %80, i32 %85)
  %87 = extractvalue { i32, i1 } %86, 0
  %88 = extractvalue { i32, i1 } %86, 1
  br i1 %88, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %87

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define void @nish_main() #1 {
entry:
  %box.addr = alloca %struct.Box*, align 8
  %Box.obj = alloca %struct.Box, align 8
  %last.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  %seen.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr.1 = alloca i32, align 4
  %kept.addr = alloca i32, align 4
  %i.addr.2 = alloca i32, align 4
  %i.addr.3 = alloca i32, align 4
  %a.addr = alloca i64, align 8
  %k.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  call void @Box.constructor(%struct.Box* %Box.obj)
  store %struct.Box* %Box.obj, %struct.Box** %box.addr, align 8
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %last.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, 3
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @named(i32 %2)
  %5 = call i8* @nish_arena_keep(i64 %3, i8* %4)
  store i8* %5, i8** %last.addr, align 8
  br label %for.inc

for.inc:
  %6 = load i32, i32* %i.addr, align 4
  %7 = add nsw i32 %6, 1
  store i32 %7, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %8, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %9, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %10, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %seen.addr, align 8
  store i32 0, i32* %i.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %11 = load i32, i32* %i.addr.1, align 4
  %12 = icmp slt i32 %11, 3
  br i1 %12, label %for.body.1, label %for.end.1

for.body.1:
  %13 = load %struct.nish_array*, %struct.nish_array** %seen.addr, align 8
  %14 = load i32, i32* %i.addr.1, align 4
  %15 = call i8* @nish_str_from_i32(i32 %14)
  %16 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.7 to i8*), i8* %15)
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 1
  %20 = load i64, i64* %19, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %21 = icmp eq i64 %18, %20
  br i1 %21, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %13, i64 8)
  br label %push.store

push.store:
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %24 = bitcast i8* %23 to i8**
  %25 = getelementptr inbounds i8*, i8** %24, i64 %18
  store i8* %16, i8** %25, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %26 = add i64 %18, 1
  store i64 %26, i64* %17, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %27 = trunc i64 %26 to i32
  br label %for.inc.1

for.inc.1:
  %28 = load i32, i32* %i.addr.1, align 4
  %29 = add nsw i32 %28, 1
  store i32 %29, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  store i32 0, i32* %kept.addr, align 4
  store i32 0, i32* %i.addr.2, align 4
  br label %for.cond.2

for.cond.2:
  %30 = load i32, i32* %i.addr.2, align 4
  %31 = icmp slt i32 %30, 3
  br i1 %31, label %for.body.2, label %for.end.2

for.body.2:
  %32 = load i32, i32* %kept.addr, align 4
  %33 = load %struct.Box*, %struct.Box** %box.addr, align 8
  %34 = load i32, i32* %i.addr.2, align 4
  %35 = call i32 @remember(%struct.Box* %33, i32 %34)
  %36 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %32, i32 %35)
  %37 = extractvalue { i32, i1 } %36, 0
  %38 = extractvalue { i32, i1 } %36, 1
  br i1 %38, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %37, i32* %kept.addr, align 4
  br label %for.inc.2

for.inc.2:
  %39 = load i32, i32* %i.addr.2, align 4
  %40 = add nsw i32 %39, 1
  store i32 %40, i32* %i.addr.2, align 4
  br label %for.cond.2

for.end.2:
  store i32 0, i32* %i.addr.3, align 4
  br label %for.cond.3

for.cond.3:
  %41 = load i32, i32* %i.addr.3, align 4
  %42 = icmp slt i32 %41, 3
  br i1 %42, label %for.body.3, label %for.end.3

for.body.3:
  %43 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %44 = load i8*, i8** %43, align 8
  %45 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %46 = load i64, i64* %45, align 8
  %47 = call i64 @nish_arena_mark()
  store i64 %47, i64* %a.addr, align 8
  %48 = load i64, i64* %a.addr, align 8
  %49 = load i32, i32* %kept.addr, align 4
  %50 = load i32, i32* %i.addr.3, align 4
  %51 = call i64 @nish_arena_mark()
  %52 = call i8* @named(i32 %50)
  %53 = call i8* @nish_arena_keep(i64 %51, i8* %52)
  %54 = bitcast i8* %53 to i64*
  %55 = load i64, i64* %54, align 8
  %56 = trunc i64 %55 to i32
  %57 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %49, i32 %56)
  %58 = extractvalue { i32, i1 } %57, 0
  %59 = extractvalue { i32, i1 } %57, 1
  br i1 %59, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %58, i32* %kept.addr, align 4
  call void @nish_arena_release(i64 %48)
  %60 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %61 = load i8*, i8** %60, align 8
  %62 = icmp eq i8* %61, %44
  br i1 %62, label %pass.rewind, label %pass.free

pass.rewind:
  %63 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %46, i64* %63, align 8
  br label %pass.done

pass.free:
  %64 = ptrtoint i8* %44 to i64
  %65 = add i64 %64, %46
  call void @nish_arena_release(i64 %65)
  br label %pass.done

pass.done:
  br label %for.inc.3

for.inc.3:
  %66 = load i32, i32* %i.addr.3, align 4
  %67 = add nsw i32 %66, 1
  store i32 %67, i32* %i.addr.3, align 4
  br label %for.cond.3

for.end.3:
  store i32 0, i32* %k.addr, align 4
  br label %while.cond

while.cond:
  %68 = load i32, i32* %k.addr, align 4
  %69 = call i8* @nish_str_from_i32(i32 %68)
  %70 = bitcast i8* %69 to i64*
  %71 = load i64, i64* %70, align 8
  %72 = trunc i64 %71 to i32
  %73 = icmp slt i32 %72, 2
  br i1 %73, label %while.body, label %while.end

while.body:
  %74 = load i32, i32* %k.addr, align 4
  %75 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %74, i32 1)
  %76 = extractvalue { i32, i1 } %75, 0
  %77 = extractvalue { i32, i1 } %75, 1
  br i1 %77, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %76, i32* %k.addr, align 4
  br label %while.cond

while.end:
  %78 = load i8*, i8** %last.addr, align 8
  %79 = call i8* @nish_str_concat(i8* %78, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %80 = load %struct.nish_array*, %struct.nish_array** %seen.addr, align 8
  %81 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %80, i64 0, i32 0
  %82 = load i64, i64* %81, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %83 = trunc i64 %82 to i32
  %84 = call i8* @nish_str_from_i32(i32 %83)
  %85 = call i8* @nish_str_concat(i8* %79, i8* %84)
  %86 = call i8* @nish_str_concat(i8* %85, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %87 = load i32, i32* %kept.addr, align 4
  %88 = call i8* @nish_str_from_i32(i32 %87)
  %89 = call i8* @nish_str_concat(i8* %86, i8* %88)
  %90 = call i8* @nish_str_concat(i8* %89, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %91 = call i32 @counted(i32 4)
  %92 = call i8* @nish_str_from_i32(i32 %91)
  %93 = call i8* @nish_str_concat(i8* %90, i8* %92)
  %94 = call i8* @nish_str_concat(i8* %93, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %95 = load %struct.Box*, %struct.Box** %box.addr, align 8
  %96 = getelementptr inbounds %struct.Box, %struct.Box* %95, i32 0, i32 0
  %97 = load i8*, i8** %96, align 8, !tbaa !4
  %98 = call i8* @nish_str_concat(i8* %94, i8* %97)
  %99 = call i8* @nish_str_concat(i8* %98, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %100 = load i32, i32* %k.addr, align 4
  %101 = call i8* @nish_str_from_i32(i32 %100)
  %102 = call i8* @nish_str_concat(i8* %99, i8* %101)
  %103 = call i8* @nish_str_concat(i8* %102, i8* bitcast ({ i64, [2 x i8] }* @.str.8 to i8*))
  %104 = call i32 @extra()
  %105 = call i8* @nish_str_from_i32(i32 %104)
  %106 = call i8* @nish_str_concat(i8* %103, i8* %105)
  call void @nish_print(i8* %106)
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

attributes #0 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!18, !19, !20, !21, !22}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Box", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"nish array"}
!6 = !{!"header", !5}
!7 = !{!"elements", !5}
!8 = !{!6}
!9 = !{!7}
!10 = !{!"header i64", !1, i64 0}
!11 = !{!"header ptr", !1, i64 0}
!12 = !{!"array header", !10, i64 0, !10, i64 8, !11, i64 16}
!13 = !{!12, !10, i64 0}
!14 = !{!12, !10, i64 8}
!15 = !{!12, !11, i64 16}
!16 = !{!"element ptr", !1, i64 0}
!17 = !{!16, !16, i64 0}
!18 = !{i32 8, !"cf-protection-branch", i32 1}
!19 = !{i32 8, !"cf-protection-return", i32 1}
!20 = !{i32 8, !"branch-target-enforcement", i32 1}
!21 = !{i32 8, !"sign-return-address", i32 1}
!22 = !{i32 4, !"probe-stack", !"inline-asm"}

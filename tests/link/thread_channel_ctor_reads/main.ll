%struct.Range = type { i32, i32 }
%struct.Pipe = type { %struct.Channel$i32*, i32, i32, i32, i32, i8*, i32, %struct.nish_array*, %struct.Range* }
%struct.Channel$i32 = type { %struct.nish_array*, i32, i64 }
%struct.ThreadScope = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"up\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"sum\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #1
declare void @nish.ThreadScope.spawn$$Pipe$i32$fn.7.produce(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Pipe* noundef nonnull align 8 dereferenceable(56), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.ThreadScope.spawn$$Pipe$i32$fn.7.consume(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), %struct.Pipe* noundef nonnull align 8 dereferenceable(56), %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #0
declare void @nish.Channel$i32.constructor(%struct.Channel$i32* noundef nonnull noalias align 8 dereferenceable(24) nocapture) #1
declare void @nish.Channel$i32.send(%struct.Channel$i32* noundef nonnull align 8 dereferenceable(24) nocapture, i32 noundef) #0
declare noundef i32 @nish.Channel$i32.take(%struct.Channel$i32* noundef nonnull align 8 dereferenceable(24) nocapture) #0
declare noundef zeroext i1 @nish.Channel$i32.ready(%struct.Channel$i32* noundef nonnull readonly align 8 dereferenceable(24) nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare void @nish_scope_join(i8* noundef nonnull) #0
declare void @nish_channel_count(i64* noundef nonnull, i64 noundef) #0
declare noundef i32 @nish_channel_receive(i64* noundef nonnull, i64* noundef nonnull) #0
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #5
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #5

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #6 {
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

define internal void @Pipe.constructor(%struct.Pipe* noundef nonnull noalias align 8 dereferenceable(56) nocapture %this, %struct.Channel$i32* noundef nonnull align 8 dereferenceable(24) %ch, i32 noundef %first, i32 noundef %last, i8* noundef nonnull noalias readonly align 8 %name) #0 {
entry:
  %0 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %this, i32 0, i32 4
  store i32 0, i32* %0, align 4, !tbaa !5
  %1 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %this, i32 0, i32 0
  store %struct.Channel$i32* %ch, %struct.Channel$i32** %1, align 8, !tbaa !6
  %2 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %this, i32 0, i32 1
  store i32 %first, i32* %2, align 4, !tbaa !7
  %3 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %this, i32 0, i32 2
  store i32 %last, i32* %3, align 4, !tbaa !8
  %4 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %this, i32 0, i32 2
  %5 = load i32, i32* %4, align 4, !tbaa !8
  %6 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %this, i32 0, i32 1
  %7 = load i32, i32* %6, align 4, !tbaa !7
  %8 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %5, i32 %7)
  %9 = extractvalue { i32, i1 } %8, 0
  %10 = extractvalue { i32, i1 } %8, 1
  br i1 %10, label %ovf.fail, label %ovf.ok

ovf.ok:
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 1)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %14 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %this, i32 0, i32 3
  store i32 %12, i32* %14, align 4, !tbaa !9
  %15 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %this, i32 0, i32 4
  %16 = load i32, i32* %15, align 4
  %17 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %16, i32 1)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  store i32 %18, i32* %15, align 4
  %20 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %this, i32 0, i32 4
  %21 = load i32, i32* %20, align 4
  %22 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %21, i32 2)
  %23 = extractvalue { i32, i1 } %22, 0
  %24 = extractvalue { i32, i1 } %22, 1
  br i1 %24, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  store i32 %23, i32* %20, align 4
  %25 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %this, i32 0, i32 5
  store i8* %name, i8** %25, align 8, !tbaa !10
  %26 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %this, i32 0, i32 5
  %27 = load i8*, i8** %26, align 8, !tbaa !10
  %28 = bitcast i8* %27 to i64*
  %29 = load i64, i64* %28, align 8
  %30 = trunc i64 %29 to i32
  %31 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %this, i32 0, i32 6
  store i32 %30, i32* %31, align 4, !tbaa !11
  %32 = call i8* @nish_alloc_struct(i64 24)
  %33 = bitcast i8* %32 to %struct.nish_array*
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  store i64 0, i64* %34, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 1
  store i64 0, i64* %35, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  %36 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  store i8* null, i8** %36, align 8, !alias.scope !15, !noalias !16, !tbaa !22
  %37 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %this, i32 0, i32 7
  store %struct.nish_array* %33, %struct.nish_array** %37, align 8, !tbaa !23
  %38 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %this, i32 0, i32 7
  %39 = load %struct.nish_array*, %struct.nish_array** %38, align 8, !tbaa !23
  %40 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %this, i32 0, i32 1
  %41 = load i32, i32* %40, align 4, !tbaa !7
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 0
  %43 = load i64, i64* %42, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %44 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 1
  %45 = load i64, i64* %44, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  %46 = icmp eq i64 %43, %45
  br i1 %46, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %39, i64 4)
  br label %push.store

push.store:
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 2
  %48 = load i8*, i8** %47, align 8, !alias.scope !15, !noalias !16, !tbaa !22
  %49 = bitcast i8* %48 to i32*
  %50 = getelementptr inbounds i32, i32* %49, i64 %43
  store i32 %41, i32* %50, align 4, !alias.scope !16, !noalias !15, !tbaa !25
  %51 = add i64 %43, 1
  store i64 %51, i64* %42, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %52 = trunc i64 %51 to i32
  %53 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %this, i32 0, i32 7
  %54 = load %struct.nish_array*, %struct.nish_array** %53, align 8, !tbaa !23
  %55 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %this, i32 0, i32 2
  %56 = load i32, i32* %55, align 4, !tbaa !8
  %57 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 0
  %58 = load i64, i64* %57, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %59 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 1
  %60 = load i64, i64* %59, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  %61 = icmp eq i64 %58, %60
  br i1 %61, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %54, i64 4)
  br label %push.store.1

push.store.1:
  %62 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %54, i64 0, i32 2
  %63 = load i8*, i8** %62, align 8, !alias.scope !15, !noalias !16, !tbaa !22
  %64 = bitcast i8* %63 to i32*
  %65 = getelementptr inbounds i32, i32* %64, i64 %58
  store i32 %56, i32* %65, align 4, !alias.scope !16, !noalias !15, !tbaa !25
  %66 = add i64 %58, 1
  store i64 %66, i64* %57, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %67 = trunc i64 %66 to i32
  %68 = call i8* @nish_alloc_struct(i64 8)
  %69 = bitcast i8* %68 to %struct.Range*
  %70 = getelementptr inbounds %struct.Range, %struct.Range* %69, i32 0, i32 0
  store i32 0, i32* %70, align 4, !tbaa !27
  %71 = getelementptr inbounds %struct.Range, %struct.Range* %69, i32 0, i32 1
  store i32 0, i32* %71, align 4, !tbaa !28
  %72 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %this, i32 0, i32 8
  store %struct.Range* %69, %struct.Range** %72, align 8, !tbaa !29
  %73 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %this, i32 0, i32 8
  %74 = load %struct.Range*, %struct.Range** %73, align 8, !tbaa !29
  %75 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %this, i32 0, i32 1
  %76 = load i32, i32* %75, align 4, !tbaa !7
  %77 = getelementptr inbounds %struct.Range, %struct.Range* %74, i32 0, i32 0
  store i32 %76, i32* %77, align 4, !tbaa !27
  %78 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %this, i32 0, i32 8
  %79 = load %struct.Range*, %struct.Range** %78, align 8, !tbaa !29
  %80 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %this, i32 0, i32 2
  %81 = load i32, i32* %80, align 4, !tbaa !8
  %82 = getelementptr inbounds %struct.Range, %struct.Range* %79, i32 0, i32 1
  store i32 %81, i32* %82, align 4, !tbaa !28
  ret void

ovf.fail:
  %ovf.op = phi i32 [ 1, %entry ], [ 0, %ovf.ok ], [ 0, %ovf.ok.1 ], [ 0, %ovf.ok.2 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define hidden noundef i32 @produce(%struct.Pipe* noundef nonnull readonly align 8 dereferenceable(56) nocapture %p) #0 {
entry:
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %p, i32 0, i32 8
  %1 = load %struct.Range*, %struct.Range** %0, align 8, !tbaa !29
  %2 = getelementptr inbounds %struct.Range, %struct.Range* %1, i32 0, i32 0
  %3 = load i32, i32* %2, align 4, !tbaa !27
  store i32 %3, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %p, i32 0, i32 8
  %6 = load %struct.Range*, %struct.Range** %5, align 8, !tbaa !29
  %7 = getelementptr inbounds %struct.Range, %struct.Range* %6, i32 0, i32 1
  %8 = load i32, i32* %7, align 4, !tbaa !28
  %9 = icmp sle i32 %4, %8
  br i1 %9, label %for.body, label %for.end

for.body:
  %10 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %p, i32 0, i32 0
  %11 = load %struct.Channel$i32*, %struct.Channel$i32** %10, align 8, !tbaa !6
  %12 = load i32, i32* %i.addr, align 4
  call void @nish.Channel$i32.send(%struct.Channel$i32* %11, i32 %12)
  br label %for.inc

for.inc:
  %13 = load i32, i32* %i.addr, align 4
  %14 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %13, i32 1)
  %15 = extractvalue { i32, i1 } %14, 0
  %16 = extractvalue { i32, i1 } %14, 1
  br i1 %16, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %15, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %17 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %p, i32 0, i32 3
  %18 = load i32, i32* %17, align 4, !tbaa !9
  %19 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %18, i32 100)
  %20 = extractvalue { i32, i1 } %19, 0
  %21 = extractvalue { i32, i1 } %19, 1
  br i1 %21, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %22 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %p, i32 0, i32 4
  %23 = load i32, i32* %22, align 4, !tbaa !5
  %24 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %23, i32 10)
  %25 = extractvalue { i32, i1 } %24, 0
  %26 = extractvalue { i32, i1 } %24, 1
  br i1 %26, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  %27 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %20, i32 %25)
  %28 = extractvalue { i32, i1 } %27, 0
  %29 = extractvalue { i32, i1 } %27, 1
  br i1 %29, label %ovf.fail, label %ovf.ok.3

ovf.ok.3:
  %30 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %p, i32 0, i32 6
  %31 = load i32, i32* %30, align 4, !tbaa !11
  %32 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %28, i32 %31)
  %33 = extractvalue { i32, i1 } %32, 0
  %34 = extractvalue { i32, i1 } %32, 1
  br i1 %34, label %ovf.fail, label %ovf.ok.4

ovf.ok.4:
  ret i32 %33

ovf.fail:
  %ovf.op = phi i32 [ 0, %for.inc ], [ 2, %for.end ], [ 2, %ovf.ok.1 ], [ 0, %ovf.ok.2 ], [ 0, %ovf.ok.3 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define hidden noundef i32 @consume(%struct.Pipe* noundef nonnull readonly align 8 dereferenceable(56) nocapture %p) #0 {
entry:
  %sum.addr = alloca i32, align 4
  %x.addr = alloca i32, align 4
  %chan.slot = alloca i64, align 8
  store i32 0, i32* %sum.addr, align 4
  %0 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %p, i32 0, i32 0
  %1 = load %struct.Channel$i32*, %struct.Channel$i32** %0, align 8, !tbaa !6
  %2 = getelementptr inbounds %struct.Channel$i32, %struct.Channel$i32* %1, i32 0, i32 2
  br label %chan.recv

chan.recv:
  %3 = call i32 @nish_channel_receive(i64* %2, i64* %chan.slot)
  %4 = icmp ne i32 %3, 0
  br i1 %4, label %chan.body, label %chan.end

chan.body:
  %5 = load i64, i64* %chan.slot, align 8
  %6 = trunc i64 %5 to i32
  store i32 %6, i32* %x.addr, align 4
  %7 = load i32, i32* %sum.addr, align 4
  %8 = load i32, i32* %x.addr, align 4
  %9 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %7, i32 %8)
  %10 = extractvalue { i32, i1 } %9, 0
  %11 = extractvalue { i32, i1 } %9, 1
  br i1 %11, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %10, i32* %sum.addr, align 4
  br label %chan.recv

chan.end:
  %12 = load i32, i32* %sum.addr, align 4
  %13 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %p, i32 0, i32 7
  %14 = load %struct.nish_array*, %struct.nish_array** %13, align 8, !tbaa !23
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %17 = icmp ult i64 0, %16
  br i1 %17, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %16)
  unreachable

bounds.ok:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !15, !noalias !16, !tbaa !22
  %20 = bitcast i8* %19 to i32*
  %21 = getelementptr inbounds i32, i32* %20, i64 0
  %22 = load i32, i32* %21, align 4, !alias.scope !16, !noalias !15, !tbaa !25
  %23 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %12, i32 %22)
  %24 = extractvalue { i32, i1 } %23, 0
  %25 = extractvalue { i32, i1 } %23, 1
  br i1 %25, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %26 = getelementptr inbounds %struct.Pipe, %struct.Pipe* %p, i32 0, i32 7
  %27 = load %struct.nish_array*, %struct.nish_array** %26, align 8, !tbaa !23
  %28 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %27, i64 0, i32 2
  %29 = load i8*, i8** %28, align 8, !alias.scope !15, !noalias !16, !tbaa !22
  %30 = bitcast i8* %29 to i32*
  %31 = getelementptr inbounds i32, i32* %30, i64 0
  %32 = load i32, i32* %31, align 4, !alias.scope !16, !noalias !15, !tbaa !25
  %33 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %24, i32 %32)
  %34 = extractvalue { i32, i1 } %33, 0
  %35 = extractvalue { i32, i1 } %33, 1
  br i1 %35, label %ovf.fail, label %ovf.ok.2

ovf.ok.2:
  ret i32 %34

ovf.fail:
  %ovf.op = phi i32 [ 0, %chan.body ], [ 0, %bounds.ok ], [ 1, %ovf.ok.1 ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define noundef i32 @nish_main() #0 {
entry:
  %sent.addr = alloca %struct.nish_array*, align 8
  %sums.addr = alloca %struct.nish_array*, align 8
  %ch.addr = alloca %struct.Channel$i32*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 1, i64* %2, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 1, i64* %3, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  %4 = call i8* @nish_alloc_struct(i64 4)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !15, !noalias !16, !tbaa !22
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 0, i32* %7, align 4, !alias.scope !16, !noalias !15, !tbaa !25
  store %struct.nish_array* %1, %struct.nish_array** %sent.addr, align 8
  %8 = call i8* @nish_alloc_struct(i64 24)
  %9 = bitcast i8* %8 to %struct.nish_array*
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  store i64 1, i64* %10, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 1
  store i64 1, i64* %11, align 8, !alias.scope !15, !noalias !16, !tbaa !21
  %12 = call i8* @nish_alloc_struct(i64 4)
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  store i8* %12, i8** %13, align 8, !alias.scope !15, !noalias !16, !tbaa !22
  %14 = bitcast i8* %12 to i32*
  %15 = getelementptr inbounds i32, i32* %14, i64 0
  store i32 0, i32* %15, align 4, !alias.scope !16, !noalias !15, !tbaa !25
  store %struct.nish_array* %9, %struct.nish_array** %sums.addr, align 8
  %16 = call i8* @nish_alloc_struct(i64 24)
  %17 = bitcast i8* %16 to %struct.Channel$i32*
  call void @nish.Channel$i32.constructor(%struct.Channel$i32* %17)
  store %struct.Channel$i32* %17, %struct.Channel$i32** %ch.addr, align 8
  %18 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %18, %struct.ThreadScope** %s.addr, align 8
  %19 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %20 = bitcast %struct.ThreadScope* %19 to i8*
  %21 = load %struct.Channel$i32*, %struct.Channel$i32** %ch.addr, align 8
  %22 = getelementptr inbounds %struct.Channel$i32, %struct.Channel$i32* %21, i32 0, i32 2
  %23 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %24 = call i8* @nish_alloc_struct(i64 56)
  %25 = bitcast i8* %24 to %struct.Pipe*
  %26 = load %struct.Channel$i32*, %struct.Channel$i32** %ch.addr, align 8
  call void @Pipe.constructor(%struct.Pipe* %25, %struct.Channel$i32* %26, i32 1, i32 1000, i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*))
  %27 = load %struct.nish_array*, %struct.nish_array** %sent.addr, align 8
  call void @nish.ThreadScope.spawn$$Pipe$i32$fn.7.produce(%struct.ThreadScope* %23, %struct.Pipe* %25, %struct.nish_array* %27, i32 0)
  %28 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %29 = call i8* @nish_alloc_struct(i64 56)
  %30 = bitcast i8* %29 to %struct.Pipe*
  %31 = load %struct.Channel$i32*, %struct.Channel$i32** %ch.addr, align 8
  call void @Pipe.constructor(%struct.Pipe* %30, %struct.Channel$i32* %31, i32 0, i32 0, i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*))
  %32 = load %struct.nish_array*, %struct.nish_array** %sums.addr, align 8
  call void @nish.ThreadScope.spawn$$Pipe$i32$fn.7.consume(%struct.ThreadScope* %28, %struct.Pipe* %30, %struct.nish_array* %32, i32 0)
  call void @nish_channel_count(i64* %22, i64 -1)
  call void @nish_scope_join(i8* %20)
  %33 = load %struct.nish_array*, %struct.nish_array** %sent.addr, align 8
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %36 = icmp ult i64 0, %35
  br i1 %36, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %35)
  unreachable

bounds.ok:
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !15, !noalias !16, !tbaa !22
  %39 = bitcast i8* %38 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 0
  %41 = load i32, i32* %40, align 4, !alias.scope !16, !noalias !15, !tbaa !25
  %42 = call i8* @nish_str_from_i32(i32 %41)
  %43 = call i8* @nish_str_concat(i8* %42, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %44 = load %struct.nish_array*, %struct.nish_array** %sums.addr, align 8
  %45 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 0
  %46 = load i64, i64* %45, align 8, !alias.scope !15, !noalias !16, !tbaa !20
  %47 = icmp ult i64 0, %46
  br i1 %47, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 0, i64 %46)
  unreachable

bounds.ok.1:
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %44, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8, !alias.scope !15, !noalias !16, !tbaa !22
  %50 = bitcast i8* %49 to i32*
  %51 = getelementptr inbounds i32, i32* %50, i64 0
  %52 = load i32, i32* %51, align 4, !alias.scope !16, !noalias !15, !tbaa !25
  %53 = call i8* @nish_str_from_i32(i32 %52)
  %54 = call i8* @nish_str_concat(i8* %43, i8* %53)
  call void @nish_print(i8* %54)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn readonly }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { nounwind willreturn readnone }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"i32", !1, i64 0}
!4 = !{!"Pipe", !2, i64 0, !3, i64 8, !3, i64 12, !3, i64 16, !3, i64 20, !2, i64 24, !3, i64 32, !2, i64 40, !2, i64 48}
!5 = !{!4, !3, i64 20}
!6 = !{!4, !2, i64 0}
!7 = !{!4, !3, i64 8}
!8 = !{!4, !3, i64 12}
!9 = !{!4, !3, i64 16}
!10 = !{!4, !2, i64 24}
!11 = !{!4, !3, i64 32}
!12 = !{!"nish array"}
!13 = !{!"header", !12}
!14 = !{!"elements", !12}
!15 = !{!13}
!16 = !{!14}
!17 = !{!"header i64", !1, i64 0}
!18 = !{!"header ptr", !1, i64 0}
!19 = !{!"array header", !17, i64 0, !17, i64 8, !18, i64 16}
!20 = !{!19, !17, i64 0}
!21 = !{!19, !17, i64 8}
!22 = !{!19, !18, i64 16}
!23 = !{!4, !2, i64 40}
!24 = !{!"element i32", !1, i64 0}
!25 = !{!24, !24, i64 0}
!26 = !{!"Range", !3, i64 0, !3, i64 4}
!27 = !{!26, !3, i64 0}
!28 = !{!26, !3, i64 4}
!29 = !{!4, !2, i64 48}

%struct.Pair = type { i32, i32 }
%struct.ThreadScope = type { i32 }
%struct.Secret$arr.u8 = type { %struct.nish_array* }
%struct.Secret$$Pair = type { %struct.Pair* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"array length out of range\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external thread_local(initialexec) global %struct.nish_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noundef nonnull align 8 dereferenceable(4) %struct.ThreadScope* @nish.scope() #0
declare void @nish.ThreadScope.spawn$i32$i32$fn.7.literal(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i32 noundef, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
declare void @nish.ThreadScope.spawn$i32$i32$fn.7.scratch(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i32 noundef, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
declare void @nish.ThreadScope.spawn$i32$i32$fn.6.record(%struct.ThreadScope* noundef nonnull align 8 dereferenceable(4), i32 noundef, %struct.nish_array* noundef nonnull align 8 dereferenceable(24), i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare void @nish_scope_join(i8* noundef nonnull) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4
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

define internal void @Pair.constructor(%struct.Pair* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %a, i32 noundef %b) #0 {
entry:
  %0 = getelementptr inbounds %struct.Pair, %struct.Pair* %this, i32 0, i32 0
  store i32 %a, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Pair, %struct.Pair* %this, i32 0, i32 1
  store i32 %b, i32* %1, align 4, !tbaa !5
  ret void
}

define hidden noundef i32 @sum$(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %k) #1 {
entry:
  %t.addr = alloca i32, align 4
  %b.addr = alloca i8, align 1
  %forof.idx = alloca i64, align 8
  store i32 0, i32* %t.addr, align 4
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %0 = load i64, i64* %forof.idx, align 8
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %k, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %3 = icmp ult i64 %0, %2
  br i1 %3, label %forof.body, label %forof.end

forof.body:
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %k, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %6 = bitcast i8* %5 to i8*
  %7 = getelementptr inbounds i8, i8* %6, i64 %0
  %8 = load i8, i8* %7, align 1, !alias.scope !10, !noalias !9, !tbaa !17
  store i8 %8, i8* %b.addr, align 1
  %9 = load i32, i32* %t.addr, align 4
  %10 = load i8, i8* %b.addr, align 1
  %11 = zext i8 %10 to i32
  %12 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %9, i32 %11)
  %13 = extractvalue { i32, i1 } %12, 0
  %14 = extractvalue { i32, i1 } %12, 1
  br i1 %14, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %13, i32* %t.addr, align 4
  br label %forof.inc

forof.inc:
  %15 = load i64, i64* %forof.idx, align 8
  %16 = add i64 %15, 1
  store i64 %16, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %17 = load i32, i32* %t.addr, align 4
  ret i32 %17

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef i32 @fillFrom$(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %k, i32 noundef %seed) #1 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %k, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %k, i64 0, i32 2
  %3 = load i8*, i8** %2, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  br label %for.cond

for.cond:
  %4 = load i32, i32* %i.addr, align 4
  %5 = trunc i64 %1 to i32
  %6 = icmp slt i32 %4, %5
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %i.addr, align 4
  %8 = sext i32 %7 to i64
  %9 = load i32, i32* %i.addr, align 4
  %10 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %seed, i32 %9)
  %11 = extractvalue { i32, i1 } %10, 0
  %12 = extractvalue { i32, i1 } %10, 1
  br i1 %12, label %ovf.fail, label %ovf.ok

ovf.ok:
  %13 = trunc i32 %11 to i8
  %14 = bitcast i8* %3 to i8*
  %15 = getelementptr inbounds i8, i8* %14, i64 %8
  store i8 %13, i8* %15, align 1, !alias.scope !10, !noalias !9, !tbaa !17
  br label %for.inc

for.inc:
  %16 = load i32, i32* %i.addr, align 4
  %17 = add nsw i32 %16, 1
  store i32 %17, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %18 = call i32 @sum$(%struct.nish_array* %k)
  ret i32 %18

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef i32 @both$(%struct.Pair* noundef nonnull readonly align 8 dereferenceable(8) nocapture %p) #1 {
entry:
  %0 = getelementptr inbounds %struct.Pair, %struct.Pair* %p, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  %2 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %1, i32 1000)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Pair, %struct.Pair* %p, i32 0, i32 1
  %6 = load i32, i32* %5, align 4, !tbaa !5
  %7 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %3, i32 %6)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  ret i32 %8

ovf.fail:
  %ovf.op = phi i32 [ 2, %entry ], [ 0, %ovf.ok ]
  call void @nish_panic_overflow(i32 %ovf.op)
  unreachable
}

define hidden noundef i32 @literal$(i32 noundef %n) #1 {
entry:
  %k.addr = alloca %struct.Secret$arr.u8*, align 8
  %t.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = trunc i32 %n to i8
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %n, i32 1)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  %4 = trunc i32 %2 to i8
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %n, i32 2)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  %8 = trunc i32 %6 to i8
  %9 = call i8* @nish_alloc_struct(i64 24)
  %10 = bitcast i8* %9 to %struct.nish_array*
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 0
  store i64 3, i64* %11, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 1
  store i64 3, i64* %12, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %13 = call i8* @nish_alloc_struct(i64 3)
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %10, i64 0, i32 2
  store i8* %13, i8** %14, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %15 = bitcast i8* %13 to i8*
  %16 = getelementptr inbounds i8, i8* %15, i64 0
  store i8 %0, i8* %16, align 1, !alias.scope !10, !noalias !9, !tbaa !17
  %17 = getelementptr inbounds i8, i8* %15, i64 1
  store i8 %4, i8* %17, align 1, !alias.scope !10, !noalias !9, !tbaa !17
  %18 = getelementptr inbounds i8, i8* %15, i64 2
  store i8 %8, i8* %18, align 1, !alias.scope !10, !noalias !9, !tbaa !17
  %19 = call %struct.Secret$arr.u8* @nish.secret$arr.u8(%struct.nish_array* %10)
  store %struct.Secret$arr.u8* %19, %struct.Secret$arr.u8** %k.addr, align 8
  %20 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %k.addr, align 8
  %21 = call i32 @nish.expose$arr.u8$i32$fn.3.sum(%struct.Secret$arr.u8* %20)
  store i32 %21, i32* %t.addr, align 4
  %22 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %k.addr, align 8
  call void @nish.wipe$$Secret$arr.u8(%struct.Secret$arr.u8* %22)
  %23 = load i32, i32* %t.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %23

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define hidden noundef i32 @scratch$(i32 noundef %n) #1 {
entry:
  %k.addr = alloca %struct.Secret$arr.u8*, align 8
  %t.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = sext i32 %n to i64
  %1 = icmp ule i64 %0, 2147483647
  br i1 %1, label %len.ok, label %len.fail

len.fail:
  call void @nish_panic(i8* bitcast ({ i64, [26 x i8] }* @.str.0 to i8*))
  unreachable

len.ok:
  %2 = call i8* @nish_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.nish_array*
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 0
  store i64 %0, i64* %4, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 1
  store i64 %0, i64* %5, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %6 = call i8* @nish_alloc_struct(i64 %0)
  call void @llvm.memset.p0i8.i64(i8* align 8 %6, i8 0, i64 %0, i1 false), !alias.scope !10, !noalias !9
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %3, i64 0, i32 2
  store i8* %6, i8** %7, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %8 = call %struct.Secret$arr.u8* @nish.secret$arr.u8(%struct.nish_array* %3)
  store %struct.Secret$arr.u8* %8, %struct.Secret$arr.u8** %k.addr, align 8
  %9 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %k.addr, align 8
  %10 = call i32 @nish.exposeWith$arr.u8$i32$i32$fn.8.fillFrom(%struct.Secret$arr.u8* %9, i32 %n)
  store i32 %10, i32* %t.addr, align 4
  %11 = load %struct.Secret$arr.u8*, %struct.Secret$arr.u8** %k.addr, align 8
  call void @nish.wipe$$Secret$arr.u8(%struct.Secret$arr.u8* %11)
  %12 = load i32, i32* %t.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %12
}

define hidden noundef i32 @record$(i32 noundef %n) #1 {
entry:
  %k.addr = alloca %struct.Secret$$Pair*, align 8
  %t.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Pair*
  %2 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %n, i32 2)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  call void @Pair.constructor(%struct.Pair* %1, i32 %n, i32 %3)
  %5 = call %struct.Secret$$Pair* @nish.secret$$Pair(%struct.Pair* %1)
  store %struct.Secret$$Pair* %5, %struct.Secret$$Pair** %k.addr, align 8
  %6 = load %struct.Secret$$Pair*, %struct.Secret$$Pair** %k.addr, align 8
  %7 = call i32 @nish.expose$$Pair$i32$fn.4.both(%struct.Secret$$Pair* %6)
  store i32 %7, i32* %t.addr, align 4
  %8 = load %struct.Secret$$Pair*, %struct.Secret$$Pair** %k.addr, align 8
  call void @nish.wipe$$Secret$$Pair(%struct.Secret$$Pair* %8)
  %9 = load i32, i32* %t.addr, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %9

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define noundef i32 @nish_main() #1 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %s.addr = alloca %struct.ThreadScope*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 6, i64* %2, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 6, i64* %3, align 8, !alias.scope !9, !noalias !10, !tbaa !18
  %4 = call i8* @nish_alloc_struct(i64 24)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 0, i32* %7, align 4, !alias.scope !10, !noalias !9, !tbaa !20
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 0, i32* %8, align 4, !alias.scope !10, !noalias !9, !tbaa !20
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 0, i32* %9, align 4, !alias.scope !10, !noalias !9, !tbaa !20
  %10 = getelementptr inbounds i32, i32* %6, i64 3
  store i32 0, i32* %10, align 4, !alias.scope !10, !noalias !9, !tbaa !20
  %11 = getelementptr inbounds i32, i32* %6, i64 4
  store i32 0, i32* %11, align 4, !alias.scope !10, !noalias !9, !tbaa !20
  %12 = getelementptr inbounds i32, i32* %6, i64 5
  store i32 0, i32* %12, align 4, !alias.scope !10, !noalias !9, !tbaa !20
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  %13 = call %struct.ThreadScope* @nish.scope()
  store %struct.ThreadScope* %13, %struct.ThreadScope** %s.addr, align 8
  %14 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %15 = bitcast %struct.ThreadScope* %14 to i8*
  %16 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %17 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.ThreadScope.spawn$i32$i32$fn.7.literal(%struct.ThreadScope* %16, i32 4, %struct.nish_array* %17, i32 0)
  %18 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %19 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.ThreadScope.spawn$i32$i32$fn.7.literal(%struct.ThreadScope* %18, i32 40, %struct.nish_array* %19, i32 1)
  %20 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %21 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.ThreadScope.spawn$i32$i32$fn.7.scratch(%struct.ThreadScope* %20, i32 8, %struct.nish_array* %21, i32 2)
  %22 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %23 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.ThreadScope.spawn$i32$i32$fn.7.scratch(%struct.ThreadScope* %22, i32 64, %struct.nish_array* %23, i32 3)
  %24 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %25 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.ThreadScope.spawn$i32$i32$fn.6.record(%struct.ThreadScope* %24, i32 3, %struct.nish_array* %25, i32 4)
  %26 = load %struct.ThreadScope*, %struct.ThreadScope** %s.addr, align 8
  %27 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  call void @nish.ThreadScope.spawn$i32$i32$fn.6.record(%struct.ThreadScope* %26, i32 7, %struct.nish_array* %27, i32 5)
  call void @nish_scope_join(i8* %15)
  %28 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  %30 = load i64, i64* %29, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %31 = icmp ult i64 0, %30
  br i1 %31, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %30)
  unreachable

bounds.ok:
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  %33 = load i8*, i8** %32, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %34 = bitcast i8* %33 to i32*
  %35 = getelementptr inbounds i32, i32* %34, i64 0
  %36 = load i32, i32* %35, align 4, !alias.scope !10, !noalias !9, !tbaa !20
  %37 = call i8* @nish_str_from_i32(i32 %36)
  %38 = call i8* @nish_str_concat(i8* %37, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %39 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %40 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 0
  %41 = load i64, i64* %40, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %42 = icmp ult i64 1, %41
  br i1 %42, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @nish_panic_index(i64 1, i64 %41)
  unreachable

bounds.ok.1:
  %43 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %39, i64 0, i32 2
  %44 = load i8*, i8** %43, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %45 = bitcast i8* %44 to i32*
  %46 = getelementptr inbounds i32, i32* %45, i64 1
  %47 = load i32, i32* %46, align 4, !alias.scope !10, !noalias !9, !tbaa !20
  %48 = call i8* @nish_str_from_i32(i32 %47)
  %49 = call i8* @nish_str_concat(i8* %38, i8* %48)
  %50 = call i8* @nish_str_concat(i8* %49, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %51 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 0
  %53 = load i64, i64* %52, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %54 = icmp ult i64 2, %53
  br i1 %54, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @nish_panic_index(i64 2, i64 %53)
  unreachable

bounds.ok.2:
  %55 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %51, i64 0, i32 2
  %56 = load i8*, i8** %55, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %57 = bitcast i8* %56 to i32*
  %58 = getelementptr inbounds i32, i32* %57, i64 2
  %59 = load i32, i32* %58, align 4, !alias.scope !10, !noalias !9, !tbaa !20
  %60 = call i8* @nish_str_from_i32(i32 %59)
  %61 = call i8* @nish_str_concat(i8* %50, i8* %60)
  %62 = call i8* @nish_str_concat(i8* %61, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %63 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %64 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 0
  %65 = load i64, i64* %64, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %66 = icmp ult i64 3, %65
  br i1 %66, label %bounds.ok.3, label %bounds.fail.3

bounds.fail.3:
  call void @nish_panic_index(i64 3, i64 %65)
  unreachable

bounds.ok.3:
  %67 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %63, i64 0, i32 2
  %68 = load i8*, i8** %67, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %69 = bitcast i8* %68 to i32*
  %70 = getelementptr inbounds i32, i32* %69, i64 3
  %71 = load i32, i32* %70, align 4, !alias.scope !10, !noalias !9, !tbaa !20
  %72 = call i8* @nish_str_from_i32(i32 %71)
  %73 = call i8* @nish_str_concat(i8* %62, i8* %72)
  call void @nish_print(i8* %73)
  %74 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %75 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %74, i64 0, i32 0
  %76 = load i64, i64* %75, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %77 = icmp ult i64 4, %76
  br i1 %77, label %bounds.ok.4, label %bounds.fail.4

bounds.fail.4:
  call void @nish_panic_index(i64 4, i64 %76)
  unreachable

bounds.ok.4:
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %74, i64 0, i32 2
  %79 = load i8*, i8** %78, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %80 = bitcast i8* %79 to i32*
  %81 = getelementptr inbounds i32, i32* %80, i64 4
  %82 = load i32, i32* %81, align 4, !alias.scope !10, !noalias !9, !tbaa !20
  %83 = call i8* @nish_str_from_i32(i32 %82)
  %84 = call i8* @nish_str_concat(i8* %83, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %85 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %86 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %85, i64 0, i32 0
  %87 = load i64, i64* %86, align 8, !alias.scope !9, !noalias !10, !tbaa !14
  %88 = icmp ult i64 5, %87
  br i1 %88, label %bounds.ok.5, label %bounds.fail.5

bounds.fail.5:
  call void @nish_panic_index(i64 5, i64 %87)
  unreachable

bounds.ok.5:
  %89 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %85, i64 0, i32 2
  %90 = load i8*, i8** %89, align 8, !alias.scope !9, !noalias !10, !tbaa !15
  %91 = bitcast i8* %90 to i32*
  %92 = getelementptr inbounds i32, i32* %91, i64 5
  %93 = load i32, i32* %92, align 4, !alias.scope !10, !noalias !9, !tbaa !20
  %94 = call i8* @nish_str_from_i32(i32 %93)
  %95 = call i8* @nish_str_concat(i8* %84, i8* %94)
  call void @nish_print(i8* %95)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

define internal void @nish.Secret$arr.u8.constructor(%struct.Secret$arr.u8* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) %value) #0 {
entry:
  %0 = getelementptr inbounds %struct.Secret$arr.u8, %struct.Secret$arr.u8* %this, i32 0, i32 0
  store %struct.nish_array* %value, %struct.nish_array** %0, align 8, !tbaa !23
  ret void
}

define internal void @nish.Secret$$Pair.constructor(%struct.Secret$$Pair* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.Pair* noundef nonnull align 8 dereferenceable(8) %value) #0 {
entry:
  %0 = getelementptr inbounds %struct.Secret$$Pair, %struct.Secret$$Pair* %this, i32 0, i32 0
  store %struct.Pair* %value, %struct.Pair** %0, align 8, !tbaa !25
  ret void
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Secret$arr.u8* @nish.secret$arr.u8(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) %value) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Secret$arr.u8*
  call void @nish.Secret$arr.u8.constructor(%struct.Secret$arr.u8* %1, %struct.nish_array* %value)
  ret %struct.Secret$arr.u8* %1
}

define internal noundef i32 @nish.expose$arr.u8$i32$fn.3.sum(%struct.Secret$arr.u8* noundef nonnull readonly align 8 dereferenceable(8) nocapture %s) #1 {
entry:
  %0 = getelementptr inbounds %struct.Secret$arr.u8, %struct.Secret$arr.u8* %s, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !23
  %2 = call i32 @sum$(%struct.nish_array* %1)
  ret i32 %2
}

define internal void @nish.wipe$$Secret$arr.u8(%struct.Secret$arr.u8* noundef nonnull align 8 dereferenceable(8) nocapture %_target) #1 {
entry:
  %0 = getelementptr inbounds %struct.Secret$arr.u8, %struct.Secret$arr.u8* %_target, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i32 0, i32 1
  %3 = load i64, i64* %2, align 8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i32 0, i32 2
  %5 = load i8*, i8** %4, align 8
  call void @llvm.memset.p0i8.i64(i8* %5, i8 0, i64 %3, i1 true)
  ret void
}

define internal noundef i32 @nish.exposeWith$arr.u8$i32$i32$fn.8.fillFrom(%struct.Secret$arr.u8* noundef nonnull readonly align 8 dereferenceable(8) nocapture %s, i32 noundef %arg) #1 {
entry:
  %0 = getelementptr inbounds %struct.Secret$arr.u8, %struct.Secret$arr.u8* %s, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !23
  %2 = call i32 @fillFrom$(%struct.nish_array* %1, i32 %arg)
  ret i32 %2
}

define internal noundef nonnull align 8 dereferenceable(8) %struct.Secret$$Pair* @nish.secret$$Pair(%struct.Pair* noundef nonnull align 8 dereferenceable(8) %value) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 8)
  %1 = bitcast i8* %0 to %struct.Secret$$Pair*
  call void @nish.Secret$$Pair.constructor(%struct.Secret$$Pair* %1, %struct.Pair* %value)
  ret %struct.Secret$$Pair* %1
}

define internal noundef i32 @nish.expose$$Pair$i32$fn.4.both(%struct.Secret$$Pair* noundef nonnull readonly align 8 dereferenceable(8) nocapture %s) #1 {
entry:
  %0 = getelementptr inbounds %struct.Secret$$Pair, %struct.Secret$$Pair* %s, i32 0, i32 0
  %1 = load %struct.Pair*, %struct.Pair** %0, align 8, !tbaa !25
  %2 = call i32 @both$(%struct.Pair* %1)
  ret i32 %2
}

define internal void @nish.wipe$$Secret$$Pair(%struct.Secret$$Pair* noundef nonnull align 8 dereferenceable(8) nocapture %_target) #1 {
entry:
  %0 = getelementptr inbounds %struct.Secret$$Pair, %struct.Secret$$Pair* %_target, i32 0, i32 0
  %1 = load %struct.Pair*, %struct.Pair** %0, align 8
  %2 = bitcast %struct.Pair* %1 to i8*
  call void @llvm.memset.p0i8.i64(i8* %2, i8 0, i64 8, i1 true)
  ret void
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Pair", !2, i64 0, !2, i64 4}
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
!15 = !{!13, !12, i64 16}
!16 = !{!"element i8", !1, i64 0}
!17 = !{!16, !16, i64 0}
!18 = !{!13, !11, i64 8}
!19 = !{!"element i32", !1, i64 0}
!20 = !{!19, !19, i64 0}
!21 = !{!"ptr", !1, i64 0}
!22 = !{!"Secret$arr.u8", !21, i64 0}
!23 = !{!22, !21, i64 0}
!24 = !{!"Secret$$Pair", !21, i64 0}
!25 = !{!24, !21, i64 0}

%struct.Leaky = type { i32 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"x\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"y\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"n\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #2
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #2

define internal void @Leaky.constructor(%struct.Leaky* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %k) #0 {
entry:
  %s.addr = alloca i8*, align 8
  %0 = call i8* @nish_str_from_i32(i32 %k)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8* %0)
  store i8* %1, i8** %s.addr, align 8
  %2 = load i8*, i8** %s.addr, align 8
  %3 = call i8* @nish_str_concat(i8* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  store i8* %3, i8** %s.addr, align 8
  %4 = getelementptr inbounds %struct.Leaky, %struct.Leaky* %this, i32 0, i32 0
  store i32 %k, i32* %4, align 4, !tbaa !4
  ret void
}

define internal noundef i32 @bracketed() #0 {
entry:
  %a.addr = alloca i64, align 8
  %s.addr = alloca i8*, align 8
  %0 = call i64 @nish_arena_mark()
  store i64 %0, i64* %a.addr, align 8
  %1 = load i64, i64* %a.addr, align 8
  store i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i8** %s.addr, align 8
  %2 = load i8*, i8** %s.addr, align 8
  %3 = call i8* @nish_str_concat(i8* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  store i8* %3, i8** %s.addr, align 8
  %4 = load i8*, i8** %s.addr, align 8
  %5 = bitcast i8* %4 to i64*
  %6 = load i64, i64* %5, align 8
  %7 = trunc i64 %6 to i32
  call void @nish_arena_release(i64 %1)
  ret i32 %7
}

define internal noundef i32 @scopedOnly(i32 noundef %n) #0 {
entry:
  %total.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %s.addr = alloca i8*, align 8
  store i32 0, i32* %total.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %3 = load i8*, i8** %2, align 8
  %4 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %5 = load i64, i64* %4, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = call i8* @nish_str_from_i32(i32 %6)
  %8 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8* %7)
  store i8* %8, i8** %s.addr, align 8
  %9 = load i32, i32* %i.addr, align 4
  %10 = call i8* @nish_str_from_i32(i32 %9)
  %11 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*), i8* %10)
  store i8* %11, i8** %s.addr, align 8
  %12 = load i32, i32* %total.addr, align 4
  %13 = load i8*, i8** %s.addr, align 8
  %14 = bitcast i8* %13 to i64*
  %15 = load i64, i64* %14, align 8
  %16 = trunc i64 %15 to i32
  %17 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %12, i32 %16)
  %18 = extractvalue { i32, i1 } %17, 0
  %19 = extractvalue { i32, i1 } %17, 1
  br i1 %19, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %18, i32* %total.addr, align 4
  %20 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %21 = load i8*, i8** %20, align 8
  %22 = icmp eq i8* %21, %3
  br i1 %22, label %pass.rewind, label %pass.free

pass.rewind:
  %23 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %5, i64* %23, align 8
  br label %pass.done

pass.free:
  %24 = ptrtoint i8* %3 to i64
  %25 = add i64 %24, %5
  call void @nish_arena_release(i64 %25)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %26 = load i32, i32* %i.addr, align 4
  %27 = add nsw i32 %26, 1
  store i32 %27, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %28 = load i32, i32* %total.addr, align 4
  ret i32 %28

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @plain(i32 noundef %n) #1 {
entry:
  %held.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %held.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, %n
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.nish_array*, %struct.nish_array** %held.addr, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = call i8* @nish_str_from_i32(i32 %6)
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %11 = load i64, i64* %10, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %12 = icmp eq i64 %9, %11
  br i1 %12, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 8)
  br label %push.store

push.store:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %15 = bitcast i8* %14 to i8**
  %16 = getelementptr inbounds i8*, i8** %15, i64 %9
  store i8* %7, i8** %16, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %17 = add i64 %9, 1
  store i64 %17, i64* %8, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %18 = trunc i64 %17 to i32
  br label %for.inc

for.inc:
  %19 = load i32, i32* %i.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %21 = load %struct.nish_array*, %struct.nish_array** %held.addr, align 8
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %23 = load i64, i64* %22, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %24 = trunc i64 %23 to i32
  ret i32 %24
}

define internal noundef i32 @twice(i32 noundef %x) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %x, i32 2)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal noundef nonnull align 8 i8* @fixed(i32 noundef %x) #2 {
entry:
  ret i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*)
}

define internal noundef nonnull align 8 i8* @label(i32 noundef %x) #0 {
entry:
  %0 = call i8* @nish_str_from_i32(i32 %x)
  %1 = call i8* @nish_str_concat(i8* bitcast ({ i64, [2 x i8] }* @.str.4 to i8*), i8* %0)
  ret i8* %1
}

define internal noundef i32 @both() #0 {
entry:
  %head.addr = alloca i8*, align 8
  %0 = call i32 @lastOf$fn.5.fixed(i32 3)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  store i8* %1, i8** %head.addr, align 8
  %2 = load i8*, i8** %head.addr, align 8
  %3 = bitcast i8* %2 to i64*
  %4 = load i64, i64* %3, align 8
  %5 = trunc i64 %4 to i32
  %6 = call i32 @lastOf$fn.5.label(i32 3)
  %7 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %5, i32 %6)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %8

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define void @nish_main() #0 {
entry:
  %k.addr = alloca i32, align 4
  %Leaky.obj = alloca %struct.Leaky, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 0, i32* %k.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %k.addr, align 4
  call void @Leaky.constructor(%struct.Leaky* %Leaky.obj, i32 %0)
  %1 = getelementptr inbounds %struct.Leaky, %struct.Leaky* %Leaky.obj, i32 0, i32 0
  %2 = load i32, i32* %1, align 4, !tbaa !4
  %3 = icmp slt i32 %2, 3
  br i1 %3, label %while.body, label %while.end

while.body:
  %4 = load i32, i32* %k.addr, align 4
  %5 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %4, i32 1)
  %6 = extractvalue { i32, i1 } %5, 0
  %7 = extractvalue { i32, i1 } %5, 1
  br i1 %7, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %6, i32* %k.addr, align 4
  br label %while.cond

while.end:
  %8 = call i32 @each$fn.5.twice(i32 3)
  %9 = call i8* @nish_str_from_i32(i32 %8)
  %10 = call i8* @nish_str_concat(i8* %9, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %11 = call i32 @bracketed()
  %12 = call i8* @nish_str_from_i32(i32 %11)
  %13 = call i8* @nish_str_concat(i8* %10, i8* %12)
  %14 = call i8* @nish_str_concat(i8* %13, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %15 = call i32 @scopedOnly(i32 3)
  %16 = call i8* @nish_str_from_i32(i32 %15)
  %17 = call i8* @nish_str_concat(i8* %14, i8* %16)
  %18 = call i8* @nish_str_concat(i8* %17, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %19 = call i32 @plain(i32 3)
  %20 = call i8* @nish_str_from_i32(i32 %19)
  %21 = call i8* @nish_str_concat(i8* %18, i8* %20)
  %22 = call i8* @nish_str_concat(i8* %21, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %23 = load i32, i32* %k.addr, align 4
  %24 = call i8* @nish_str_from_i32(i32 %23)
  %25 = call i8* @nish_str_concat(i8* %22, i8* %24)
  %26 = call i8* @nish_str_concat(i8* %25, i8* bitcast ({ i64, [2 x i8] }* @.str.5 to i8*))
  %27 = call i32 @both()
  %28 = call i8* @nish_str_from_i32(i32 %27)
  %29 = call i8* @nish_str_concat(i8* %26, i8* %28)
  call void @nish_print(i8* %29)
  call void @nish_arena_release(i64 %arena.mark)
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @lastOf$fn.5.fixed(i32 noundef %n) #3 {
entry:
  %last.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  store i8* bitcast ({ i64, [1 x i8] }* @.str.6 to i8*), i8** %last.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = call i8* @fixed(i32 %2)
  store i8* %3, i8** %last.addr, align 8
  br label %for.inc

for.inc:
  %4 = load i32, i32* %i.addr, align 4
  %5 = add nsw i32 %4, 1
  store i32 %5, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %6 = load i8*, i8** %last.addr, align 8
  %7 = bitcast i8* %6 to i64*
  %8 = load i64, i64* %7, align 8
  %9 = trunc i64 %8 to i32
  ret i32 %9
}

define internal noundef i32 @lastOf$fn.5.label(i32 noundef %n) #0 {
entry:
  %last.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [1 x i8] }* @.str.6 to i8*), i8** %last.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = call i64 @nish_arena_mark()
  %4 = call i8* @label(i32 %2)
  %5 = call i8* @nish_arena_keep(i64 %3, i8* %4)
  store i8* %5, i8** %last.addr, align 8
  br label %for.inc

for.inc:
  %6 = load i32, i32* %i.addr, align 4
  %7 = add nsw i32 %6, 1
  store i32 %7, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %8 = load i8*, i8** %last.addr, align 8
  %9 = bitcast i8* %8 to i64*
  %10 = load i64, i64* %9, align 8
  %11 = trunc i64 %10 to i32
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %11
}

define internal noundef i32 @each$fn.5.twice(i32 noundef %n) #0 {
entry:
  %held.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %held.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, %n
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.nish_array*, %struct.nish_array** %held.addr, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = call i32 @twice(i32 %6)
  %8 = call i8* @nish_str_from_i32(i32 %7)
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %12 = load i64, i64* %11, align 8, !alias.scope !8, !noalias !9, !tbaa !14
  %13 = icmp eq i64 %10, %12
  br i1 %13, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 8)
  br label %push.store

push.store:
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !8, !noalias !9, !tbaa !15
  %16 = bitcast i8* %15 to i8**
  %17 = getelementptr inbounds i8*, i8** %16, i64 %10
  store i8* %8, i8** %17, align 8, !alias.scope !9, !noalias !8, !tbaa !17
  %18 = add i64 %10, 1
  store i64 %18, i64* %9, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %19 = trunc i64 %18 to i32
  br label %for.inc

for.inc:
  %20 = load i32, i32* %i.addr, align 4
  %21 = add nsw i32 %20, 1
  store i32 %21, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %22 = load %struct.nish_array*, %struct.nish_array** %held.addr, align 8
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %22, i64 0, i32 0
  %24 = load i64, i64* %23, align 8, !alias.scope !8, !noalias !9, !tbaa !13
  %25 = trunc i64 %24 to i32
  ret i32 %25
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!llvm.module.flags = !{!18, !19, !20, !21, !22}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Leaky", !2, i64 0}
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

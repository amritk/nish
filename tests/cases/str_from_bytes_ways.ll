%struct.Packet = type { %struct.nish_array*, %struct.nish_array* }
%struct.Slots = type { %struct.nish_array* }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #0
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_u64(i64 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #3
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #3

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

define internal void @Packet.constructor(%struct.Packet* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 2, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 2, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 2)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i8*
  %7 = getelementptr inbounds i8, i8* %6, i64 0
  store i8 104, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i8, i8* %6, i64 1
  store i8 105, i8* %8, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds %struct.Packet, %struct.Packet* %this, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %9, align 8, !tbaa !17
  %10 = call i8* @nish_alloc_struct(i64 24)
  %11 = bitcast i8* %10 to %struct.nish_array*
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 0
  store i64 2, i64* %12, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 1
  store i64 2, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %14 = call i8* @nish_alloc_struct(i64 2)
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %11, i64 0, i32 2
  store i8* %14, i8** %15, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %16 = bitcast i8* %14 to i8*
  %17 = getelementptr inbounds i8, i8* %16, i64 0
  store i8 116, i8* %17, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %18 = getelementptr inbounds i8, i8* %16, i64 1
  store i8 103, i8* %18, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %19 = getelementptr inbounds %struct.Packet, %struct.Packet* %this, i32 0, i32 1
  store %struct.nish_array* %11, %struct.nish_array** %19, align 8, !tbaa !18
  ret void
}

define internal void @Slots.constructor(%struct.Slots* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 4, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 4, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 4)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i8*
  %7 = getelementptr inbounds i8, i8* %6, i64 0
  store i8 115, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i8, i8* %6, i64 1
  store i8 108, i8* %8, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds i8, i8* %6, i64 2
  store i8 111, i8* %9, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = getelementptr inbounds i8, i8* %6, i64 3
  store i8 116, i8* %10, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %11 = getelementptr inbounds %struct.Slots, %struct.Slots* %this, i32 0, i32 0
  store %struct.nish_array* %1, %struct.nish_array** %11, align 8, !tbaa !20
  ret void
}

define internal noundef i8 @Slots.first(%struct.Slots* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Slots, %struct.Slots* %this, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !20
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = icmp ult i64 0, %3
  br i1 %4, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 0, i64 %3)
  unreachable

bounds.ok:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %7 = bitcast i8* %6 to i8*
  %8 = getelementptr inbounds i8, i8* %7, i64 0
  %9 = load i8, i8* %8, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  ret i8 %9
}

define internal noundef nonnull align 8 i8* @Slots.text(%struct.Slots* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #1 {
entry:
  %0 = getelementptr inbounds %struct.Slots, %struct.Slots* %this, i32 0, i32 0
  %1 = load %struct.nish_array*, %struct.nish_array** %0, align 8, !tbaa !20
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = icmp ule i64 0, 4
  %5 = icmp ule i64 4, %3
  %6 = and i1 %4, %5
  br i1 %6, label %bytes.ok, label %bytes.fail

bytes.fail:
  call void @nish_panic_slice(i64 0, i64 4, i64 %3)
  unreachable

bytes.ok:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %9 = getelementptr inbounds i8, i8* %8, i64 0
  %10 = sub i64 4, 0
  %11 = call i8* @nish_str_new(i8* %9, i64 %10)
  ret i8* %11
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @made() #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 4, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 4, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = call i8* @nish_alloc_struct(i64 4)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %4 to i8*
  %7 = getelementptr inbounds i8, i8* %6, i64 0
  store i8 109, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %8 = getelementptr inbounds i8, i8* %6, i64 1
  store i8 97, i8* %8, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds i8, i8* %6, i64 2
  store i8 100, i8* %9, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %10 = getelementptr inbounds i8, i8* %6, i64 3
  store i8 101, i8* %10, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  ret %struct.nish_array* %1
}

define internal noundef nonnull align 8 i8* @pick(i1 noundef zeroext %which, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %a, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %b) #1 {
entry:
  br i1 %which, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %0 = phi %struct.nish_array* [ %a, %cond.true ], [ %b, %cond.false ]
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ule i64 0, 1
  %4 = icmp ule i64 1, %2
  %5 = and i1 %3, %4
  br i1 %5, label %bytes.ok, label %bytes.fail

bytes.fail:
  call void @nish_panic_slice(i64 0, i64 1, i64 %2)
  unreachable

bytes.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %0, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %8 = getelementptr inbounds i8, i8* %7, i64 0
  %9 = sub i64 1, 0
  %10 = call i8* @nish_str_new(i8* %8, i64 %9)
  ret i8* %10
}

define internal noundef nonnull align 8 i8* @ranged(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %bytes, i32 noundef %end) #1 {
entry:
  %0 = sext i32 %end to i64
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = icmp ule i64 0, %0
  %4 = icmp ule i64 %0, %2
  %5 = and i1 %3, %4
  br i1 %5, label %bytes.ok, label %bytes.fail

bytes.fail:
  call void @nish_panic_slice(i64 0, i64 %0, i64 %2)
  unreachable

bytes.ok:
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %bytes, i64 0, i32 2
  %7 = load i8*, i8** %6, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %8 = getelementptr inbounds i8, i8* %7, i64 0
  %9 = sub i64 %0, 0
  %10 = call i8* @nish_str_new(i8* %8, i64 %9)
  ret i8* %10
}

define noundef i32 @nish_main() #1 {
entry:
  %p.addr = alloca %struct.Packet*, align 8
  %Packet.obj = alloca %struct.Packet, align 8
  %s.addr = alloca %struct.Slots*, align 8
  %Slots.obj = alloca %struct.Slots, align 8
  %a.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [1 x i8], align 8
  %b.addr = alloca %struct.nish_array*, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [1 x i8], align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [3 x i8], align 8
  %wide.addr = alloca i32, align 4
  %big.addr = alloca i64, align 8
  %f.addr = alloca double, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Packet.constructor(%struct.Packet* %Packet.obj)
  store %struct.Packet* %Packet.obj, %struct.Packet** %p.addr, align 8
  %0 = load %struct.Packet*, %struct.Packet** %p.addr, align 8
  %1 = getelementptr inbounds %struct.Packet, %struct.Packet* %0, i32 0, i32 0
  %2 = load %struct.nish_array*, %struct.nish_array** %1, align 8, !tbaa !17
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0
  %4 = load i64, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %5 = icmp ule i64 0, 2
  %6 = icmp ule i64 2, %4
  %7 = and i1 %5, %6
  br i1 %7, label %bytes.ok, label %bytes.fail

bytes.fail:
  call void @nish_panic_slice(i64 0, i64 2, i64 %4)
  unreachable

bytes.ok:
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %10 = getelementptr inbounds i8, i8* %9, i64 0
  %11 = sub i64 2, 0
  %12 = call i8* @nish_str_new(i8* %10, i64 %11)
  call void @nish_print(i8* %12)
  %13 = load %struct.Packet*, %struct.Packet** %p.addr, align 8
  %14 = getelementptr inbounds %struct.Packet, %struct.Packet* %13, i32 0, i32 1
  %15 = load %struct.nish_array*, %struct.nish_array** %14, align 8, !tbaa !18
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = icmp ule i64 1, 2
  %19 = icmp ule i64 2, %17
  %20 = and i1 %18, %19
  br i1 %20, label %bytes.ok.1, label %bytes.fail.1

bytes.fail.1:
  call void @nish_panic_slice(i64 1, i64 2, i64 %17)
  unreachable

bytes.ok.1:
  %21 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %15, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %23 = getelementptr inbounds i8, i8* %22, i64 1
  %24 = sub i64 2, 1
  %25 = call i8* @nish_str_new(i8* %23, i64 %24)
  call void @nish_print(i8* %25)
  call void @Slots.constructor(%struct.Slots* %Slots.obj)
  store %struct.Slots* %Slots.obj, %struct.Slots** %s.addr, align 8
  %26 = load %struct.Slots*, %struct.Slots** %s.addr, align 8
  %27 = call i64 @nish_arena_mark()
  %28 = call i8* @Slots.text(%struct.Slots* %26)
  %29 = call i8* @nish_arena_keep(i64 %27, i8* %28)
  %30 = call i8* @nish_str_concat(i8* %29, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %31 = load %struct.Slots*, %struct.Slots** %s.addr, align 8
  %32 = call i8 @Slots.first(%struct.Slots* %31)
  %33 = zext i8 %32 to i64
  %34 = call i8* @nish_str_from_u64(i64 %33)
  %35 = call i8* @nish_str_concat(i8* %30, i8* %34)
  call void @nish_print(i8* %35)
  %36 = call %struct.nish_array* @made()
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 0
  %38 = load i64, i64* %37, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %39 = icmp ule i64 1, 4
  %40 = icmp ule i64 4, %38
  %41 = and i1 %39, %40
  br i1 %41, label %bytes.ok.2, label %bytes.fail.2

bytes.fail.2:
  call void @nish_panic_slice(i64 1, i64 4, i64 %38)
  unreachable

bytes.ok.2:
  %42 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %36, i64 0, i32 2
  %43 = load i8*, i8** %42, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %44 = getelementptr inbounds i8, i8* %43, i64 1
  %45 = sub i64 4, 1
  %46 = call i8* @nish_str_new(i8* %44, i64 %45)
  call void @nish_print(i8* %46)
  %47 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 1, i64* %47, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %48 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 1, i64* %48, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %49 = bitcast [1 x i8]* %arr.data to i8*
  %50 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %49, i8** %50, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %51 = bitcast i8* %49 to i8*
  %52 = getelementptr inbounds i8, i8* %51, i64 0
  store i8 97, i8* %52, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %a.addr, align 8
  %53 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 1, i64* %53, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %54 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 1, i64* %54, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %55 = bitcast [1 x i8]* %arr.data.1 to i8*
  %56 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %55, i8** %56, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %57 = bitcast i8* %55 to i8*
  %58 = getelementptr inbounds i8, i8* %57, i64 0
  store i8 98, i8* %58, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr.1, %struct.nish_array** %b.addr, align 8
  %59 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %60 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %61 = call i64 @nish_arena_mark()
  %62 = call i8* @pick(i1 true, %struct.nish_array* %59, %struct.nish_array* %60)
  %63 = call i8* @nish_arena_keep(i64 %61, i8* %62)
  %64 = load %struct.nish_array*, %struct.nish_array** %a.addr, align 8
  %65 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %66 = call i64 @nish_arena_mark()
  %67 = call i8* @pick(i1 false, %struct.nish_array* %64, %struct.nish_array* %65)
  %68 = call i8* @nish_arena_keep(i64 %66, i8* %67)
  %69 = call i8* @nish_str_concat(i8* %63, i8* %68)
  call void @nish_print(i8* %69)
  %70 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 3, i64* %70, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %71 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 3, i64* %71, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %72 = bitcast [3 x i8]* %arr.data.2 to i8*
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %72, i8** %73, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %74 = bitcast i8* %72 to i8*
  %75 = getelementptr inbounds i8, i8* %74, i64 0
  store i8 108, i8* %75, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %76 = getelementptr inbounds i8, i8* %74, i64 1
  store i8 105, i8* %76, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %77 = getelementptr inbounds i8, i8* %74, i64 2
  store i8 116, i8* %77, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %78 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  %79 = load i64, i64* %78, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %80 = icmp ule i64 0, 3
  %81 = icmp ule i64 3, %79
  %82 = and i1 %80, %81
  br i1 %82, label %bytes.ok.3, label %bytes.fail.3

bytes.fail.3:
  call void @nish_panic_slice(i64 0, i64 3, i64 %79)
  unreachable

bytes.ok.3:
  %83 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  %84 = load i8*, i8** %83, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %85 = getelementptr inbounds i8, i8* %84, i64 0
  %86 = sub i64 3, 0
  %87 = call i8* @nish_str_new(i8* %85, i64 %86)
  call void @nish_print(i8* %87)
  store i32 3, i32* %wide.addr, align 4
  %88 = sext i32 4 to i64
  store i64 %88, i64* %big.addr, align 8
  %89 = call %struct.nish_array* @made()
  %90 = load i32, i32* %wide.addr, align 4
  %91 = zext i32 %90 to i64
  %92 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %89, i64 0, i32 0
  %93 = load i64, i64* %92, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %94 = icmp ule i64 0, %91
  %95 = icmp ule i64 %91, %93
  %96 = and i1 %94, %95
  br i1 %96, label %bytes.ok.4, label %bytes.fail.4

bytes.fail.4:
  call void @nish_panic_slice(i64 0, i64 %91, i64 %93)
  unreachable

bytes.ok.4:
  %97 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %89, i64 0, i32 2
  %98 = load i8*, i8** %97, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %99 = getelementptr inbounds i8, i8* %98, i64 0
  %100 = sub i64 %91, 0
  %101 = call i8* @nish_str_new(i8* %99, i64 %100)
  %102 = call i8* @nish_str_concat(i8* %101, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %103 = call %struct.nish_array* @made()
  %104 = sext i32 1 to i64
  %105 = load i64, i64* %big.addr, align 8
  %106 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %103, i64 0, i32 0
  %107 = load i64, i64* %106, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %108 = icmp ule i64 %104, %105
  %109 = icmp ule i64 %105, %107
  %110 = and i1 %108, %109
  br i1 %110, label %bytes.ok.5, label %bytes.fail.5

bytes.fail.5:
  call void @nish_panic_slice(i64 %104, i64 %105, i64 %107)
  unreachable

bytes.ok.5:
  %111 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %103, i64 0, i32 2
  %112 = load i8*, i8** %111, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %113 = getelementptr inbounds i8, i8* %112, i64 %104
  %114 = sub i64 %105, %104
  %115 = call i8* @nish_str_new(i8* %113, i64 %114)
  %116 = call i8* @nish_str_concat(i8* %102, i8* %115)
  call void @nish_print(i8* %116)
  store double 0x4007333333333333, double* %f.addr, align 8
  %117 = call %struct.nish_array* @made()
  %118 = load double, double* %f.addr, align 8
  %119 = fptosi double %118 to i64
  %120 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %117, i64 0, i32 0
  %121 = load i64, i64* %120, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %122 = icmp ule i64 0, %119
  %123 = icmp ule i64 %119, %121
  %124 = and i1 %122, %123
  br i1 %124, label %bytes.ok.6, label %bytes.fail.6

bytes.fail.6:
  call void @nish_panic_slice(i64 0, i64 %119, i64 %121)
  unreachable

bytes.ok.6:
  %125 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %117, i64 0, i32 2
  %126 = load i8*, i8** %125, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %127 = getelementptr inbounds i8, i8* %126, i64 0
  %128 = sub i64 %119, 0
  %129 = call i8* @nish_str_new(i8* %127, i64 %128)
  call void @nish_print(i8* %129)
  %130 = call %struct.nish_array* @made()
  %131 = call i64 @nish_arena_mark()
  %132 = call i8* @ranged(%struct.nish_array* %130, i32 2)
  %133 = call i8* @nish_arena_keep(i64 %131, i8* %132)
  call void @nish_print(i8* %133)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
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
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i8", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"ptr", !6, i64 0}
!16 = !{!"Packet", !15, i64 0, !15, i64 8}
!17 = !{!16, !15, i64 0}
!18 = !{!16, !15, i64 8}
!19 = !{!"Slots", !15, i64 0}
!20 = !{!19, !15, i64 0}

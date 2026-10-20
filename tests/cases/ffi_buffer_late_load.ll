%struct.Popper = type { i64 }
%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [71 x i8] } { i64 70, [71 x i8] c"`pwrite`: argument 3 (n) counts more bytes than argument 2 (buf) holds\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [70 x i8] } { i64 69, [70 x i8] c"`write`: argument 3 (n) counts more bytes than argument 2 (buf) holds\00" }, align 8

declare i64 @write(i32, i8*, i64)
declare i64 @pwrite(i32, i8*, i64, i64)
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_panic_index(i64 noundef, i64 noundef) #3

define internal noundef i32 @grow(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %b) #0 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 1
  %3 = load i64, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = icmp eq i64 %1, %3
  br i1 %4, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %b, i64 1)
  br label %push.store

push.store:
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %6 = load i8*, i8** %5, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %7 = bitcast i8* %6 to i8*
  %8 = getelementptr inbounds i8, i8* %7, i64 %1
  store i8 33, i8* %8, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = add i64 %1, 1
  store i64 %9, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = trunc i64 %9 to i32
  %11 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %12 = load i64, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 1
  %14 = load i64, i64* %13, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %15 = icmp eq i64 %12, %14
  br i1 %15, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %b, i64 1)
  br label %push.store.1

push.store.1:
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %18 = bitcast i8* %17 to i8*
  %19 = getelementptr inbounds i8, i8* %18, i64 %12
  store i8 10, i8* %19, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %20 = add i64 %12, 1
  store i64 %20, i64* %11, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %21 = trunc i64 %20 to i32
  ret i32 1
}

define internal noundef i64 @zero() #1 {
entry:
  ret i64 0
}

define internal noundef i64 @shrink(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %b) #2 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = icmp eq i64 %1, 0
  br i1 %2, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %3 = sub i64 %1, 1
  store i64 %3, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %5 to i8*
  %7 = getelementptr inbounds i8, i8* %6, i64 %3
  %8 = load i8, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  ret i64 0
}

define internal void @Popper.constructor(%struct.Popper* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) nocapture %b) #2 {
entry:
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %2 = icmp eq i64 %1, 0
  br i1 %2, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %3 = sub i64 %1, 1
  store i64 %3, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %b, i64 0, i32 2
  %5 = load i8*, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %6 = bitcast i8* %5 to i8*
  %7 = getelementptr inbounds i8, i8* %6, i64 %3
  %8 = load i8, i8* %7, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %9 = getelementptr inbounds %struct.Popper, %struct.Popper* %this, i32 0, i32 0
  store i64 0, i64* %9, align 8, !tbaa !17
  ret void
}

define noundef i64 @noResize() #2 {
entry:
  %buf.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i8], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [2 x i8]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i8*
  %5 = getelementptr inbounds i8, i8* %4, i64 0
  store i8 1, i8* %5, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i8, i8* %4, i64 1
  store i8 2, i8* %6, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %buf.addr, align 8
  %7 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = trunc i64 %10 to i32
  %12 = sext i32 %11 to i64
  %13 = call i64 @zero()
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %15 = load i8*, i8** %14, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %16 = call i64 @pwrite(i32 -1, i8* %15, i64 %12, i64 %13)
  ret i64 %16
}

define noundef i64 @resizing() #2 {
entry:
  %buf.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i8], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [2 x i8]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i8*
  %5 = getelementptr inbounds i8, i8* %4, i64 0
  store i8 1, i8* %5, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i8, i8* %4, i64 1
  store i8 2, i8* %6, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %buf.addr, align 8
  %7 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = trunc i64 %10 to i32
  %12 = sext i32 %11 to i64
  %13 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %14 = call i64 @shrink(%struct.nish_array* %13)
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %16 = load i64, i64* %15, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %17 = icmp ule i64 %12, %16
  br i1 %17, label %ffi.ok, label %ffi.length

ffi.length:
  call void @nish_panic(i8* bitcast ({ i64, [71 x i8] }* @.str.0 to i8*))
  unreachable

ffi.ok:
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %20 = call i64 @pwrite(i32 -1, i8* %19, i64 %12, i64 %14)
  ret i64 %20
}

define noundef i64 @inlinePop() #2 {
entry:
  %buf.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i8], align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [2 x i8]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i8*
  %5 = getelementptr inbounds i8, i8* %4, i64 0
  store i8 1, i8* %5, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i8, i8* %4, i64 1
  store i8 2, i8* %6, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %buf.addr, align 8
  %7 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = trunc i64 %10 to i32
  %12 = sext i32 %11 to i64
  %13 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %14 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 0
  %15 = load i64, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %16 = icmp eq i64 %15, 0
  br i1 %16, label %pop.empty, label %pop.ok

pop.empty:
  call void @nish_panic_index(i64 0, i64 0)
  unreachable

pop.ok:
  %17 = sub i64 %15, 1
  store i64 %17, i64* %14, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %13, i64 0, i32 2
  %19 = load i8*, i8** %18, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %20 = bitcast i8* %19 to i8*
  %21 = getelementptr inbounds i8, i8* %20, i64 %17
  %22 = load i8, i8* %21, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %23 = zext i8 %22 to i64
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = icmp ule i64 %12, %25
  br i1 %26, label %ffi.ok, label %ffi.length

ffi.length:
  call void @nish_panic(i8* bitcast ({ i64, [71 x i8] }* @.str.0 to i8*))
  unreachable

ffi.ok:
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %28 = load i8*, i8** %27, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %29 = call i64 @pwrite(i32 -1, i8* %28, i64 %12, i64 %23)
  ret i64 %29
}

define noundef i64 @viaNew() #2 {
entry:
  %buf.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i8], align 8
  %Popper.obj = alloca %struct.Popper, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [2 x i8]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i8*
  %5 = getelementptr inbounds i8, i8* %4, i64 0
  store i8 1, i8* %5, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i8, i8* %4, i64 1
  store i8 2, i8* %6, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %buf.addr, align 8
  %7 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %8 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0
  %10 = load i64, i64* %9, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %11 = trunc i64 %10 to i32
  %12 = sext i32 %11 to i64
  %13 = load %struct.nish_array*, %struct.nish_array** %buf.addr, align 8
  call void @Popper.constructor(%struct.Popper* %Popper.obj, %struct.nish_array* %13)
  %14 = getelementptr inbounds %struct.Popper, %struct.Popper* %Popper.obj, i32 0, i32 0
  %15 = load i64, i64* %14, align 8, !tbaa !17
  %16 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 0
  %17 = load i64, i64* %16, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = icmp ule i64 %12, %17
  br i1 %18, label %ffi.ok, label %ffi.length

ffi.length:
  call void @nish_panic(i8* bitcast ({ i64, [71 x i8] }* @.str.0 to i8*))
  unreachable

ffi.ok:
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %7, i64 0, i32 2
  %20 = load i8*, i8** %19, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %21 = call i64 @pwrite(i32 -1, i8* %20, i64 %12, i64 %15)
  ret i64 %21
}

define noundef i32 @nish_main() #2 {
entry:
  %b.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [2 x i8], align 8
  %r.addr = alloca i64, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [2 x i8], align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [2 x i8], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = bitcast [2 x i8]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %4 = bitcast i8* %2 to i8*
  %5 = getelementptr inbounds i8, i8* %4, i64 0
  store i8 104, i8* %5, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %6 = getelementptr inbounds i8, i8* %4, i64 1
  store i8 105, i8* %6, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %b.addr, align 8
  %7 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %8 = call i32 @grow(%struct.nish_array* %7)
  %9 = load %struct.nish_array*, %struct.nish_array** %b.addr, align 8
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %12 = icmp ule i64 4, %11
  br i1 %12, label %ffi.ok, label %ffi.length

ffi.length:
  call void @nish_panic(i8* bitcast ({ i64, [70 x i8] }* @.str.1 to i8*))
  unreachable

ffi.ok:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %9, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %15 = call i64 @write(i32 %8, i8* %14, i64 4)
  %16 = call i64 @noResize()
  store i64 %16, i64* %r.addr, align 8
  %17 = load i64, i64* %r.addr, align 8
  %18 = icmp slt i64 %17, 0
  br i1 %18, label %cond.true, label %cond.false

cond.true:
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 2, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %20 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 2, i64* %20, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %21 = bitcast [2 x i8]* %arr.data.1 to i8*
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %21, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %23 = bitcast i8* %21 to i8*
  %24 = getelementptr inbounds i8, i8* %23, i64 0
  store i8 45, i8* %24, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %25 = getelementptr inbounds i8, i8* %23, i64 1
  store i8 10, i8* %25, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  br label %cond.end

cond.false:
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 2, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 2, i64* %27, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %28 = bitcast [2 x i8]* %arr.data.2 to i8*
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %28, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %30 = bitcast i8* %28 to i8*
  %31 = getelementptr inbounds i8, i8* %30, i64 0
  store i8 43, i8* %31, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %32 = getelementptr inbounds i8, i8* %30, i64 1
  store i8 10, i8* %32, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  br label %cond.end

cond.end:
  %33 = phi %struct.nish_array* [ %arr.hdr.1, %cond.true ], [ %arr.hdr.2, %cond.false ]
  %34 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 0
  %35 = load i64, i64* %34, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %36 = icmp ule i64 2, %35
  br i1 %36, label %ffi.ok.1, label %ffi.length.1

ffi.length.1:
  call void @nish_panic(i8* bitcast ({ i64, [70 x i8] }* @.str.1 to i8*))
  unreachable

ffi.ok.1:
  %37 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %33, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %39 = call i64 @write(i32 1, i8* %38, i64 2)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind }
attributes #3 = { nounwind noreturn cold }

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
!15 = !{!"i64", !6, i64 0}
!16 = !{!"Popper", !15, i64 0}
!17 = !{!16, !15, i64 0}

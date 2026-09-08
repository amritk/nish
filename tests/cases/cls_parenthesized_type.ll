%struct.Node = type { i32 }
%struct.amrit_array = type { i64, i64, i8* }
%struct.amrit_arena = type { i8*, i64, i64, i8* }

@amrit_arena = external global %struct.amrit_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @amrit_arena_grow(i64 noundef) #1
declare void @amrit_panic_index(i64 noundef, i64 noundef) #2

define internal noalias noundef nonnull align 8 i8* @amrit_alloc_struct(i64 noundef %size) #3 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.amrit_arena, %struct.amrit_arena* @amrit_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.amrit_arena, %struct.amrit_arena* @amrit_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.amrit_arena, %struct.amrit_arena* @amrit_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @amrit_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define noundef i32 @test() #0 {
entry:
  %slots.addr = alloca %struct.amrit_array*, align 8
  %arr.hdr = alloca %struct.amrit_array, align 8
  %arr.data = alloca [2 x %struct.Node*], align 8
  %first.addr = alloca %struct.Node*, align 8
  %found.addr = alloca %struct.Node*, align 8
  %0 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %0, align 8
  %1 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %1, align 8
  %2 = mul i64 2, 8
  %3 = bitcast [2 x %struct.Node*]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %3, i8 0, i64 %2, i1 false)
  %4 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 2
  store i8* %3, i8** %4, align 8
  store %struct.amrit_array* %arr.hdr, %struct.amrit_array** %slots.addr, align 8
  %5 = call i8* @amrit_alloc_struct(i64 4)
  %6 = bitcast i8* %5 to %struct.Node*
  %7 = getelementptr inbounds %struct.Node, %struct.Node* %6, i32 0, i32 0
  store i32 0, i32* %7, align 4
  store %struct.Node* %6, %struct.Node** %first.addr, align 8
  %8 = load %struct.Node*, %struct.Node** %first.addr, align 8
  %9 = getelementptr inbounds %struct.Node, %struct.Node* %8, i32 0, i32 0
  store i32 7, i32* %9, align 4
  %10 = load %struct.amrit_array*, %struct.amrit_array** %slots.addr, align 8
  %11 = load %struct.Node*, %struct.Node** %first.addr, align 8
  %12 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %10, i64 0, i32 0
  %13 = load i64, i64* %12, align 8
  %14 = icmp ult i64 0, %13
  br i1 %14, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @amrit_panic_index(i64 0, i64 %13)
  unreachable

bounds.ok:
  %15 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %10, i64 0, i32 2
  %16 = load i8*, i8** %15, align 8
  %17 = bitcast i8* %16 to %struct.Node**
  %18 = getelementptr inbounds %struct.Node*, %struct.Node** %17, i64 0
  store %struct.Node* %11, %struct.Node** %18, align 8
  %19 = load %struct.amrit_array*, %struct.amrit_array** %slots.addr, align 8
  %20 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %19, i64 0, i32 0
  %21 = load i64, i64* %20, align 8
  %22 = icmp ult i64 0, %21
  br i1 %22, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @amrit_panic_index(i64 0, i64 %21)
  unreachable

bounds.ok.1:
  %23 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %19, i64 0, i32 2
  %24 = load i8*, i8** %23, align 8
  %25 = bitcast i8* %24 to %struct.Node**
  %26 = getelementptr inbounds %struct.Node*, %struct.Node** %25, i64 0
  %27 = load %struct.Node*, %struct.Node** %26, align 8
  store %struct.Node* %27, %struct.Node** %found.addr, align 8
  %28 = load %struct.Node*, %struct.Node** %found.addr, align 8
  %29 = icmp eq %struct.Node* %28, null
  br i1 %29, label %cond.true, label %cond.false

cond.true:
  %30 = sub i32 0, 1
  br label %cond.end

cond.false:
  %31 = load %struct.Node*, %struct.Node** %found.addr, align 8
  %32 = getelementptr inbounds %struct.Node, %struct.Node* %31, i32 0, i32 0
  %33 = load i32, i32* %32, align 4
  br label %cond.end

cond.end:
  %34 = phi i32 [ %30, %cond.true ], [ %33, %cond.false ]
  ret i32 %34
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind noreturn cold }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) }

%struct.Blob = type { i32, i32 }
%struct.sts_array = type { i64, i64, i8* }
%struct.sts_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@sts_arena = external global %struct.sts_arena, align 8

declare noalias noundef nonnull align 8 i8* @sts_arena_grow(i64 noundef) #2
declare void @sts_reset_arena() #0
declare void @sts_free_arena() #0
declare noundef i64 @sts_arena_mark() #0
declare void @sts_arena_release(i64 noundef) #0
declare noundef i64 @sts_arena_used() #0
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #0
declare noalias noundef nonnull align 8 i8* @sts_str_from_i64(i64 noundef) #0
declare void @sts_array_grow(%struct.sts_array* noundef nonnull align 8 nocapture, i64 noundef) #0
declare void @sts_panic_index(i64 noundef, i64 noundef) #3

define internal noalias noundef nonnull align 8 i8* @sts_alloc_struct(i64 noundef %size) #4 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.sts_arena, %struct.sts_arena* @sts_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @sts_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define void @Blob.constructor(%struct.Blob* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %a) #0 {
entry:
  %0 = getelementptr inbounds %struct.Blob, %struct.Blob* %this, i32 0, i32 0
  store i32 %a, i32* %0, align 4
  %1 = mul i32 %a, 2
  %2 = getelementptr inbounds %struct.Blob, %struct.Blob* %this, i32 0, i32 1
  store i32 %1, i32* %2, align 4
  ret void
}

define noundef nonnull align 8 dereferenceable(24) %struct.sts_array* @fill(i32 noundef %n) #0 {
entry:
  %xs.addr = alloca %struct.sts_array*, align 8
  %i.addr = alloca i32, align 4
  %0 = call i8* @sts_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.sts_array*
  %2 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8
  %3 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8
  %4 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8
  store %struct.sts_array* %1, %struct.sts_array** %xs.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp slt i32 %5, %n
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  %8 = call i8* @sts_alloc_struct(i64 8)
  %9 = bitcast i8* %8 to %struct.Blob*
  %10 = load i32, i32* %i.addr, align 4
  call void @Blob.constructor(%struct.Blob* %9, i32 %10)
  %11 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %7, i64 0, i32 0
  %12 = load i64, i64* %11, align 8
  %13 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %7, i64 0, i32 1
  %14 = load i64, i64* %13, align 8
  %15 = icmp eq i64 %12, %14
  br i1 %15, label %push.grow, label %push.store

push.grow:
  call void @sts_array_grow(%struct.sts_array* %7, i64 8)
  br label %push.store

push.store:
  %16 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %7, i64 0, i32 2
  %17 = load i8*, i8** %16, align 8
  %18 = bitcast i8* %17 to %struct.Blob**
  %19 = getelementptr inbounds %struct.Blob*, %struct.Blob** %18, i64 %12
  store %struct.Blob* %9, %struct.Blob** %19, align 8
  %20 = add i64 %12, 1
  store i64 %20, i64* %11, align 8
  %21 = trunc i64 %20 to i32
  br label %for.inc

for.inc:
  %22 = load i32, i32* %i.addr, align 4
  %23 = add i32 %22, 1
  store i32 %23, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %24 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  ret %struct.sts_array* %24
}

define noundef i32 @sts_main() #1 {
entry:
  %base.addr = alloca i64, align 8
  %m.addr = alloca i64, align 8
  %xs.addr = alloca %struct.sts_array*, align 8
  %ys.addr = alloca %struct.sts_array*, align 8
  %0 = call i64 @sts_arena_used()
  store i64 %0, i64* %base.addr, align 8
  %1 = call i64 @sts_arena_mark()
  store i64 %1, i64* %m.addr, align 8
  %2 = call %struct.sts_array* @fill(i32 1000)
  store %struct.sts_array* %2, %struct.sts_array** %xs.addr, align 8
  %3 = load %struct.sts_array*, %struct.sts_array** %xs.addr, align 8
  %4 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %3, i64 0, i32 0
  %5 = load i64, i64* %4, align 8
  %6 = icmp ult i64 999, %5
  br i1 %6, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @sts_panic_index(i64 999, i64 %5)
  unreachable

bounds.ok:
  %7 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %3, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8
  %9 = bitcast i8* %8 to %struct.Blob**
  %10 = getelementptr inbounds %struct.Blob*, %struct.Blob** %9, i64 999
  %11 = load %struct.Blob*, %struct.Blob** %10, align 8
  %12 = getelementptr inbounds %struct.Blob, %struct.Blob* %11, i32 0, i32 1
  %13 = load i32, i32* %12, align 4
  %14 = call i8* @sts_str_from_i32(i32 %13)
  call void @sts_print(i8* %14)
  %15 = call i64 @sts_arena_used()
  %16 = load i64, i64* %base.addr, align 8
  %17 = icmp sgt i64 %15, %16
  %18 = select i1 %17, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @sts_print(i8* %18)
  %19 = load i64, i64* %m.addr, align 8
  call void @sts_arena_release(i64 %19)
  %20 = call i64 @sts_arena_used()
  %21 = load i64, i64* %base.addr, align 8
  %22 = icmp eq i64 %20, %21
  %23 = select i1 %22, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @sts_print(i8* %23)
  %24 = call %struct.sts_array* @fill(i32 10)
  store %struct.sts_array* %24, %struct.sts_array** %ys.addr, align 8
  %25 = load %struct.sts_array*, %struct.sts_array** %ys.addr, align 8
  %26 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %25, i64 0, i32 0
  %27 = load i64, i64* %26, align 8
  %28 = trunc i64 %27 to i32
  %29 = call i8* @sts_str_from_i32(i32 %28)
  call void @sts_print(i8* %29)
  call void @sts_reset_arena()
  %30 = call i64 @sts_arena_used()
  %31 = call i8* @sts_str_from_i64(i64 %30)
  call void @sts_print(i8* %31)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @sts_main()
  call void @sts_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

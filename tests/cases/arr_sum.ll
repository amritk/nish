%struct.amrit_array = type { i64, i64, i8* }
%struct.amrit_arena = type { i8*, i64, i64, i8* }

@amrit_arena = external global %struct.amrit_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @amrit_arena_grow(i64 noundef) #1
declare void @amrit_free_arena() #2
declare noundef i64 @amrit_arena_mark() #2
declare void @amrit_arena_release(i64 noundef) #2
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @amrit_str_from_i32(i32 noundef) #2
declare void @amrit_panic_index(i64 noundef, i64 noundef) #3

define internal noalias noundef nonnull align 8 i8* @amrit_alloc_struct(i64 noundef %size) #4 {
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

define void @fill(%struct.amrit_array* noundef nonnull align 8 dereferenceable(24) nocapture %xs, i32 noundef %n) #0 {
entry:
  %i.addr = alloca i32, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %for.body, label %for.end

for.body:
  %2 = load i32, i32* %i.addr, align 4
  %3 = sext i32 %2 to i64
  %4 = load i32, i32* %i.addr, align 4
  %5 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %xs, i64 0, i32 0
  %6 = load i64, i64* %5, align 8
  %7 = icmp ult i64 %3, %6
  br i1 %7, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @amrit_panic_index(i64 %3, i64 %6)
  unreachable

bounds.ok:
  %8 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %xs, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8
  %10 = bitcast i8* %9 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %3
  store i32 %4, i32* %11, align 4
  br label %for.inc

for.inc:
  %12 = load i32, i32* %i.addr, align 4
  %13 = add i32 %12, 1
  store i32 %13, i32* %i.addr, align 4
  br label %for.cond

for.end:
  ret void
}

define noundef i32 @sum(%struct.amrit_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs, i32 noundef %n) #0 {
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
  %4 = sext i32 %3 to i64
  %5 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %xs, i64 0, i32 0
  %6 = load i64, i64* %5, align 8
  %7 = icmp ult i64 %4, %6
  br i1 %7, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @amrit_panic_index(i64 %4, i64 %6)
  unreachable

bounds.ok:
  %8 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %xs, i64 0, i32 2
  %9 = load i8*, i8** %8, align 8
  %10 = bitcast i8* %9 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 %4
  %12 = load i32, i32* %11, align 4
  %13 = add i32 %2, %12
  store i32 %13, i32* %total.addr, align 4
  br label %for.inc

for.inc:
  %14 = load i32, i32* %i.addr, align 4
  %15 = add i32 %14, 1
  store i32 %15, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %16 = load i32, i32* %total.addr, align 4
  ret i32 %16
}

define noundef i32 @amrit_main() #0 {
entry:
  %n.addr = alloca i32, align 4
  %xs.addr = alloca %struct.amrit_array*, align 8
  %arena.mark = call i64 @amrit_arena_mark()
  store i32 1000, i32* %n.addr, align 4
  %0 = load i32, i32* %n.addr, align 4
  %1 = sext i32 %0 to i64
  %2 = call i8* @amrit_alloc_struct(i64 24)
  %3 = bitcast i8* %2 to %struct.amrit_array*
  %4 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %3, i64 0, i32 0
  store i64 %1, i64* %4, align 8
  %5 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %3, i64 0, i32 1
  store i64 %1, i64* %5, align 8
  %6 = mul i64 %1, 4
  %7 = call i8* @amrit_alloc_struct(i64 %6)
  call void @llvm.memset.p0i8.i64(i8* align 8 %7, i8 0, i64 %6, i1 false)
  %8 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %3, i64 0, i32 2
  store i8* %7, i8** %8, align 8
  store %struct.amrit_array* %3, %struct.amrit_array** %xs.addr, align 8
  %9 = load %struct.amrit_array*, %struct.amrit_array** %xs.addr, align 8
  %10 = load i32, i32* %n.addr, align 4
  call void @fill(%struct.amrit_array* %9, i32 %10)
  %11 = load %struct.amrit_array*, %struct.amrit_array** %xs.addr, align 8
  %12 = load i32, i32* %n.addr, align 4
  %13 = call i32 @sum(%struct.amrit_array* %11, i32 %12)
  %14 = call i8* @amrit_str_from_i32(i32 %13)
  call void @amrit_print(i8* %14)
  call void @amrit_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @amrit_main()
  call void @amrit_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

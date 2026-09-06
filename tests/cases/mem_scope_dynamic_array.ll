%struct.sts_array = type { i64, i64, i8* }
%struct.sts_arena = type { i8*, i64, i64, i8* }

@sts_arena = external global %struct.sts_arena, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare noalias noundef nonnull align 8 i8* @sts_arena_grow(i64 noundef) #1
declare void @sts_free_arena() #2
declare noundef i64 @sts_arena_mark() #2
declare void @sts_arena_release(i64 noundef) #2
declare noundef i64 @sts_arena_used() #2
declare void @sts_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @sts_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @sts_str_from_i64(i64 noundef) #2
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

define noundef i32 @histogram(i32 noundef %n, i32 noundef %seed) #0 {
entry:
  %counts.addr = alloca %struct.sts_array*, align 8
  %x.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %best.addr = alloca i32, align 4
  %i.addr.1 = alloca i32, align 4
  %arena.mark = call i64 @sts_arena_mark()
  %0 = sext i32 %n to i64
  %1 = call i8* @sts_alloc_struct(i64 24)
  %2 = bitcast i8* %1 to %struct.sts_array*
  %3 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %2, i64 0, i32 0
  store i64 %0, i64* %3, align 8
  %4 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %2, i64 0, i32 1
  store i64 %0, i64* %4, align 8
  %5 = mul i64 %0, 4
  %6 = call i8* @sts_alloc_struct(i64 %5)
  call void @llvm.memset.p0i8.i64(i8* align 8 %6, i8 0, i64 %5, i1 false)
  %7 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %2, i64 0, i32 2
  store i8* %6, i8** %7, align 8
  store %struct.sts_array* %2, %struct.sts_array** %counts.addr, align 8
  store i32 %seed, i32* %x.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %8 = load i32, i32* %i.addr, align 4
  %9 = icmp slt i32 %8, 1000
  br i1 %9, label %for.body, label %for.end

for.body:
  %10 = load i32, i32* %x.addr, align 4
  %11 = mul i32 %10, 31
  %12 = add i32 %11, 7
  %13 = srem i32 %12, 1000003
  store i32 %13, i32* %x.addr, align 4
  %14 = load %struct.sts_array*, %struct.sts_array** %counts.addr, align 8
  %15 = load i32, i32* %x.addr, align 4
  %16 = srem i32 %15, %n
  %17 = sext i32 %16 to i64
  %18 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %14, i64 0, i32 0
  %19 = load i64, i64* %18, align 8
  %20 = icmp ult i64 %17, %19
  br i1 %20, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @sts_panic_index(i64 %17, i64 %19)
  unreachable

bounds.ok:
  %21 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %14, i64 0, i32 2
  %22 = load i8*, i8** %21, align 8
  %23 = bitcast i8* %22 to i32*
  %24 = getelementptr inbounds i32, i32* %23, i64 %17
  %25 = load i32, i32* %24, align 4
  %26 = add i32 %25, 1
  store i32 %26, i32* %24, align 4
  br label %for.inc

for.inc:
  %27 = load i32, i32* %i.addr, align 4
  %28 = add i32 %27, 1
  store i32 %28, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %best.addr, align 4
  store i32 0, i32* %i.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %29 = load i32, i32* %i.addr.1, align 4
  %30 = icmp slt i32 %29, %n
  br i1 %30, label %for.body.1, label %for.end.1

for.body.1:
  %31 = load %struct.sts_array*, %struct.sts_array** %counts.addr, align 8
  %32 = load i32, i32* %i.addr.1, align 4
  %33 = sext i32 %32 to i64
  %34 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %31, i64 0, i32 0
  %35 = load i64, i64* %34, align 8
  %36 = icmp ult i64 %33, %35
  br i1 %36, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @sts_panic_index(i64 %33, i64 %35)
  unreachable

bounds.ok.1:
  %37 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %31, i64 0, i32 2
  %38 = load i8*, i8** %37, align 8
  %39 = bitcast i8* %38 to i32*
  %40 = getelementptr inbounds i32, i32* %39, i64 %33
  %41 = load i32, i32* %40, align 4
  %42 = load %struct.sts_array*, %struct.sts_array** %counts.addr, align 8
  %43 = load i32, i32* %best.addr, align 4
  %44 = sext i32 %43 to i64
  %45 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %42, i64 0, i32 0
  %46 = load i64, i64* %45, align 8
  %47 = icmp ult i64 %44, %46
  br i1 %47, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @sts_panic_index(i64 %44, i64 %46)
  unreachable

bounds.ok.2:
  %48 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %42, i64 0, i32 2
  %49 = load i8*, i8** %48, align 8
  %50 = bitcast i8* %49 to i32*
  %51 = getelementptr inbounds i32, i32* %50, i64 %44
  %52 = load i32, i32* %51, align 4
  %53 = icmp sgt i32 %41, %52
  br i1 %53, label %if.then, label %if.end

if.then:
  %54 = load i32, i32* %i.addr.1, align 4
  store i32 %54, i32* %best.addr, align 4
  br label %if.end

if.end:
  br label %for.inc.1

for.inc.1:
  %55 = load i32, i32* %i.addr.1, align 4
  %56 = add i32 %55, 1
  store i32 %56, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  %57 = load i32, i32* %best.addr, align 4
  call void @sts_arena_release(i64 %arena.mark)
  ret i32 %57
}

define noundef i32 @sts_main() #0 {
entry:
  %before.addr = alloca i64, align 8
  %acc.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %after.addr = alloca i64, align 8
  %arena.mark = call i64 @sts_arena_mark()
  %0 = call i32 @histogram(i32 16, i32 1)
  %1 = call i8* @sts_str_from_i32(i32 %0)
  call void @sts_print(i8* %1)
  %2 = call i64 @sts_arena_used()
  store i64 %2, i64* %before.addr, align 8
  store i32 0, i32* %acc.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, 100000
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load i32, i32* %acc.addr, align 4
  %6 = load i32, i32* %i.addr, align 4
  %7 = srem i32 %6, 5
  %8 = add i32 16, %7
  %9 = load i32, i32* %i.addr, align 4
  %10 = call i32 @histogram(i32 %8, i32 %9)
  %11 = add i32 %5, %10
  store i32 %11, i32* %acc.addr, align 4
  br label %for.inc

for.inc:
  %12 = load i32, i32* %i.addr, align 4
  %13 = add i32 %12, 1
  store i32 %13, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %14 = call i64 @sts_arena_used()
  store i64 %14, i64* %after.addr, align 8
  %15 = load i64, i64* %before.addr, align 8
  %16 = call i8* @sts_str_from_i64(i64 %15)
  call void @sts_print(i8* %16)
  %17 = load i32, i32* %acc.addr, align 4
  %18 = call i8* @sts_str_from_i32(i32 %17)
  call void @sts_print(i8* %18)
  %19 = load i64, i64* %after.addr, align 8
  %20 = call i8* @sts_str_from_i64(i64 %19)
  call void @sts_print(i8* %20)
  call void @sts_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @sts_main()
  call void @sts_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

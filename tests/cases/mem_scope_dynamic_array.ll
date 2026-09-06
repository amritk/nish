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
declare void @sts_panic_div(i1 noundef zeroext) #3

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
  %13 = icmp eq i32 1000003, 0
  %14 = icmp eq i32 %12, -2147483648
  %15 = icmp eq i32 1000003, -1
  %16 = and i1 %14, %15
  %17 = or i1 %13, %16
  br i1 %17, label %div.fail, label %div.ok

div.fail:
  call void @sts_panic_div(i1 zeroext %13)
  unreachable

div.ok:
  %18 = srem i32 %12, 1000003
  store i32 %18, i32* %x.addr, align 4
  %19 = load %struct.sts_array*, %struct.sts_array** %counts.addr, align 8
  %20 = load i32, i32* %x.addr, align 4
  %21 = icmp eq i32 %n, 0
  %22 = icmp eq i32 %20, -2147483648
  %23 = icmp eq i32 %n, -1
  %24 = and i1 %22, %23
  %25 = or i1 %21, %24
  br i1 %25, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @sts_panic_div(i1 zeroext %21)
  unreachable

div.ok.1:
  %26 = srem i32 %20, %n
  %27 = sext i32 %26 to i64
  %28 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %19, i64 0, i32 0
  %29 = load i64, i64* %28, align 8
  %30 = icmp ult i64 %27, %29
  br i1 %30, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @sts_panic_index(i64 %27, i64 %29)
  unreachable

bounds.ok:
  %31 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %19, i64 0, i32 2
  %32 = load i8*, i8** %31, align 8
  %33 = bitcast i8* %32 to i32*
  %34 = getelementptr inbounds i32, i32* %33, i64 %27
  %35 = load i32, i32* %34, align 4
  %36 = add i32 %35, 1
  store i32 %36, i32* %34, align 4
  br label %for.inc

for.inc:
  %37 = load i32, i32* %i.addr, align 4
  %38 = add i32 %37, 1
  store i32 %38, i32* %i.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %best.addr, align 4
  store i32 0, i32* %i.addr.1, align 4
  br label %for.cond.1

for.cond.1:
  %39 = load i32, i32* %i.addr.1, align 4
  %40 = icmp slt i32 %39, %n
  br i1 %40, label %for.body.1, label %for.end.1

for.body.1:
  %41 = load %struct.sts_array*, %struct.sts_array** %counts.addr, align 8
  %42 = load i32, i32* %i.addr.1, align 4
  %43 = sext i32 %42 to i64
  %44 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %41, i64 0, i32 0
  %45 = load i64, i64* %44, align 8
  %46 = icmp ult i64 %43, %45
  br i1 %46, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @sts_panic_index(i64 %43, i64 %45)
  unreachable

bounds.ok.1:
  %47 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %41, i64 0, i32 2
  %48 = load i8*, i8** %47, align 8
  %49 = bitcast i8* %48 to i32*
  %50 = getelementptr inbounds i32, i32* %49, i64 %43
  %51 = load i32, i32* %50, align 4
  %52 = load %struct.sts_array*, %struct.sts_array** %counts.addr, align 8
  %53 = load i32, i32* %best.addr, align 4
  %54 = sext i32 %53 to i64
  %55 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %52, i64 0, i32 0
  %56 = load i64, i64* %55, align 8
  %57 = icmp ult i64 %54, %56
  br i1 %57, label %bounds.ok.2, label %bounds.fail.2

bounds.fail.2:
  call void @sts_panic_index(i64 %54, i64 %56)
  unreachable

bounds.ok.2:
  %58 = getelementptr inbounds %struct.sts_array, %struct.sts_array* %52, i64 0, i32 2
  %59 = load i8*, i8** %58, align 8
  %60 = bitcast i8* %59 to i32*
  %61 = getelementptr inbounds i32, i32* %60, i64 %54
  %62 = load i32, i32* %61, align 4
  %63 = icmp sgt i32 %51, %62
  br i1 %63, label %if.then, label %if.end

if.then:
  %64 = load i32, i32* %i.addr.1, align 4
  store i32 %64, i32* %best.addr, align 4
  br label %if.end

if.end:
  br label %for.inc.1

for.inc.1:
  %65 = load i32, i32* %i.addr.1, align 4
  %66 = add i32 %65, 1
  store i32 %66, i32* %i.addr.1, align 4
  br label %for.cond.1

for.end.1:
  %67 = load i32, i32* %best.addr, align 4
  call void @sts_arena_release(i64 %arena.mark)
  ret i32 %67
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
  %7 = icmp eq i32 5, 0
  %8 = icmp eq i32 %6, -2147483648
  %9 = icmp eq i32 5, -1
  %10 = and i1 %8, %9
  %11 = or i1 %7, %10
  br i1 %11, label %div.fail, label %div.ok

div.fail:
  call void @sts_panic_div(i1 zeroext %7)
  unreachable

div.ok:
  %12 = srem i32 %6, 5
  %13 = add i32 16, %12
  %14 = load i32, i32* %i.addr, align 4
  %15 = call i32 @histogram(i32 %13, i32 %14)
  %16 = add i32 %5, %15
  store i32 %16, i32* %acc.addr, align 4
  br label %for.inc

for.inc:
  %17 = load i32, i32* %i.addr, align 4
  %18 = add i32 %17, 1
  store i32 %18, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %19 = call i64 @sts_arena_used()
  store i64 %19, i64* %after.addr, align 8
  %20 = load i64, i64* %before.addr, align 8
  %21 = call i8* @sts_str_from_i64(i64 %20)
  call void @sts_print(i8* %21)
  %22 = load i32, i32* %acc.addr, align 4
  %23 = call i8* @sts_str_from_i32(i32 %22)
  call void @sts_print(i8* %23)
  %24 = load i64, i64* %after.addr, align 8
  %25 = call i8* @sts_str_from_i64(i64 %24)
  call void @sts_print(i8* %25)
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

%struct.amrit_array = type { i64, i64, i8* }
%struct.amrit_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
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

define noundef i32 @amrit_main() #0 {
entry:
  %n.addr = alloca i32, align 4
  %xs.addr = alloca %struct.amrit_array*, align 8
  %i.addr = alloca i32, align 4
  %flags.addr = alloca %struct.amrit_array*, align 8
  %arr.hdr = alloca %struct.amrit_array, align 8
  %arr.data = alloca [2 x i1], align 8
  %arena.mark = call i64 @amrit_arena_mark()
  store i32 4, i32* %n.addr, align 4
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
  %10 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %9, i64 0, i32 0
  %11 = load i64, i64* %10, align 8
  %12 = trunc i64 %11 to i32
  %13 = call i8* @amrit_str_from_i32(i32 %12)
  call void @amrit_print(i8* %13)
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %14 = load i32, i32* %i.addr, align 4
  %15 = load %struct.amrit_array*, %struct.amrit_array** %xs.addr, align 8
  %16 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %15, i64 0, i32 0
  %17 = load i64, i64* %16, align 8
  %18 = trunc i64 %17 to i32
  %19 = icmp slt i32 %14, %18
  br i1 %19, label %for.body, label %for.end

for.body:
  %20 = load %struct.amrit_array*, %struct.amrit_array** %xs.addr, align 8
  %21 = load i32, i32* %i.addr, align 4
  %22 = sext i32 %21 to i64
  %23 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %20, i64 0, i32 0
  %24 = load i64, i64* %23, align 8
  %25 = icmp ult i64 %22, %24
  br i1 %25, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @amrit_panic_index(i64 %22, i64 %24)
  unreachable

bounds.ok:
  %26 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %20, i64 0, i32 2
  %27 = load i8*, i8** %26, align 8
  %28 = bitcast i8* %27 to i32*
  %29 = getelementptr inbounds i32, i32* %28, i64 %22
  %30 = load i32, i32* %29, align 4
  %31 = call i8* @amrit_str_from_i32(i32 %30)
  call void @amrit_print(i8* %31)
  br label %for.inc

for.inc:
  %32 = load i32, i32* %i.addr, align 4
  %33 = add i32 %32, 1
  store i32 %33, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %34 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 0
  store i64 2, i64* %34, align 8
  %35 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 1
  store i64 2, i64* %35, align 8
  %36 = bitcast [2 x i1]* %arr.data to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %36, i8 0, i64 2, i1 false)
  %37 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %arr.hdr, i64 0, i32 2
  store i8* %36, i8** %37, align 8
  store %struct.amrit_array* %arr.hdr, %struct.amrit_array** %flags.addr, align 8
  %38 = load %struct.amrit_array*, %struct.amrit_array** %flags.addr, align 8
  %39 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %38, i64 0, i32 0
  %40 = load i64, i64* %39, align 8
  %41 = icmp ult i64 0, %40
  br i1 %41, label %bounds.ok.1, label %bounds.fail.1

bounds.fail.1:
  call void @amrit_panic_index(i64 0, i64 %40)
  unreachable

bounds.ok.1:
  %42 = getelementptr inbounds %struct.amrit_array, %struct.amrit_array* %38, i64 0, i32 2
  %43 = load i8*, i8** %42, align 8
  %44 = bitcast i8* %43 to i1*
  %45 = getelementptr inbounds i1, i1* %44, i64 0
  %46 = load i1, i1* %45, align 1
  %47 = select i1 %46, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  call void @amrit_print(i8* %47)
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

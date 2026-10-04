%struct.nish_result.i32.str = type { i1, i32, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"odd\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #3 {
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

define internal noundef nonnull align 8 dereferenceable(16) %struct.nish_result.i32.str* @half(i32 noundef %n) #0 {
entry:
  %0 = srem i32 %n, 2
  %1 = icmp ne i32 %0, 0
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = call i8* @nish_alloc_struct(i64 16)
  %3 = bitcast i8* %2 to %struct.nish_result.i32.str*
  %4 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %3, i32 0, i32 0
  store i1 false, i1* %4, align 1
  %5 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %3, i32 0, i32 2
  store i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*), i8** %5, align 8
  ret %struct.nish_result.i32.str* %3

if.end:
  %6 = sdiv i32 %n, 2
  %7 = call i8* @nish_alloc_struct(i64 16)
  %8 = bitcast i8* %7 to %struct.nish_result.i32.str*
  %9 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %8, i32 0, i32 0
  store i1 true, i1* %9, align 1
  %10 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %8, i32 0, i32 1
  store i32 %6, i32* %10, align 4
  ret %struct.nish_result.i32.str* %8
}

define noundef i32 @nish_main() #0 {
entry:
  %good.addr = alloca %struct.nish_result.i32.str*, align 8
  %bad.addr = alloca %struct.nish_result.i32.str*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.nish_result.i32.str* @half(i32 8)
  store %struct.nish_result.i32.str* %0, %struct.nish_result.i32.str** %good.addr, align 8
  %1 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %good.addr, align 8
  %2 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %1, i32 0, i32 0
  %3 = load i1, i1* %2, align 1
  %4 = xor i1 %3, true
  br i1 %4, label %if.then, label %if.end

if.then:
  %5 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %good.addr, align 8
  %6 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %5, i32 0, i32 2
  %7 = load i8*, i8** %6, align 8
  call void @nish_print(i8* %7)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 1

if.end:
  %8 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %good.addr, align 8
  %9 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %8, i32 0, i32 1
  %10 = load i32, i32* %9, align 4
  %11 = call i8* @nish_str_from_i32(i32 %10)
  call void @nish_print(i8* %11)
  %12 = call %struct.nish_result.i32.str* @half(i32 7)
  store %struct.nish_result.i32.str* %12, %struct.nish_result.i32.str** %bad.addr, align 8
  %13 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %bad.addr, align 8
  %14 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %13, i32 0, i32 0
  %15 = load i1, i1* %14, align 1
  br i1 %15, label %if.then.1, label %if.end.1

if.then.1:
  %16 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %bad.addr, align 8
  %17 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %16, i32 0, i32 1
  %18 = load i32, i32* %17, align 4
  %19 = call i8* @nish_str_from_i32(i32 %18)
  call void @nish_print(i8* %19)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 1

if.end.1:
  %20 = load %struct.nish_result.i32.str*, %struct.nish_result.i32.str** %bad.addr, align 8
  %21 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %20, i32 0, i32 2
  %22 = load i8*, i8** %21, align 8
  call void @nish_print(i8* %22)
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
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) }

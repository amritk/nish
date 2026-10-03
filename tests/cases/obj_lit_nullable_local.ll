%struct.E = type { i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"null\00" }, align 8
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
  %in.cap = icmp ule i64 %new.off, %cap
  %bounded = icmp ule i64 %size, 4611686018427387904
  %fits = and i1 %in.cap, %bounded
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %request = select i1 %bounded, i64 %size.aligned, i64 %size
  %grown = call i8* @nish_arena_grow(i64 %request)
  ret i8* %grown
}

define internal noundef align 4 %struct.E* @make(i32 noundef %at) #0 {
entry:
  %e.addr = alloca %struct.E*, align 8
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.E*
  %2 = getelementptr inbounds %struct.E, %struct.E* %1, i32 0, i32 0
  store i32 %at, i32* %2, align 4
  store %struct.E* %1, %struct.E** %e.addr, align 8
  %3 = load %struct.E*, %struct.E** %e.addr, align 8
  ret %struct.E* %3
}

define void @nish_main() #0 {
entry:
  %e.addr = alloca %struct.E*, align 8
  %m.addr = alloca %struct.E*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.E*
  %2 = getelementptr inbounds %struct.E, %struct.E* %1, i32 0, i32 0
  store i32 1, i32* %2, align 4
  store %struct.E* %1, %struct.E** %e.addr, align 8
  %3 = load %struct.E*, %struct.E** %e.addr, align 8
  %4 = icmp ne %struct.E* %3, null
  br i1 %4, label %if.then, label %if.end

if.then:
  %5 = load %struct.E*, %struct.E** %e.addr, align 8
  %6 = getelementptr inbounds %struct.E, %struct.E* %5, i32 0, i32 0
  %7 = load i32, i32* %6, align 4
  %8 = call i8* @nish_str_from_i32(i32 %7)
  call void @nish_print(i8* %8)
  br label %if.end

if.end:
  store %struct.E* null, %struct.E** %e.addr, align 8
  %9 = load %struct.E*, %struct.E** %e.addr, align 8
  %10 = icmp eq %struct.E* %9, null
  br i1 %10, label %if.then.1, label %if.end.1

if.then.1:
  call void @nish_print(i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*))
  br label %if.end.1

if.end.1:
  %11 = call %struct.E* @make(i32 4)
  store %struct.E* %11, %struct.E** %m.addr, align 8
  %12 = load %struct.E*, %struct.E** %m.addr, align 8
  %13 = icmp ne %struct.E* %12, null
  br i1 %13, label %if.then.2, label %if.end.2

if.then.2:
  %14 = load %struct.E*, %struct.E** %m.addr, align 8
  %15 = getelementptr inbounds %struct.E, %struct.E* %14, i32 0, i32 0
  %16 = load i32, i32* %15, align 4
  %17 = call i8* @nish_str_from_i32(i32 %16)
  call void @nish_print(i8* %17)
  br label %if.end.2

if.end.2:
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) }

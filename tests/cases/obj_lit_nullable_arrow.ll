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

define internal noundef align 4 %struct.E* @make(i32 noundef %at) #0 {
entry:
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.E*
  %2 = getelementptr inbounds %struct.E, %struct.E* %1, i32 0, i32 0
  store i32 %at, i32* %2, align 4
  ret %struct.E* %1
}

define internal noundef align 4 %struct.E* @pick(i1 noundef zeroext %some) #0 {
entry:
  br i1 %some, label %cond.true, label %cond.false

cond.true:
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.E*
  %2 = getelementptr inbounds %struct.E, %struct.E* %1, i32 0, i32 0
  store i32 7, i32* %2, align 4
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %3 = phi %struct.E* [ %1, %cond.true ], [ null, %cond.false ]
  ret %struct.E* %3
}

define void @nish_main() #0 {
entry:
  %e.addr = alloca %struct.E*, align 8
  %p.addr = alloca %struct.E*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.E* @make(i32 3)
  store %struct.E* %0, %struct.E** %e.addr, align 8
  %1 = load %struct.E*, %struct.E** %e.addr, align 8
  %2 = icmp ne %struct.E* %1, null
  br i1 %2, label %if.then, label %if.end

if.then:
  %3 = load %struct.E*, %struct.E** %e.addr, align 8
  %4 = getelementptr inbounds %struct.E, %struct.E* %3, i32 0, i32 0
  %5 = load i32, i32* %4, align 4
  %6 = call i8* @nish_str_from_i32(i32 %5)
  call void @nish_print(i8* %6)
  br label %if.end

if.end:
  %7 = call %struct.E* @pick(i1 true)
  store %struct.E* %7, %struct.E** %p.addr, align 8
  %8 = load %struct.E*, %struct.E** %p.addr, align 8
  %9 = icmp ne %struct.E* %8, null
  br i1 %9, label %if.then.1, label %if.end.1

if.then.1:
  %10 = load %struct.E*, %struct.E** %p.addr, align 8
  %11 = getelementptr inbounds %struct.E, %struct.E* %10, i32 0, i32 0
  %12 = load i32, i32* %11, align 4
  %13 = call i8* @nish_str_from_i32(i32 %12)
  call void @nish_print(i8* %13)
  br label %if.end.1

if.end.1:
  %14 = call %struct.E* @pick(i1 false)
  %15 = icmp eq %struct.E* %14, null
  br i1 %15, label %if.then.2, label %if.end.2

if.then.2:
  call void @nish_print(i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*))
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

%struct.nish_result.i32.str = type { i1, i32, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"odd\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
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

define internal noundef nonnull align 8 dereferenceable(16) %struct.nish_result.i32.str* @halve(i32 noundef %n) #0 {
entry:
  %0 = srem i32 %n, 2
  %1 = icmp eq i32 %0, 0
  br i1 %1, label %cond.true, label %cond.false

cond.true:
  %2 = sdiv i32 %n, 2
  %3 = call i8* @nish_alloc_struct(i64 16)
  %4 = bitcast i8* %3 to %struct.nish_result.i32.str*
  %5 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %4, i32 0, i32 0
  store i1 true, i1* %5, align 1
  %6 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %4, i32 0, i32 1
  store i32 %2, i32* %6, align 4
  br label %cond.end

cond.false:
  %7 = call i8* @nish_alloc_struct(i64 16)
  %8 = bitcast i8* %7 to %struct.nish_result.i32.str*
  %9 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %8, i32 0, i32 0
  store i1 false, i1* %9, align 1
  %10 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %8, i32 0, i32 2
  store i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*), i8** %10, align 8
  br label %cond.end

cond.end:
  %11 = phi %struct.nish_result.i32.str* [ %4, %cond.true ], [ %8, %cond.false ]
  ret %struct.nish_result.i32.str* %11
}

define noundef i32 @test() #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.nish_result.i32.str* @halve(i32 8)
  %1 = sub nsw i32 0, 1
  %2 = call i32 @orElse$i32(%struct.nish_result.i32.str* %0, i32 %1)
  %3 = call i8* @nish_str_from_i32(i32 %2)
  call void @nish_print(i8* %3)
  %4 = call %struct.nish_result.i32.str* @halve(i32 7)
  %5 = sub nsw i32 0, 1
  %6 = call i32 @orElse$i32(%struct.nish_result.i32.str* %4, i32 %5)
  %7 = call i8* @nish_str_from_i32(i32 %6)
  call void @nish_print(i8* %7)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define internal noundef i32 @orElse$i32(%struct.nish_result.i32.str* noundef nonnull align 8 dereferenceable(16) readonly nocapture %r, i32 noundef %fallback) #1 {
entry:
  %0 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %r, i32 0, i32 0
  %1 = load i1, i1* %0, align 1
  br i1 %1, label %if.then, label %if.end

if.then:
  %2 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %r, i32 0, i32 1
  %3 = load i32, i32* %2, align 4
  ret i32 %3

if.end:
  ret i32 %fallback
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { alwaysinline nounwind willreturn allocsize(0) }

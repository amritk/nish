%struct.nish_result.i32.str = type { i1, i32, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"empty\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [19 x i8] } { i64 18, [19 x i8] c"a non-empty string\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"abc\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_exit(i32 noundef) #3

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
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

define internal noundef nonnull align 8 dereferenceable(16) %struct.nish_result.i32.str* @parse(i8* noundef nonnull noalias readonly align 8 nocapture %s) #0 {
entry:
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  %3 = icmp eq i32 %2, 0
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = call i8* @nish_alloc_struct(i64 16)
  %5 = bitcast i8* %4 to %struct.nish_result.i32.str*
  %6 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %5, i32 0, i32 0
  store i1 false, i1* %6, align 1
  %7 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %5, i32 0, i32 2
  store i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8** %7, align 8
  ret %struct.nish_result.i32.str* %5

if.end:
  %8 = bitcast i8* %s to i64*
  %9 = load i64, i64* %8, align 8
  %10 = trunc i64 %9 to i32
  %11 = call i8* @nish_alloc_struct(i64 16)
  %12 = bitcast i8* %11 to %struct.nish_result.i32.str*
  %13 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %12, i32 0, i32 0
  store i1 true, i1* %13, align 1
  %14 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %12, i32 0, i32 1
  store i32 %10, i32* %14, align 4
  ret %struct.nish_result.i32.str* %12
}

define internal noundef i32 @strict(i8* noundef nonnull noalias readonly align 8 %s) #1 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.nish_result.i32.str* @parse(i8* %s)
  %1 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %0, i32 0, i32 0
  %2 = load i1, i1* %1, align 1
  br i1 %2, label %res.ok, label %res.panic

res.panic:
  call void @nish_write(i8* bitcast ({ i64, [19 x i8] }* @.str.1 to i8*), i32 2, i1 true)
  call void @nish_exit(i32 1)
  unreachable

res.ok:
  %3 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %0, i32 0, i32 1
  %4 = load i32, i32* %3, align 4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %4
}

define internal noundef i32 @lenient(i8* noundef nonnull noalias readonly align 8 %s) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.nish_result.i32.str* @parse(i8* %s)
  %1 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %0, i32 0, i32 0
  %2 = load i1, i1* %1, align 1
  br i1 %2, label %res.ok, label %res.alt

res.ok:
  %3 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %0, i32 0, i32 1
  %4 = load i32, i32* %3, align 4
  br label %res.end

res.alt:
  br label %res.end

res.end:
  %5 = phi i32 [ %4, %res.ok ], [ 0, %res.alt ]
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %5
}

define noundef i32 @nish_main() #1 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i32 @strict(i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*))
  %1 = call i8* @nish_str_from_i32(i32 %0)
  call void @nish_print(i8* %1)
  %2 = call i32 @lenient(i8* bitcast ({ i64, [1 x i8] }* @.str.3 to i8*))
  %3 = call i8* @nish_str_from_i32(i32 %2)
  call void @nish_print(i8* %3)
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
attributes #3 = { noreturn nounwind }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

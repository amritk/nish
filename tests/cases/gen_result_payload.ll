%struct.nish_result.i32.str = type { i1, i32, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"odd\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare noundef i64 @nish_arena_mark() #3
declare void @nish_arena_release(i64 noundef) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #3
declare void @nish_panic_div(i1 noundef zeroext) #4

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #5 {
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
  %0 = icmp eq i32 2, 0
  %1 = icmp eq i32 %n, -2147483648
  %2 = icmp eq i32 2, -1
  %3 = and i1 %1, %2
  %4 = or i1 %0, %3
  br i1 %4, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %0)
  unreachable

div.ok:
  %5 = srem i32 %n, 2
  %6 = icmp eq i32 %5, 0
  br i1 %6, label %cond.true, label %cond.false

cond.true:
  %7 = icmp eq i32 2, 0
  %8 = icmp eq i32 %n, -2147483648
  %9 = icmp eq i32 2, -1
  %10 = and i1 %8, %9
  %11 = or i1 %7, %10
  br i1 %11, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @nish_panic_div(i1 zeroext %7)
  unreachable

div.ok.1:
  %12 = sdiv i32 %n, 2
  %13 = call i8* @nish_alloc_struct(i64 16)
  %14 = bitcast i8* %13 to %struct.nish_result.i32.str*
  %15 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %14, i32 0, i32 0
  store i1 true, i1* %15, align 1
  %16 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %14, i32 0, i32 1
  store i32 %12, i32* %16, align 4
  br label %cond.end

cond.false:
  %17 = call i8* @nish_alloc_struct(i64 16)
  %18 = bitcast i8* %17 to %struct.nish_result.i32.str*
  %19 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %18, i32 0, i32 0
  store i1 false, i1* %19, align 1
  %20 = getelementptr inbounds %struct.nish_result.i32.str, %struct.nish_result.i32.str* %18, i32 0, i32 2
  store i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*), i8** %20, align 8
  br label %cond.end

cond.end:
  %21 = phi %struct.nish_result.i32.str* [ %14, %div.ok.1 ], [ %18, %cond.false ]
  ret %struct.nish_result.i32.str* %21
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

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind willreturn }
attributes #4 = { nounwind noreturn cold }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

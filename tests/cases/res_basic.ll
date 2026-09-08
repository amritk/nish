%struct.amrit_result.i32.str = type { i1, i32, i8* }
%struct.amrit_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"odd\00" }, align 8
@amrit_arena = external global %struct.amrit_arena, align 8

declare noalias noundef nonnull align 8 i8* @amrit_arena_grow(i64 noundef) #1
declare void @amrit_free_arena() #2
declare noundef i64 @amrit_arena_mark() #2
declare void @amrit_arena_release(i64 noundef) #2
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @amrit_str_from_i32(i32 noundef) #2
declare void @amrit_panic_div(i1 noundef zeroext) #3

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

define internal noundef nonnull align 8 dereferenceable(16) %struct.amrit_result.i32.str* @half(i32 noundef %n) #0 {
entry:
  %0 = icmp eq i32 2, 0
  %1 = icmp eq i32 %n, -2147483648
  %2 = icmp eq i32 2, -1
  %3 = and i1 %1, %2
  %4 = or i1 %0, %3
  br i1 %4, label %div.fail, label %div.ok

div.fail:
  call void @amrit_panic_div(i1 zeroext %0)
  unreachable

div.ok:
  %5 = srem i32 %n, 2
  %6 = icmp ne i32 %5, 0
  br i1 %6, label %if.then, label %if.end

if.then:
  %7 = call i8* @amrit_alloc_struct(i64 16)
  %8 = bitcast i8* %7 to %struct.amrit_result.i32.str*
  %9 = getelementptr inbounds %struct.amrit_result.i32.str, %struct.amrit_result.i32.str* %8, i32 0, i32 0
  store i1 false, i1* %9, align 1
  %10 = getelementptr inbounds %struct.amrit_result.i32.str, %struct.amrit_result.i32.str* %8, i32 0, i32 2
  store i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*), i8** %10, align 8
  ret %struct.amrit_result.i32.str* %8

if.end:
  %11 = icmp eq i32 2, 0
  %12 = icmp eq i32 %n, -2147483648
  %13 = icmp eq i32 2, -1
  %14 = and i1 %12, %13
  %15 = or i1 %11, %14
  br i1 %15, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @amrit_panic_div(i1 zeroext %11)
  unreachable

div.ok.1:
  %16 = sdiv i32 %n, 2
  %17 = call i8* @amrit_alloc_struct(i64 16)
  %18 = bitcast i8* %17 to %struct.amrit_result.i32.str*
  %19 = getelementptr inbounds %struct.amrit_result.i32.str, %struct.amrit_result.i32.str* %18, i32 0, i32 0
  store i1 true, i1* %19, align 1
  %20 = getelementptr inbounds %struct.amrit_result.i32.str, %struct.amrit_result.i32.str* %18, i32 0, i32 1
  store i32 %16, i32* %20, align 4
  ret %struct.amrit_result.i32.str* %18
}

define noundef i32 @amrit_main() #0 {
entry:
  %good.addr = alloca %struct.amrit_result.i32.str*, align 8
  %bad.addr = alloca %struct.amrit_result.i32.str*, align 8
  %arena.mark = call i64 @amrit_arena_mark()
  %0 = call %struct.amrit_result.i32.str* @half(i32 8)
  store %struct.amrit_result.i32.str* %0, %struct.amrit_result.i32.str** %good.addr, align 8
  %1 = load %struct.amrit_result.i32.str*, %struct.amrit_result.i32.str** %good.addr, align 8
  %2 = getelementptr inbounds %struct.amrit_result.i32.str, %struct.amrit_result.i32.str* %1, i32 0, i32 0
  %3 = load i1, i1* %2, align 1
  %4 = xor i1 %3, true
  br i1 %4, label %if.then, label %if.end

if.then:
  %5 = load %struct.amrit_result.i32.str*, %struct.amrit_result.i32.str** %good.addr, align 8
  %6 = getelementptr inbounds %struct.amrit_result.i32.str, %struct.amrit_result.i32.str* %5, i32 0, i32 2
  %7 = load i8*, i8** %6, align 8
  call void @amrit_print(i8* %7)
  call void @amrit_arena_release(i64 %arena.mark)
  ret i32 1

if.end:
  %8 = load %struct.amrit_result.i32.str*, %struct.amrit_result.i32.str** %good.addr, align 8
  %9 = getelementptr inbounds %struct.amrit_result.i32.str, %struct.amrit_result.i32.str* %8, i32 0, i32 1
  %10 = load i32, i32* %9, align 4
  %11 = call i8* @amrit_str_from_i32(i32 %10)
  call void @amrit_print(i8* %11)
  %12 = call %struct.amrit_result.i32.str* @half(i32 7)
  store %struct.amrit_result.i32.str* %12, %struct.amrit_result.i32.str** %bad.addr, align 8
  %13 = load %struct.amrit_result.i32.str*, %struct.amrit_result.i32.str** %bad.addr, align 8
  %14 = getelementptr inbounds %struct.amrit_result.i32.str, %struct.amrit_result.i32.str* %13, i32 0, i32 0
  %15 = load i1, i1* %14, align 1
  br i1 %15, label %if.then.1, label %if.end.1

if.then.1:
  %16 = load %struct.amrit_result.i32.str*, %struct.amrit_result.i32.str** %bad.addr, align 8
  %17 = getelementptr inbounds %struct.amrit_result.i32.str, %struct.amrit_result.i32.str* %16, i32 0, i32 1
  %18 = load i32, i32* %17, align 4
  %19 = call i8* @amrit_str_from_i32(i32 %18)
  call void @amrit_print(i8* %19)
  call void @amrit_arena_release(i64 %arena.mark)
  ret i32 1

if.end.1:
  %20 = load %struct.amrit_result.i32.str*, %struct.amrit_result.i32.str** %bad.addr, align 8
  %21 = getelementptr inbounds %struct.amrit_result.i32.str, %struct.amrit_result.i32.str* %20, i32 0, i32 2
  %22 = load i8*, i8** %21, align 8
  call void @amrit_print(i8* %22)
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

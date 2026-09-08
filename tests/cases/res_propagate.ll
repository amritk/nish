%struct.amrit_result.i32.str = type { i1, i32, i8* }
%struct.amrit_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c" is odd\00" }, align 8
@amrit_arena = external global %struct.amrit_arena, align 8

declare noalias noundef nonnull align 8 i8* @amrit_arena_grow(i64 noundef) #1
declare void @amrit_free_arena() #2
declare noalias noundef nonnull align 8 i8* @amrit_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
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
  %7 = call i8* @amrit_str_from_i32(i32 %n)
  %8 = call i8* @amrit_str_concat(i8* %7, i8* bitcast ({ i64, [8 x i8] }* @.str.0 to i8*))
  %9 = call i8* @amrit_alloc_struct(i64 16)
  %10 = bitcast i8* %9 to %struct.amrit_result.i32.str*
  %11 = getelementptr inbounds %struct.amrit_result.i32.str, %struct.amrit_result.i32.str* %10, i32 0, i32 0
  store i1 false, i1* %11, align 1
  %12 = getelementptr inbounds %struct.amrit_result.i32.str, %struct.amrit_result.i32.str* %10, i32 0, i32 2
  store i8* %8, i8** %12, align 8
  ret %struct.amrit_result.i32.str* %10

if.end:
  %13 = icmp eq i32 2, 0
  %14 = icmp eq i32 %n, -2147483648
  %15 = icmp eq i32 2, -1
  %16 = and i1 %14, %15
  %17 = or i1 %13, %16
  br i1 %17, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @amrit_panic_div(i1 zeroext %13)
  unreachable

div.ok.1:
  %18 = sdiv i32 %n, 2
  %19 = call i8* @amrit_alloc_struct(i64 16)
  %20 = bitcast i8* %19 to %struct.amrit_result.i32.str*
  %21 = getelementptr inbounds %struct.amrit_result.i32.str, %struct.amrit_result.i32.str* %20, i32 0, i32 0
  store i1 true, i1* %21, align 1
  %22 = getelementptr inbounds %struct.amrit_result.i32.str, %struct.amrit_result.i32.str* %20, i32 0, i32 1
  store i32 %18, i32* %22, align 4
  ret %struct.amrit_result.i32.str* %20
}

define internal noundef nonnull align 8 dereferenceable(16) %struct.amrit_result.i32.str* @quarter(i32 noundef %n) #0 {
entry:
  %h.addr = alloca i32, align 4
  %0 = call %struct.amrit_result.i32.str* @half(i32 %n)
  %1 = getelementptr inbounds %struct.amrit_result.i32.str, %struct.amrit_result.i32.str* %0, i32 0, i32 0
  %2 = load i1, i1* %1, align 1
  br i1 %2, label %res.ok, label %res.propagate

res.propagate:
  %3 = getelementptr inbounds %struct.amrit_result.i32.str, %struct.amrit_result.i32.str* %0, i32 0, i32 2
  %4 = load i8*, i8** %3, align 8
  %5 = call i8* @amrit_alloc_struct(i64 16)
  %6 = bitcast i8* %5 to %struct.amrit_result.i32.str*
  %7 = getelementptr inbounds %struct.amrit_result.i32.str, %struct.amrit_result.i32.str* %6, i32 0, i32 0
  store i1 false, i1* %7, align 1
  %8 = getelementptr inbounds %struct.amrit_result.i32.str, %struct.amrit_result.i32.str* %6, i32 0, i32 2
  store i8* %4, i8** %8, align 8
  ret %struct.amrit_result.i32.str* %6

res.ok:
  %9 = getelementptr inbounds %struct.amrit_result.i32.str, %struct.amrit_result.i32.str* %0, i32 0, i32 1
  %10 = load i32, i32* %9, align 4
  store i32 %10, i32* %h.addr, align 4
  %11 = load i32, i32* %h.addr, align 4
  %12 = call %struct.amrit_result.i32.str* @half(i32 %11)
  ret %struct.amrit_result.i32.str* %12
}

define noundef i32 @amrit_main() #0 {
entry:
  %good.addr = alloca %struct.amrit_result.i32.str*, align 8
  %bad.addr = alloca %struct.amrit_result.i32.str*, align 8
  %0 = call %struct.amrit_result.i32.str* @quarter(i32 8)
  store %struct.amrit_result.i32.str* %0, %struct.amrit_result.i32.str** %good.addr, align 8
  %1 = load %struct.amrit_result.i32.str*, %struct.amrit_result.i32.str** %good.addr, align 8
  %2 = getelementptr inbounds %struct.amrit_result.i32.str, %struct.amrit_result.i32.str* %1, i32 0, i32 0
  %3 = load i1, i1* %2, align 1
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = load %struct.amrit_result.i32.str*, %struct.amrit_result.i32.str** %good.addr, align 8
  %5 = getelementptr inbounds %struct.amrit_result.i32.str, %struct.amrit_result.i32.str* %4, i32 0, i32 1
  %6 = load i32, i32* %5, align 4
  %7 = call i8* @amrit_str_from_i32(i32 %6)
  call void @amrit_print(i8* %7)
  br label %if.end

if.end:
  %8 = call %struct.amrit_result.i32.str* @quarter(i32 6)
  store %struct.amrit_result.i32.str* %8, %struct.amrit_result.i32.str** %bad.addr, align 8
  %9 = load %struct.amrit_result.i32.str*, %struct.amrit_result.i32.str** %bad.addr, align 8
  %10 = getelementptr inbounds %struct.amrit_result.i32.str, %struct.amrit_result.i32.str* %9, i32 0, i32 0
  %11 = load i1, i1* %10, align 1
  %12 = xor i1 %11, true
  br i1 %12, label %if.then.1, label %if.end.1

if.then.1:
  %13 = load %struct.amrit_result.i32.str*, %struct.amrit_result.i32.str** %bad.addr, align 8
  %14 = getelementptr inbounds %struct.amrit_result.i32.str, %struct.amrit_result.i32.str* %13, i32 0, i32 2
  %15 = load i8*, i8** %14, align 8
  call void @amrit_print(i8* %15)
  br label %if.end.1

if.end.1:
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

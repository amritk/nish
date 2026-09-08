%struct.IoError = type { i32, i8* }
%struct.amrit_result.i32.i32 = type { i1, i32, i32 }
%struct.amrit_result.void.i32 = type { i1, i32 }
%struct.amrit_result.i32.$IoError = type { i1, i32, %struct.IoError* }
%struct.amrit_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@amrit_arena = external global %struct.amrit_arena, align 8

declare noalias noundef nonnull align 8 i8* @amrit_arena_grow(i64 noundef) #3
declare zeroext i1 @amrit_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #4
declare void @amrit_panic_div(i1 noundef zeroext) #5

define internal noalias noundef nonnull align 8 i8* @amrit_alloc_struct(i64 noundef %size) #6 {
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

define noundef i64 @half(i32 noundef %n) #0 {
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
  %7 = zext i32 %n to i64
  %8 = shl i64 %7, 32
  ret i64 %8

if.end:
  %9 = icmp eq i32 2, 0
  %10 = icmp eq i32 %n, -2147483648
  %11 = icmp eq i32 2, -1
  %12 = and i1 %10, %11
  %13 = or i1 %9, %12
  br i1 %13, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @amrit_panic_div(i1 zeroext %9)
  unreachable

div.ok.1:
  %14 = sdiv i32 %n, 2
  %15 = zext i32 %14 to i64
  %16 = shl i64 %15, 32
  %17 = or i64 %16, 1
  ret i64 %17
}

define noundef i64 @checkPort(i32 noundef %port) #1 {
entry:
  %0 = icmp sle i32 %port, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = zext i32 %port to i64
  %2 = shl i64 %1, 32
  ret i64 %2

if.end:
  ret i64 1
}

define noundef nonnull align 8 dereferenceable(16) %struct.amrit_result.i32.$IoError* @openFile(i8* noundef nonnull noalias readonly align 8 %path) #1 {
entry:
  %problem.addr = alloca %struct.IoError*, align 8
  %0 = call zeroext i1 @amrit_str_eq(i8* %path, i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*))
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call i8* @amrit_alloc_struct(i64 16)
  %2 = bitcast i8* %1 to %struct.IoError*
  %3 = getelementptr inbounds %struct.IoError, %struct.IoError* %2, i32 0, i32 0
  store i32 2, i32* %3, align 4
  %4 = getelementptr inbounds %struct.IoError, %struct.IoError* %2, i32 0, i32 1
  store i8* %path, i8** %4, align 8
  store %struct.IoError* %2, %struct.IoError** %problem.addr, align 8
  %5 = load %struct.IoError*, %struct.IoError** %problem.addr, align 8
  %6 = call i8* @amrit_alloc_struct(i64 16)
  %7 = bitcast i8* %6 to %struct.amrit_result.i32.$IoError*
  %8 = getelementptr inbounds %struct.amrit_result.i32.$IoError, %struct.amrit_result.i32.$IoError* %7, i32 0, i32 0
  store i1 false, i1* %8, align 1
  %9 = getelementptr inbounds %struct.amrit_result.i32.$IoError, %struct.amrit_result.i32.$IoError* %7, i32 0, i32 2
  store %struct.IoError* %5, %struct.IoError** %9, align 8
  ret %struct.amrit_result.i32.$IoError* %7

if.end:
  %10 = call i8* @amrit_alloc_struct(i64 16)
  %11 = bitcast i8* %10 to %struct.amrit_result.i32.$IoError*
  %12 = getelementptr inbounds %struct.amrit_result.i32.$IoError, %struct.amrit_result.i32.$IoError* %11, i32 0, i32 0
  store i1 true, i1* %12, align 1
  %13 = getelementptr inbounds %struct.amrit_result.i32.$IoError, %struct.amrit_result.i32.$IoError* %11, i32 0, i32 1
  store i32 3, i32* %13, align 4
  ret %struct.amrit_result.i32.$IoError* %11
}

define noundef i32 @describe(i64 noundef %r) #2 {
entry:
  %amrit_result.i32.i32.obj = alloca %struct.amrit_result.i32.i32, align 8
  %0 = trunc i64 %r to i1
  %1 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 0
  store i1 %0, i1* %1, align 1
  %2 = lshr i64 %r, 32
  %3 = trunc i64 %2 to i32
  %4 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 1
  store i32 %3, i32* %4, align 4
  %5 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 2
  store i32 %3, i32* %5, align 4
  %6 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 0
  %7 = load i1, i1* %6, align 1
  %8 = xor i1 %7, true
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 2
  %10 = load i32, i32* %9, align 4
  %11 = sub i32 0, %10
  ret i32 %11

if.end:
  %12 = getelementptr inbounds %struct.amrit_result.i32.i32, %struct.amrit_result.i32.i32* %amrit_result.i32.i32.obj, i32 0, i32 1
  %13 = load i32, i32* %12, align 4
  ret i32 %13
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind willreturn readonly }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { nounwind willreturn memory(argmem: read) }
attributes #5 = { nounwind noreturn cold }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

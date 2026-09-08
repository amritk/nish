%struct.IoError = type { i32, i8* }
%struct.amrit_result.i32.$IoError = type { i1, i32, %struct.IoError* }
%struct.amrit_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"error \00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"fd \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"/etc/hosts\00" }, align 8
@amrit_arena = external global %struct.amrit_arena, align 8

declare noalias noundef nonnull align 8 i8* @amrit_arena_grow(i64 noundef) #2
declare void @amrit_free_arena() #0
declare noalias noundef nonnull align 8 i8* @amrit_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare zeroext i1 @amrit_str_eq(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @amrit_str_from_i32(i32 noundef) #0

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

define internal noundef nonnull align 8 dereferenceable(16) %struct.amrit_result.i32.$IoError* @openFile(i8* noundef nonnull noalias readonly align 8 %path) #0 {
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

define internal noundef nonnull align 8 i8* @describe(i8* noundef nonnull noalias readonly align 8 %path) #0 {
entry:
  %opened.addr = alloca %struct.amrit_result.i32.$IoError*, align 8
  %failure.addr = alloca %struct.IoError*, align 8
  %0 = call %struct.amrit_result.i32.$IoError* @openFile(i8* %path)
  store %struct.amrit_result.i32.$IoError* %0, %struct.amrit_result.i32.$IoError** %opened.addr, align 8
  %1 = load %struct.amrit_result.i32.$IoError*, %struct.amrit_result.i32.$IoError** %opened.addr, align 8
  %2 = getelementptr inbounds %struct.amrit_result.i32.$IoError, %struct.amrit_result.i32.$IoError* %1, i32 0, i32 0
  %3 = load i1, i1* %2, align 1
  %4 = xor i1 %3, true
  br i1 %4, label %if.then, label %if.end

if.then:
  %5 = load %struct.amrit_result.i32.$IoError*, %struct.amrit_result.i32.$IoError** %opened.addr, align 8
  %6 = getelementptr inbounds %struct.amrit_result.i32.$IoError, %struct.amrit_result.i32.$IoError* %5, i32 0, i32 2
  %7 = load %struct.IoError*, %struct.IoError** %6, align 8
  store %struct.IoError* %7, %struct.IoError** %failure.addr, align 8
  %8 = load %struct.IoError*, %struct.IoError** %failure.addr, align 8
  %9 = getelementptr inbounds %struct.IoError, %struct.IoError* %8, i32 0, i32 0
  %10 = load i32, i32* %9, align 4
  %11 = call i8* @amrit_str_from_i32(i32 %10)
  %12 = call i8* @amrit_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.1 to i8*), i8* %11)
  ret i8* %12

if.end:
  %13 = load %struct.amrit_result.i32.$IoError*, %struct.amrit_result.i32.$IoError** %opened.addr, align 8
  %14 = getelementptr inbounds %struct.amrit_result.i32.$IoError, %struct.amrit_result.i32.$IoError* %13, i32 0, i32 1
  %15 = load i32, i32* %14, align 4
  %16 = call i8* @amrit_str_from_i32(i32 %15)
  %17 = call i8* @amrit_str_concat(i8* bitcast ({ i64, [4 x i8] }* @.str.2 to i8*), i8* %16)
  ret i8* %17
}

define noundef i32 @amrit_main() #0 {
entry:
  %0 = call i8* @describe(i8* bitcast ({ i64, [11 x i8] }* @.str.3 to i8*))
  call void @amrit_print(i8* %0)
  %1 = call i8* @describe(i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*))
  call void @amrit_print(i8* %1)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @amrit_main()
  call void @amrit_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) }
attributes #3 = { nounwind willreturn memory(argmem: read) }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

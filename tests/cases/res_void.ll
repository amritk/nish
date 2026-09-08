%struct.amrit_result.void.str = type { i1, i8* }
%struct.amrit_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [22 x i8] } { i64 21, [22 x i8] c"port must be positive\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"443 is a port\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"done\00" }, align 8
@amrit_arena = external global %struct.amrit_arena, align 8

declare noalias noundef nonnull align 8 i8* @amrit_arena_grow(i64 noundef) #2
declare void @amrit_free_arena() #0
declare noundef i64 @amrit_arena_mark() #0
declare void @amrit_arena_release(i64 noundef) #0
declare void @amrit_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #0
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare void @amrit_exit(i32 noundef) #3

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

define noundef nonnull align 8 dereferenceable(16) %struct.amrit_result.void.str* @checkPort(i32 noundef %port) #0 {
entry:
  %0 = icmp sle i32 %port, 0
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = call i8* @amrit_alloc_struct(i64 16)
  %2 = bitcast i8* %1 to %struct.amrit_result.void.str*
  %3 = getelementptr inbounds %struct.amrit_result.void.str, %struct.amrit_result.void.str* %2, i32 0, i32 0
  store i1 false, i1* %3, align 1
  %4 = getelementptr inbounds %struct.amrit_result.void.str, %struct.amrit_result.void.str* %2, i32 0, i32 1
  store i8* bitcast ({ i64, [22 x i8] }* @.str.0 to i8*), i8** %4, align 8
  ret %struct.amrit_result.void.str* %2

if.end:
  %5 = call i8* @amrit_alloc_struct(i64 16)
  %6 = bitcast i8* %5 to %struct.amrit_result.void.str*
  %7 = getelementptr inbounds %struct.amrit_result.void.str, %struct.amrit_result.void.str* %6, i32 0, i32 0
  store i1 true, i1* %7, align 1
  ret %struct.amrit_result.void.str* %6
}

define noundef i32 @amrit_main() #1 {
entry:
  %bad.addr = alloca %struct.amrit_result.void.str*, align 8
  %arena.mark = call i64 @amrit_arena_mark()
  %0 = call %struct.amrit_result.void.str* @checkPort(i32 0)
  store %struct.amrit_result.void.str* %0, %struct.amrit_result.void.str** %bad.addr, align 8
  %1 = load %struct.amrit_result.void.str*, %struct.amrit_result.void.str** %bad.addr, align 8
  %2 = getelementptr inbounds %struct.amrit_result.void.str, %struct.amrit_result.void.str* %1, i32 0, i32 0
  %3 = load i1, i1* %2, align 1
  %4 = xor i1 %3, true
  br i1 %4, label %if.then, label %if.end

if.then:
  %5 = load %struct.amrit_result.void.str*, %struct.amrit_result.void.str** %bad.addr, align 8
  %6 = getelementptr inbounds %struct.amrit_result.void.str, %struct.amrit_result.void.str* %5, i32 0, i32 1
  %7 = load i8*, i8** %6, align 8
  call void @amrit_print(i8* %7)
  br label %if.end

if.end:
  %8 = call %struct.amrit_result.void.str* @checkPort(i32 443)
  %9 = getelementptr inbounds %struct.amrit_result.void.str, %struct.amrit_result.void.str* %8, i32 0, i32 0
  %10 = load i1, i1* %9, align 1
  br i1 %10, label %res.ok, label %res.panic

res.panic:
  call void @amrit_write(i8* bitcast ({ i64, [14 x i8] }* @.str.1 to i8*), i32 2, i1 true)
  call void @amrit_exit(i32 1)
  unreachable

res.ok:
  call void @amrit_print(i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*))
  call void @amrit_arena_release(i64 %arena.mark)
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
attributes #3 = { noreturn nounwind }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

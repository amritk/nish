%struct.amrit_result.i32.str = type { i1, i32, i8* }
%struct.amrit_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"not a port\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"nope\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"8080\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"8080 is a port\00" }, align 8
@amrit_arena = external global %struct.amrit_arena, align 8

declare noalias noundef nonnull align 8 i8* @amrit_arena_grow(i64 noundef) #2
declare void @amrit_free_arena() #0
declare noundef i64 @amrit_arena_mark() #0
declare void @amrit_arena_release(i64 noundef) #0
declare void @amrit_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #0
declare void @amrit_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @amrit_str_from_i32(i32 noundef) #0
declare void @amrit_exit(i32 noundef) #3
declare noundef double @amrit_parse_number(i8* noundef nonnull readonly align 8 nocapture, i32 noundef) #0
declare i32 @llvm.fptosi.sat.i32.f64(double) #4

define internal noalias noundef nonnull align 8 i8* @amrit_alloc_struct(i64 noundef %size) #5 {
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

define noundef nonnull align 8 dereferenceable(16) %struct.amrit_result.i32.str* @parsePort(i8* noundef nonnull noalias readonly align 8 nocapture %text) #0 {
entry:
  %n.addr = alloca i32, align 4
  %0 = call double @amrit_parse_number(i8* %text, i32 2)
  %1 = call i32 @llvm.fptosi.sat.i32.f64(double %0)
  store i32 %1, i32* %n.addr, align 4
  %2 = load i32, i32* %n.addr, align 4
  %3 = icmp sle i32 %2, 0
  br i1 %3, label %if.then, label %if.end

if.then:
  %4 = call i8* @amrit_alloc_struct(i64 16)
  %5 = bitcast i8* %4 to %struct.amrit_result.i32.str*
  %6 = getelementptr inbounds %struct.amrit_result.i32.str, %struct.amrit_result.i32.str* %5, i32 0, i32 0
  store i1 false, i1* %6, align 1
  %7 = getelementptr inbounds %struct.amrit_result.i32.str, %struct.amrit_result.i32.str* %5, i32 0, i32 2
  store i8* bitcast ({ i64, [11 x i8] }* @.str.0 to i8*), i8** %7, align 8
  ret %struct.amrit_result.i32.str* %5

if.end:
  %8 = load i32, i32* %n.addr, align 4
  %9 = call i8* @amrit_alloc_struct(i64 16)
  %10 = bitcast i8* %9 to %struct.amrit_result.i32.str*
  %11 = getelementptr inbounds %struct.amrit_result.i32.str, %struct.amrit_result.i32.str* %10, i32 0, i32 0
  store i1 true, i1* %11, align 1
  %12 = getelementptr inbounds %struct.amrit_result.i32.str, %struct.amrit_result.i32.str* %10, i32 0, i32 1
  store i32 %8, i32* %12, align 4
  ret %struct.amrit_result.i32.str* %10
}

define noundef i32 @amrit_main() #1 {
entry:
  %arena.mark = call i64 @amrit_arena_mark()
  %0 = call %struct.amrit_result.i32.str* @parsePort(i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*))
  %1 = getelementptr inbounds %struct.amrit_result.i32.str, %struct.amrit_result.i32.str* %0, i32 0, i32 0
  %2 = load i1, i1* %1, align 1
  br i1 %2, label %res.ok, label %res.alt

res.ok:
  %3 = getelementptr inbounds %struct.amrit_result.i32.str, %struct.amrit_result.i32.str* %0, i32 0, i32 1
  %4 = load i32, i32* %3, align 4
  br label %res.end

res.alt:
  %5 = sub i32 0, 1
  br label %res.end

res.end:
  %6 = phi i32 [ %4, %res.ok ], [ %5, %res.alt ]
  %7 = call i8* @amrit_str_from_i32(i32 %6)
  call void @amrit_print(i8* %7)
  %8 = call %struct.amrit_result.i32.str* @parsePort(i8* bitcast ({ i64, [5 x i8] }* @.str.2 to i8*))
  %9 = getelementptr inbounds %struct.amrit_result.i32.str, %struct.amrit_result.i32.str* %8, i32 0, i32 0
  %10 = load i1, i1* %9, align 1
  br i1 %10, label %res.ok.1, label %res.panic

res.panic:
  call void @amrit_write(i8* bitcast ({ i64, [15 x i8] }* @.str.3 to i8*), i32 2, i1 true)
  call void @amrit_exit(i32 1)
  unreachable

res.ok.1:
  %11 = getelementptr inbounds %struct.amrit_result.i32.str, %struct.amrit_result.i32.str* %8, i32 0, i32 1
  %12 = load i32, i32* %11, align 4
  %13 = call i8* @amrit_str_from_i32(i32 %12)
  call void @amrit_print(i8* %13)
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
attributes #4 = { nounwind willreturn readnone }
attributes #5 = { alwaysinline nounwind willreturn allocsize(0) }

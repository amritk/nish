%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"n=\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c" i=\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #1
declare void @nish_free_arena() #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #3

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

define noundef i32 @nish_main() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 8, i64* %2, align 8, !alias.scope !3, !noalias !4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 8, i64* %3, align 8, !alias.scope !3, !noalias !4
  %4 = call i8* @nish_alloc_struct(i64 32)
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* %4, i8** %5, align 8, !alias.scope !3, !noalias !4
  %6 = bitcast i8* %4 to i32*
  %7 = getelementptr inbounds i32, i32* %6, i64 0
  store i32 10, i32* %7, align 4, !alias.scope !4, !noalias !3
  %8 = getelementptr inbounds i32, i32* %6, i64 1
  store i32 20, i32* %8, align 4, !alias.scope !4, !noalias !3
  %9 = getelementptr inbounds i32, i32* %6, i64 2
  store i32 30, i32* %9, align 4, !alias.scope !4, !noalias !3
  %10 = getelementptr inbounds i32, i32* %6, i64 3
  store i32 40, i32* %10, align 4, !alias.scope !4, !noalias !3
  %11 = getelementptr inbounds i32, i32* %6, i64 4
  store i32 50, i32* %11, align 4, !alias.scope !4, !noalias !3
  %12 = getelementptr inbounds i32, i32* %6, i64 5
  store i32 60, i32* %12, align 4, !alias.scope !4, !noalias !3
  %13 = getelementptr inbounds i32, i32* %6, i64 6
  store i32 70, i32* %13, align 4, !alias.scope !4, !noalias !3
  %14 = getelementptr inbounds i32, i32* %6, i64 7
  store i32 80, i32* %14, align 4, !alias.scope !4, !noalias !3
  store %struct.nish_array* %1, %struct.nish_array** %xs.addr, align 8
  store i32 0, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %15 = load i32, i32* %i.addr, align 4
  %16 = icmp sge i32 %15, 0
  br i1 %16, label %land.rhs, label %land.end

land.rhs:
  %17 = load i32, i32* %i.addr, align 4
  %18 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %18, i64 0, i32 0
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4
  %21 = trunc i64 %20 to i32
  %22 = icmp slt i32 %17, %21
  br label %land.end

land.end:
  %23 = phi i1 [ false, %for.cond ], [ %22, %land.rhs ]
  br i1 %23, label %for.body, label %for.end

for.body:
  %24 = load i32, i32* %n.addr, align 4
  %25 = add nsw i32 %24, 1
  store i32 %25, i32* %n.addr, align 4
  %26 = load i32, i32* %n.addr, align 4
  switch i32 %26, label %sw.default [
    i32 1, label %sw.case
  ]

sw.case:
  %27 = call i8* @nish_alloc_struct(i64 24)
  %28 = bitcast i8* %27 to %struct.nish_array*
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 0
  store i64 1, i64* %29, align 8, !alias.scope !3, !noalias !4
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 1
  store i64 1, i64* %30, align 8, !alias.scope !3, !noalias !4
  %31 = call i8* @nish_alloc_struct(i64 4)
  %32 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %28, i64 0, i32 2
  store i8* %31, i8** %32, align 8, !alias.scope !3, !noalias !4
  %33 = bitcast i8* %31 to i32*
  %34 = getelementptr inbounds i32, i32* %33, i64 0
  store i32 1, i32* %34, align 4, !alias.scope !4, !noalias !3
  store %struct.nish_array* %28, %struct.nish_array** %xs.addr, align 8
  store i32 7, i32* %i.addr, align 4
  br label %for.inc

sw.default:
  br label %sw.end

sw.end:
  %35 = load i32, i32* %i.addr, align 4
  %36 = icmp slt i32 %35, 0
  br i1 %36, label %lor.end, label %lor.rhs

lor.rhs:
  %37 = load i32, i32* %i.addr, align 4
  %38 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 0
  %40 = load i64, i64* %39, align 8, !alias.scope !3, !noalias !4
  %41 = trunc i64 %40 to i32
  %42 = icmp sge i32 %37, %41
  br label %lor.end

lor.end:
  %43 = phi i1 [ true, %sw.end ], [ %42, %lor.rhs ]
  br i1 %43, label %if.then, label %if.end

if.then:
  br label %for.end

if.end:
  %44 = load i32, i32* %n.addr, align 4
  %45 = icmp sgt i32 %44, 3
  br i1 %45, label %if.then.1, label %if.end.1

if.then.1:
  br label %for.end

if.end.1:
  br label %for.inc

for.inc:
  %46 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %47 = load i32, i32* %i.addr, align 4
  %48 = sext i32 %47 to i64
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 0
  %50 = load i64, i64* %49, align 8, !alias.scope !3, !noalias !4
  %51 = icmp ult i64 %48, %50
  br i1 %51, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %48, i64 %50)
  unreachable

bounds.ok:
  %52 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %46, i64 0, i32 2
  %53 = load i8*, i8** %52, align 8, !alias.scope !3, !noalias !4
  %54 = bitcast i8* %53 to i32*
  %55 = getelementptr inbounds i32, i32* %54, i64 %48
  store i32 1000000, i32* %55, align 4, !alias.scope !4, !noalias !3
  br label %for.cond

for.end:
  %56 = load i32, i32* %n.addr, align 4
  %57 = call i8* @nish_str_from_i32(i32 %56)
  %58 = call i8* @nish_str_concat(i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*), i8* %57)
  %59 = call i8* @nish_str_concat(i8* %58, i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*))
  %60 = load i32, i32* %i.addr, align 4
  %61 = call i8* @nish_str_from_i32(i32 %60)
  %62 = call i8* @nish_str_concat(i8* %59, i8* %61)
  call void @nish_print(i8* %62)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn cold noinline allocsize(0) }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}

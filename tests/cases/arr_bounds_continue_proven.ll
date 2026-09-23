%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_panic_div(i1 noundef zeroext) #2

define internal noundef i32 @sumOdd(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %s.addr = alloca i32, align 4
  %last.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %n.addr = alloca i32, align 4
  store i32 0, i32* %s.addr, align 4
  store i32 0, i32* %last.addr, align 4
  %0 = sub nsw i32 0, 1
  store i32 %0, i32* %i.addr, align 4
  store i32 0, i32* %n.addr, align 4
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !3, !noalias !4
  br label %for.cond

for.cond:
  %5 = load i32, i32* %n.addr, align 4
  %6 = icmp slt i32 %5, 100
  br i1 %6, label %for.body, label %for.end

for.body:
  %7 = load i32, i32* %n.addr, align 4
  %8 = add nsw i32 %7, 1
  store i32 %8, i32* %n.addr, align 4
  %9 = load i32, i32* %i.addr, align 4
  %10 = add nsw i32 %9, 1
  store i32 %10, i32* %i.addr, align 4
  %11 = load i32, i32* %i.addr, align 4
  %12 = icmp slt i32 %11, 0
  br i1 %12, label %lor.end, label %lor.rhs

lor.rhs:
  %13 = load i32, i32* %i.addr, align 4
  %14 = trunc i64 %2 to i32
  %15 = icmp sge i32 %13, %14
  br label %lor.end

lor.end:
  %16 = phi i1 [ true, %for.body ], [ %15, %lor.rhs ]
  br i1 %16, label %if.then, label %if.end

if.then:
  br label %for.end

if.end:
  %17 = load i32, i32* %i.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = bitcast i8* %4 to i32*
  %20 = getelementptr inbounds i32, i32* %19, i64 %18
  %21 = load i32, i32* %20, align 4, !alias.scope !4, !noalias !3
  %22 = icmp eq i32 2, 0
  %23 = icmp eq i32 %21, -2147483648
  %24 = icmp eq i32 2, -1
  %25 = and i1 %23, %24
  %26 = or i1 %22, %25
  br i1 %26, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %22)
  unreachable

div.ok:
  %27 = srem i32 %21, 2
  %28 = icmp eq i32 %27, 0
  br i1 %28, label %if.then.1, label %if.end.1

if.then.1:
  br label %for.inc

if.end.1:
  %29 = load i32, i32* %s.addr, align 4
  %30 = load i32, i32* %i.addr, align 4
  %31 = sext i32 %30 to i64
  %32 = bitcast i8* %4 to i32*
  %33 = getelementptr inbounds i32, i32* %32, i64 %31
  %34 = load i32, i32* %33, align 4, !alias.scope !4, !noalias !3
  %35 = add nsw i32 %29, %34
  store i32 %35, i32* %s.addr, align 4
  br label %for.inc

for.inc:
  %36 = load i32, i32* %i.addr, align 4
  %37 = sext i32 %36 to i64
  %38 = bitcast i8* %4 to i32*
  %39 = getelementptr inbounds i32, i32* %38, i64 %37
  %40 = load i32, i32* %39, align 4, !alias.scope !4, !noalias !3
  store i32 %40, i32* %last.addr, align 4
  br label %for.cond

for.end:
  %41 = load i32, i32* %s.addr, align 4
  %42 = load i32, i32* %last.addr, align 4
  %43 = mul nsw i32 %42, 0
  %44 = add nsw i32 %41, %43
  ret i32 %44
}

define internal noundef i32 @countOdd(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %xs) #0 {
entry:
  %odd.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  store i32 0, i32* %odd.addr, align 4
  %0 = sub nsw i32 0, 1
  store i32 %0, i32* %i.addr, align 4
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 0
  %2 = load i64, i64* %1, align 8, !alias.scope !3, !noalias !4
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %xs, i64 0, i32 2
  %4 = load i8*, i8** %3, align 8, !alias.scope !3, !noalias !4
  br label %do.body

do.body:
  %5 = load i32, i32* %i.addr, align 4
  %6 = add nsw i32 %5, 1
  store i32 %6, i32* %i.addr, align 4
  %7 = load i32, i32* %i.addr, align 4
  %8 = icmp slt i32 %7, 0
  br i1 %8, label %lor.end, label %lor.rhs

lor.rhs:
  %9 = load i32, i32* %i.addr, align 4
  %10 = trunc i64 %2 to i32
  %11 = icmp sge i32 %9, %10
  br label %lor.end

lor.end:
  %12 = phi i1 [ true, %do.body ], [ %11, %lor.rhs ]
  br i1 %12, label %if.then, label %if.end

if.then:
  br label %do.end

if.end:
  %13 = load i32, i32* %i.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = bitcast i8* %4 to i32*
  %16 = getelementptr inbounds i32, i32* %15, i64 %14
  %17 = load i32, i32* %16, align 4, !alias.scope !4, !noalias !3
  %18 = icmp eq i32 2, 0
  %19 = icmp eq i32 %17, -2147483648
  %20 = icmp eq i32 2, -1
  %21 = and i1 %19, %20
  %22 = or i1 %18, %21
  br i1 %22, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %18)
  unreachable

div.ok:
  %23 = srem i32 %17, 2
  %24 = icmp eq i32 %23, 0
  br i1 %24, label %if.then.1, label %if.end.1

if.then.1:
  br label %do.cond

if.end.1:
  %25 = load i32, i32* %odd.addr, align 4
  %26 = add nsw i32 %25, 1
  store i32 %26, i32* %odd.addr, align 4
  br label %do.cond

do.cond:
  %27 = load i32, i32* %i.addr, align 4
  %28 = sext i32 %27 to i64
  %29 = bitcast i8* %4 to i32*
  %30 = getelementptr inbounds i32, i32* %29, i64 %28
  %31 = load i32, i32* %30, align 4, !alias.scope !4, !noalias !3
  %32 = icmp sgt i32 %31, 0
  br i1 %32, label %do.body, label %do.end

do.end:
  %33 = load i32, i32* %odd.addr, align 4
  ret i32 %33
}

define noundef i32 @nish_main() #0 {
entry:
  %xs.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [7 x i32], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 7, i64* %0, align 8, !alias.scope !3, !noalias !4
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 7, i64* %1, align 8, !alias.scope !3, !noalias !4
  %2 = bitcast [7 x i32]* %arr.data to i8*
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %2, i8** %3, align 8, !alias.scope !3, !noalias !4
  %4 = bitcast i8* %2 to i32*
  %5 = getelementptr inbounds i32, i32* %4, i64 0
  store i32 3, i32* %5, align 4, !alias.scope !4, !noalias !3
  %6 = getelementptr inbounds i32, i32* %4, i64 1
  store i32 1, i32* %6, align 4, !alias.scope !4, !noalias !3
  %7 = getelementptr inbounds i32, i32* %4, i64 2
  store i32 4, i32* %7, align 4, !alias.scope !4, !noalias !3
  %8 = getelementptr inbounds i32, i32* %4, i64 3
  store i32 1, i32* %8, align 4, !alias.scope !4, !noalias !3
  %9 = getelementptr inbounds i32, i32* %4, i64 4
  store i32 5, i32* %9, align 4, !alias.scope !4, !noalias !3
  %10 = getelementptr inbounds i32, i32* %4, i64 5
  store i32 0, i32* %10, align 4, !alias.scope !4, !noalias !3
  %11 = getelementptr inbounds i32, i32* %4, i64 6
  store i32 9, i32* %11, align 4, !alias.scope !4, !noalias !3
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %xs.addr, align 8
  %12 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %13 = call i32 @sumOdd(%struct.nish_array* %12)
  %14 = call i8* @nish_str_from_i32(i32 %13)
  %15 = call i8* @nish_str_concat(i8* %14, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %16 = load %struct.nish_array*, %struct.nish_array** %xs.addr, align 8
  %17 = call i32 @countOdd(%struct.nish_array* %16)
  %18 = call i8* @nish_str_from_i32(i32 %17)
  %19 = call i8* @nish_str_concat(i8* %15, i8* %18)
  call void @nish_print(i8* %19)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn }
attributes #2 = { nounwind noreturn cold }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}

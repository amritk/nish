%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"=\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"?\00" }, align 8

declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2

define noundef nonnull align 8 i8* @banner(i32 noundef %n) #0 {
entry:
  %out.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %out.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %while.body, label %while.end

while.body:
  %2 = load i8*, i8** %out.addr, align 8
  %3 = call i8* @nish_str_concat(i8* %2, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  store i8* %3, i8** %out.addr, align 8
  %4 = load i32, i32* %i.addr, align 4
  %5 = add nsw i32 %4, 1
  store i32 %5, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %6 = load i8*, i8** %out.addr, align 8
  ret i8* %6
}

define noundef i64 @widened() #1 {
entry:
  %0 = mul nsw i32 100000, 100000
  %1 = sext i32 %0 to i64
  ret i64 %1
}

define noundef i32 @test() #0 {
entry:
  %arr.hdr = alloca %struct.nish_array, align 8
  %arr.data = alloca [3 x i32], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @banner(i32 3)
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  %3 = bitcast i8* %2 to i64*
  %4 = load i64, i64* %3, align 8
  %5 = trunc i64 %4 to i32
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 3, i64* %6, align 8, !alias.scope !3, !noalias !4
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 3, i64* %7, align 8, !alias.scope !3, !noalias !4
  %8 = bitcast [3 x i32]* %arr.data to i8*
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* %8, i8** %9, align 8, !alias.scope !3, !noalias !4
  %10 = bitcast i8* %8 to i32*
  %11 = getelementptr inbounds i32, i32* %10, i64 0
  store i32 1, i32* %11, align 4, !alias.scope !4, !noalias !3
  %12 = getelementptr inbounds i32, i32* %10, i64 1
  store i32 2, i32* %12, align 4, !alias.scope !4, !noalias !3
  %13 = getelementptr inbounds i32, i32* %10, i64 2
  store i32 3, i32* %13, align 4, !alias.scope !4, !noalias !3
  %14 = call i64 @nish_arena_mark()
  %15 = call i8* @label$i32(%struct.nish_array* %arr.hdr)
  %16 = call i8* @nish_arena_keep(i64 %14, i8* %15)
  %17 = bitcast i8* %16 to i64*
  %18 = load i64, i64* %17, align 8
  %19 = trunc i64 %18 to i32
  %20 = add nsw i32 %5, %19
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %20
}

define internal noundef nonnull align 8 i8* @label$i32(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %items) #0 {
entry:
  %s.addr = alloca i8*, align 8
  %i.addr = alloca i32, align 4
  store i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  store i32 0, i32* %i.addr, align 4
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %items, i64 0, i32 0
  %1 = load i64, i64* %0, align 8, !alias.scope !3, !noalias !4
  br label %while.cond

while.cond:
  %2 = load i32, i32* %i.addr, align 4
  %3 = trunc i64 %1 to i32
  %4 = icmp slt i32 %2, %3
  br i1 %4, label %while.body, label %while.end

while.body:
  %5 = load i8*, i8** %s.addr, align 8
  %6 = call i8* @nish_str_concat(i8* %5, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  store i8* %6, i8** %s.addr, align 8
  %7 = load i32, i32* %i.addr, align 4
  %8 = add nsw i32 %7, 1
  store i32 %8, i32* %i.addr, align 4
  br label %while.cond

while.end:
  %9 = load i8*, i8** %s.addr, align 8
  ret i8* %9
}

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind willreturn }

!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}

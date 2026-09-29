@.str.0 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"abcdef\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #2

define internal noundef nonnull align 8 i8* @head(i8* noundef nonnull noalias readonly align 8 %s, i32 noundef %n) #0 {
entry:
  %0 = icmp sge i32 %n, 0
  br i1 %0, label %land.rhs, label %land.end

land.rhs:
  %1 = bitcast i8* %s to i64*
  %2 = load i64, i64* %1, align 8
  %3 = trunc i64 %2 to i32
  %4 = icmp sle i32 %n, %3
  br label %land.end

land.end:
  %5 = phi i1 [ false, %entry ], [ %4, %land.rhs ]
  br i1 %5, label %if.then, label %if.end

if.then:
  %6 = bitcast i8* %s to i64*
  %7 = load i64, i64* %6, align 8
  %8 = sext i32 %n to i64
  %9 = icmp ule i64 0, %8
  %10 = icmp ule i64 %8, %7
  %11 = and i1 %9, %10
  br i1 %11, label %slice.ok, label %slice.fail

slice.fail:
  call void @nish_panic_slice(i64 0, i64 %8, i64 %7)
  unreachable

slice.ok:
  %12 = sub i64 %8, 0
  %13 = getelementptr inbounds i8, i8* %s, i64 8
  %14 = getelementptr inbounds i8, i8* %13, i64 0
  %15 = call i8* @nish_str_new(i8* %14, i64 %12)
  ret i8* %15

if.end:
  ret i8* %s
}

define internal noundef nonnull align 8 i8* @rest(i8* noundef nonnull noalias readonly align 8 nocapture %s, i32 noundef %from) #0 {
entry:
  %n.addr = alloca i32, align 4
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = trunc i64 %1 to i32
  store i32 %2, i32* %n.addr, align 4
  %3 = icmp sge i32 %from, 0
  br i1 %3, label %land.rhs, label %land.end

land.rhs:
  %4 = bitcast i8* %s to i64*
  %5 = load i64, i64* %4, align 8
  %6 = trunc i64 %5 to i32
  %7 = icmp sle i32 %from, %6
  br label %land.end

land.end:
  %8 = phi i1 [ false, %entry ], [ %7, %land.rhs ]
  br i1 %8, label %if.then, label %if.end

if.then:
  %9 = bitcast i8* %s to i64*
  %10 = load i64, i64* %9, align 8
  %11 = sext i32 %from to i64
  %12 = load i32, i32* %n.addr, align 4
  %13 = sext i32 %12 to i64
  %14 = icmp ule i64 %11, %13
  %15 = icmp ule i64 %13, %10
  %16 = and i1 %14, %15
  br i1 %16, label %slice.ok, label %slice.fail

slice.fail:
  call void @nish_panic_slice(i64 %11, i64 %13, i64 %10)
  unreachable

slice.ok:
  %17 = sub i64 %13, %11
  %18 = getelementptr inbounds i8, i8* %s, i64 8
  %19 = getelementptr inbounds i8, i8* %18, i64 %11
  %20 = call i8* @nish_str_new(i8* %19, i64 %17)
  ret i8* %20

if.end:
  ret i8* bitcast ({ i64, [1 x i8] }* @.str.0 to i8*)
}

define noundef i32 @nish_main() #0 {
entry:
  %word.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [7 x i8] }* @.str.1 to i8*), i8** %word.addr, align 8
  %0 = load i8*, i8** %word.addr, align 8
  %1 = call i64 @nish_arena_mark()
  %2 = call i8* @head(i8* %0, i32 3)
  %3 = call i8* @nish_arena_keep(i64 %1, i8* %2)
  call void @nish_print(i8* %3)
  %4 = load i8*, i8** %word.addr, align 8
  %5 = call i64 @nish_arena_mark()
  %6 = call i8* @rest(i8* %4, i32 4)
  %7 = call i8* @nish_arena_keep(i64 %5, i8* %6)
  call void @nish_print(i8* %7)
  %8 = load i8*, i8** %word.addr, align 8
  %9 = bitcast i8* %8 to i64*
  %10 = load i64, i64* %9, align 8
  %11 = icmp ule i64 0, %10
  br i1 %11, label %slice.ok, label %slice.fail

slice.fail:
  call void @nish_panic_slice(i64 0, i64 %10, i64 %10)
  unreachable

slice.ok:
  %12 = sub i64 %10, 0
  %13 = getelementptr inbounds i8, i8* %8, i64 8
  %14 = getelementptr inbounds i8, i8* %13, i64 0
  %15 = call i8* @nish_str_new(i8* %14, i64 %12)
  call void @nish_print(i8* %15)
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

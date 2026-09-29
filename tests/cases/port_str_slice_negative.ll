@.str.0 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"abcdef\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #2

define internal noundef nonnull align 8 i8* @lastTwo(i8* noundef nonnull noalias readonly align 8 nocapture %s) #0 {
entry:
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = sext i32 -2 to i64
  %3 = icmp ule i64 %2, %1
  br i1 %3, label %slice.ok, label %slice.fail

slice.fail:
  call void @nish_panic_slice(i64 %2, i64 %1, i64 %1)
  unreachable

slice.ok:
  %4 = sub i64 %1, %2
  %5 = getelementptr inbounds i8, i8* %s, i64 8
  %6 = getelementptr inbounds i8, i8* %5, i64 %2
  %7 = call i8* @nish_str_new(i8* %6, i64 %4)
  ret i8* %7
}

define internal noundef nonnull align 8 i8* @window(i8* noundef nonnull noalias readonly align 8 nocapture %s, i32 noundef %from, i32 noundef %to) #0 {
entry:
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = sext i32 %from to i64
  %3 = sext i32 %to to i64
  %4 = icmp ule i64 %2, %3
  %5 = icmp ule i64 %3, %1
  %6 = and i1 %4, %5
  br i1 %6, label %slice.ok, label %slice.fail

slice.fail:
  call void @nish_panic_slice(i64 %2, i64 %3, i64 %1)
  unreachable

slice.ok:
  %7 = sub i64 %3, %2
  %8 = getelementptr inbounds i8, i8* %s, i64 8
  %9 = getelementptr inbounds i8, i8* %8, i64 %2
  %10 = call i8* @nish_str_new(i8* %9, i64 %7)
  ret i8* %10
}

define internal noundef nonnull align 8 i8* @past(i8* noundef nonnull noalias readonly align 8 nocapture %s) #0 {
entry:
  %0 = bitcast i8* %s to i64*
  %1 = load i64, i64* %0, align 8
  %2 = icmp ule i64 2, 10
  %3 = icmp ule i64 10, %1
  %4 = and i1 %2, %3
  br i1 %4, label %slice.ok, label %slice.fail

slice.fail:
  call void @nish_panic_slice(i64 2, i64 10, i64 %1)
  unreachable

slice.ok:
  %5 = sub i64 10, 2
  %6 = getelementptr inbounds i8, i8* %s, i64 8
  %7 = getelementptr inbounds i8, i8* %6, i64 2
  %8 = call i8* @nish_str_new(i8* %7, i64 %5)
  ret i8* %8
}

define noundef i32 @nish_main() #0 {
entry:
  %word.addr = alloca i8*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [7 x i8] }* @.str.0 to i8*), i8** %word.addr, align 8
  %0 = load i8*, i8** %word.addr, align 8
  %1 = bitcast i8* %0 to i64*
  %2 = load i64, i64* %1, align 8
  %3 = trunc i64 %2 to i32
  %4 = icmp sgt i32 %3, 100
  br i1 %4, label %if.then, label %if.end

if.then:
  %5 = load i8*, i8** %word.addr, align 8
  %6 = call i64 @nish_arena_mark()
  %7 = call i8* @lastTwo(i8* %5)
  %8 = call i8* @nish_arena_keep(i64 %6, i8* %7)
  call void @nish_print(i8* %8)
  %9 = load i8*, i8** %word.addr, align 8
  %10 = call i64 @nish_arena_mark()
  %11 = call i8* @past(i8* %9)
  %12 = call i8* @nish_arena_keep(i64 %10, i8* %11)
  call void @nish_print(i8* %12)
  br label %if.end

if.end:
  %13 = load i8*, i8** %word.addr, align 8
  %14 = call i64 @nish_arena_mark()
  %15 = call i8* @window(i8* %13, i32 1, i32 3)
  %16 = call i8* @nish_arena_keep(i64 %14, i8* %15)
  call void @nish_print(i8* %16)
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

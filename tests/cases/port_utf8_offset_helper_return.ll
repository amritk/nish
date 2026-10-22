@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"l\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"h\C3\A9llo\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"hello\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"o\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"inside\00" }, align 8

declare void @nish_free_arena() #3
declare noundef i64 @nish_arena_mark() #3
declare void @nish_arena_release(i64 noundef) #3
declare i64 @nish_str_index_of(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #4
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #3
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #3
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1

define internal noundef i32 @firstL(i8* noundef nonnull noalias readonly align 8 nocapture %s) #0 {
entry:
  %0 = call i64 @nish_str_index_of(i8* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %1 = trunc i64 %0 to i32
  ret i32 %1
}

define internal noundef i32 @same(i32 noundef %n) #1 {
entry:
  ret i32 %n
}

define internal noundef i32 @kept(i32 noundef %n) #1 {
entry:
  %m.addr = alloca i32, align 4
  store i32 %n, i32* %m.addr, align 4
  %0 = load i32, i32* %m.addr, align 4
  ret i32 %0
}

define internal noundef i32 @width(i8* noundef nonnull noalias readonly align 8 %s) #2 {
entry:
  %0 = call i32 @firstL(i8* %s)
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 1)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %2

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @nish_main() #2 {
entry:
  %word.addr = alloca i8*, align 8
  %w.addr = alloca i32, align 4
  %back.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [7 x i8] }* @.str.1 to i8*), i8** %word.addr, align 8
  %0 = load i8*, i8** %word.addr, align 8
  %1 = call i32 @firstL(i8* %0)
  %2 = call i8* @nish_str_from_i32(i32 %1)
  call void @nish_print(i8* %2)
  %3 = load i8*, i8** %word.addr, align 8
  %4 = call i32 @width(i8* %3)
  store i32 %4, i32* %w.addr, align 4
  %5 = load i32, i32* %w.addr, align 4
  %6 = call i8* @nish_str_from_i32(i32 %5)
  call void @nish_print(i8* %6)
  %7 = call i32 @firstL(i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*))
  %8 = call i8* @nish_str_from_i32(i32 %7)
  call void @nish_print(i8* %8)
  %9 = load i8*, i8** %word.addr, align 8
  %10 = bitcast i8* %9 to i64*
  %11 = load i64, i64* %10, align 8
  %12 = trunc i64 %11 to i32
  %13 = call i32 @same(i32 %12)
  %14 = call i8* @nish_str_from_i32(i32 %13)
  call void @nish_print(i8* %14)
  %15 = load i8*, i8** %word.addr, align 8
  %16 = call i64 @nish_str_index_of(i8* %15, i8* bitcast ({ i64, [2 x i8] }* @.str.3 to i8*))
  %17 = trunc i64 %16 to i32
  %18 = call i32 @kept(i32 %17)
  store i32 %18, i32* %back.addr, align 4
  %19 = load i32, i32* %back.addr, align 4
  %20 = call i8* @nish_str_from_i32(i32 %19)
  call void @nish_print(i8* %20)
  %21 = load i8*, i8** %word.addr, align 8
  %22 = call i64 @nish_str_index_of(i8* %21, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %23 = trunc i64 %22 to i32
  %24 = call i32 @same(i32 %23)
  %25 = load i8*, i8** %word.addr, align 8
  %26 = bitcast i8* %25 to i64*
  %27 = load i64, i64* %26, align 8
  %28 = trunc i64 %27 to i32
  %29 = icmp slt i32 %24, %28
  br i1 %29, label %if.then, label %if.end

if.then:
  call void @nish_print(i8* bitcast ({ i64, [7 x i8] }* @.str.4 to i8*))
  br label %if.end

if.end:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readonly }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind }
attributes #3 = { nounwind willreturn }
attributes #4 = { nounwind willreturn memory(argmem: read) }
attributes #5 = { nounwind noreturn cold }

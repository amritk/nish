@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"abc\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_panic_index(i64 noundef, i64 noundef) #2

define noundef i32 @nish_main() #0 {
entry:
  %s.addr = alloca i8*, align 8
  %k.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  store i32 0, i32* %k.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i8*, i8** %s.addr, align 8
  %1 = bitcast i8* %0 to i64*
  %2 = load i64, i64* %1, align 8
  %3 = trunc i64 %2 to i32
  store i32 %3, i32* %k.addr, align 4
  %4 = icmp sgt i32 %3, 0
  br i1 %4, label %while.body, label %while.end

while.body:
  store i32 100, i32* %k.addr, align 4
  br label %while.end

while.end:
  store i32 50, i32* %i.addr, align 4
  %5 = load i32, i32* %i.addr, align 4
  %6 = icmp sge i32 %5, 0
  br i1 %6, label %land.rhs, label %land.end

land.rhs:
  %7 = load i32, i32* %i.addr, align 4
  %8 = load i32, i32* %k.addr, align 4
  %9 = icmp slt i32 %7, %8
  br label %land.end

land.end:
  %10 = phi i1 [ false, %while.end ], [ %9, %land.rhs ]
  br i1 %10, label %if.then, label %if.end

if.then:
  %11 = load i8*, i8** %s.addr, align 8
  %12 = load i32, i32* %i.addr, align 4
  %13 = sext i32 %12 to i64
  %14 = bitcast i8* %11 to i64*
  %15 = load i64, i64* %14, align 8
  %16 = icmp ult i64 %13, %15
  br i1 %16, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %13, i64 %15)
  unreachable

bounds.ok:
  %17 = getelementptr inbounds i8, i8* %11, i64 8
  %18 = getelementptr inbounds i8, i8* %17, i64 %13
  %19 = load i8, i8* %18, align 1
  %20 = zext i8 %19 to i32
  %21 = call i8* @nish_str_from_i32(i32 %20)
  call void @nish_print(i8* %21)
  br label %if.end

if.end:
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

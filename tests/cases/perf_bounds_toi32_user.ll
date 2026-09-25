%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"abc\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare void @nish_panic_index(i64 noundef, i64 noundef) #3

define internal noundef i32 @toI32(i32 noundef %n) #0 {
entry:
  %0 = add nsw i32 %n, 1
  ret i32 %0
}

define noundef i32 @nish_main() #1 {
entry:
  %s.addr = alloca i8*, align 8
  %n.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  %0 = load i8*, i8** %s.addr, align 8
  %1 = bitcast i8* %0 to i64*
  %2 = load i64, i64* %1, align 8
  %3 = trunc i64 %2 to i32
  %4 = call i32 @toI32(i32 %3)
  store i32 %4, i32* %n.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %5 = load i32, i32* %i.addr, align 4
  %6 = load i32, i32* %n.addr, align 4
  %7 = icmp slt i32 %5, %6
  br i1 %7, label %while.body, label %while.end

while.body:
  %8 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %9 = load i8*, i8** %8, align 8
  %10 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %11 = load i64, i64* %10, align 8
  %12 = load i8*, i8** %s.addr, align 8
  %13 = load i32, i32* %i.addr, align 4
  %14 = sext i32 %13 to i64
  %15 = bitcast i8* %12 to i64*
  %16 = load i64, i64* %15, align 8
  %17 = icmp ult i64 %14, %16
  br i1 %17, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %14, i64 %16)
  unreachable

bounds.ok:
  %18 = getelementptr inbounds i8, i8* %12, i64 8
  %19 = getelementptr inbounds i8, i8* %18, i64 %14
  %20 = load i8, i8* %19, align 1
  %21 = zext i8 %20 to i32
  %22 = call i8* @nish_str_from_i32(i32 %21)
  call void @nish_print(i8* %22)
  %23 = load i32, i32* %i.addr, align 4
  %24 = add nsw i32 %23, 1
  store i32 %24, i32* %i.addr, align 4
  %25 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %26 = load i8*, i8** %25, align 8
  %27 = icmp eq i8* %26, %9
  br i1 %27, label %pass.rewind, label %pass.free

pass.rewind:
  %28 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %11, i64* %28, align 8
  br label %pass.done

pass.free:
  %29 = ptrtoint i8* %9 to i64
  %30 = add i64 %29, %11
  call void @nish_arena_release(i64 %30)
  br label %pass.done

pass.done:
  br label %while.cond

while.end:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone }
attributes #1 = { nounwind }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind noreturn cold }

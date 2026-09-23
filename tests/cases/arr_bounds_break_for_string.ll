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
  %n.addr = alloca i32, align 4
  %t.addr = alloca i32, align 4
  %i.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  store i8* bitcast ({ i64, [4 x i8] }* @.str.0 to i8*), i8** %s.addr, align 8
  store i32 0, i32* %k.addr, align 4
  store i32 0, i32* %n.addr, align 4
  br label %for.cond

for.cond:
  %0 = load i8*, i8** %s.addr, align 8
  %1 = bitcast i8* %0 to i64*
  %2 = load i64, i64* %1, align 8
  %3 = trunc i64 %2 to i32
  store i32 %3, i32* %k.addr, align 4
  %4 = icmp sgt i32 %3, 0
  br i1 %4, label %land.rhs, label %land.end

land.rhs:
  %5 = load i32, i32* %n.addr, align 4
  %6 = icmp slt i32 %5, 10
  br label %land.end

land.end:
  %7 = phi i1 [ false, %for.cond ], [ %6, %land.rhs ]
  br i1 %7, label %for.body, label %for.end

for.body:
  %8 = load i32, i32* %n.addr, align 4
  %9 = icmp eq i32 %8, 0
  br i1 %9, label %if.then, label %if.end

if.then:
  store i32 100, i32* %k.addr, align 4
  br label %for.end

if.end:
  br label %for.inc

for.inc:
  %10 = load i32, i32* %n.addr, align 4
  %11 = add nsw i32 %10, 1
  store i32 %11, i32* %n.addr, align 4
  br label %for.cond

for.end:
  store i32 0, i32* %t.addr, align 4
  store i32 0, i32* %i.addr, align 4
  br label %for.cond.1

for.cond.1:
  %12 = load i32, i32* %i.addr, align 4
  %13 = load i32, i32* %k.addr, align 4
  %14 = icmp slt i32 %12, %13
  br i1 %14, label %for.body.1, label %for.end.1

for.body.1:
  %15 = load i32, i32* %t.addr, align 4
  %16 = load i8*, i8** %s.addr, align 8
  %17 = load i32, i32* %i.addr, align 4
  %18 = sext i32 %17 to i64
  %19 = bitcast i8* %16 to i64*
  %20 = load i64, i64* %19, align 8
  %21 = icmp ult i64 %18, %20
  br i1 %21, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %18, i64 %20)
  unreachable

bounds.ok:
  %22 = getelementptr inbounds i8, i8* %16, i64 8
  %23 = getelementptr inbounds i8, i8* %22, i64 %18
  %24 = load i8, i8* %23, align 1
  %25 = zext i8 %24 to i32
  %26 = add nsw i32 %15, %25
  store i32 %26, i32* %t.addr, align 4
  br label %for.inc.1

for.inc.1:
  %27 = load i32, i32* %i.addr, align 4
  %28 = add nsw i32 %27, 1
  store i32 %28, i32* %i.addr, align 4
  br label %for.cond.1

for.end.1:
  %29 = load i32, i32* %t.addr, align 4
  %30 = call i8* @nish_str_from_i32(i32 %29)
  call void @nish_print(i8* %30)
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

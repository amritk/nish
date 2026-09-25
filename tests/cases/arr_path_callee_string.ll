%struct.Text = type { i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"z\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"abc\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #2

define internal void @Text.constructor(%struct.Text* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i8* noundef nonnull noalias readonly align 8 %text) #0 {
entry:
  %0 = getelementptr inbounds %struct.Text, %struct.Text* %this, i32 0, i32 0
  store i8* %text, i8** %0, align 8, !tbaa !4
  ret void
}

define internal void @shorten(%struct.Text* noundef nonnull align 8 dereferenceable(8) nocapture %t, i32 noundef %i) #0 {
entry:
  %0 = icmp eq i32 %i, 1
  br i1 %0, label %if.then, label %if.end

if.then:
  %1 = getelementptr inbounds %struct.Text, %struct.Text* %t, i32 0, i32 0
  store i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8** %1, align 8, !tbaa !4
  br label %if.end

if.end:
  ret void
}

define noundef i32 @nish_main() #1 {
entry:
  %t.addr = alloca %struct.Text*, align 8
  %Text.obj = alloca %struct.Text, align 8
  %i.addr = alloca i32, align 4
  %c.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  call void @Text.constructor(%struct.Text* %Text.obj, i8* bitcast ({ i64, [4 x i8] }* @.str.1 to i8*))
  store %struct.Text* %Text.obj, %struct.Text** %t.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = load %struct.Text*, %struct.Text** %t.addr, align 8
  %2 = getelementptr inbounds %struct.Text, %struct.Text* %1, i32 0, i32 0
  %3 = load i8*, i8** %2, align 8, !tbaa !4
  %4 = bitcast i8* %3 to i64*
  %5 = load i64, i64* %4, align 8
  %6 = trunc i64 %5 to i32
  %7 = icmp slt i32 %0, %6
  br i1 %7, label %while.body, label %while.end

while.body:
  %8 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %9 = load i8*, i8** %8, align 8
  %10 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %11 = load i64, i64* %10, align 8
  %12 = load %struct.Text*, %struct.Text** %t.addr, align 8
  %13 = load i32, i32* %i.addr, align 4
  call void @shorten(%struct.Text* %12, i32 %13)
  %14 = load %struct.Text*, %struct.Text** %t.addr, align 8
  %15 = getelementptr inbounds %struct.Text, %struct.Text* %14, i32 0, i32 0
  %16 = load i8*, i8** %15, align 8, !tbaa !4
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
  store i32 %25, i32* %c.addr, align 4
  %26 = load i32, i32* %c.addr, align 4
  %27 = call i8* @nish_str_from_i32(i32 %26)
  call void @nish_print(i8* %27)
  %28 = load i32, i32* %i.addr, align 4
  %29 = add nsw i32 %28, 1
  store i32 %29, i32* %i.addr, align 4
  %30 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %31 = load i8*, i8** %30, align 8
  %32 = icmp eq i8* %31, %9
  br i1 %32, label %pass.rewind, label %pass.free

pass.rewind:
  %33 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %11, i64* %33, align 8
  br label %pass.done

pass.free:
  %34 = ptrtoint i8* %9 to i64
  %35 = add i64 %34, %11
  call void @nish_arena_release(i64 %35)
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

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind }
attributes #2 = { nounwind noreturn cold }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"Text", !2, i64 0}
!4 = !{!3, !2, i64 0}

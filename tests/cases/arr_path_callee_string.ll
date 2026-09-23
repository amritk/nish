%struct.Text = type { i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"z\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"abc\00" }, align 8

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
  %8 = load %struct.Text*, %struct.Text** %t.addr, align 8
  %9 = load i32, i32* %i.addr, align 4
  call void @shorten(%struct.Text* %8, i32 %9)
  %10 = load %struct.Text*, %struct.Text** %t.addr, align 8
  %11 = getelementptr inbounds %struct.Text, %struct.Text* %10, i32 0, i32 0
  %12 = load i8*, i8** %11, align 8, !tbaa !4
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
  store i32 %21, i32* %c.addr, align 4
  %22 = load i32, i32* %c.addr, align 4
  %23 = call i8* @nish_str_from_i32(i32 %22)
  call void @nish_print(i8* %23)
  %24 = load i32, i32* %i.addr, align 4
  %25 = add nsw i32 %24, 1
  store i32 %25, i32* %i.addr, align 4
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

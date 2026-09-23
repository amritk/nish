%struct.Text = type { i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"z\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"abcdef\00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_panic_index(i64 noundef, i64 noundef) #2

define internal void @Text.constructor(%struct.Text* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i8* noundef nonnull noalias readonly align 8 %s) #0 {
entry:
  %0 = getelementptr inbounds %struct.Text, %struct.Text* %this, i32 0, i32 0
  store i8* %s, i8** %0, align 8, !tbaa !4
  ret void
}

define internal noundef zeroext i1 @Text.cut(%struct.Text* noundef nonnull align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Text, %struct.Text* %this, i32 0, i32 0
  store i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8** %0, align 8, !tbaa !4
  ret i1 true
}

define internal noundef i32 @code(%struct.Text* noundef nonnull align 8 dereferenceable(8) nocapture %t, i32 noundef %i) #0 {
entry:
  %0 = icmp sge i32 %i, 0
  br i1 %0, label %land.rhs.1, label %land.end.1

land.rhs.1:
  %1 = getelementptr inbounds %struct.Text, %struct.Text* %t, i32 0, i32 0
  %2 = load i8*, i8** %1, align 8, !tbaa !4
  %3 = bitcast i8* %2 to i64*
  %4 = load i64, i64* %3, align 8
  %5 = trunc i64 %4 to i32
  %6 = icmp slt i32 %i, %5
  br label %land.end.1

land.end.1:
  %7 = phi i1 [ false, %entry ], [ %6, %land.rhs.1 ]
  br i1 %7, label %land.rhs, label %land.end

land.rhs:
  %8 = call i1 @Text.cut(%struct.Text* %t)
  br label %land.end

land.end:
  %9 = phi i1 [ false, %land.end.1 ], [ %8, %land.rhs ]
  br i1 %9, label %if.then, label %if.end

if.then:
  %10 = getelementptr inbounds %struct.Text, %struct.Text* %t, i32 0, i32 0
  %11 = load i8*, i8** %10, align 8, !tbaa !4
  %12 = sext i32 %i to i64
  %13 = bitcast i8* %11 to i64*
  %14 = load i64, i64* %13, align 8
  %15 = icmp ult i64 %12, %14
  br i1 %15, label %bounds.ok, label %bounds.fail

bounds.fail:
  call void @nish_panic_index(i64 %12, i64 %14)
  unreachable

bounds.ok:
  %16 = getelementptr inbounds i8, i8* %11, i64 8
  %17 = getelementptr inbounds i8, i8* %16, i64 %12
  %18 = load i8, i8* %17, align 1
  %19 = zext i8 %18 to i32
  ret i32 %19

if.end:
  %20 = sub nsw i32 0, 1
  ret i32 %20
}

define noundef i32 @nish_main() #0 {
entry:
  %Text.obj = alloca %struct.Text, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Text.constructor(%struct.Text* %Text.obj, i8* bitcast ({ i64, [7 x i8] }* @.str.1 to i8*))
  %0 = call i32 @code(%struct.Text* %Text.obj, i32 3)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  call void @nish_print(i8* %1)
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

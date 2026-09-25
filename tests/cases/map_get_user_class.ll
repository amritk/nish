%struct.Map$str$i32 = type { i8*, i32 }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"a\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"b\00" }, align 8

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define noundef i32 @nish_main() #0 {
entry:
  %m.addr = alloca %struct.Map$str$i32*, align 8
  %Map$str$i32.obj = alloca %struct.Map$str$i32, align 8
  %v.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  call void @Map$str$i32.constructor(%struct.Map$str$i32* %Map$str$i32.obj, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i32 4)
  store %struct.Map$str$i32* %Map$str$i32.obj, %struct.Map$str$i32** %m.addr, align 8
  %0 = load %struct.Map$str$i32*, %struct.Map$str$i32** %m.addr, align 8
  %1 = call i32 @Map$str$i32.get(%struct.Map$str$i32* %0, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  store i32 %1, i32* %v.addr, align 4
  %2 = load i32, i32* %v.addr, align 4
  %3 = add nsw i32 %2, 1
  %4 = call i8* @nish_str_from_i32(i32 %3)
  call void @nish_print(i8* %4)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define internal void @Map$str$i32.constructor(%struct.Map$str$i32* noundef nonnull noalias align 8 dereferenceable(16) nocapture %this, i8* noundef nonnull noalias readonly align 8 %key, i32 noundef %value) #0 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 0
  store i8* %key, i8** %0, align 8, !tbaa !5
  %1 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1
  store i32 %value, i32* %1, align 4, !tbaa !6
  ret void
}

define internal noundef i32 @Map$str$i32.get(%struct.Map$str$i32* noundef nonnull readonly align 8 dereferenceable(16) nocapture %this, i8* noundef nonnull noalias readonly align 8 nocapture %key) #1 {
entry:
  %0 = getelementptr inbounds %struct.Map$str$i32, %struct.Map$str$i32* %this, i32 0, i32 1
  %1 = load i32, i32* %0, align 4, !tbaa !6
  ret i32 %1
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"i32", !1, i64 0}
!4 = !{!"Map$str$i32", !2, i64 0, !3, i64 8}
!5 = !{!4, !2, i64 0}
!6 = !{!4, !3, i64 8}

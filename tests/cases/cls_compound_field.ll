%struct.Stats = type { i32, i32, i32 }

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define internal void @Stats.constructor(%struct.Stats* noundef nonnull noalias align 8 dereferenceable(12) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Stats, %struct.Stats* %this, i32 0, i32 2
  store i32 0, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Stats, %struct.Stats* %this, i32 0, i32 0
  store i32 0, i32* %1, align 4, !tbaa !5
  %2 = getelementptr inbounds %struct.Stats, %struct.Stats* %this, i32 0, i32 1
  store i32 8, i32* %2, align 4, !tbaa !6
  ret void
}

define internal noundef i32 @Stats.add(%struct.Stats* noundef nonnull align 8 dereferenceable(12) nocapture %this, i32 noundef %v) #0 {
entry:
  %0 = getelementptr inbounds %struct.Stats, %struct.Stats* %this, i32 0, i32 2
  %1 = load i32, i32* %0, align 4
  %2 = add nsw i32 %1, 1
  store i32 %2, i32* %0, align 4
  %3 = getelementptr inbounds %struct.Stats, %struct.Stats* %this, i32 0, i32 0
  %4 = load i32, i32* %3, align 4
  %5 = add nsw i32 %4, %v
  store i32 %5, i32* %3, align 4
  %6 = getelementptr inbounds %struct.Stats, %struct.Stats* %this, i32 0, i32 0
  %7 = load i32, i32* %6, align 4, !tbaa !5
  ret i32 %7
}

define internal void @halve(%struct.Stats* noundef nonnull align 8 dereferenceable(12) nocapture %s) #0 {
entry:
  %0 = getelementptr inbounds %struct.Stats, %struct.Stats* %s, i32 0, i32 1
  %1 = load i32, i32* %0, align 4
  %2 = sdiv i32 %1, 2
  store i32 %2, i32* %0, align 4
  %3 = getelementptr inbounds %struct.Stats, %struct.Stats* %s, i32 0, i32 0
  %4 = load i32, i32* %3, align 4
  %5 = getelementptr inbounds %struct.Stats, %struct.Stats* %s, i32 0, i32 0
  %6 = load i32, i32* %5, align 4, !tbaa !5
  %7 = srem i32 %6, 2
  %8 = sub nsw i32 %4, %7
  store i32 %8, i32* %3, align 4
  ret void
}

define noundef i32 @nish_main() #0 {
entry:
  %s.addr = alloca %struct.Stats*, align 8
  %Stats.obj = alloca %struct.Stats, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Stats.constructor(%struct.Stats* %Stats.obj)
  store %struct.Stats* %Stats.obj, %struct.Stats** %s.addr, align 8
  %0 = load %struct.Stats*, %struct.Stats** %s.addr, align 8
  %1 = call i32 @Stats.add(%struct.Stats* %0, i32 5)
  %2 = load %struct.Stats*, %struct.Stats** %s.addr, align 8
  %3 = call i32 @Stats.add(%struct.Stats* %2, i32 8)
  %4 = load %struct.Stats*, %struct.Stats** %s.addr, align 8
  %5 = getelementptr inbounds %struct.Stats, %struct.Stats* %4, i32 0, i32 0
  %6 = load i32, i32* %5, align 4
  %7 = mul nsw i32 %6, 3
  store i32 %7, i32* %5, align 4
  %8 = load %struct.Stats*, %struct.Stats** %s.addr, align 8
  call void @halve(%struct.Stats* %8)
  %9 = load %struct.Stats*, %struct.Stats** %s.addr, align 8
  %10 = getelementptr inbounds %struct.Stats, %struct.Stats* %9, i32 0, i32 0
  %11 = load i32, i32* %10, align 4, !tbaa !5
  %12 = call i8* @nish_str_from_i32(i32 %11)
  call void @nish_print(i8* %12)
  %13 = load %struct.Stats*, %struct.Stats** %s.addr, align 8
  %14 = getelementptr inbounds %struct.Stats, %struct.Stats* %13, i32 0, i32 2
  %15 = load i32, i32* %14, align 4, !tbaa !4
  %16 = call i8* @nish_str_from_i32(i32 %15)
  call void @nish_print(i8* %16)
  %17 = load %struct.Stats*, %struct.Stats** %s.addr, align 8
  %18 = getelementptr inbounds %struct.Stats, %struct.Stats* %17, i32 0, i32 1
  %19 = load i32, i32* %18, align 4, !tbaa !6
  %20 = call i8* @nish_str_from_i32(i32 %19)
  call void @nish_print(i8* %20)
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

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Stats", !2, i64 0, !2, i64 4, !2, i64 8}
!4 = !{!3, !2, i64 8}
!5 = !{!3, !2, i64 0}
!6 = !{!3, !2, i64 4}

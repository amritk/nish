%struct.Dn = type { i32 }

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define internal void @Dn.constructor(%struct.Dn* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Dn, %struct.Dn* %this, i32 0, i32 0
  store i32 7, i32* %0, align 4, !tbaa !4
  ret void
}

define noundef i32 @nish_main() #0 {
entry:
  %Dn.obj = alloca %struct.Dn, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Dn.constructor(%struct.Dn* %Dn.obj)
  %0 = getelementptr inbounds %struct.Dn, %struct.Dn* %Dn.obj, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  %2 = call i8* @nish_str_from_i32(i32 %1)
  call void @nish_print(i8* %2)
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
!3 = !{!"Dn", !2, i64 0}
!4 = !{!3, !2, i64 0}

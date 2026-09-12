%struct.toString = type { i32 }

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0

define internal void @toString.constructor(%struct.toString* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %n) #0 {
entry:
  %0 = getelementptr inbounds %struct.toString, %struct.toString* %this, i32 0, i32 0
  store i32 %n, i32* %0, align 4, !tbaa !4
  ret void
}

define internal noundef i32 @valueOf(i32 noundef %x) #1 {
entry:
  %0 = mul nsw i32 %x, 2
  ret i32 %0
}

define internal noundef i32 @hasOwnProperty(i32 noundef %x) #1 {
entry:
  %0 = add nsw i32 %x, 1
  ret i32 %0
}

define internal noundef i32 @isPrototypeOf(i32 noundef %x) #1 {
entry:
  %0 = sub nsw i32 %x, 1
  ret i32 %0
}

define noundef i32 @nish_main() #0 {
entry:
  %constructor.addr = alloca i32, align 4
  %toString.obj = alloca %struct.toString, align 8
  %arena.mark = call i64 @nish_arena_mark()
  store i32 3, i32* %constructor.addr, align 4
  %0 = call i32 @valueOf(i32 21)
  %1 = call i8* @nish_str_from_i32(i32 %0)
  call void @nish_print(i8* %1)
  %2 = call i32 @hasOwnProperty(i32 41)
  %3 = call i8* @nish_str_from_i32(i32 %2)
  call void @nish_print(i8* %3)
  %4 = call i32 @isPrototypeOf(i32 11)
  %5 = call i8* @nish_str_from_i32(i32 %4)
  call void @nish_print(i8* %5)
  call void @toString.constructor(%struct.toString* %toString.obj, i32 7)
  %6 = getelementptr inbounds %struct.toString, %struct.toString* %toString.obj, i32 0, i32 0
  %7 = load i32, i32* %6, align 4, !tbaa !4
  %8 = call i8* @nish_str_from_i32(i32 %7)
  call void @nish_print(i8* %8)
  %9 = load i32, i32* %constructor.addr, align 4
  %10 = call i8* @nish_str_from_i32(i32 %9)
  call void @nish_print(i8* %10)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #2 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"toString", !2, i64 0}
!4 = !{!3, !2, i64 0}

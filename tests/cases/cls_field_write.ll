%struct.Counter = type { i32, i32 }

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define internal void @Counter.constructor(%struct.Counter* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i32 noundef %step) #0 {
entry:
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 1
  store i32 %step, i32* %1, align 4, !tbaa !5
  ret void
}

define internal void @bump(%struct.Counter* noundef nonnull align 8 dereferenceable(8) nocapture %c) #1 {
entry:
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %c, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  %2 = getelementptr inbounds %struct.Counter, %struct.Counter* %c, i32 0, i32 1
  %3 = load i32, i32* %2, align 4, !tbaa !5
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %3)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  %7 = getelementptr inbounds %struct.Counter, %struct.Counter* %c, i32 0, i32 0
  store i32 %5, i32* %7, align 4, !tbaa !4
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @bumpTwice(%struct.Counter* noundef nonnull align 8 dereferenceable(8) nocapture %c) #1 {
entry:
  call void @bump(%struct.Counter* %c)
  call void @bump(%struct.Counter* %c)
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %c, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  ret i32 %1
}

define noundef i32 @nish_main() #1 {
entry:
  %c.addr = alloca %struct.Counter*, align 8
  %Counter.obj = alloca %struct.Counter, align 8
  %arena.mark = call i64 @nish_arena_mark()
  call void @Counter.constructor(%struct.Counter* %Counter.obj, i32 5)
  store %struct.Counter* %Counter.obj, %struct.Counter** %c.addr, align 8
  %0 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %1 = getelementptr inbounds %struct.Counter, %struct.Counter* %0, i32 0, i32 1
  store i32 7, i32* %1, align 4, !tbaa !5
  %2 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %3 = call i32 @bumpTwice(%struct.Counter* %2)
  %4 = call i8* @nish_str_from_i32(i32 %3)
  call void @nish_print(i8* %4)
  %5 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %6 = getelementptr inbounds %struct.Counter, %struct.Counter* %5, i32 0, i32 0
  store i32 100, i32* %6, align 4, !tbaa !4
  %7 = load %struct.Counter*, %struct.Counter** %c.addr, align 8
  %8 = getelementptr inbounds %struct.Counter, %struct.Counter* %7, i32 0, i32 0
  %9 = load i32, i32* %8, align 4, !tbaa !4
  %10 = call i8* @nish_str_from_i32(i32 %9)
  call void @nish_print(i8* %10)
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
attributes #3 = { nounwind willreturn readnone }

!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Counter", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}

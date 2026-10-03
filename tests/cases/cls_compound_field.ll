%struct.Stats = type { i32, i32, i32 }

declare void @nish_free_arena() #0
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_panic_div(i1 noundef zeroext) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.ssub.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #3

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

define internal noundef i32 @Stats.add(%struct.Stats* noundef nonnull align 8 dereferenceable(12) nocapture %this, i32 noundef %v) #1 {
entry:
  %0 = getelementptr inbounds %struct.Stats, %struct.Stats* %this, i32 0, i32 2
  %1 = load i32, i32* %0, align 4
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %3, i32* %0, align 4
  %5 = getelementptr inbounds %struct.Stats, %struct.Stats* %this, i32 0, i32 0
  %6 = load i32, i32* %5, align 4
  %7 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %6, i32 %v)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %8, i32* %5, align 4
  %10 = getelementptr inbounds %struct.Stats, %struct.Stats* %this, i32 0, i32 0
  %11 = load i32, i32* %10, align 4, !tbaa !5
  ret i32 %11

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @halve(%struct.Stats* noundef nonnull align 8 dereferenceable(12) nocapture %s) #1 {
entry:
  %0 = getelementptr inbounds %struct.Stats, %struct.Stats* %s, i32 0, i32 1
  %1 = load i32, i32* %0, align 4
  %2 = icmp eq i32 2, 0
  %3 = icmp eq i32 %1, -2147483648
  %4 = icmp eq i32 2, -1
  %5 = and i1 %3, %4
  %6 = or i1 %2, %5
  br i1 %6, label %div.fail, label %div.ok

div.fail:
  call void @nish_panic_div(i1 zeroext %2)
  unreachable

div.ok:
  %7 = sdiv i32 %1, 2
  store i32 %7, i32* %0, align 4
  %8 = getelementptr inbounds %struct.Stats, %struct.Stats* %s, i32 0, i32 0
  %9 = load i32, i32* %8, align 4
  %10 = getelementptr inbounds %struct.Stats, %struct.Stats* %s, i32 0, i32 0
  %11 = load i32, i32* %10, align 4, !tbaa !5
  %12 = icmp eq i32 2, 0
  %13 = icmp eq i32 %11, -2147483648
  %14 = icmp eq i32 2, -1
  %15 = and i1 %13, %14
  %16 = or i1 %12, %15
  br i1 %16, label %div.fail.1, label %div.ok.1

div.fail.1:
  call void @nish_panic_div(i1 zeroext %12)
  unreachable

div.ok.1:
  %17 = srem i32 %11, 2
  %18 = call { i32, i1 } @llvm.ssub.with.overflow.i32(i32 %9, i32 %17)
  %19 = extractvalue { i32, i1 } %18, 0
  %20 = extractvalue { i32, i1 } %18, 1
  br i1 %20, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %19, i32* %8, align 4
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 1)
  unreachable
}

define noundef i32 @nish_main() #1 {
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
  %7 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %6, i32 3)
  %8 = extractvalue { i32, i1 } %7, 0
  %9 = extractvalue { i32, i1 } %7, 1
  br i1 %9, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %8, i32* %5, align 4
  %10 = load %struct.Stats*, %struct.Stats** %s.addr, align 8
  call void @halve(%struct.Stats* %10)
  %11 = load %struct.Stats*, %struct.Stats** %s.addr, align 8
  %12 = getelementptr inbounds %struct.Stats, %struct.Stats* %11, i32 0, i32 0
  %13 = load i32, i32* %12, align 4, !tbaa !5
  %14 = call i8* @nish_str_from_i32(i32 %13)
  call void @nish_print(i8* %14)
  %15 = load %struct.Stats*, %struct.Stats** %s.addr, align 8
  %16 = getelementptr inbounds %struct.Stats, %struct.Stats* %15, i32 0, i32 2
  %17 = load i32, i32* %16, align 4, !tbaa !4
  %18 = call i8* @nish_str_from_i32(i32 %17)
  call void @nish_print(i8* %18)
  %19 = load %struct.Stats*, %struct.Stats** %s.addr, align 8
  %20 = getelementptr inbounds %struct.Stats, %struct.Stats* %19, i32 0, i32 1
  %21 = load i32, i32* %20, align 4, !tbaa !6
  %22 = call i8* @nish_str_from_i32(i32 %21)
  call void @nish_print(i8* %22)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
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
!3 = !{!"Stats", !2, i64 0, !2, i64 4, !2, i64 8}
!4 = !{!3, !2, i64 8}
!5 = !{!3, !2, i64 0}
!6 = !{!3, !2, i64 4}

%struct.Slot = type { i32 }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2

define internal noundef zeroext i1 @named(i32 noundef %c) #0 {
entry:
  %0 = icmp ne i32 %c, 0
  ret i1 %0
}

define internal noundef zeroext i1 @orNone(i32 noundef %c) #0 {
entry:
  %0 = icmp eq i32 %c, 0
  ret i1 %0
}

define internal noundef i32 @keep(i32 noundef %c) #0 {
entry:
  ret i32 %c
}

define noundef i32 @nish_main() #1 {
entry:
  %slot.addr = alloca %struct.Slot*, align 8
  %Slot.obj = alloca %struct.Slot, align 8
  %kept.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Slot, %struct.Slot* %Slot.obj, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !4
  store %struct.Slot* %Slot.obj, %struct.Slot** %slot.addr, align 8
  %1 = load %struct.Slot*, %struct.Slot** %slot.addr, align 8
  %2 = getelementptr inbounds %struct.Slot, %struct.Slot* %1, i32 0, i32 0
  %3 = load i32, i32* %2, align 4, !tbaa !4
  %4 = call i32 @keep(i32 %3)
  store i32 %4, i32* %kept.addr, align 4
  %5 = load i32, i32* %kept.addr, align 4
  %6 = icmp eq i32 %5, 0
  %7 = select i1 %6, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  %8 = call i8* @nish_str_concat(i8* %7, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %9 = load i32, i32* %kept.addr, align 4
  %10 = icmp eq i32 0, %9
  %11 = select i1 %10, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  %12 = call i8* @nish_str_concat(i8* %8, i8* %11)
  %13 = call i8* @nish_str_concat(i8* %12, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %14 = load i32, i32* %kept.addr, align 4
  %15 = call i1 @named(i32 %14)
  %16 = select i1 %15, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  %17 = call i8* @nish_str_concat(i8* %13, i8* %16)
  %18 = call i8* @nish_str_concat(i8* %17, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %19 = call i1 @orNone(i32 0)
  %20 = select i1 %19, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  %21 = call i8* @nish_str_concat(i8* %18, i8* %20)
  %22 = call i8* @nish_str_concat(i8* %21, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*))
  %23 = load i32, i32* %kept.addr, align 4
  %24 = call i1 @orNone(i32 %23)
  %25 = select i1 %24, i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.1 to i8*)
  %26 = call i8* @nish_str_concat(i8* %22, i8* %25)
  call void @nish_print(i8* %26)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #1 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #1 = { nounwind "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn "probe-stack"="inline-asm" }

!llvm.module.flags = !{!5, !6, !7, !8, !9}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Slot", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{i32 8, !"cf-protection-branch", i32 1}
!6 = !{i32 8, !"cf-protection-return", i32 1}
!7 = !{i32 8, !"branch-target-enforcement", i32 1}
!8 = !{i32 8, !"sign-return-address", i32 1}
!9 = !{i32 4, !"probe-stack", !"inline-asm"}

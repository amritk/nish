%struct.Pair = type { i32, i32, i8* }
%struct.Cell = type { i32, i32 }

@.str.0 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"cell\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define internal noundef i32 @Cell.sum(%struct.Cell* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %0 = getelementptr inbounds %struct.Cell, %struct.Cell* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  %2 = getelementptr inbounds %struct.Cell, %struct.Cell* %this, i32 0, i32 1
  %3 = load i32, i32* %2, align 4, !tbaa !5
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %3)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %5

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define void @nish_main() #0 {
entry:
  %c.addr = alloca %struct.Cell*, align 8
  %Cell.obj = alloca %struct.Cell, align 8
  %p.addr = alloca %struct.Pair*, align 8
  %Pair.obj = alloca %struct.Pair, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Cell, %struct.Cell* %Cell.obj, i32 0, i32 0
  store i32 1, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Cell, %struct.Cell* %Cell.obj, i32 0, i32 1
  store i32 2, i32* %1, align 4, !tbaa !5
  store %struct.Cell* %Cell.obj, %struct.Cell** %c.addr, align 8
  %2 = load %struct.Cell*, %struct.Cell** %c.addr, align 8
  %3 = getelementptr inbounds %struct.Cell, %struct.Cell* %2, i32 0, i32 1
  store i32 7, i32* %3, align 4, !tbaa !5
  %4 = load %struct.Cell*, %struct.Cell** %c.addr, align 8
  %5 = getelementptr inbounds %struct.Cell, %struct.Cell* %4, i32 0, i32 0
  %6 = load i32, i32* %5, align 4, !tbaa !4
  %7 = getelementptr inbounds %struct.Pair, %struct.Pair* %Pair.obj, i32 0, i32 0
  store i32 %6, i32* %7, align 4
  %8 = load %struct.Cell*, %struct.Cell** %c.addr, align 8
  %9 = getelementptr inbounds %struct.Cell, %struct.Cell* %8, i32 0, i32 1
  %10 = load i32, i32* %9, align 4, !tbaa !5
  %11 = getelementptr inbounds %struct.Pair, %struct.Pair* %Pair.obj, i32 0, i32 1
  store i32 %10, i32* %11, align 4
  %12 = getelementptr inbounds %struct.Pair, %struct.Pair* %Pair.obj, i32 0, i32 2
  store i8* bitcast ({ i64, [5 x i8] }* @.str.0 to i8*), i8** %12, align 8
  store %struct.Pair* %Pair.obj, %struct.Pair** %p.addr, align 8
  %13 = load %struct.Pair*, %struct.Pair** %p.addr, align 8
  %14 = getelementptr inbounds %struct.Pair, %struct.Pair* %13, i32 0, i32 0
  %15 = load i32, i32* %14, align 4
  %16 = call i8* @nish_str_from_i32(i32 %15)
  %17 = call i8* @nish_str_concat(i8* %16, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %18 = load %struct.Pair*, %struct.Pair** %p.addr, align 8
  %19 = getelementptr inbounds %struct.Pair, %struct.Pair* %18, i32 0, i32 1
  %20 = load i32, i32* %19, align 4
  %21 = call i8* @nish_str_from_i32(i32 %20)
  %22 = call i8* @nish_str_concat(i8* %17, i8* %21)
  %23 = call i8* @nish_str_concat(i8* %22, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %24 = load %struct.Pair*, %struct.Pair** %p.addr, align 8
  %25 = getelementptr inbounds %struct.Pair, %struct.Pair* %24, i32 0, i32 2
  %26 = load i8*, i8** %25, align 8
  %27 = call i8* @nish_str_concat(i8* %23, i8* %26)
  %28 = call i8* @nish_str_concat(i8* %27, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %29 = load %struct.Cell*, %struct.Cell** %c.addr, align 8
  %30 = call i32 @Cell.sum(%struct.Cell* %29)
  %31 = call i8* @nish_str_from_i32(i32 %30)
  %32 = call i8* @nish_str_concat(i8* %28, i8* %31)
  call void @nish_print(i8* %32)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  call void @nish_main()
  call void @nish_free_arena()
  ret i32 0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!6, !7, !8, !9, !10}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Cell", !2, i64 0, !2, i64 4}
!4 = !{!3, !2, i64 0}
!5 = !{!3, !2, i64 4}
!6 = !{i32 8, !"cf-protection-branch", i32 1}
!7 = !{i32 8, !"cf-protection-return", i32 1}
!8 = !{i32 8, !"branch-target-enforcement", i32 1}
!9 = !{i32 8, !"sign-return-address", i32 1}
!10 = !{i32 4, !"probe-stack", !"inline-asm"}

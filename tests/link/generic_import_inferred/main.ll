%struct.Box$i32 = type { i32 }
%struct.Box$str = type { i8* }

@.str.0 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"inferred\00" }, align 8

declare noundef nonnull align 8 dereferenceable(4) %struct.Box$i32* @box$i32(i32 noundef) #1
declare noundef nonnull align 8 dereferenceable(8) %struct.Box$str* @box$str(i8* noundef nonnull noalias readonly align 8) #1
declare noundef i32 @unbox$i32(%struct.Box$i32* noundef nonnull readonly align 8 dereferenceable(4) nocapture) #2
declare void @Box$i32.constructor(%struct.Box$i32* noundef nonnull noalias align 8 dereferenceable(4) nocapture, i32 noundef) #1
declare noundef i32 @Box$i32.get(%struct.Box$i32* noundef nonnull readonly align 8 dereferenceable(4) nocapture) #2
declare void @Box$str.constructor(%struct.Box$str* noundef nonnull noalias align 8 dereferenceable(8) nocapture, i8* noundef nonnull noalias readonly align 8) #1
declare noundef nonnull align 8 i8* @Box$str.get(%struct.Box$str* noundef nonnull readonly align 8 dereferenceable(8) nocapture) #2
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

define noundef i32 @nish_main() #0 {
entry:
  %b.addr = alloca %struct.Box$i32*, align 8
  %word.addr = alloca %struct.Box$str*, align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call %struct.Box$i32* @box$i32(i32 7)
  store %struct.Box$i32* %0, %struct.Box$i32** %b.addr, align 8
  %1 = load %struct.Box$i32*, %struct.Box$i32** %b.addr, align 8
  %2 = call i32 @Box$i32.get(%struct.Box$i32* %1)
  %3 = load %struct.Box$i32*, %struct.Box$i32** %b.addr, align 8
  %4 = getelementptr inbounds %struct.Box$i32, %struct.Box$i32* %3, i32 0, i32 0
  %5 = load i32, i32* %4, align 4, !tbaa !4
  %6 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %2, i32 %5)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  %9 = call i8* @nish_str_from_i32(i32 %7)
  call void @nish_print(i8* %9)
  %10 = call %struct.Box$str* @box$str(i8* bitcast ({ i64, [9 x i8] }* @.str.0 to i8*))
  store %struct.Box$str* %10, %struct.Box$str** %word.addr, align 8
  %11 = load %struct.Box$str*, %struct.Box$str** %word.addr, align 8
  %12 = call i8* @Box$str.get(%struct.Box$str* %11)
  call void @nish_print(i8* %12)
  %13 = load %struct.Box$i32*, %struct.Box$i32** %b.addr, align 8
  %14 = call i32 @unbox$i32(%struct.Box$i32* %13)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %14

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #3 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #4 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!5, !6, !7, !8, !9}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Box$i32", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{i32 8, !"cf-protection-branch", i32 1}
!6 = !{i32 8, !"cf-protection-return", i32 1}
!7 = !{i32 8, !"branch-target-enforcement", i32 1}
!8 = !{i32 8, !"sign-return-address", i32 1}
!9 = !{i32 4, !"probe-stack", !"inline-asm"}

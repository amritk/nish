%struct.Cell = type { i32 }
%struct.Counter = type { i32 }

@.str.0 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"tick \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3

define internal void @Cell.bump(%struct.Cell* noundef nonnull align 8 dereferenceable(4) nocapture %this, i32 noundef %by) #0 {
entry:
  %0 = getelementptr inbounds %struct.Cell, %struct.Cell* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %by)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %3, i32* %0, align 4
  ret void

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal noundef i32 @Counter.tick(%struct.Counter* noundef nonnull align 8 dereferenceable(4) nocapture %this) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  %1 = load i32, i32* %0, align 4, !tbaa !4
  %2 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 1)
  %3 = extractvalue { i32, i1 } %2, 0
  %4 = extractvalue { i32, i1 } %2, 1
  br i1 %4, label %ovf.fail, label %ovf.ok

ovf.ok:
  %5 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  store i32 %3, i32* %5, align 4, !tbaa !4
  %6 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  %7 = load i32, i32* %6, align 4, !tbaa !4
  %8 = call i8* @nish_str_from_i32(i32 %7)
  %9 = call i8* @nish_str_concat(i8* bitcast ({ i64, [6 x i8] }* @.str.0 to i8*), i8* %8)
  call void @nish_print(i8* %9)
  %10 = getelementptr inbounds %struct.Counter, %struct.Counter* %this, i32 0, i32 0
  %11 = load i32, i32* %10, align 4, !tbaa !4
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %11

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @both(%struct.Counter* noundef nonnull align 8 dereferenceable(4) nocapture %t, %struct.Cell* noundef align 8 nocapture %a, %struct.Cell* noundef align 8 nocapture %z) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = icmp eq %struct.Cell* %a, null
  br i1 %0, label %chain.end, label %chain.next

chain.next:
  %1 = call i32 @Counter.tick(%struct.Counter* %t)
  call void @Cell.bump(%struct.Cell* %a, i32 %1)
  br label %chain.end

chain.end:
  %2 = icmp eq %struct.Cell* %z, null
  br i1 %2, label %chain.end.1, label %chain.next.1

chain.next.1:
  %3 = call i32 @Counter.tick(%struct.Counter* %t)
  call void @Cell.bump(%struct.Cell* %z, i32 %3)
  br label %chain.end.1

chain.end.1:
  %4 = icmp eq %struct.Cell* %a, null
  br i1 %4, label %nullish.default, label %chain.next.2

chain.next.2:
  %5 = getelementptr inbounds %struct.Cell, %struct.Cell* %a, i32 0, i32 0
  %6 = load i32, i32* %5, align 4, !tbaa !6
  br label %nullish.end

nullish.default:
  br label %nullish.end

nullish.end:
  %7 = phi i32 [ %6, %chain.next.2 ], [ -1, %nullish.default ]
  %8 = call i8* @nish_str_from_i32(i32 %7)
  %9 = call i8* @nish_str_concat(i8* %8, i8* bitcast ({ i64, [2 x i8] }* @.str.1 to i8*))
  %10 = getelementptr inbounds %struct.Counter, %struct.Counter* %t, i32 0, i32 0
  %11 = load i32, i32* %10, align 4, !tbaa !4
  %12 = call i8* @nish_str_from_i32(i32 %11)
  %13 = call i8* @nish_str_concat(i8* %9, i8* %12)
  call void @nish_print(i8* %13)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define void @nish_main() #0 {
entry:
  %Counter.obj = alloca %struct.Counter, align 8
  %Cell.obj = alloca %struct.Cell, align 8
  %0 = getelementptr inbounds %struct.Counter, %struct.Counter* %Counter.obj, i32 0, i32 0
  store i32 0, i32* %0, align 4, !tbaa !4
  %1 = getelementptr inbounds %struct.Cell, %struct.Cell* %Cell.obj, i32 0, i32 0
  store i32 0, i32* %1, align 4, !tbaa !6
  call void @both(%struct.Counter* %Counter.obj, %struct.Cell* %Cell.obj, %struct.Cell* null)
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

!nish.compat = !{!12}
!llvm.module.flags = !{!7, !8, !9, !10, !11}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"i32", !1, i64 0}
!3 = !{!"Counter", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"Cell", !2, i64 0}
!6 = !{!5, !2, i64 0}
!7 = !{i32 8, !"cf-protection-branch", i32 1}
!8 = !{i32 8, !"cf-protection-return", i32 1}
!9 = !{i32 8, !"branch-target-enforcement", i32 1}
!10 = !{i32 8, !"sign-return-address", i32 1}
!11 = !{i32 4, !"probe-stack", !"inline-asm"}
!12 = !{!"f64", !"nullish", !"optional-chaining", !"string-switch", !"for-of-string", !"optional-params", !"overloads"}

%struct.File = type { i8* }
%struct.Point = type { i32 }
%struct.Box$i32 = type { i32 }
%struct.Box$str = type { i8* }
%struct.Box$$Point = type { %struct.Point* }
%struct.Empty$str = type { i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"\00\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [89 x i8] } { i64 88, [89 x i8] c"`fopen`: argument 1 (path) holds a NUL byte, which C would read as the end of the string\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"r\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"two\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare i8* @fopen(i8*, i8*)
declare i32 @fclose(i8*)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #2
declare void @nish_free_arena() #1
declare i64 @nish_str_index_of(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #3
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #4
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #5

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #6 {
entry:
  %size.p7 = add i64 %size, 7
  %size.aligned = and i64 %size.p7, -8
  %off.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %off = load i64, i64* %off.ptr, align 8
  %new.off = add i64 %off, %size.aligned
  %cap.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 2
  %cap = load i64, i64* %cap.ptr, align 8
  %fits = icmp ule i64 %new.off, %cap
  br i1 %fits, label %fast, label %slow

fast:
  store i64 %new.off, i64* %off.ptr, align 8
  %buf.ptr = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %buf = load i8*, i8** %buf.ptr, align 8
  %obj = getelementptr inbounds i8, i8* %buf, i64 %off
  ret i8* %obj

slow:
  %grown = call i8* @nish_arena_grow(i64 %size.aligned)
  ret i8* %grown
}

define internal void @File.constructor(%struct.File* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i8* noundef nonnull noalias readonly align 8 %path) #0 {
entry:
  %0 = call i64 @nish_str_index_of(i8* %path, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %1 = icmp sge i64 %0, 0
  br i1 %1, label %ffi.nul, label %ffi.ok

ffi.nul:
  call void @nish_panic(i8* bitcast ({ i64, [89 x i8] }* @.str.1 to i8*))
  unreachable

ffi.ok:
  %2 = getelementptr inbounds i8, i8* %path, i64 8
  %3 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i64 8
  %4 = call i8* @fopen(i8* %2, i8* %3)
  %5 = getelementptr inbounds %struct.File, %struct.File* %this, i32 0, i32 0
  store i8* %4, i8** %5, align 8, !tbaa !4
  ret void
}

define internal void @Point.constructor(%struct.Point* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %x) #1 {
entry:
  %0 = getelementptr inbounds %struct.Point, %struct.Point* %this, i32 0, i32 0
  store i32 %x, i32* %0, align 4, !tbaa !7
  ret void
}

define noundef i32 @nish_main() #0 {
entry:
  %a.addr = alloca %struct.Box$i32*, align 8
  %Box$i32.obj = alloca %struct.Box$i32, align 8
  %b.addr = alloca %struct.Box$str*, align 8
  %Box$str.obj = alloca %struct.Box$str, align 8
  %c.addr = alloca %struct.Box$$Point*, align 8
  %Box$$Point.obj = alloca %struct.Box$$Point, align 8
  %e.addr = alloca %struct.Empty$str*, align 8
  %Empty$str.obj = alloca %struct.Empty$str, align 8
  call void @Box$i32.constructor(%struct.Box$i32* %Box$i32.obj, i32 40)
  store %struct.Box$i32* %Box$i32.obj, %struct.Box$i32** %a.addr, align 8
  call void @Box$str.constructor(%struct.Box$str* %Box$str.obj, i8* bitcast ({ i64, [4 x i8] }* @.str.3 to i8*))
  store %struct.Box$str* %Box$str.obj, %struct.Box$str** %b.addr, align 8
  %0 = call i8* @nish_alloc_struct(i64 4)
  %1 = bitcast i8* %0 to %struct.Point*
  call void @Point.constructor(%struct.Point* %1, i32 2)
  call void @Box$$Point.constructor(%struct.Box$$Point* %Box$$Point.obj, %struct.Point* %1)
  store %struct.Box$$Point* %Box$$Point.obj, %struct.Box$$Point** %c.addr, align 8
  %2 = getelementptr inbounds %struct.Empty$str, %struct.Empty$str* %Empty$str.obj, i32 0, i32 0
  store i32 7, i32* %2, align 4, !tbaa !9
  store %struct.Empty$str* %Empty$str.obj, %struct.Empty$str** %e.addr, align 8
  %3 = load %struct.Box$i32*, %struct.Box$i32** %a.addr, align 8
  %4 = getelementptr inbounds %struct.Box$i32, %struct.Box$i32* %3, i32 0, i32 0
  %5 = load i32, i32* %4, align 4, !tbaa !11
  %6 = load %struct.Box$$Point*, %struct.Box$$Point** %c.addr, align 8
  %7 = getelementptr inbounds %struct.Box$$Point, %struct.Box$$Point* %6, i32 0, i32 0
  %8 = load %struct.Point*, %struct.Point** %7, align 8, !tbaa !13
  %9 = getelementptr inbounds %struct.Point, %struct.Point* %8, i32 0, i32 0
  %10 = load i32, i32* %9, align 4, !tbaa !7
  %11 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %5, i32 %10)
  %12 = extractvalue { i32, i1 } %11, 0
  %13 = extractvalue { i32, i1 } %11, 1
  br i1 %13, label %ovf.fail, label %ovf.ok

ovf.ok:
  %14 = call i8* @nish_str_from_i32(i32 %12)
  call void @nish_print(i8* %14)
  %15 = load %struct.Box$str*, %struct.Box$str** %b.addr, align 8
  %16 = getelementptr inbounds %struct.Box$str, %struct.Box$str* %15, i32 0, i32 0
  %17 = load i8*, i8** %16, align 8, !tbaa !15
  call void @nish_print(i8* %17)
  %18 = load %struct.Empty$str*, %struct.Empty$str** %e.addr, align 8
  %19 = getelementptr inbounds %struct.Empty$str, %struct.Empty$str* %18, i32 0, i32 0
  %20 = load i32, i32* %19, align 4, !tbaa !9
  %21 = call i8* @nish_str_from_i32(i32 %20)
  call void @nish_print(i8* %21)
  ret i32 0

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @Box$i32.constructor(%struct.Box$i32* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %value) #1 {
entry:
  %0 = getelementptr inbounds %struct.Box$i32, %struct.Box$i32* %this, i32 0, i32 0
  store i32 %value, i32* %0, align 4, !tbaa !11
  ret void
}

define internal void @Box$str.constructor(%struct.Box$str* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i8* noundef nonnull noalias readonly align 8 %value) #1 {
entry:
  %0 = getelementptr inbounds %struct.Box$str, %struct.Box$str* %this, i32 0, i32 0
  store i8* %value, i8** %0, align 8, !tbaa !15
  ret void
}

define internal void @Box$$Point.constructor(%struct.Box$$Point* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %struct.Point* noundef nonnull align 8 dereferenceable(4) %value) #1 {
entry:
  %0 = getelementptr inbounds %struct.Box$$Point, %struct.Box$$Point* %this, i32 0, i32 0
  store %struct.Point* %value, %struct.Point** %0, align 8, !tbaa !13
  ret void
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn memory(argmem: read) "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #5 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.module.flags = !{!16, !17, !18, !19, !20}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"File", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"i32", !1, i64 0}
!6 = !{!"Point", !5, i64 0}
!7 = !{!6, !5, i64 0}
!8 = !{!"Empty$str", !5, i64 0}
!9 = !{!8, !5, i64 0}
!10 = !{!"Box$i32", !5, i64 0}
!11 = !{!10, !5, i64 0}
!12 = !{!"Box$$Point", !2, i64 0}
!13 = !{!12, !2, i64 0}
!14 = !{!"Box$str", !2, i64 0}
!15 = !{!14, !2, i64 0}
!16 = !{i32 8, !"cf-protection-branch", i32 1}
!17 = !{i32 8, !"cf-protection-return", i32 1}
!18 = !{i32 8, !"branch-target-enforcement", i32 1}
!19 = !{i32 8, !"sign-return-address", i32 1}
!20 = !{i32 4, !"probe-stack", !"inline-asm"}

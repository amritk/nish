%struct.Circle = type { i32, i32 }
%struct.Square = type { i32, i32 }
%struct.Box$un2.$Circle.$Square = type { %union.tagged* }
%union.tagged = type { i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.dbg.value(metadata, metadata, metadata)
declare void @llvm.dbg.declare(metadata, metadata, metadata)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare void @nish_free_arena() #1
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare extern_weak void @nish_panic_overflow(i32 noundef) #4
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #5

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

define internal noundef i32 @area(%union.tagged* noundef %s) #0 !dbg !15 {
entry:
  call void @llvm.dbg.value(metadata %union.tagged* %s, metadata !17, metadata !DIExpression()), !dbg !16
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %s, i32 0, i32 0, !dbg !19
  %1 = load i32, i32* %0, align 4, !dbg !19
  %2 = icmp eq i32 %1, 0, !dbg !19
  br i1 %2, label %cond.true, label %cond.false, !dbg !19

cond.true:
  %3 = bitcast %union.tagged* %s to %struct.Circle*, !dbg !22
  %4 = getelementptr inbounds %struct.Circle, %struct.Circle* %3, i32 0, i32 1, !dbg !22
  %5 = load i32, i32* %4, align 4, !tbaa !27, !dbg !22
  %6 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 3, i32 %5), !dbg !21
  %7 = extractvalue { i32, i1 } %6, 0, !dbg !21
  %8 = extractvalue { i32, i1 } %6, 1, !dbg !21
  br i1 %8, label %ovf.fail, label %ovf.ok, !dbg !21

ovf.ok:
  %9 = bitcast %union.tagged* %s to %struct.Circle*, !dbg !28
  %10 = getelementptr inbounds %struct.Circle, %struct.Circle* %9, i32 0, i32 1, !dbg !28
  %11 = load i32, i32* %10, align 4, !tbaa !27, !dbg !28
  %12 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %7, i32 %11), !dbg !21
  %13 = extractvalue { i32, i1 } %12, 0, !dbg !21
  %14 = extractvalue { i32, i1 } %12, 1, !dbg !21
  br i1 %14, label %ovf.fail, label %ovf.ok.1, !dbg !21

ovf.ok.1:
  br label %cond.end, !dbg !19

cond.false:
  %15 = bitcast %union.tagged* %s to %struct.Square*, !dbg !29
  %16 = getelementptr inbounds %struct.Square, %struct.Square* %15, i32 0, i32 1, !dbg !29
  %17 = load i32, i32* %16, align 4, !tbaa !31, !dbg !29
  %18 = bitcast %union.tagged* %s to %struct.Square*, !dbg !32
  %19 = getelementptr inbounds %struct.Square, %struct.Square* %18, i32 0, i32 1, !dbg !32
  %20 = load i32, i32* %19, align 4, !tbaa !31, !dbg !32
  %21 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %17, i32 %20), !dbg !29
  %22 = extractvalue { i32, i1 } %21, 0, !dbg !29
  %23 = extractvalue { i32, i1 } %21, 1, !dbg !29
  br i1 %23, label %ovf.fail.1, label %ovf.ok.2, !dbg !29

ovf.ok.2:
  br label %cond.end, !dbg !19

cond.end:
  %24 = phi i32 [ %13, %ovf.ok.1 ], [ %22, %ovf.ok.2 ], !dbg !19
  ret i32 %24, !dbg !16

ovf.fail:
  call void @nish_panic_overflow(i32 2), !dbg !21
  unreachable

ovf.fail.1:
  call void @nish_panic_overflow(i32 2), !dbg !29
  unreachable
}

define void @nish_main() #0 !dbg !35 {
entry:
  %b.addr = alloca %struct.Box$un2.$Circle.$Square*, align 8
  %Box$un2.$Circle.$Square.obj = alloca %struct.Box$un2.$Circle.$Square, align 8
  %0 = call i8* @nish_alloc_struct(i64 8), !dbg !39
  %1 = bitcast i8* %0 to %struct.Circle*, !dbg !39
  %2 = getelementptr inbounds %struct.Circle, %struct.Circle* %1, i32 0, i32 0, !dbg !39
  store i32 0, i32* %2, align 4, !tbaa !40, !dbg !39
  %3 = getelementptr inbounds %struct.Circle, %struct.Circle* %1, i32 0, i32 1, !dbg !39
  store i32 2, i32* %3, align 4, !tbaa !27, !dbg !39
  %4 = bitcast %struct.Circle* %1 to %union.tagged*, !dbg !39
  call void @Box$un2.$Circle.$Square.constructor(%struct.Box$un2.$Circle.$Square* %Box$un2.$Circle.$Square.obj, %union.tagged* %4), !dbg !38
  store %struct.Box$un2.$Circle.$Square* %Box$un2.$Circle.$Square.obj, %struct.Box$un2.$Circle.$Square** %b.addr, align 8, !dbg !37
  call void @llvm.dbg.declare(metadata %struct.Box$un2.$Circle.$Square** %b.addr, metadata !45, metadata !DIExpression()), !dbg !37
  %5 = load %struct.Box$un2.$Circle.$Square*, %struct.Box$un2.$Circle.$Square** %b.addr, align 8, !dbg !48
  %6 = call %union.tagged* @Box$un2.$Circle.$Square.get(%struct.Box$un2.$Circle.$Square* %5), !dbg !48
  %7 = call i32 @area(%union.tagged* %6), !dbg !47
  %8 = call i8* @nish_str_from_i32(i32 %7), !dbg !46
  call void @nish_print(i8* %8), !dbg !46
  %9 = load %struct.Box$un2.$Circle.$Square*, %struct.Box$un2.$Circle.$Square** %b.addr, align 8, !dbg !49
  %10 = call i8* @nish_alloc_struct(i64 8), !dbg !50
  %11 = bitcast i8* %10 to %struct.Square*, !dbg !50
  %12 = getelementptr inbounds %struct.Square, %struct.Square* %11, i32 0, i32 0, !dbg !50
  store i32 1, i32* %12, align 4, !tbaa !51, !dbg !50
  %13 = getelementptr inbounds %struct.Square, %struct.Square* %11, i32 0, i32 1, !dbg !50
  store i32 3, i32* %13, align 4, !tbaa !31, !dbg !50
  %14 = bitcast %struct.Square* %11 to %union.tagged*, !dbg !50
  call void @Box$un2.$Circle.$Square.put(%struct.Box$un2.$Circle.$Square* %9, %union.tagged* %14), !dbg !49
  %15 = load %struct.Box$un2.$Circle.$Square*, %struct.Box$un2.$Circle.$Square** %b.addr, align 8, !dbg !54
  %16 = call %union.tagged* @Box$un2.$Circle.$Square.get(%struct.Box$un2.$Circle.$Square* %15), !dbg !54
  %17 = call i32 @area(%union.tagged* %16), !dbg !53
  %18 = call i8* @nish_str_from_i32(i32 %17), !dbg !52
  call void @nish_print(i8* %18), !dbg !52
  ret void, !dbg !36
}

define internal void @Box$un2.$Circle.$Square.constructor(%struct.Box$un2.$Circle.$Square* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, %union.tagged* noundef %value) #1 !dbg !57 {
entry:
  call void @llvm.dbg.value(metadata %struct.Box$un2.$Circle.$Square* %this, metadata !59, metadata !DIExpression()), !dbg !58
  call void @llvm.dbg.value(metadata %union.tagged* %value, metadata !60, metadata !DIExpression()), !dbg !58
  %0 = getelementptr inbounds %struct.Box$un2.$Circle.$Square, %struct.Box$un2.$Circle.$Square* %this, i32 0, i32 0, !dbg !61
  store %union.tagged* %value, %union.tagged** %0, align 8, !tbaa !65, !dbg !61
  ret void, !dbg !58
}

define internal noundef %union.tagged* @Box$un2.$Circle.$Square.get(%struct.Box$un2.$Circle.$Square* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #2 !dbg !68 {
entry:
  call void @llvm.dbg.value(metadata %struct.Box$un2.$Circle.$Square* %this, metadata !70, metadata !DIExpression()), !dbg !69
  %0 = getelementptr inbounds %struct.Box$un2.$Circle.$Square, %struct.Box$un2.$Circle.$Square* %this, i32 0, i32 0, !dbg !72
  %1 = load %union.tagged*, %union.tagged** %0, align 8, !tbaa !65, !dbg !72
  ret %union.tagged* %1, !dbg !71
}

define internal void @Box$un2.$Circle.$Square.put(%struct.Box$un2.$Circle.$Square* noundef nonnull align 8 dereferenceable(8) nocapture %this, %union.tagged* noundef %value) #1 !dbg !73 {
entry:
  call void @llvm.dbg.value(metadata %struct.Box$un2.$Circle.$Square* %this, metadata !75, metadata !DIExpression()), !dbg !74
  call void @llvm.dbg.value(metadata %union.tagged* %value, metadata !76, metadata !DIExpression()), !dbg !74
  %0 = getelementptr inbounds %struct.Box$un2.$Circle.$Square, %struct.Box$un2.$Circle.$Square* %this, i32 0, i32 0, !dbg !77
  store %union.tagged* %value, %union.tagged** %0, align 8, !tbaa !65, !dbg !77
  ret void, !dbg !74
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 !dbg !81 {
entry:
  call void @nish_main(), !dbg !82
  call void @nish_free_arena(), !dbg !82
  ret i32 0, !dbg !82
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind willreturn readonly "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) "probe-stack"="inline-asm" }
attributes #4 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #5 = { nounwind willreturn readnone "probe-stack"="inline-asm" }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) "probe-stack"="inline-asm" }

!llvm.dbg.cu = !{!0}
!llvm.module.flags = !{!2, !3, !83, !84, !85, !86, !87}
!0 = distinct !DICompileUnit(language: DW_LANG_C99, file: !1, producer: "nish <version>", isOptimized: false, runtimeVersion: 0, emissionKind: FullDebug)
!1 = !DIFile(filename: "<root>/tests/cases/dbg_union_generic.ts", directory: ".")
!2 = !{i32 7, !"Dwarf Version", i32 5}
!3 = !{i32 2, !"Debug Info Version", i32 3}
!4 = !DIBasicType(name: "int", size: 32, encoding: DW_ATE_signed)
!5 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "Circle | Square", file: !1, size: 32, align: 32, elements: !11)
!6 = !DIEnumerator(name: "Circle", value: 0)
!7 = !DIEnumerator(name: "Square", value: 1)
!8 = !{!6, !7}
!9 = !DICompositeType(tag: DW_TAG_enumeration_type, name: "Kind", file: !1, line: 5, size: 32, align: 32, elements: !8, baseType: !4)
!10 = !DIDerivedType(tag: DW_TAG_member, name: "kind", scope: !5, baseType: !9, size: 32, offset: 0)
!11 = !{!10}
!12 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !5, size: 64)
!13 = !{!4, !12}
!14 = !DISubroutineType(types: !13)
!15 = distinct !DISubprogram(name: "area", linkageName: "area", scope: !1, file: !1, line: 35, type: !14, scopeLine: 35, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!16 = !DILocation(line: 35, column: 1, scope: !15)
!17 = !DILocalVariable(name: "s", arg: 1, scope: !15, file: !1, line: 35, type: !12)
!18 = !DILocation(line: 35, column: 33, scope: !15)
!19 = !DILocation(line: 35, column: 34, scope: !15)
!20 = !DILocation(line: 35, column: 45, scope: !15)
!21 = !DILocation(line: 35, column: 59, scope: !15)
!22 = !DILocation(line: 35, column: 63, scope: !15)
!23 = !{!"nish TBAA"}
!24 = !{!"omnipotent char", !23, i64 0}
!25 = !{!"i32", !24, i64 0}
!26 = !{!"Circle", !25, i64 0, !25, i64 4}
!27 = !{!26, !25, i64 4}
!28 = !DILocation(line: 35, column: 69, scope: !15)
!29 = !DILocation(line: 35, column: 75, scope: !15)
!30 = !{!"Square", !25, i64 0, !25, i64 4}
!31 = !{!30, !25, i64 4}
!32 = !DILocation(line: 35, column: 84, scope: !15)
!33 = !{null}
!34 = !DISubroutineType(types: !33)
!35 = distinct !DISubprogram(name: "main", linkageName: "nish_main", scope: !1, file: !1, line: 37, type: !34, scopeLine: 37, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition, unit: !0)
!36 = !DILocation(line: 37, column: 1, scope: !35)
!37 = !DILocation(line: 38, column: 3, scope: !35)
!38 = !DILocation(line: 38, column: 13, scope: !35)
!39 = !DILocation(line: 38, column: 28, scope: !35)
!40 = !{!26, !25, i64 0}
!41 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "Box<Circle | Square>", file: !1, line: 22, size: 64, align: 64, elements: !44)
!42 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !41, size: 64)
!43 = !DIDerivedType(tag: DW_TAG_member, name: "value", scope: !41, file: !1, line: 23, baseType: !12, size: 64, offset: 0)
!44 = !{!43}
!45 = !DILocalVariable(name: "b", scope: !35, file: !1, line: 38, type: !42)
!46 = !DILocation(line: 39, column: 3, scope: !35)
!47 = !DILocation(line: 39, column: 15, scope: !35)
!48 = !DILocation(line: 39, column: 20, scope: !35)
!49 = !DILocation(line: 40, column: 3, scope: !35)
!50 = !DILocation(line: 40, column: 9, scope: !35)
!51 = !{!30, !25, i64 0}
!52 = !DILocation(line: 41, column: 3, scope: !35)
!53 = !DILocation(line: 41, column: 15, scope: !35)
!54 = !DILocation(line: 41, column: 20, scope: !35)
!55 = !{null, !42, !12}
!56 = !DISubroutineType(types: !55)
!57 = distinct !DISubprogram(name: "Box<Circle | Square>.constructor", linkageName: "Box$un2.$Circle.$Square.constructor", scope: !1, file: !1, line: 24, type: !56, scopeLine: 24, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!58 = !DILocation(line: 24, column: 3, scope: !57)
!59 = !DILocalVariable(name: "this", arg: 1, scope: !57, file: !1, line: 24, type: !42, flags: DIFlagArtificial | DIFlagObjectPointer)
!60 = !DILocalVariable(name: "value", arg: 2, scope: !57, file: !1, line: 24, type: !12)
!61 = !DILocation(line: 25, column: 5, scope: !57)
!62 = !DILocation(line: 25, column: 18, scope: !57)
!63 = !{!"ptr", !24, i64 0}
!64 = !{!"Box$un2.$Circle.$Square", !63, i64 0}
!65 = !{!64, !63, i64 0}
!66 = !{!12, !42}
!67 = !DISubroutineType(types: !66)
!68 = distinct !DISubprogram(name: "Box<Circle | Square>.get", linkageName: "Box$un2.$Circle.$Square.get", scope: !1, file: !1, line: 27, type: !67, scopeLine: 27, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!69 = !DILocation(line: 27, column: 3, scope: !68)
!70 = !DILocalVariable(name: "this", arg: 1, scope: !68, file: !1, line: 27, type: !42, flags: DIFlagArtificial | DIFlagObjectPointer)
!71 = !DILocation(line: 28, column: 5, scope: !68)
!72 = !DILocation(line: 28, column: 12, scope: !68)
!73 = distinct !DISubprogram(name: "Box<Circle | Square>.put", linkageName: "Box$un2.$Circle.$Square.put", scope: !1, file: !1, line: 30, type: !56, scopeLine: 30, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!74 = !DILocation(line: 30, column: 3, scope: !73)
!75 = !DILocalVariable(name: "this", arg: 1, scope: !73, file: !1, line: 30, type: !42, flags: DIFlagArtificial | DIFlagObjectPointer)
!76 = !DILocalVariable(name: "value", arg: 2, scope: !73, file: !1, line: 30, type: !12)
!77 = !DILocation(line: 31, column: 5, scope: !73)
!78 = !DILocation(line: 31, column: 18, scope: !73)
!79 = !{!4}
!80 = !DISubroutineType(types: !79)
!81 = distinct !DISubprogram(name: "main", linkageName: "main", scope: !1, file: !1, line: 37, type: !80, scopeLine: 37, flags: DIFlagPrototyped | DIFlagArtificial, spFlags: DISPFlagDefinition, unit: !0)
!82 = !DILocation(line: 37, column: 1, scope: !81)
!83 = !{i32 8, !"cf-protection-branch", i32 1}
!84 = !{i32 8, !"cf-protection-return", i32 1}
!85 = !{i32 8, !"branch-target-enforcement", i32 1}
!86 = !{i32 8, !"sign-return-address", i32 1}
!87 = !{i32 4, !"probe-stack", !"inline-asm"}

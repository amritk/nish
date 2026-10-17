%struct.Dot = type { i32, i32 }
%struct.Box = type { i32, i32 }
%struct.Sheet = type { %union.tagged*, %struct.nish_array*, %union.tagged* }
%struct.nish_array = type { i64, i64, i8* }
%union.tagged = type { i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.dbg.value(metadata, metadata, metadata)
declare void @llvm.dbg.declare(metadata, metadata, metadata)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3
declare noundef i64 @nish_arena_mark() #0
declare void @nish_arena_release(i64 noundef) #0
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #2
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #0

define internal noalias noundef nonnull align 8 i8* @nish_alloc_struct(i64 noundef %size) #4 {
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

define internal void @Sheet.constructor(%struct.Sheet* noundef nonnull noalias align 8 dereferenceable(24) nocapture %this, %union.tagged* noundef %first) #0 !dbg !29 {
entry:
  call void @llvm.dbg.value(metadata %struct.Sheet* %this, metadata !31, metadata !DIExpression()), !dbg !30
  call void @llvm.dbg.value(metadata %union.tagged* %first, metadata !32, metadata !DIExpression()), !dbg !30
  %0 = getelementptr inbounds %struct.Sheet, %struct.Sheet* %this, i32 0, i32 0, !dbg !33
  store %union.tagged* %first, %union.tagged** %0, align 8, !tbaa !39, !dbg !33
  %1 = call i8* @nish_alloc_struct(i64 24), !dbg !41
  %2 = bitcast i8* %1 to %struct.nish_array*, !dbg !41
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 0, !dbg !41
  store i64 0, i64* %3, align 8, !alias.scope !45, !noalias !46, !tbaa !50, !dbg !41
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 1, !dbg !41
  store i64 0, i64* %4, align 8, !alias.scope !45, !noalias !46, !tbaa !51, !dbg !41
  %5 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %2, i64 0, i32 2, !dbg !41
  store i8* null, i8** %5, align 8, !alias.scope !45, !noalias !46, !tbaa !52, !dbg !41
  %6 = getelementptr inbounds %struct.Sheet, %struct.Sheet* %this, i32 0, i32 1, !dbg !40
  store %struct.nish_array* %2, %struct.nish_array** %6, align 8, !tbaa !53, !dbg !40
  %7 = getelementptr inbounds %struct.Sheet, %struct.Sheet* %this, i32 0, i32 2, !dbg !54
  store %union.tagged* null, %union.tagged** %7, align 8, !tbaa !56, !dbg !54
  ret void, !dbg !30
}

define internal noundef %union.tagged* @dotOf(i32 noundef %x) #0 !dbg !59 {
entry:
  %dot.addr = alloca %struct.Dot*, align 8
  call void @llvm.dbg.value(metadata i32 %x, metadata !61, metadata !DIExpression()), !dbg !60
  %0 = call i8* @nish_alloc_struct(i64 8), !dbg !63
  %1 = bitcast i8* %0 to %struct.Dot*, !dbg !63
  %2 = getelementptr inbounds %struct.Dot, %struct.Dot* %1, i32 0, i32 0, !dbg !63
  store i32 0, i32* %2, align 4, !dbg !63
  %3 = getelementptr inbounds %struct.Dot, %struct.Dot* %1, i32 0, i32 1, !dbg !63
  store i32 %x, i32* %3, align 4, !dbg !63
  store %struct.Dot* %1, %struct.Dot** %dot.addr, align 8, !dbg !62
  call void @llvm.dbg.declare(metadata %struct.Dot** %dot.addr, metadata !71, metadata !DIExpression()), !dbg !62
  %4 = load %struct.Dot*, %struct.Dot** %dot.addr, align 8, !dbg !73
  %5 = bitcast %struct.Dot* %4 to %union.tagged*, !dbg !73
  ret %union.tagged* %5, !dbg !72
}

define internal noundef i32 @tagOf(%union.tagged* noundef %m) #1 !dbg !76 {
entry:
  call void @llvm.dbg.value(metadata %union.tagged* %m, metadata !78, metadata !DIExpression()), !dbg !77
  %0 = getelementptr inbounds %union.tagged, %union.tagged* %m, i32 0, i32 0, !dbg !80
  %1 = load i32, i32* %0, align 4, !dbg !80
  %2 = icmp eq i32 %1, 0, !dbg !80
  br i1 %2, label %cond.true, label %cond.false, !dbg !80

cond.true:
  br label %cond.end, !dbg !80

cond.false:
  br label %cond.end, !dbg !80

cond.end:
  %3 = phi i32 [ 1, %cond.true ], [ 2, %cond.false ], !dbg !80
  ret i32 %3, !dbg !77
}

define noundef i32 @test() #2 !dbg !86 {
entry:
  %local.addr = alloca %union.tagged*, align 8
  %sheet.addr = alloca %struct.Sheet*, align 8
  %Sheet.obj = alloca %struct.Sheet, align 8
  %arena.mark = call i64 @nish_arena_mark(), !dbg !87
  %0 = call %union.tagged* @dotOf(i32 1), !dbg !89
  store %union.tagged* %0, %union.tagged** %local.addr, align 8, !dbg !88
  call void @llvm.dbg.declare(metadata %union.tagged** %local.addr, metadata !91, metadata !DIExpression()), !dbg !88
  %1 = call i8* @nish_alloc_struct(i64 8), !dbg !94
  %2 = bitcast i8* %1 to %struct.Box*, !dbg !94
  %3 = getelementptr inbounds %struct.Box, %struct.Box* %2, i32 0, i32 0, !dbg !94
  store i32 1, i32* %3, align 4, !tbaa !97, !dbg !94
  %4 = getelementptr inbounds %struct.Box, %struct.Box* %2, i32 0, i32 1, !dbg !94
  store i32 2, i32* %4, align 4, !tbaa !98, !dbg !94
  %5 = bitcast %struct.Box* %2 to %union.tagged*, !dbg !94
  call void @Sheet.constructor(%struct.Sheet* %Sheet.obj, %union.tagged* %5), !dbg !93
  store %struct.Sheet* %Sheet.obj, %struct.Sheet** %sheet.addr, align 8, !dbg !92
  call void @llvm.dbg.declare(metadata %struct.Sheet** %sheet.addr, metadata !99, metadata !DIExpression()), !dbg !92
  %6 = load %struct.Sheet*, %struct.Sheet** %sheet.addr, align 8, !dbg !100
  %7 = getelementptr inbounds %struct.Sheet, %struct.Sheet* %6, i32 0, i32 1, !dbg !100
  %8 = load %struct.nish_array*, %struct.nish_array** %7, align 8, !tbaa !53, !dbg !100
  %9 = load %union.tagged*, %union.tagged** %local.addr, align 8, !dbg !101
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 0, !dbg !100
  %11 = load i64, i64* %10, align 8, !alias.scope !45, !noalias !46, !tbaa !50, !dbg !100
  %12 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 1, !dbg !100
  %13 = load i64, i64* %12, align 8, !alias.scope !45, !noalias !46, !tbaa !51, !dbg !100
  %14 = icmp eq i64 %11, %13, !dbg !100
  br i1 %14, label %push.grow, label %push.store, !dbg !100

push.grow:
  call void @nish_array_grow(%struct.nish_array* %8, i64 8), !dbg !100
  br label %push.store, !dbg !100

push.store:
  %15 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %8, i64 0, i32 2, !dbg !100
  %16 = load i8*, i8** %15, align 8, !alias.scope !45, !noalias !46, !tbaa !52, !dbg !100
  %17 = bitcast i8* %16 to %union.tagged**, !dbg !100
  %18 = getelementptr inbounds %union.tagged*, %union.tagged** %17, i64 %11, !dbg !100
  store %union.tagged* %9, %union.tagged** %18, align 8, !alias.scope !46, !noalias !45, !tbaa !103, !dbg !100
  %19 = add i64 %11, 1, !dbg !100
  store i64 %19, i64* %10, align 8, !alias.scope !45, !noalias !46, !tbaa !50, !dbg !100
  %20 = trunc i64 %19 to i32, !dbg !100
  %21 = load %struct.Sheet*, %struct.Sheet** %sheet.addr, align 8, !dbg !104
  %22 = load %union.tagged*, %union.tagged** %local.addr, align 8, !dbg !105
  %23 = getelementptr inbounds %struct.Sheet, %struct.Sheet* %21, i32 0, i32 2, !dbg !104
  store %union.tagged* %22, %union.tagged** %23, align 8, !tbaa !56, !dbg !104
  %24 = load %union.tagged*, %union.tagged** %local.addr, align 8, !dbg !109
  %25 = call i32 @tagOf(%union.tagged* %24), !dbg !108
  %26 = call i8* @nish_str_from_i32(i32 %25), !dbg !107
  %27 = call i8* @nish_str_concat(i8* %26, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*)), !dbg !107
  %28 = load %struct.Sheet*, %struct.Sheet** %sheet.addr, align 8, !dbg !111
  %29 = getelementptr inbounds %struct.Sheet, %struct.Sheet* %28, i32 0, i32 0, !dbg !111
  %30 = load %union.tagged*, %union.tagged** %29, align 8, !tbaa !39, !dbg !111
  %31 = call i32 @tagOf(%union.tagged* %30), !dbg !110
  %32 = call i8* @nish_str_from_i32(i32 %31), !dbg !107
  %33 = call i8* @nish_str_concat(i8* %27, i8* %32), !dbg !107
  %34 = call i8* @nish_str_concat(i8* %33, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*)), !dbg !107
  %35 = load %struct.Sheet*, %struct.Sheet** %sheet.addr, align 8, !dbg !112
  %36 = getelementptr inbounds %struct.Sheet, %struct.Sheet* %35, i32 0, i32 1, !dbg !112
  %37 = load %struct.nish_array*, %struct.nish_array** %36, align 8, !tbaa !53, !dbg !112
  %38 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %37, i64 0, i32 0, !dbg !112
  %39 = load i64, i64* %38, align 8, !alias.scope !45, !noalias !46, !tbaa !50, !dbg !112
  %40 = trunc i64 %39 to i32, !dbg !112
  %41 = call i8* @nish_str_from_i32(i32 %40), !dbg !107
  %42 = call i8* @nish_str_concat(i8* %34, i8* %41), !dbg !107
  %43 = call i8* @nish_str_concat(i8* %42, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*)), !dbg !107
  %44 = load %struct.Sheet*, %struct.Sheet** %sheet.addr, align 8, !dbg !113
  %45 = getelementptr inbounds %struct.Sheet, %struct.Sheet* %44, i32 0, i32 2, !dbg !113
  %46 = load %union.tagged*, %union.tagged** %45, align 8, !tbaa !56, !dbg !113
  %47 = icmp eq %union.tagged* %46, null, !dbg !113
  %48 = select i1 %47, i8* bitcast ({ i64, [5 x i8] }* @.str.1 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.2 to i8*), !dbg !107
  %49 = call i8* @nish_str_concat(i8* %43, i8* %48), !dbg !107
  call void @nish_print(i8* %49), !dbg !106
  call void @nish_arena_release(i64 %arena.mark), !dbg !115
  ret i32 0, !dbg !115
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!llvm.dbg.cu = !{!0}
!llvm.module.flags = !{!2, !3}
!0 = distinct !DICompileUnit(language: DW_LANG_C99, file: !1, producer: "nish <version>", isOptimized: false, runtimeVersion: 0, emissionKind: FullDebug)
!1 = !DIFile(filename: "<root>/tests/cases/dbg_union.ts", directory: ".")
!2 = !{i32 7, !"Dwarf Version", i32 5}
!3 = !{i32 2, !"Debug Info Version", i32 3}
!4 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "Sheet", file: !1, line: 22, size: 192, align: 64, elements: !26)
!5 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !4, size: 64)
!6 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "Dot | Box", file: !1, size: 32, align: 32, elements: !13)
!7 = !DIEnumerator(name: "Dot", value: 0)
!8 = !DIEnumerator(name: "Box", value: 1)
!9 = !{!7, !8}
!10 = !DIBasicType(name: "int", size: 32, encoding: DW_ATE_signed)
!11 = !DICompositeType(tag: DW_TAG_enumeration_type, name: "Kind", file: !1, line: 5, size: 32, align: 32, elements: !9, baseType: !10)
!12 = !DIDerivedType(tag: DW_TAG_member, name: "kind", scope: !6, baseType: !11, size: 32, offset: 0)
!13 = !{!12}
!14 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !6, size: 64)
!15 = !DIDerivedType(tag: DW_TAG_member, name: "first", scope: !4, file: !1, line: 23, baseType: !14, size: 64, offset: 0)
!16 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "(Dot | Box)[]", file: !1, size: 192, align: 64, elements: !22)
!17 = !DIBasicType(name: "long", size: 64, encoding: DW_ATE_signed)
!18 = !DIDerivedType(tag: DW_TAG_member, name: "len", scope: !16, baseType: !17, size: 64, offset: 0)
!19 = !DIDerivedType(tag: DW_TAG_member, name: "cap", scope: !16, baseType: !17, size: 64, offset: 64)
!20 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !14, size: 64)
!21 = !DIDerivedType(tag: DW_TAG_member, name: "data", scope: !16, baseType: !20, size: 64, offset: 128)
!22 = !{!18, !19, !21}
!23 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !16, size: 64)
!24 = !DIDerivedType(tag: DW_TAG_member, name: "rest", scope: !4, file: !1, line: 24, baseType: !23, size: 64, offset: 64)
!25 = !DIDerivedType(tag: DW_TAG_member, name: "spare", scope: !4, file: !1, line: 25, baseType: !14, size: 64, offset: 128)
!26 = !{!15, !24, !25}
!27 = !{null, !5, !14}
!28 = !DISubroutineType(types: !27)
!29 = distinct !DISubprogram(name: "Sheet.constructor", linkageName: "Sheet.constructor", scope: !1, file: !1, line: 26, type: !28, scopeLine: 26, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!30 = !DILocation(line: 26, column: 3, scope: !29)
!31 = !DILocalVariable(name: "this", arg: 1, scope: !29, file: !1, line: 26, type: !5, flags: DIFlagArtificial | DIFlagObjectPointer)
!32 = !DILocalVariable(name: "first", arg: 2, scope: !29, file: !1, line: 26, type: !14)
!33 = !DILocation(line: 27, column: 5, scope: !29)
!34 = !DILocation(line: 27, column: 18, scope: !29)
!35 = !{!"nish TBAA"}
!36 = !{!"omnipotent char", !35, i64 0}
!37 = !{!"ptr", !36, i64 0}
!38 = !{!"Sheet", !37, i64 0, !37, i64 8, !37, i64 16}
!39 = !{!38, !37, i64 0}
!40 = !DILocation(line: 28, column: 5, scope: !29)
!41 = !DILocation(line: 28, column: 17, scope: !29)
!42 = !{!"nish array"}
!43 = !{!"header", !42}
!44 = !{!"elements", !42}
!45 = !{!43}
!46 = !{!44}
!47 = !{!"header i64", !36, i64 0}
!48 = !{!"header ptr", !36, i64 0}
!49 = !{!"array header", !47, i64 0, !47, i64 8, !48, i64 16}
!50 = !{!49, !47, i64 0}
!51 = !{!49, !47, i64 8}
!52 = !{!49, !48, i64 16}
!53 = !{!38, !37, i64 8}
!54 = !DILocation(line: 29, column: 5, scope: !29)
!55 = !DILocation(line: 29, column: 18, scope: !29)
!56 = !{!38, !37, i64 16}
!57 = !{!14, !10}
!58 = !DISubroutineType(types: !57)
!59 = distinct !DISubprogram(name: "dotOf", linkageName: "dotOf", scope: !1, file: !1, line: 33, type: !58, scopeLine: 33, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!60 = !DILocation(line: 33, column: 1, scope: !59)
!61 = !DILocalVariable(name: "x", arg: 1, scope: !59, file: !1, line: 33, type: !10)
!62 = !DILocation(line: 34, column: 3, scope: !59)
!63 = !DILocation(line: 34, column: 20, scope: !59)
!64 = !DILocation(line: 34, column: 28, scope: !59)
!65 = !DILocation(line: 34, column: 41, scope: !59)
!66 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "Dot", file: !1, line: 10, size: 64, align: 32, elements: !70)
!67 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !66, size: 64)
!68 = !DIDerivedType(tag: DW_TAG_member, name: "kind", scope: !66, file: !1, line: 11, baseType: !11, size: 32, offset: 0)
!69 = !DIDerivedType(tag: DW_TAG_member, name: "x", scope: !66, file: !1, line: 12, baseType: !10, size: 32, offset: 32)
!70 = !{!68, !69}
!71 = !DILocalVariable(name: "dot", scope: !59, file: !1, line: 34, type: !67)
!72 = !DILocation(line: 35, column: 3, scope: !59)
!73 = !DILocation(line: 35, column: 10, scope: !59)
!74 = !{!10, !14}
!75 = !DISubroutineType(types: !74)
!76 = distinct !DISubprogram(name: "tagOf", linkageName: "tagOf", scope: !1, file: !1, line: 38, type: !75, scopeLine: 38, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!77 = !DILocation(line: 38, column: 1, scope: !76)
!78 = !DILocalVariable(name: "m", arg: 1, scope: !76, file: !1, line: 38, type: !14)
!79 = !DILocation(line: 38, column: 33, scope: !76)
!80 = !DILocation(line: 38, column: 34, scope: !76)
!81 = !DILocation(line: 38, column: 45, scope: !76)
!82 = !DILocation(line: 38, column: 56, scope: !76)
!83 = !DILocation(line: 38, column: 60, scope: !76)
!84 = !{!10}
!85 = !DISubroutineType(types: !84)
!86 = distinct !DISubprogram(name: "test", linkageName: "test", scope: !1, file: !1, line: 40, type: !85, scopeLine: 40, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition, unit: !0)
!87 = !DILocation(line: 40, column: 1, scope: !86)
!88 = !DILocation(line: 41, column: 3, scope: !86)
!89 = !DILocation(line: 41, column: 23, scope: !86)
!90 = !DILocation(line: 41, column: 29, scope: !86)
!91 = !DILocalVariable(name: "local", scope: !86, file: !1, line: 41, type: !14)
!92 = !DILocation(line: 42, column: 3, scope: !86)
!93 = !DILocation(line: 42, column: 17, scope: !86)
!94 = !DILocation(line: 42, column: 27, scope: !86)
!95 = !{!"i32", !36, i64 0}
!96 = !{!"Box", !95, i64 0, !95, i64 4}
!97 = !{!96, !95, i64 0}
!98 = !{!96, !95, i64 4}
!99 = !DILocalVariable(name: "sheet", scope: !86, file: !1, line: 42, type: !5)
!100 = !DILocation(line: 43, column: 3, scope: !86)
!101 = !DILocation(line: 43, column: 19, scope: !86)
!102 = !{!"element ptr", !36, i64 0}
!103 = !{!102, !102, i64 0}
!104 = !DILocation(line: 44, column: 3, scope: !86)
!105 = !DILocation(line: 44, column: 17, scope: !86)
!106 = !DILocation(line: 45, column: 3, scope: !86)
!107 = !DILocation(line: 45, column: 15, scope: !86)
!108 = !DILocation(line: 45, column: 18, scope: !86)
!109 = !DILocation(line: 45, column: 24, scope: !86)
!110 = !DILocation(line: 45, column: 34, scope: !86)
!111 = !DILocation(line: 45, column: 40, scope: !86)
!112 = !DILocation(line: 45, column: 56, scope: !86)
!113 = !DILocation(line: 45, column: 77, scope: !86)
!114 = !DILocation(line: 45, column: 93, scope: !86)
!115 = !DILocation(line: 46, column: 3, scope: !86)
!116 = !DILocation(line: 46, column: 10, scope: !86)

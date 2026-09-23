%struct.Box$i32 = type { i32 }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"ok\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.dbg.value(metadata, metadata, metadata)
declare void @llvm.dbg.declare(metadata, metadata, metadata)
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #3

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

define noundef i32 @test() #0 !dbg !7 {
entry:
  %b.addr = alloca %struct.Box$i32*, align 8
  %s.addr = alloca i8*, align 8
  %c.addr = alloca %struct.Box$i32*, align 8
  %0 = call i8* @nish_alloc_struct(i64 4), !dbg !10
  %1 = bitcast i8* %0 to %struct.Box$i32*, !dbg !10
  %2 = call i32 @identity$i32(i32 40), !dbg !11
  call void @Box$i32.constructor(%struct.Box$i32* %1, i32 %2), !dbg !10
  store %struct.Box$i32* %1, %struct.Box$i32** %b.addr, align 8, !dbg !9
  call void @llvm.dbg.declare(metadata %struct.Box$i32** %b.addr, metadata !17, metadata !DIExpression()), !dbg !9
  %3 = call i8* @identity$str(i8* bitcast ({ i64, [3 x i8] }* @.str.0 to i8*)), !dbg !19
  store i8* %3, i8** %s.addr, align 8, !dbg !18
  call void @llvm.dbg.declare(metadata i8** %s.addr, metadata !23, metadata !DIExpression()), !dbg !18
  %4 = load %struct.Box$i32*, %struct.Box$i32** %b.addr, align 8, !dbg !26
  %5 = call %struct.Box$i32* @identity$$Box$i32(%struct.Box$i32* %4), !dbg !25
  store %struct.Box$i32* %5, %struct.Box$i32** %c.addr, align 8, !dbg !24
  call void @llvm.dbg.declare(metadata %struct.Box$i32** %c.addr, metadata !27, metadata !DIExpression()), !dbg !24
  %6 = load %struct.Box$i32*, %struct.Box$i32** %c.addr, align 8, !dbg !29
  %7 = call i32 @Box$i32.get(%struct.Box$i32* %6), !dbg !29
  %8 = load i8*, i8** %s.addr, align 8, !dbg !30
  %9 = bitcast i8* %8 to i64*, !dbg !30
  %10 = load i64, i64* %9, align 8, !dbg !30
  %11 = trunc i64 %10 to i32, !dbg !30
  %12 = add nsw i32 %7, %11, !dbg !29
  ret i32 %12, !dbg !28
}

define internal void @Box$i32.constructor(%struct.Box$i32* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this, i32 noundef %value) #0 !dbg !33 {
entry:
  call void @llvm.dbg.value(metadata %struct.Box$i32* %this, metadata !35, metadata !DIExpression()), !dbg !34
  call void @llvm.dbg.value(metadata i32 %value, metadata !36, metadata !DIExpression()), !dbg !34
  %0 = getelementptr inbounds %struct.Box$i32, %struct.Box$i32* %this, i32 0, i32 0, !dbg !37
  store i32 %value, i32* %0, align 4, !tbaa !43, !dbg !37
  ret void, !dbg !34
}

define internal noundef i32 @Box$i32.get(%struct.Box$i32* noundef nonnull readonly align 8 dereferenceable(4) nocapture %this) #1 !dbg !46 {
entry:
  call void @llvm.dbg.value(metadata %struct.Box$i32* %this, metadata !48, metadata !DIExpression()), !dbg !47
  %0 = getelementptr inbounds %struct.Box$i32, %struct.Box$i32* %this, i32 0, i32 0, !dbg !50
  %1 = load i32, i32* %0, align 4, !tbaa !43, !dbg !50
  ret i32 %1, !dbg !49
}

define internal noundef i32 @identity$i32(i32 noundef %x) #2 !dbg !53 {
entry:
  call void @llvm.dbg.value(metadata i32 %x, metadata !55, metadata !DIExpression()), !dbg !54
  ret i32 %x, !dbg !54
}

define internal noundef nonnull align 8 i8* @identity$str(i8* noundef nonnull noalias readonly align 8 %x) #2 !dbg !59 {
entry:
  call void @llvm.dbg.value(metadata i8* %x, metadata !61, metadata !DIExpression()), !dbg !60
  ret i8* %x, !dbg !60
}

define internal noundef nonnull align 8 dereferenceable(4) %struct.Box$i32* @identity$$Box$i32(%struct.Box$i32* noundef nonnull align 8 dereferenceable(4) %x) #2 !dbg !65 {
entry:
  call void @llvm.dbg.value(metadata %struct.Box$i32* %x, metadata !67, metadata !DIExpression()), !dbg !66
  ret %struct.Box$i32* %x, !dbg !66
}

attributes #0 = { nounwind willreturn }
attributes #1 = { nounwind willreturn readonly }
attributes #2 = { nounwind willreturn readnone }
attributes #3 = { nounwind willreturn cold noinline allocsize(0) }
attributes #4 = { alwaysinline nounwind willreturn allocsize(0) }

!llvm.dbg.cu = !{!0}
!llvm.module.flags = !{!2, !3}
!0 = distinct !DICompileUnit(language: DW_LANG_C99, file: !1, producer: "nish <version>", isOptimized: false, runtimeVersion: 0, emissionKind: FullDebug)
!1 = !DIFile(filename: "<root>/tests/cases/dbg_generic.ts", directory: ".")
!2 = !{i32 7, !"Dwarf Version", i32 5}
!3 = !{i32 2, !"Debug Info Version", i32 3}
!4 = !DIBasicType(name: "int", size: 32, encoding: DW_ATE_signed)
!5 = !{!4}
!6 = !DISubroutineType(types: !5)
!7 = distinct !DISubprogram(name: "test", linkageName: "test", scope: !1, file: !1, line: 20, type: !6, scopeLine: 20, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition, unit: !0)
!8 = !DILocation(line: 20, column: 1, scope: !7)
!9 = !DILocation(line: 21, column: 3, scope: !7)
!10 = !DILocation(line: 21, column: 13, scope: !7)
!11 = !DILocation(line: 21, column: 26, scope: !7)
!12 = !DILocation(line: 21, column: 35, scope: !7)
!13 = distinct !DICompositeType(tag: DW_TAG_structure_type, name: "Box<i32>", file: !1, line: 10, size: 32, align: 32, elements: !16)
!14 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !13, size: 64)
!15 = !DIDerivedType(tag: DW_TAG_member, name: "value", scope: !13, file: !1, line: 11, baseType: !4, size: 32, offset: 0)
!16 = !{!15}
!17 = !DILocalVariable(name: "b", scope: !7, file: !1, line: 21, type: !14)
!18 = !DILocation(line: 22, column: 3, scope: !7)
!19 = !DILocation(line: 22, column: 21, scope: !7)
!20 = !DILocation(line: 22, column: 30, scope: !7)
!21 = !DIBasicType(name: "char", size: 8, encoding: DW_ATE_signed_char)
!22 = !DIDerivedType(tag: DW_TAG_pointer_type, baseType: !21, size: 64)
!23 = !DILocalVariable(name: "s", scope: !7, file: !1, line: 22, type: !22)
!24 = !DILocation(line: 23, column: 3, scope: !7)
!25 = !DILocation(line: 23, column: 13, scope: !7)
!26 = !DILocation(line: 23, column: 22, scope: !7)
!27 = !DILocalVariable(name: "c", scope: !7, file: !1, line: 23, type: !14)
!28 = !DILocation(line: 24, column: 3, scope: !7)
!29 = !DILocation(line: 24, column: 10, scope: !7)
!30 = !DILocation(line: 24, column: 20, scope: !7)
!31 = !{null, !14, !4}
!32 = !DISubroutineType(types: !31)
!33 = distinct !DISubprogram(name: "Box<i32>.constructor", linkageName: "Box$i32.constructor", scope: !1, file: !1, line: 12, type: !32, scopeLine: 12, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!34 = !DILocation(line: 12, column: 3, scope: !33)
!35 = !DILocalVariable(name: "this", arg: 1, scope: !33, file: !1, line: 12, type: !14, flags: DIFlagArtificial | DIFlagObjectPointer)
!36 = !DILocalVariable(name: "value", arg: 2, scope: !33, file: !1, line: 12, type: !4)
!37 = !DILocation(line: 13, column: 5, scope: !33)
!38 = !DILocation(line: 13, column: 18, scope: !33)
!39 = !{!"nish TBAA"}
!40 = !{!"omnipotent char", !39, i64 0}
!41 = !{!"i32", !40, i64 0}
!42 = !{!"Box$i32", !41, i64 0}
!43 = !{!42, !41, i64 0}
!44 = !{!4, !14}
!45 = !DISubroutineType(types: !44)
!46 = distinct !DISubprogram(name: "Box<i32>.get", linkageName: "Box$i32.get", scope: !1, file: !1, line: 15, type: !45, scopeLine: 15, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!47 = !DILocation(line: 15, column: 3, scope: !46)
!48 = !DILocalVariable(name: "this", arg: 1, scope: !46, file: !1, line: 15, type: !14, flags: DIFlagArtificial | DIFlagObjectPointer)
!49 = !DILocation(line: 16, column: 5, scope: !46)
!50 = !DILocation(line: 16, column: 12, scope: !46)
!51 = !{!4, !4}
!52 = !DISubroutineType(types: !51)
!53 = distinct !DISubprogram(name: "identity<i32>", linkageName: "identity$i32", scope: !1, file: !1, line: 8, type: !52, scopeLine: 8, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!54 = !DILocation(line: 8, column: 1, scope: !53)
!55 = !DILocalVariable(name: "x", arg: 1, scope: !53, file: !1, line: 8, type: !4)
!56 = !DILocation(line: 8, column: 34, scope: !53)
!57 = !{!22, !22}
!58 = !DISubroutineType(types: !57)
!59 = distinct !DISubprogram(name: "identity<string>", linkageName: "identity$str", scope: !1, file: !1, line: 8, type: !58, scopeLine: 8, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!60 = !DILocation(line: 8, column: 1, scope: !59)
!61 = !DILocalVariable(name: "x", arg: 1, scope: !59, file: !1, line: 8, type: !22)
!62 = !DILocation(line: 8, column: 34, scope: !59)
!63 = !{!14, !14}
!64 = !DISubroutineType(types: !63)
!65 = distinct !DISubprogram(name: "identity<Box<i32>>", linkageName: "identity$$Box$i32", scope: !1, file: !1, line: 8, type: !64, scopeLine: 8, flags: DIFlagPrototyped, spFlags: DISPFlagDefinition | DISPFlagLocalToUnit, unit: !0)
!66 = !DILocation(line: 8, column: 1, scope: !65)
!67 = !DILocalVariable(name: "x", arg: 1, scope: !65, file: !1, line: 8, type: !14)
!68 = !DILocation(line: 8, column: 34, scope: !65)

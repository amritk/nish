%struct.nish_array = type { i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [37 x i8] } { i64 36, [37 x i8] c"build/test/io_write_bytes_string.bin\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [36 x i8] } { i64 35, [36 x i8] c"build/test/io_write_bytes_array.bin\00" }, align 8

declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_new(i8* noundef readonly nocapture, i64 noundef) #1
declare void @nish_write(i8* noundef nonnull readonly align 8 nocapture, i32 noundef, i1 noundef zeroext) #1
declare void @nish_write_file(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare noundef i32 @nish_write_file_bytes(i8* noundef nonnull readonly align 8 nocapture, %struct.nish_array* noundef nonnull align 8 nocapture readonly) #0
declare noundef i32 @nish_write_bytes(%struct.nish_array* noundef nonnull align 8 nocapture readonly, i64 noundef, i64 noundef) #0
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #1
declare void @nish_panic_slice(i64 noundef, i64 noundef, i64 noundef) #2

define noundef i32 @nish_main() #0 {
entry:
  %bytes.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %i.addr = alloca i32, align 4
  %sent.addr = alloca i32, align 4
  %text.addr = alloca i8*, align 8
  %filed.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %bytes.addr, align 8
  store i32 0, i32* %i.addr, align 4
  br label %for.cond

for.cond:
  %3 = load i32, i32* %i.addr, align 4
  %4 = icmp slt i32 %3, 256
  br i1 %4, label %for.body, label %for.end

for.body:
  %5 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %6 = load i32, i32* %i.addr, align 4
  %7 = trunc i32 %6 to i8
  %8 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 0
  %9 = load i64, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %10 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 1
  %11 = load i64, i64* %10, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %12 = icmp eq i64 %9, %11
  br i1 %12, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %5, i64 1)
  br label %push.store

push.store:
  %13 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %5, i64 0, i32 2
  %14 = load i8*, i8** %13, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %15 = bitcast i8* %14 to i8*
  %16 = getelementptr inbounds i8, i8* %15, i64 %9
  store i8 %7, i8* %16, align 1, !alias.scope !4, !noalias !3, !tbaa !14
  %17 = add i64 %9, 1
  store i64 %17, i64* %8, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %18 = trunc i64 %17 to i32
  br label %for.inc

for.inc:
  %19 = load i32, i32* %i.addr, align 4
  %20 = add nsw i32 %19, 1
  store i32 %20, i32* %i.addr, align 4
  br label %for.cond

for.end:
  %21 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %22 = add i64 0, 256
  %23 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %21, i64 0, i32 0
  %24 = load i64, i64* %23, align 8
  %25 = icmp ule i64 0, %22
  %26 = icmp ule i64 %22, %24
  %27 = and i1 %25, %26
  br i1 %27, label %net.ok, label %net.fail

net.fail:
  call void @nish_panic_slice(i64 0, i64 %22, i64 %24)
  unreachable

net.ok:
  %28 = call i32 @nish_write_bytes(%struct.nish_array* %21, i64 0, i64 256)
  store i32 %28, i32* %sent.addr, align 4
  %29 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %30 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 0
  %31 = load i64, i64* %30, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %32 = icmp ule i64 0, 256
  %33 = icmp ule i64 256, %31
  %34 = and i1 %32, %33
  br i1 %34, label %bytes.ok, label %bytes.fail

bytes.fail:
  call void @nish_panic_slice(i64 0, i64 256, i64 %31)
  unreachable

bytes.ok:
  %35 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %29, i64 0, i32 2
  %36 = load i8*, i8** %35, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %37 = getelementptr inbounds i8, i8* %36, i64 0
  %38 = sub i64 256, 0
  %39 = call i8* @nish_str_new(i8* %37, i64 %38)
  store i8* %39, i8** %text.addr, align 8
  %40 = load i8*, i8** %text.addr, align 8
  call void @nish_write(i8* %40, i32 1, i1 false)
  %41 = load i8*, i8** %text.addr, align 8
  call void @nish_write_file(i8* bitcast ({ i64, [37 x i8] }* @.str.0 to i8*), i8* %41)
  %42 = load %struct.nish_array*, %struct.nish_array** %bytes.addr, align 8
  %43 = call i32 @nish_write_file_bytes(i8* bitcast ({ i64, [36 x i8] }* @.str.1 to i8*), %struct.nish_array* %42)
  store i32 %43, i32* %filed.addr, align 4
  %44 = load i32, i32* %sent.addr, align 4
  %45 = icmp eq i32 %44, 256
  br i1 %45, label %land.rhs, label %land.end

land.rhs:
  %46 = load i32, i32* %filed.addr, align 4
  %47 = icmp eq i32 %46, 256
  br label %land.end

land.end:
  %48 = phi i1 [ false, %bytes.ok ], [ %47, %land.rhs ]
  br i1 %48, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %49 = phi i32 [ 0, %cond.true ], [ 1, %cond.false ]
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 %49
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }

!llvm.module.flags = !{!15, !16, !17, !18, !19}
!0 = !{!"nish array"}
!1 = !{!"header", !0}
!2 = !{!"elements", !0}
!3 = !{!1}
!4 = !{!2}
!5 = !{!"nish TBAA"}
!6 = !{!"omnipotent char", !5, i64 0}
!7 = !{!"header i64", !6, i64 0}
!8 = !{!"header ptr", !6, i64 0}
!9 = !{!"array header", !7, i64 0, !7, i64 8, !8, i64 16}
!10 = !{!9, !7, i64 0}
!11 = !{!9, !7, i64 8}
!12 = !{!9, !8, i64 16}
!13 = !{!"element i8", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{i32 8, !"cf-protection-branch", i32 1}
!16 = !{i32 8, !"cf-protection-return", i32 1}
!17 = !{i32 8, !"branch-target-enforcement", i32 1}
!18 = !{i32 8, !"sign-return-address", i32 1}
!19 = !{i32 4, !"probe-stack", !"inline-asm"}

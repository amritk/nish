%struct.File = type { i8* }
%struct.Probe = type { i32 }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"\00\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [97 x i8] } { i64 96, [97 x i8] c"`counted_fopen`: argument 1 (path) holds a NUL byte, which C would read as the end of the string\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"r\00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"data\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"ab\00" }, align 8

declare i8* @counted_fopen(i8*, i8*)
declare i32 @counted_fclose(i8*)
declare i32 @fgetc(i8*)
declare i64 @nish_str_index_of(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #1
declare void @nish_panic(i8* noundef nonnull readonly align 8 nocapture) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #2
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #3
declare { i32, i1 } @llvm.smul.with.overflow.i32(i32, i32) #3

define internal void @File.constructor(%struct.File* noundef nonnull noalias align 8 dereferenceable(8) nocapture %this, i8* noundef nonnull noalias readonly align 8 %path) #0 {
entry:
  %0 = call i64 @nish_str_index_of(i8* %path, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %1 = icmp sge i64 %0, 0
  br i1 %1, label %ffi.nul, label %ffi.ok

ffi.nul:
  call void @nish_panic(i8* bitcast ({ i64, [97 x i8] }* @.str.1 to i8*))
  unreachable

ffi.ok:
  %2 = getelementptr inbounds i8, i8* %path, i64 8
  %3 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.2 to i8*), i64 8
  %4 = call i8* @counted_fopen(i8* %2, i8* %3)
  %5 = getelementptr inbounds %struct.File, %struct.File* %this, i32 0, i32 0
  store i8* %4, i8** %5, align 8, !tbaa !4
  ret void
}

define internal noundef i32 @File.read(%struct.File* noundef nonnull readonly align 8 dereferenceable(8) nocapture %this) #0 {
entry:
  %p.addr = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.File, %struct.File* %this, i32 0, i32 0
  %1 = load i8*, i8** %0, align 8, !tbaa !4
  store i8* %1, i8** %p.addr, align 8
  %2 = load i8*, i8** %p.addr, align 8
  %3 = icmp eq i8* %2, null
  br i1 %3, label %if.then, label %if.end

if.then:
  ret i32 -1

if.end:
  %4 = load i8*, i8** %p.addr, align 8
  %5 = call i32 @fgetc(i8* %4)
  ret i32 %5
}

define noundef i32 @nested(i32 noundef %k) #0 {
entry:
  %outer.addr = alloca %struct.File*, align 8
  %File.obj = alloca %struct.File, align 8
  %c.addr = alloca i32, align 4
  %inner.addr = alloca %struct.File*, align 8
  %File.obj.1 = alloca %struct.File, align 8
  call void @File.constructor(%struct.File* %File.obj, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*))
  store %struct.File* %File.obj, %struct.File** %outer.addr, align 8
  %0 = load %struct.File*, %struct.File** %outer.addr, align 8
  %1 = load %struct.File*, %struct.File** %outer.addr, align 8
  %2 = call i32 @File.read(%struct.File* %1)
  store i32 %2, i32* %c.addr, align 4
  call void @File.constructor(%struct.File* %File.obj.1, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*))
  store %struct.File* %File.obj.1, %struct.File** %inner.addr, align 8
  %3 = load %struct.File*, %struct.File** %inner.addr, align 8
  %4 = icmp eq i32 %k, 1
  br i1 %4, label %if.then, label %if.end

if.then:
  %5 = getelementptr inbounds %struct.File, %struct.File* %3, i32 0, i32 0
  %6 = load i8*, i8** %5, align 8, !tbaa !4
  %7 = icmp eq i8* %6, null
  br i1 %7, label %handle.closed, label %handle.close

handle.close:
  %8 = call i32 @counted_fclose(i8* %6)
  br label %handle.closed

handle.closed:
  %9 = getelementptr inbounds %struct.File, %struct.File* %0, i32 0, i32 0
  %10 = load i8*, i8** %9, align 8, !tbaa !4
  %11 = icmp eq i8* %10, null
  br i1 %11, label %handle.closed.1, label %handle.close.1

handle.close.1:
  %12 = call i32 @counted_fclose(i8* %10)
  br label %handle.closed.1

handle.closed.1:
  ret i32 1

if.end:
  %13 = load i32, i32* %c.addr, align 4
  %14 = load %struct.File*, %struct.File** %inner.addr, align 8
  %15 = call i32 @File.read(%struct.File* %14)
  %16 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %13, i32 %15)
  %17 = extractvalue { i32, i1 } %16, 0
  %18 = extractvalue { i32, i1 } %16, 1
  br i1 %18, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %17, i32* %c.addr, align 4
  %19 = getelementptr inbounds %struct.File, %struct.File* %3, i32 0, i32 0
  %20 = load i8*, i8** %19, align 8, !tbaa !4
  %21 = icmp eq i8* %20, null
  br i1 %21, label %handle.closed.2, label %handle.close.2

handle.close.2:
  %22 = call i32 @counted_fclose(i8* %20)
  br label %handle.closed.2

handle.closed.2:
  %23 = icmp eq i32 %k, 2
  br i1 %23, label %if.then.1, label %if.end.1

if.then.1:
  %24 = getelementptr inbounds %struct.File, %struct.File* %0, i32 0, i32 0
  %25 = load i8*, i8** %24, align 8, !tbaa !4
  %26 = icmp eq i8* %25, null
  br i1 %26, label %handle.closed.3, label %handle.close.3

handle.close.3:
  %27 = call i32 @counted_fclose(i8* %25)
  br label %handle.closed.3

handle.closed.3:
  ret i32 2

if.end.1:
  %28 = load i32, i32* %c.addr, align 4
  %29 = getelementptr inbounds %struct.File, %struct.File* %0, i32 0, i32 0
  %30 = load i8*, i8** %29, align 8, !tbaa !4
  %31 = icmp eq i8* %30, null
  br i1 %31, label %handle.closed.4, label %handle.close.4

handle.close.4:
  %32 = call i32 @counted_fclose(i8* %30)
  br label %handle.closed.4

handle.closed.4:
  ret i32 %28

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define noundef i32 @whileBody(i32 noundef %n) #0 {
entry:
  %i.addr = alloca i32, align 4
  %total.addr = alloca i32, align 4
  %f.addr = alloca %struct.File*, align 8
  %File.obj = alloca %struct.File, align 8
  store i32 0, i32* %i.addr, align 4
  store i32 0, i32* %total.addr, align 4
  br label %while.cond

while.cond:
  %0 = load i32, i32* %i.addr, align 4
  %1 = icmp slt i32 %0, %n
  br i1 %1, label %while.body, label %while.end

while.body:
  call void @File.constructor(%struct.File* %File.obj, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*))
  store %struct.File* %File.obj, %struct.File** %f.addr, align 8
  %2 = load %struct.File*, %struct.File** %f.addr, align 8
  %3 = load i32, i32* %total.addr, align 4
  %4 = load %struct.File*, %struct.File** %f.addr, align 8
  %5 = call i32 @File.read(%struct.File* %4)
  %6 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %3, i32 %5)
  %7 = extractvalue { i32, i1 } %6, 0
  %8 = extractvalue { i32, i1 } %6, 1
  br i1 %8, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %7, i32* %total.addr, align 4
  %9 = load i32, i32* %i.addr, align 4
  %10 = add nsw i32 %9, 1
  store i32 %10, i32* %i.addr, align 4
  %11 = getelementptr inbounds %struct.File, %struct.File* %2, i32 0, i32 0
  %12 = load i8*, i8** %11, align 8, !tbaa !4
  %13 = icmp eq i8* %12, null
  br i1 %13, label %handle.closed, label %handle.close

handle.close:
  %14 = call i32 @counted_fclose(i8* %12)
  br label %handle.closed

handle.closed:
  br label %while.cond

while.end:
  %15 = load i32, i32* %total.addr, align 4
  ret i32 %15

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

define internal void @Probe.constructor(%struct.Probe* noundef nonnull noalias align 8 dereferenceable(4) nocapture %this) #0 {
entry:
  %f.addr = alloca %struct.File*, align 8
  %File.obj = alloca %struct.File, align 8
  call void @File.constructor(%struct.File* %File.obj, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*))
  store %struct.File* %File.obj, %struct.File** %f.addr, align 8
  %0 = load %struct.File*, %struct.File** %f.addr, align 8
  %1 = load %struct.File*, %struct.File** %f.addr, align 8
  %2 = call i32 @File.read(%struct.File* %1)
  %3 = getelementptr inbounds %struct.Probe, %struct.Probe* %this, i32 0, i32 0
  store i32 %2, i32* %3, align 4, !tbaa !7
  %4 = getelementptr inbounds %struct.File, %struct.File* %0, i32 0, i32 0
  %5 = load i8*, i8** %4, align 8, !tbaa !4
  %6 = icmp eq i8* %5, null
  br i1 %6, label %handle.closed, label %handle.close

handle.close:
  %7 = call i32 @counted_fclose(i8* %5)
  br label %handle.closed

handle.closed:
  ret void
}

define noundef i32 @built() #0 {
entry:
  %p.addr = alloca %struct.Probe*, align 8
  %Probe.obj = alloca %struct.Probe, align 8
  call void @Probe.constructor(%struct.Probe* %Probe.obj)
  store %struct.Probe* %Probe.obj, %struct.Probe** %p.addr, align 8
  %0 = load %struct.Probe*, %struct.Probe** %p.addr, align 8
  %1 = getelementptr inbounds %struct.Probe, %struct.Probe* %0, i32 0, i32 0
  %2 = load i32, i32* %1, align 4, !tbaa !7
  ret i32 %2
}

define noundef i32 @specialised() #0 {
entry:
  %s.addr = alloca i8*, align 8
  %0 = call i8* @readWith$str(i8* bitcast ({ i64, [3 x i8] }* @.str.4 to i8*))
  store i8* %0, i8** %s.addr, align 8
  %1 = load i8*, i8** %s.addr, align 8
  %2 = bitcast i8* %1 to i64*
  %3 = load i64, i64* %2, align 8
  %4 = trunc i64 %3 to i32
  %5 = tail call i32 @readWith$i32(i32 %4)
  ret i32 %5
}

define noundef i32 @passed(i32 noundef %n) #0 {
entry:
  %0 = call i32 @around$fn.13.passed$arrow0(i32 %n)
  ret i32 %0
}

define internal noundef i32 @passed$arrow0(i32 noundef %m) #0 {
entry:
  %0 = call { i32, i1 } @llvm.smul.with.overflow.i32(i32 %m, i32 2)
  %1 = extractvalue { i32, i1 } %0, 0
  %2 = extractvalue { i32, i1 } %0, 1
  br i1 %2, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %1

ovf.fail:
  call void @nish_panic_overflow(i32 2)
  unreachable
}

define internal noundef nonnull align 8 i8* @readWith$str(i8* noundef nonnull noalias readonly align 8 %x) #0 {
entry:
  %f.addr = alloca %struct.File*, align 8
  %File.obj = alloca %struct.File, align 8
  call void @File.constructor(%struct.File* %File.obj, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*))
  store %struct.File* %File.obj, %struct.File** %f.addr, align 8
  %0 = load %struct.File*, %struct.File** %f.addr, align 8
  %1 = load %struct.File*, %struct.File** %f.addr, align 8
  %2 = call i32 @File.read(%struct.File* %1)
  %3 = getelementptr inbounds %struct.File, %struct.File* %0, i32 0, i32 0
  %4 = load i8*, i8** %3, align 8, !tbaa !4
  %5 = icmp eq i8* %4, null
  br i1 %5, label %handle.closed, label %handle.close

handle.close:
  %6 = call i32 @counted_fclose(i8* %4)
  br label %handle.closed

handle.closed:
  ret i8* %x
}

define internal noundef i32 @readWith$i32(i32 noundef %x) #0 {
entry:
  %f.addr = alloca %struct.File*, align 8
  %File.obj = alloca %struct.File, align 8
  call void @File.constructor(%struct.File* %File.obj, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*))
  store %struct.File* %File.obj, %struct.File** %f.addr, align 8
  %0 = load %struct.File*, %struct.File** %f.addr, align 8
  %1 = load %struct.File*, %struct.File** %f.addr, align 8
  %2 = call i32 @File.read(%struct.File* %1)
  %3 = getelementptr inbounds %struct.File, %struct.File* %0, i32 0, i32 0
  %4 = load i8*, i8** %3, align 8, !tbaa !4
  %5 = icmp eq i8* %4, null
  br i1 %5, label %handle.closed, label %handle.close

handle.close:
  %6 = call i32 @counted_fclose(i8* %4)
  br label %handle.closed

handle.closed:
  ret i32 %x
}

define internal noundef i32 @around$fn.13.passed$arrow0(i32 noundef %n) #0 {
entry:
  %f.addr = alloca %struct.File*, align 8
  %File.obj = alloca %struct.File, align 8
  call void @File.constructor(%struct.File* %File.obj, i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*))
  store %struct.File* %File.obj, %struct.File** %f.addr, align 8
  %0 = load %struct.File*, %struct.File** %f.addr, align 8
  %1 = call i32 @passed$arrow0(i32 %n)
  %2 = load %struct.File*, %struct.File** %f.addr, align 8
  %3 = call i32 @File.read(%struct.File* %2)
  %4 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %1, i32 %3)
  %5 = extractvalue { i32, i1 } %4, 0
  %6 = extractvalue { i32, i1 } %4, 1
  br i1 %6, label %ovf.fail, label %ovf.ok

ovf.ok:
  %7 = getelementptr inbounds %struct.File, %struct.File* %0, i32 0, i32 0
  %8 = load i8*, i8** %7, align 8, !tbaa !4
  %9 = icmp eq i8* %8, null
  br i1 %9, label %handle.closed, label %handle.close

handle.close:
  %10 = call i32 @counted_fclose(i8* %8)
  br label %handle.closed

handle.closed:
  ret i32 %5

ovf.fail:
  call void @nish_panic_overflow(i32 0)
  unreachable
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn memory(argmem: read) "probe-stack"="inline-asm" }
attributes #2 = { nounwind noreturn cold "probe-stack"="inline-asm" }
attributes #3 = { nounwind willreturn readnone "probe-stack"="inline-asm" }

!llvm.module.flags = !{!8, !9, !10, !11, !12}
!0 = !{!"nish TBAA"}
!1 = !{!"omnipotent char", !0, i64 0}
!2 = !{!"ptr", !1, i64 0}
!3 = !{!"File", !2, i64 0}
!4 = !{!3, !2, i64 0}
!5 = !{!"i32", !1, i64 0}
!6 = !{!"Probe", !5, i64 0}
!7 = !{!6, !5, i64 0}
!8 = !{i32 8, !"cf-protection-branch", i32 1}
!9 = !{i32 8, !"cf-protection-return", i32 1}
!10 = !{i32 8, !"branch-target-enforcement", i32 1}
!11 = !{i32 8, !"sign-return-address", i32 1}
!12 = !{i32 4, !"probe-stack", !"inline-asm"}

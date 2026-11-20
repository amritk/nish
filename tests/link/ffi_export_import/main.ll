%struct.TallyOut = type { i64 }
%struct.tally = type {}

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8

declare void @llvm.memset.p0i8.i64(i8* nocapture writeonly, i8, i64, i1 immarg)
declare void @tally_add(i8*, i64)
declare void @tally_free(i8*)
declare i32 @tally_get(i8*, %struct.TallyOut*)
declare i8* @tally_new(i32)
declare void @nish_free_arena() #1
declare noundef i64 @nish_arena_mark() #1
declare void @nish_arena_release(i64 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #1
declare noalias noundef nonnull align 8 i8* @nish_str_from_i64(i64 noundef) #1

define noundef i32 @nish_main() #0 {
entry:
  %t.addr = alloca i8*, align 8
  %out.addr = alloca %struct.TallyOut*, align 8
  %TallyOut.obj = alloca %struct.TallyOut, align 8
  %status.addr = alloca i32, align 4
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @tally_new(i32 40)
  store i8* %0, i8** %t.addr, align 8
  %1 = load i8*, i8** %t.addr, align 8
  %2 = icmp eq i8* %1, null
  br i1 %2, label %if.then, label %if.end

if.then:
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 1

if.end:
  %3 = load i8*, i8** %t.addr, align 8
  call void @tally_add(i8* %3, i64 2)
  %4 = bitcast %struct.TallyOut* %TallyOut.obj to i8*
  call void @llvm.memset.p0i8.i64(i8* align 8 %4, i8 0, i64 8, i1 false)
  store %struct.TallyOut* %TallyOut.obj, %struct.TallyOut** %out.addr, align 8
  %5 = load i8*, i8** %t.addr, align 8
  %6 = load %struct.TallyOut*, %struct.TallyOut** %out.addr, align 8
  %7 = call i32 @tally_get(i8* %5, %struct.TallyOut* %6)
  store i32 %7, i32* %status.addr, align 4
  %8 = load i8*, i8** %t.addr, align 8
  call void @tally_free(i8* %8)
  %9 = load i32, i32* %status.addr, align 4
  %10 = call i8* @nish_str_from_i32(i32 %9)
  %11 = call i8* @nish_str_concat(i8* %10, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*))
  %12 = load %struct.TallyOut*, %struct.TallyOut** %out.addr, align 8
  %13 = getelementptr inbounds %struct.TallyOut, %struct.TallyOut* %12, i32 0, i32 0
  %14 = load i64, i64* %13, align 8
  %15 = call i8* @nish_str_from_i64(i64 %14)
  %16 = call i8* @nish_str_concat(i8* %11, i8* %15)
  call void @nish_print(i8* %16)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0
}

define noundef i32 @main(i32 noundef %argc, i8** noundef %argv) #0 {
entry:
  %0 = call i32 @nish_main()
  call void @nish_free_arena()
  ret i32 %0
}

attributes #0 = { nounwind "probe-stack"="inline-asm" }
attributes #1 = { nounwind willreturn "probe-stack"="inline-asm" }

!llvm.module.flags = !{!0, !1, !2, !3, !4}
!0 = !{i32 8, !"cf-protection-branch", i32 1}
!1 = !{i32 8, !"cf-protection-return", i32 1}
!2 = !{i32 8, !"branch-target-enforcement", i32 1}
!3 = !{i32 8, !"sign-return-address", i32 1}
!4 = !{i32 4, !"probe-stack", !"inline-asm"}

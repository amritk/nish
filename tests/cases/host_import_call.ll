target datalayout = "e-m:e-p:32:32-p10:8:8-p20:8:8-i64:64-n32:64-S128-ni:1:10:20"
target triple = "wasm32-unknown-unknown"

declare zeroext i8 @shade(i8 zeroext) #1
declare i32 @width(i32) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #3
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #4

define noundef i32 @wider(i32 noundef %c) #0 {
entry:
  %0 = call i32 @width(i32 %c)
  %1 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %0, i32 1)
  %2 = extractvalue { i32, i1 } %1, 0
  %3 = extractvalue { i32, i1 } %1, 1
  br i1 %3, label %ovf.fail, label %ovf.ok

ovf.ok:
  ret i32 %2

ovf.fail:
  call void @nish_panic_overflow(i32 0), !nish.site !{i32 0}
  unreachable
}

define noundef i8 @darker(i8 noundef %level) #0 {
entry:
  %0 = call i8 @shade(i8 %level)
  %1 = sub i8 %0, 1
  ret i8 %1
}

attributes #0 = { nounwind }
attributes #1 = { "wasm-import-module"="host" "wasm-import-name"="shade" }
attributes #2 = { "wasm-import-module"="host" "wasm-import-name"="width" }
attributes #3 = { nounwind noreturn cold }
attributes #4 = { nounwind willreturn readnone }

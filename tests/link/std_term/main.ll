%struct.Canvas = type { %struct.Screen*, i32, i32, %struct.nish_array* }
%struct.FixedStep = type { double, double, double, i32, i1 }
%struct.KeyDecoder = type { double, %struct.nish_array*, double }
%struct.KeyEvent = type { i32, i32 }
%struct.Screen = type { %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, %struct.nish_array*, i32, i32, i32, i1, i1 }
%struct.nish_array = type { i64, i64, i8* }
%struct.nish_arena = type { i8*, i64, i64, i8* }

@.str.0 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"\1B\00" }, align 8
@.str.1 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"^[\00" }, align 8
@.str.2 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c": \00" }, align 8
@.str.3 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"char\00" }, align 8
@.str.4 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"up\00" }, align 8
@.str.5 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"down\00" }, align 8
@.str.6 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"right\00" }, align 8
@.str.7 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"left\00" }, align 8
@.str.8 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"enter\00" }, align 8
@.str.9 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"space\00" }, align 8
@.str.10 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"escape\00" }, align 8
@.str.11 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"ctrl-c\00" }, align 8
@.str.12 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"tab\00" }, align 8
@.str.13 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"backspace\00" }, align 8
@.str.14 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"control\00" }, align 8
@.str.15 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"unknown\00" }, align 8
@.str.16 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"(\00" }, align 8
@.str.17 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c")\00" }, align 8
@.str.18 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c": [\00" }, align 8
@.str.19 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c" \00" }, align 8
@.str.20 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"]\00" }, align 8
@.str.21 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c" holding\00" }, align 8
@.str.22 = private unnamed_addr constant { i64, [1 x i8] } { i64 0, [1 x i8] c"\00" }, align 8
@.str.23 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"leave\00" }, align 8
@.str.24 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"hide\00" }, align 8
@.str.25 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"show\00" }, align 8
@.str.26 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"clear\00" }, align 8
@.str.27 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"reset\00" }, align 8
@.str.28 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"move 3,1\00" }, align 8
@.str.29 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"sync\00" }, align 8
@.str.30 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"..\00" }, align 8
@.str.31 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"rgb clamps: \00" }, align 8
@.str.32 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"true\00" }, align 8
@.str.33 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c"false\00" }, align 8
@.str.34 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"palette red \00" }, align 8
@.str.35 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c" grey \00" }, align 8
@.str.36 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c" near-black \00" }, align 8
@.str.37 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c" white \00" }, align 8
@.str.38 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c" default \00" }, align 8
@.str.39 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"blank 4x2\00" }, align 8
@.str.40 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"unchanged: \00" }, align 8
@.str.41 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"one cell\00" }, align 8
@.str.42 = private unnamed_addr constant { i64, [20 x i8] } { i64 19, [20 x i8] c"gap of one, bridged\00" }, align 8
@.str.43 = private unnamed_addr constant { i64, [35 x i8] } { i64 34, [35 x i8] c"gap of two in another style, moved\00" }, align 8
@.str.44 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"row start, then home\00" }, align 8
@.str.45 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"off screen: \00" }, align 8
@.str.46 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"Hi\00" }, align 8
@.str.47 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"yo\00" }, align 8
@.str.48 = private unnamed_addr constant { i64, [4 x i8] } { i64 3, [4 x i8] c"\C3\A9!\00" }, align 8
@.str.49 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"styled run\00" }, align 8
@.str.50 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"text answers \00" }, align 8
@.str.51 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c", glyph at 4 is \00" }, align 8
@.str.52 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"add inverse\00" }, align 8
@.str.53 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"cleared\00" }, align 8
@.str.54 = private unnamed_addr constant { i64, [23 x i8] } { i64 22, [23 x i8] c"unknown attribute bits\00" }, align 8
@.str.55 = private unnamed_addr constant { i64, [34 x i8] } { i64 33, [34 x i8] c"control, negative, surrogate, DEL\00" }, align 8
@.str.56 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"gap over a control, moved\00" }, align 8
@.str.57 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"ab\00" }, align 8
@.str.58 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"256 colours\00" }, align 8
@.str.59 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"sync first frame\00" }, align 8
@.str.60 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"sync unchanged: \00" }, align 8
@.str.61 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"sync one styled cell\00" }, align 8
@.str.62 = private unnamed_addr constant { i64, [16 x i8] } { i64 15, [16 x i8] c"sync turned off\00" }, align 8
@.str.63 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c"canvas \00" }, align 8
@.str.64 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"x\00" }, align 8
@.str.65 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"pixels\00" }, align 8
@.str.66 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"fillRect\00" }, align 8
@.str.67 = private unnamed_addr constant { i64, [5 x i8] } { i64 4, [5 x i8] c"line\00" }, align 8
@.str.68 = private unnamed_addr constant { i64, [13 x i8] } { i64 12, [13 x i8] c"pixel (1,1) \00" }, align 8
@.str.69 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c" (1,2) \00" }, align 8
@.str.70 = private unnamed_addr constant { i64, [6 x i8] } { i64 5, [6 x i8] c" off \00" }, align 8
@.str.71 = private unnamed_addr constant { i64, [40 x i8] } { i64 39, [40 x i8] c"lines to far endpoints stop at the edge\00" }, align 8
@.str.72 = private unnamed_addr constant { i64, [3 x i8] } { i64 2, [3 x i8] c"ok\00" }, align 8
@.str.73 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"text over pixels\00" }, align 8
@.str.74 = private unnamed_addr constant { i64, [17 x i8] } { i64 16, [17 x i8] c"frame loop sent \00" }, align 8
@.str.75 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c" bytes\00" }, align 8
@.str.76 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"steps \00" }, align 8
@.str.77 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c" alpha \00" }, align 8
@.str.78 = private unnamed_addr constant { i64, [2 x i8] } { i64 1, [2 x i8] c"%\00" }, align 8
@.str.79 = private unnamed_addr constant { i64, [19 x i8] } { i64 18, [19 x i8] c"a long stall runs \00" }, align 8
@.str.80 = private unnamed_addr constant { i64, [29 x i8] } { i64 28, [29 x i8] c" and keeps the phase: alpha \00" }, align 8
@.str.81 = private unnamed_addr constant { i64, [50 x i8] } { i64 49, [50 x i8] c"a 100 Hz draw clock over a second of 1 ms ticks: \00" }, align 8
@.str.82 = private unnamed_addr constant { i64, [8 x i8] } { i64 7, [8 x i8] c" frames\00" }, align 8
@.str.83 = private unnamed_addr constant { i64, [15 x i8] } { i64 14, [15 x i8] c"clamped: step \00" }, align 8
@.str.84 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c" ms, at most \00" }, align 8
@.str.85 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"arrows\00" }, align 8
@.str.86 = private unnamed_addr constant { i64, [9 x i8] } { i64 8, [9 x i8] c"controls\00" }, align 8
@.str.87 = private unnamed_addr constant { i64, [10 x i8] } { i64 9, [10 x i8] c"printable\00" }, align 8
@.str.88 = private unnamed_addr constant { i64, [22 x i8] } { i64 21, [22 x i8] c"count bounds the read\00" }, align 8
@.str.89 = private unnamed_addr constant { i64, [22 x i8] } { i64 21, [22 x i8] c"split ESC | [A, first\00" }, align 8
@.str.90 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"split ESC | [A, then\00" }, align 8
@.str.91 = private unnamed_addr constant { i64, [22 x i8] } { i64 21, [22 x i8] c"split ESC[ | B, first\00" }, align 8
@.str.92 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"split ESC[ | B, then\00" }, align 8
@.str.93 = private unnamed_addr constant { i64, [23 x i8] } { i64 22, [23 x i8] c"split ESC O | C, first\00" }, align 8
@.str.94 = private unnamed_addr constant { i64, [22 x i8] } { i64 21, [22 x i8] c"split ESC O | C, then\00" }, align 8
@.str.95 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"parameters, ESC[1;5A\00" }, align 8
@.str.96 = private unnamed_addr constant { i64, [20 x i8] } { i64 19, [20 x i8] c"other final, ESC[3~\00" }, align 8
@.str.97 = private unnamed_addr constant { i64, [16 x i8] } { i64 15, [16 x i8] c"lone ESC, first\00" }, align 8
@.str.98 = private unnamed_addr constant { i64, [21 x i8] } { i64 20, [21 x i8] c"lone ESC, poll early\00" }, align 8
@.str.99 = private unnamed_addr constant { i64, [20 x i8] } { i64 19, [20 x i8] c"lone ESC, poll late\00" }, align 8
@.str.100 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"ESC then a letter\00" }, align 8
@.str.101 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"ESC ESC [ A\00" }, align 8
@.str.102 = private unnamed_addr constant { i64, [36 x i8] } { i64 35, [36 x i8] c"held ESC timed out by the next feed\00" }, align 8
@.str.103 = private unnamed_addr constant { i64, [12 x i8] } { i64 11, [12 x i8] c"  next feed\00" }, align 8
@.str.104 = private unnamed_addr constant { i64, [19 x i8] } { i64 18, [19 x i8] c"split UTF-8, first\00" }, align 8
@.str.105 = private unnamed_addr constant { i64, [18 x i8] } { i64 17, [18 x i8] c"split UTF-8, then\00" }, align 8
@.str.106 = private unnamed_addr constant { i64, [27 x i8] } { i64 26, [27 x i8] c"unfinished UTF-8 timed out\00" }, align 8
@.str.107 = private unnamed_addr constant { i64, [7 x i8] } { i64 6, [7 x i8] c"  poll\00" }, align 8
@.str.108 = private unnamed_addr constant { i64, [14 x i8] } { i64 13, [14 x i8] c"invalid bytes\00" }, align 8
@.str.109 = private unnamed_addr constant { i64, [33 x i8] } { i64 32, [33 x i8] c"a character cut short by another\00" }, align 8
@.str.110 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"empty feed\00" }, align 8
@.str.111 = private unnamed_addr constant { i64, [27 x i8] } { i64 26, [27 x i8] c"held over two feeds, first\00" }, align 8
@.str.112 = private unnamed_addr constant { i64, [26 x i8] } { i64 25, [26 x i8] c"held over two feeds, then\00" }, align 8
@.str.113 = private unnamed_addr constant { i64, [23 x i8] } { i64 22, [23 x i8] c"  timed from the first\00" }, align 8
@.str.114 = private unnamed_addr constant { i64, [19 x i8] } { i64 18, [19 x i8] c"ESC O and no final\00" }, align 8
@.str.115 = private unnamed_addr constant { i64, [19 x i8] } { i64 18, [19 x i8] c"past U+10FFFF lead\00" }, align 8
@.str.116 = private unnamed_addr constant { i64, [30 x i8] } { i64 29, [30 x i8] c"overlong, surrogate, too high\00" }, align 8
@.str.117 = private unnamed_addr constant { i64, [11 x i8] } { i64 10, [11 x i8] c"four bytes\00" }, align 8
@nish_arena = external global %struct.nish_arena, align 8

declare void @llvm.memcpy.p0i8.p0i8.i64(i8* noalias nocapture writeonly, i8* noalias nocapture readonly, i64, i1 immarg)
declare void @nish.Canvas.constructor(%struct.Canvas* noundef nonnull noalias align 8 dereferenceable(24) nocapture, %struct.Screen* noundef nonnull align 8 dereferenceable(88)) #0
declare void @nish.Canvas.clear(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture, i32 noundef) #0
declare noundef i32 @nish.Canvas.pixel(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture, i32 noundef, i32 noundef) #0
declare void @nish.Canvas.setPixel(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture, i32 noundef, i32 noundef, i32 noundef) #0
declare void @nish.Canvas.fillRect(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture, i32 noundef, i32 noundef, i32 noundef, i32 noundef, i32 noundef) #0
declare void @nish.Canvas.line(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture, i32 noundef, i32 noundef, i32 noundef, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.Canvas.text(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture, i32 noundef, i32 noundef, i8* noundef nonnull noalias readonly align 8, i32 noundef) #0
declare void @nish.Canvas.paintCell(%struct.Canvas* noundef nonnull readonly align 8 dereferenceable(24) nocapture, i32 noundef, i32 noundef) #0
declare void @nish.FixedStep.constructor(%struct.FixedStep* noundef nonnull noalias align 8 dereferenceable(32) nocapture, i32 noundef, i32 noundef) #2
declare noundef i32 @nish.FixedStep.advance(%struct.FixedStep* noundef nonnull align 8 dereferenceable(32) nocapture, double noundef) #0
declare noundef double @nish.FixedStep.alpha(%struct.FixedStep* noundef nonnull readonly align 8 dereferenceable(32) nocapture) #3
declare void @nish.KeyDecoder.constructor(%struct.KeyDecoder* noundef nonnull noalias align 8 dereferenceable(24) nocapture, double noundef) #2
declare noundef zeroext i1 @nish.KeyDecoder.waiting(%struct.KeyDecoder* noundef nonnull readonly align 8 dereferenceable(24) nocapture) #3
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture, i32 noundef, double noundef) #0
declare noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @nish.KeyDecoder.poll(%struct.KeyDecoder* noundef nonnull align 8 dereferenceable(24) nocapture, double noundef) #0
declare void @nish.KeyEvent.constructor(%struct.KeyEvent* noundef nonnull noalias align 8 dereferenceable(8) nocapture, i32 noundef, i32 noundef) #2
declare void @nish.Screen.constructor(%struct.Screen* noundef nonnull noalias align 8 dereferenceable(88) nocapture, i32 noundef, i32 noundef, i1 noundef zeroext) #0
declare void @nish.Screen.resize(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture, i32 noundef, i32 noundef) #0
declare void @nish.Screen.clear(%struct.Screen* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i32 noundef) #2
declare void @nish.Screen.invalidate(%struct.Screen* noundef nonnull readonly align 8 dereferenceable(88) nocapture) #2
declare void @nish.Screen.set(%struct.Screen* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i32 noundef, i32 noundef, i32 noundef, i32 noundef, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.Screen.text(%struct.Screen* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i32 noundef, i32 noundef, i8* noundef nonnull noalias readonly align 8, i32 noundef, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.Screen.glyphAt(%struct.Screen* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i32 noundef, i32 noundef) #0
declare void @nish.Screen.put(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture, i32 noundef) #0
declare void @nish.Screen.putDecimal(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture, i32 noundef) #0
declare void @nish.Screen.putSyncMode(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture, i32 noundef) #0
declare void @nish.Screen.putGlyph(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture, i32 noundef) #0
declare void @nish.Screen.putColour(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture, i32 noundef, i32 noundef) #0
declare noundef i32 @nish.Screen.colourKey(%struct.Screen* noundef nonnull readonly align 8 dereferenceable(88) nocapture, i32 noundef) #0
declare noundef nonnull align 8 i8* @nish.Screen.flush(%struct.Screen* noundef nonnull align 8 dereferenceable(88) nocapture) #0
declare noundef nonnull align 8 i8* @nish.beginSync() #1
declare noundef nonnull align 8 i8* @nish.clearScreen() #1
declare noundef nonnull align 8 i8* @nish.endSync() #1
declare noundef nonnull align 8 i8* @nish.enterAltScreen() #1
declare noundef nonnull align 8 i8* @nish.hideCursor() #1
declare noundef nonnull align 8 i8* @nish.leaveAltScreen() #1
declare noundef nonnull align 8 i8* @nish.moveCursor(i32 noundef, i32 noundef) #0
declare noundef i32 @nish.paletteIndex(i32 noundef) #0
declare noundef nonnull align 8 i8* @nish.resetStyle() #1
declare noundef i32 @nish.rgb(i32 noundef, i32 noundef, i32 noundef) #1
declare noundef nonnull align 8 i8* @nish.showCursor() #1
declare noundef nonnull align 8 i8* @nish.replaceAll(i8* noundef nonnull noalias readonly align 8, i8* noundef nonnull noalias readonly align 8 nocapture, i8* noundef nonnull noalias readonly align 8 nocapture) #0
declare noalias noundef nonnull align 8 i8* @nish_arena_grow(i64 noundef) #4
declare void @nish_free_arena() #2
declare noundef i64 @nish_arena_mark() #2
declare void @nish_arena_release(i64 noundef) #2
declare noundef nonnull align 8 i8* @nish_arena_keep(i64 noundef, i8* noundef nonnull align 8) #2
declare noalias noundef nonnull align 8 i8* @nish_str_concat(i8* noundef nonnull readonly align 8 nocapture, i8* noundef nonnull readonly align 8 nocapture) #0
declare void @nish_print(i8* noundef nonnull readonly align 8 nocapture) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_i32(i32 noundef) #2
declare noalias noundef nonnull align 8 i8* @nish_str_from_f64(double noundef) #2
declare void @nish_array_grow(%struct.nish_array* noundef nonnull align 8 nocapture, i64 noundef) #2
declare extern_weak void @nish_panic_overflow(i32 noundef) #5
declare double @llvm.floor.f64(double) #1
declare { i32, i1 } @llvm.sadd.with.overflow.i32(i32, i32) #1

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

define internal noundef nonnull align 8 i8* @shown(i8* noundef nonnull noalias readonly align 8 %s) #0 {
entry:
  %0 = call i64 @nish_arena_mark()
  %1 = call i8* @nish.replaceAll(i8* %s, i8* bitcast ({ i64, [2 x i8] }* @.str.0 to i8*), i8* bitcast ({ i64, [3 x i8] }* @.str.1 to i8*))
  %2 = call i8* @nish_arena_keep(i64 %0, i8* %1)
  ret i8* %2
}

define internal void @frame(i8* noundef nonnull noalias readonly align 8 nocapture %label, i8* noundef nonnull noalias readonly align 8 %s) #0 {
entry:
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish_str_concat(i8* %label, i8* bitcast ({ i64, [3 x i8] }* @.str.2 to i8*))
  %1 = call i64 @nish_arena_mark()
  %2 = call i8* @shown(i8* %s)
  %3 = call i8* @nish_arena_keep(i64 %1, i8* %2)
  %4 = call i8* @nish_str_concat(i8* %0, i8* %3)
  call void @nish_print(i8* %4)
  call void @nish_arena_release(i64 %arena.mark)
  ret void
}

define internal noundef nonnull align 8 dereferenceable(24) %struct.nish_array* @bytesOf(%struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %codes) #0 {
entry:
  %out.addr = alloca %struct.nish_array*, align 8
  %c.addr = alloca i32, align 4
  %forof.idx = alloca i64, align 8
  %0 = call i8* @nish_alloc_struct(i64 24)
  %1 = bitcast i8* %0 to %struct.nish_array*
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 0
  store i64 0, i64* %2, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %3 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 1
  store i64 0, i64* %3, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %1, i64 0, i32 2
  store i8* null, i8** %4, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %1, %struct.nish_array** %out.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %5 = load i64, i64* %forof.idx, align 8
  %6 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %codes, i64 0, i32 0
  %7 = load i64, i64* %6, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %8 = icmp ult i64 %5, %7
  br i1 %8, label %forof.body, label %forof.end

forof.body:
  %9 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %codes, i64 0, i32 2
  %10 = load i8*, i8** %9, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %11 = bitcast i8* %10 to i32*
  %12 = getelementptr inbounds i32, i32* %11, i64 %5
  %13 = load i32, i32* %12, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  store i32 %13, i32* %c.addr, align 4
  %14 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  %15 = load i32, i32* %c.addr, align 4
  %16 = trunc i32 %15 to i8
  %17 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 0
  %18 = load i64, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %19 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 1
  %20 = load i64, i64* %19, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %21 = icmp eq i64 %18, %20
  br i1 %21, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %14, i64 1)
  br label %push.store

push.store:
  %22 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %14, i64 0, i32 2
  %23 = load i8*, i8** %22, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %24 = bitcast i8* %23 to i8*
  %25 = getelementptr inbounds i8, i8* %24, i64 %18
  store i8 %16, i8* %25, align 1, !alias.scope !4, !noalias !3, !tbaa !16
  %26 = add i64 %18, 1
  store i64 %26, i64* %17, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %27 = trunc i64 %26 to i32
  br label %forof.inc

forof.inc:
  %28 = load i64, i64* %forof.idx, align 8
  %29 = add i64 %28, 1
  store i64 %29, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %30 = load %struct.nish_array*, %struct.nish_array** %out.addr, align 8
  ret %struct.nish_array* %30
}

define internal noundef nonnull align 8 i8* @kindName(i32 noundef %kind) #1 {
entry:
  %0 = icmp eq i32 %kind, 1
  br i1 %0, label %if.then, label %if.end

if.then:
  ret i8* bitcast ({ i64, [5 x i8] }* @.str.3 to i8*)

if.end:
  %1 = icmp eq i32 %kind, 2
  br i1 %1, label %if.then.1, label %if.end.1

if.then.1:
  ret i8* bitcast ({ i64, [3 x i8] }* @.str.4 to i8*)

if.end.1:
  %2 = icmp eq i32 %kind, 3
  br i1 %2, label %if.then.2, label %if.end.2

if.then.2:
  ret i8* bitcast ({ i64, [5 x i8] }* @.str.5 to i8*)

if.end.2:
  %3 = icmp eq i32 %kind, 4
  br i1 %3, label %if.then.3, label %if.end.3

if.then.3:
  ret i8* bitcast ({ i64, [6 x i8] }* @.str.6 to i8*)

if.end.3:
  %4 = icmp eq i32 %kind, 5
  br i1 %4, label %if.then.4, label %if.end.4

if.then.4:
  ret i8* bitcast ({ i64, [5 x i8] }* @.str.7 to i8*)

if.end.4:
  %5 = icmp eq i32 %kind, 6
  br i1 %5, label %if.then.5, label %if.end.5

if.then.5:
  ret i8* bitcast ({ i64, [6 x i8] }* @.str.8 to i8*)

if.end.5:
  %6 = icmp eq i32 %kind, 7
  br i1 %6, label %if.then.6, label %if.end.6

if.then.6:
  ret i8* bitcast ({ i64, [6 x i8] }* @.str.9 to i8*)

if.end.6:
  %7 = icmp eq i32 %kind, 8
  br i1 %7, label %if.then.7, label %if.end.7

if.then.7:
  ret i8* bitcast ({ i64, [7 x i8] }* @.str.10 to i8*)

if.end.7:
  %8 = icmp eq i32 %kind, 9
  br i1 %8, label %if.then.8, label %if.end.8

if.then.8:
  ret i8* bitcast ({ i64, [7 x i8] }* @.str.11 to i8*)

if.end.8:
  %9 = icmp eq i32 %kind, 10
  br i1 %9, label %if.then.9, label %if.end.9

if.then.9:
  ret i8* bitcast ({ i64, [4 x i8] }* @.str.12 to i8*)

if.end.9:
  %10 = icmp eq i32 %kind, 11
  br i1 %10, label %if.then.10, label %if.end.10

if.then.10:
  ret i8* bitcast ({ i64, [10 x i8] }* @.str.13 to i8*)

if.end.10:
  %11 = icmp eq i32 %kind, 12
  br i1 %11, label %if.then.11, label %if.end.11

if.then.11:
  ret i8* bitcast ({ i64, [8 x i8] }* @.str.14 to i8*)

if.end.11:
  ret i8* bitcast ({ i64, [8 x i8] }* @.str.15 to i8*)
}

define internal void @events(i8* noundef nonnull noalias readonly align 8 nocapture %label, %struct.nish_array* noundef nonnull align 8 dereferenceable(24) readonly nocapture %keys, %struct.KeyDecoder* noundef nonnull readonly align 8 dereferenceable(24) nocapture %d) #0 {
entry:
  %parts.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %k.addr = alloca %struct.KeyEvent*, align 8
  %forof.idx = alloca i64, align 8
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %0 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %0, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %1 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %1, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %2 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %2, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %parts.addr, align 8
  store i64 0, i64* %forof.idx, align 8
  br label %forof.cond

forof.cond:
  %3 = load i64, i64* %forof.idx, align 8
  %4 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 0
  %5 = load i64, i64* %4, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %6 = icmp ult i64 %3, %5
  br i1 %6, label %forof.body, label %forof.end

forof.body:
  %7 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %keys, i64 0, i32 2
  %8 = load i8*, i8** %7, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %9 = bitcast i8* %8 to %struct.KeyEvent**
  %10 = getelementptr inbounds %struct.KeyEvent*, %struct.KeyEvent** %9, i64 %3
  %11 = load %struct.KeyEvent*, %struct.KeyEvent** %10, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  store %struct.KeyEvent* %11, %struct.KeyEvent** %k.addr, align 8
  %12 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %13 = load %struct.KeyEvent*, %struct.KeyEvent** %k.addr, align 8
  %14 = getelementptr inbounds %struct.KeyEvent, %struct.KeyEvent* %13, i32 0, i32 0
  %15 = load i32, i32* %14, align 4, !tbaa !21
  %16 = call i8* @kindName(i32 %15)
  %17 = call i8* @nish_str_concat(i8* %16, i8* bitcast ({ i64, [2 x i8] }* @.str.16 to i8*))
  %18 = load %struct.KeyEvent*, %struct.KeyEvent** %k.addr, align 8
  %19 = getelementptr inbounds %struct.KeyEvent, %struct.KeyEvent* %18, i32 0, i32 1
  %20 = load i32, i32* %19, align 4, !tbaa !22
  %21 = call i8* @nish_str_from_i32(i32 %20)
  %22 = call i8* @nish_str_concat(i8* %17, i8* %21)
  %23 = call i8* @nish_str_concat(i8* %22, i8* bitcast ({ i64, [2 x i8] }* @.str.17 to i8*))
  %24 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 0
  %25 = load i64, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %26 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 1
  %27 = load i64, i64* %26, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %28 = icmp eq i64 %25, %27
  br i1 %28, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %12, i64 8)
  br label %push.store

push.store:
  %29 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %12, i64 0, i32 2
  %30 = load i8*, i8** %29, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %31 = bitcast i8* %30 to i8**
  %32 = getelementptr inbounds i8*, i8** %31, i64 %25
  store i8* %23, i8** %32, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %33 = add i64 %25, 1
  store i64 %33, i64* %24, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %34 = trunc i64 %33 to i32
  br label %forof.inc

forof.inc:
  %35 = load i64, i64* %forof.idx, align 8
  %36 = add i64 %35, 1
  store i64 %36, i64* %forof.idx, align 8
  br label %forof.cond

forof.end:
  %37 = call i8* @nish_str_concat(i8* %label, i8* bitcast ({ i64, [4 x i8] }* @.str.18 to i8*))
  %38 = load %struct.nish_array*, %struct.nish_array** %parts.addr, align 8
  %39 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 0
  %40 = load i64, i64* %39, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %41 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.19 to i8*) to i64*
  %42 = load i64, i64* %41, align 8
  %43 = sub i64 %40, 1
  %44 = mul i64 %42, %43
  %45 = icmp eq i64 %40, 0
  %46 = select i1 %45, i64 0, i64 %44
  store i64 %46, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %47 = load i64, i64* %join.at, align 8
  %48 = icmp ult i64 %47, %40
  br i1 %48, label %join.sum.body, label %join.copy

join.sum.body:
  %49 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 2
  %50 = load i8*, i8** %49, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %51 = bitcast i8* %50 to i8**
  %52 = getelementptr inbounds i8*, i8** %51, i64 %47
  %53 = load i8*, i8** %52, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %54 = load i64, i64* %join.total, align 8
  %55 = bitcast i8* %53 to i64*
  %56 = load i64, i64* %55, align 8
  %57 = add i64 %54, %56
  store i64 %57, i64* %join.total, align 8
  %58 = add i64 %47, 1
  store i64 %58, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %59 = load i64, i64* %join.total, align 8
  %60 = icmp ugt i64 %59, 2147483647
  %61 = add i64 %59, 9
  %62 = select i1 %60, i64 4611686018427387904, i64 %61
  %63 = call i8* @nish_alloc_struct(i64 %62)
  %64 = bitcast i8* %63 to i64*
  store i64 %59, i64* %64, align 8
  %65 = getelementptr inbounds i8, i8* %63, i64 8
  store i8* %65, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %66 = load i64, i64* %join.at, align 8
  %67 = icmp ult i64 %66, %40
  br i1 %67, label %join.part, label %join.end

join.part:
  %68 = load i8*, i8** %join.p, align 8
  %69 = icmp eq i64 %66, 0
  %70 = select i1 %69, i64 0, i64 %42
  %71 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.19 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %68, i8* %71, i64 %70, i1 false)
  %72 = getelementptr inbounds i8, i8* %68, i64 %70
  %73 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %38, i64 0, i32 2
  %74 = load i8*, i8** %73, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %75 = bitcast i8* %74 to i8**
  %76 = getelementptr inbounds i8*, i8** %75, i64 %66
  %77 = load i8*, i8** %76, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %78 = bitcast i8* %77 to i64*
  %79 = load i64, i64* %78, align 8
  %80 = getelementptr inbounds i8, i8* %77, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %72, i8* %80, i64 %79, i1 false)
  %81 = getelementptr inbounds i8, i8* %72, i64 %79
  store i8* %81, i8** %join.p, align 8
  %82 = add i64 %66, 1
  store i64 %82, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %83 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %83, align 1
  %84 = call i8* @nish_str_concat(i8* %37, i8* %63)
  %85 = call i8* @nish_str_concat(i8* %84, i8* bitcast ({ i64, [2 x i8] }* @.str.20 to i8*))
  %86 = call i1 @nish.KeyDecoder.waiting(%struct.KeyDecoder* %d)
  br i1 %86, label %cond.true, label %cond.false

cond.true:
  br label %cond.end

cond.false:
  br label %cond.end

cond.end:
  %87 = phi i8* [ bitcast ({ i64, [9 x i8] }* @.str.21 to i8*), %cond.true ], [ bitcast ({ i64, [1 x i8] }* @.str.22 to i8*), %cond.false ]
  %88 = call i8* @nish_str_concat(i8* %85, i8* %87)
  call void @nish_print(i8* %88)
  ret void
}

define noundef i32 @nish_main() #0 {
entry:
  %s.addr = alloca %struct.Screen*, align 8
  %Screen.obj = alloca %struct.Screen, align 8
  %t.addr = alloca %struct.Screen*, align 8
  %Screen.obj.1 = alloca %struct.Screen, align 8
  %red.addr = alloca i32, align 4
  %blue.addr = alloca i32, align 4
  %drawn.addr = alloca i32, align 4
  %q.addr = alloca %struct.Screen*, align 8
  %Screen.obj.2 = alloca %struct.Screen, align 8
  %p.addr = alloca %struct.Screen*, align 8
  %Screen.obj.3 = alloca %struct.Screen, align 8
  %y.addr = alloca %struct.Screen*, align 8
  %Screen.obj.4 = alloca %struct.Screen, align 8
  %cs.addr = alloca %struct.Screen*, align 8
  %c.addr = alloca %struct.Canvas*, align 8
  %Canvas.obj = alloca %struct.Canvas, align 8
  %game.addr = alloca %struct.Screen*, align 8
  %Screen.obj.5 = alloca %struct.Screen, align 8
  %sent.addr = alloca i32, align 4
  %f.addr = alloca i32, align 4
  %out.addr = alloca i8*, align 8
  %logic.addr = alloca %struct.FixedStep*, align 8
  %FixedStep.obj = alloca %struct.FixedStep, align 8
  %steps.addr = alloca %struct.nish_array*, align 8
  %arr.hdr = alloca %struct.nish_array, align 8
  %join.total = alloca i64, align 8
  %join.at = alloca i64, align 8
  %join.p = alloca i8*, align 8
  %behind.addr = alloca %struct.FixedStep*, align 8
  %FixedStep.obj.1 = alloca %struct.FixedStep, align 8
  %caught.addr = alloca i32, align 4
  %draw.addr = alloca %struct.FixedStep*, align 8
  %FixedStep.obj.2 = alloca %struct.FixedStep, align 8
  %frames.addr = alloca i32, align 4
  %ms.addr = alloca i32, align 4
  %odd.addr = alloca %struct.FixedStep*, align 8
  %FixedStep.obj.3 = alloca %struct.FixedStep, align 8
  %d.addr = alloca %struct.KeyDecoder*, align 8
  %KeyDecoder.obj = alloca %struct.KeyDecoder, align 8
  %arr.hdr.1 = alloca %struct.nish_array, align 8
  %arr.data = alloca [12 x i32], align 8
  %arr.hdr.2 = alloca %struct.nish_array, align 8
  %arr.data.1 = alloca [8 x i32], align 8
  %arr.hdr.3 = alloca %struct.nish_array, align 8
  %arr.data.2 = alloca [8 x i32], align 8
  %arr.hdr.4 = alloca %struct.nish_array, align 8
  %arr.data.3 = alloca [3 x i32], align 8
  %arr.hdr.5 = alloca %struct.nish_array, align 8
  %arr.data.4 = alloca [1 x i32], align 8
  %arr.hdr.6 = alloca %struct.nish_array, align 8
  %arr.data.5 = alloca [2 x i32], align 8
  %arr.hdr.7 = alloca %struct.nish_array, align 8
  %arr.data.6 = alloca [2 x i32], align 8
  %arr.hdr.8 = alloca %struct.nish_array, align 8
  %arr.data.7 = alloca [1 x i32], align 8
  %arr.hdr.9 = alloca %struct.nish_array, align 8
  %arr.data.8 = alloca [2 x i32], align 8
  %arr.hdr.10 = alloca %struct.nish_array, align 8
  %arr.data.9 = alloca [1 x i32], align 8
  %arr.hdr.11 = alloca %struct.nish_array, align 8
  %arr.data.10 = alloca [6 x i32], align 8
  %arr.hdr.12 = alloca %struct.nish_array, align 8
  %arr.data.11 = alloca [4 x i32], align 8
  %arr.hdr.13 = alloca %struct.nish_array, align 8
  %arr.data.12 = alloca [1 x i32], align 8
  %arr.hdr.14 = alloca %struct.nish_array, align 8
  %arr.data.13 = alloca [2 x i32], align 8
  %arr.hdr.15 = alloca %struct.nish_array, align 8
  %arr.data.14 = alloca [4 x i32], align 8
  %arr.hdr.16 = alloca %struct.nish_array, align 8
  %arr.data.15 = alloca [1 x i32], align 8
  %arr.hdr.17 = alloca %struct.nish_array, align 8
  %arr.data.16 = alloca [1 x i32], align 8
  %arr.hdr.18 = alloca %struct.nish_array, align 8
  %arr.data.17 = alloca [1 x i32], align 8
  %arr.hdr.19 = alloca %struct.nish_array, align 8
  %arr.data.18 = alloca [1 x i32], align 8
  %arr.hdr.20 = alloca %struct.nish_array, align 8
  %arr.data.19 = alloca [2 x i32], align 8
  %arr.hdr.21 = alloca %struct.nish_array, align 8
  %arr.data.20 = alloca [3 x i32], align 8
  %arr.hdr.22 = alloca %struct.nish_array, align 8
  %arr.data.21 = alloca [3 x i32], align 8
  %arr.hdr.23 = alloca %struct.nish_array, align 8
  %arr.hdr.24 = alloca %struct.nish_array, align 8
  %arr.data.22 = alloca [1 x i32], align 8
  %arr.hdr.25 = alloca %struct.nish_array, align 8
  %arr.data.23 = alloca [1 x i32], align 8
  %arr.hdr.26 = alloca %struct.nish_array, align 8
  %arr.data.24 = alloca [3 x i32], align 8
  %arr.hdr.27 = alloca %struct.nish_array, align 8
  %arr.data.25 = alloca [3 x i32], align 8
  %arr.hdr.28 = alloca %struct.nish_array, align 8
  %arr.data.26 = alloca [10 x i32], align 8
  %arr.hdr.29 = alloca %struct.nish_array, align 8
  %arr.data.27 = alloca [4 x i32], align 8
  %arena.mark = call i64 @nish_arena_mark()
  %0 = call i8* @nish.enterAltScreen()
  call void @frame(i8* bitcast ({ i64, [6 x i8] }* @.str.8 to i8*), i8* %0)
  %1 = call i8* @nish.leaveAltScreen()
  call void @frame(i8* bitcast ({ i64, [6 x i8] }* @.str.23 to i8*), i8* %1)
  %2 = call i8* @nish.hideCursor()
  call void @frame(i8* bitcast ({ i64, [5 x i8] }* @.str.24 to i8*), i8* %2)
  %3 = call i8* @nish.showCursor()
  call void @frame(i8* bitcast ({ i64, [5 x i8] }* @.str.25 to i8*), i8* %3)
  %4 = call i8* @nish.clearScreen()
  call void @frame(i8* bitcast ({ i64, [6 x i8] }* @.str.26 to i8*), i8* %4)
  %5 = call i8* @nish.resetStyle()
  call void @frame(i8* bitcast ({ i64, [6 x i8] }* @.str.27 to i8*), i8* %5)
  %6 = call i64 @nish_arena_mark()
  %7 = call i8* @nish.moveCursor(i32 3, i32 1)
  %8 = call i8* @nish_arena_keep(i64 %6, i8* %7)
  call void @frame(i8* bitcast ({ i64, [9 x i8] }* @.str.28 to i8*), i8* %8)
  %9 = call i8* @nish.beginSync()
  %10 = call i8* @nish_str_concat(i8* %9, i8* bitcast ({ i64, [3 x i8] }* @.str.30 to i8*))
  %11 = call i8* @nish.endSync()
  %12 = call i8* @nish_str_concat(i8* %10, i8* %11)
  call void @frame(i8* bitcast ({ i64, [5 x i8] }* @.str.29 to i8*), i8* %12)
  %13 = call i32 @nish.rgb(i32 300, i32 -4, i32 128)
  %14 = call i32 @nish.rgb(i32 255, i32 0, i32 128)
  %15 = icmp eq i32 %13, %14
  %16 = select i1 %15, i8* bitcast ({ i64, [5 x i8] }* @.str.32 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.33 to i8*)
  %17 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.31 to i8*), i8* %16)
  call void @nish_print(i8* %17)
  %18 = call i32 @nish.rgb(i32 255, i32 0, i32 0)
  %19 = call i32 @nish.paletteIndex(i32 %18)
  %20 = call i8* @nish_str_from_i32(i32 %19)
  %21 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.34 to i8*), i8* %20)
  %22 = call i8* @nish_str_concat(i8* %21, i8* bitcast ({ i64, [7 x i8] }* @.str.35 to i8*))
  %23 = call i32 @nish.rgb(i32 128, i32 128, i32 128)
  %24 = call i32 @nish.paletteIndex(i32 %23)
  %25 = call i8* @nish_str_from_i32(i32 %24)
  %26 = call i8* @nish_str_concat(i8* %22, i8* %25)
  %27 = call i8* @nish_str_concat(i8* %26, i8* bitcast ({ i64, [13 x i8] }* @.str.36 to i8*))
  %28 = call i32 @nish.rgb(i32 8, i32 8, i32 8)
  %29 = call i32 @nish.paletteIndex(i32 %28)
  %30 = call i8* @nish_str_from_i32(i32 %29)
  %31 = call i8* @nish_str_concat(i8* %27, i8* %30)
  %32 = call i8* @nish_str_concat(i8* %31, i8* bitcast ({ i64, [8 x i8] }* @.str.37 to i8*))
  %33 = call i32 @nish.rgb(i32 255, i32 255, i32 255)
  %34 = call i32 @nish.paletteIndex(i32 %33)
  %35 = call i8* @nish_str_from_i32(i32 %34)
  %36 = call i8* @nish_str_concat(i8* %32, i8* %35)
  %37 = call i8* @nish_str_concat(i8* %36, i8* bitcast ({ i64, [10 x i8] }* @.str.38 to i8*))
  %38 = call i32 @nish.paletteIndex(i32 -1)
  %39 = call i8* @nish_str_from_i32(i32 %38)
  %40 = call i8* @nish_str_concat(i8* %37, i8* %39)
  call void @nish_print(i8* %40)
  call void @nish.Screen.constructor(%struct.Screen* %Screen.obj, i32 4, i32 2, i1 false)
  store %struct.Screen* %Screen.obj, %struct.Screen** %s.addr, align 8
  %41 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  %42 = call i64 @nish_arena_mark()
  %43 = call i8* @nish.Screen.flush(%struct.Screen* %41)
  %44 = call i8* @nish_arena_keep(i64 %42, i8* %43)
  call void @frame(i8* bitcast ({ i64, [10 x i8] }* @.str.39 to i8*), i8* %44)
  %45 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  %46 = call i64 @nish_arena_mark()
  %47 = call i8* @nish.Screen.flush(%struct.Screen* %45)
  %48 = call i8* @nish_arena_keep(i64 %46, i8* %47)
  %49 = bitcast i8* %48 to i64*
  %50 = load i64, i64* %49, align 8
  %51 = trunc i64 %50 to i32
  %52 = call i8* @nish_str_from_i32(i32 %51)
  %53 = call i8* @nish_str_concat(i8* bitcast ({ i64, [12 x i8] }* @.str.40 to i8*), i8* %52)
  call void @nish_print(i8* %53)
  %54 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %54, i32 2, i32 1, i32 88, i32 -1, i32 -1, i32 0)
  %55 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  %56 = call i64 @nish_arena_mark()
  %57 = call i8* @nish.Screen.flush(%struct.Screen* %55)
  %58 = call i8* @nish_arena_keep(i64 %56, i8* %57)
  call void @frame(i8* bitcast ({ i64, [9 x i8] }* @.str.41 to i8*), i8* %58)
  %59 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %59, i32 0, i32 0, i32 65, i32 -1, i32 -1, i32 0)
  %60 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %60, i32 2, i32 0, i32 66, i32 -1, i32 -1, i32 0)
  %61 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  %62 = call i64 @nish_arena_mark()
  %63 = call i8* @nish.Screen.flush(%struct.Screen* %61)
  %64 = call i8* @nish_arena_keep(i64 %62, i8* %63)
  call void @frame(i8* bitcast ({ i64, [20 x i8] }* @.str.42 to i8*), i8* %64)
  %65 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %65, i32 0, i32 0, i32 67, i32 -1, i32 -1, i32 0)
  %66 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  %67 = call i32 @nish.rgb(i32 255, i32 0, i32 0)
  call void @nish.Screen.set(%struct.Screen* %66, i32 3, i32 0, i32 68, i32 %67, i32 -1, i32 0)
  %68 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  %69 = call i64 @nish_arena_mark()
  %70 = call i8* @nish.Screen.flush(%struct.Screen* %68)
  %71 = call i8* @nish_arena_keep(i64 %69, i8* %70)
  call void @frame(i8* bitcast ({ i64, [35 x i8] }* @.str.43 to i8*), i8* %71)
  %72 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %72, i32 0, i32 1, i32 69, i32 -1, i32 -1, i32 0)
  %73 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %73, i32 0, i32 0, i32 32, i32 -1, i32 -1, i32 0)
  %74 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  %75 = call i64 @nish_arena_mark()
  %76 = call i8* @nish.Screen.flush(%struct.Screen* %74)
  %77 = call i8* @nish_arena_keep(i64 %75, i8* %76)
  call void @frame(i8* bitcast ({ i64, [21 x i8] }* @.str.44 to i8*), i8* %77)
  %78 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %78, i32 9, i32 9, i32 90, i32 -1, i32 -1, i32 0)
  %79 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %79, i32 -1, i32 0, i32 90, i32 -1, i32 -1, i32 0)
  %80 = load %struct.Screen*, %struct.Screen** %s.addr, align 8
  %81 = call i64 @nish_arena_mark()
  %82 = call i8* @nish.Screen.flush(%struct.Screen* %80)
  %83 = call i8* @nish_arena_keep(i64 %81, i8* %82)
  %84 = bitcast i8* %83 to i64*
  %85 = load i64, i64* %84, align 8
  %86 = trunc i64 %85 to i32
  %87 = call i8* @nish_str_from_i32(i32 %86)
  %88 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.45 to i8*), i8* %87)
  call void @nish_print(i8* %88)
  call void @nish.Screen.constructor(%struct.Screen* %Screen.obj.1, i32 6, i32 1, i1 false)
  store %struct.Screen* %Screen.obj.1, %struct.Screen** %t.addr, align 8
  %89 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %90 = call i64 @nish_arena_mark()
  %91 = call i8* @nish.Screen.flush(%struct.Screen* %89)
  %92 = call i8* @nish_arena_keep(i64 %90, i8* %91)
  %93 = call i32 @nish.rgb(i32 255, i32 0, i32 0)
  store i32 %93, i32* %red.addr, align 4
  %94 = call i32 @nish.rgb(i32 0, i32 0, i32 255)
  store i32 %94, i32* %blue.addr, align 4
  %95 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %96 = load i32, i32* %red.addr, align 4
  %97 = load i32, i32* %blue.addr, align 4
  %98 = call i32 @nish.Screen.text(%struct.Screen* %95, i32 0, i32 0, i8* bitcast ({ i64, [3 x i8] }* @.str.46 to i8*), i32 %96, i32 %97, i32 1)
  store i32 %98, i32* %drawn.addr, align 4
  %99 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %100 = load i32, i32* %drawn.addr, align 4
  %101 = load i32, i32* %red.addr, align 4
  %102 = load i32, i32* %blue.addr, align 4
  %103 = call i32 @nish.Screen.text(%struct.Screen* %99, i32 %100, i32 0, i8* bitcast ({ i64, [3 x i8] }* @.str.47 to i8*), i32 %101, i32 %102, i32 2)
  %104 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %105 = call i32 @nish.Screen.text(%struct.Screen* %104, i32 4, i32 0, i8* bitcast ({ i64, [4 x i8] }* @.str.48 to i8*), i32 -1, i32 -1, i32 0)
  %106 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %107 = call i64 @nish_arena_mark()
  %108 = call i8* @nish.Screen.flush(%struct.Screen* %106)
  %109 = call i8* @nish_arena_keep(i64 %107, i8* %108)
  call void @frame(i8* bitcast ({ i64, [11 x i8] }* @.str.49 to i8*), i8* %109)
  %110 = load i32, i32* %drawn.addr, align 4
  %111 = call i8* @nish_str_from_i32(i32 %110)
  %112 = call i8* @nish_str_concat(i8* bitcast ({ i64, [14 x i8] }* @.str.50 to i8*), i8* %111)
  %113 = call i8* @nish_str_concat(i8* %112, i8* bitcast ({ i64, [17 x i8] }* @.str.51 to i8*))
  %114 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %115 = call i32 @nish.Screen.glyphAt(%struct.Screen* %114, i32 4, i32 0)
  %116 = call i8* @nish_str_from_i32(i32 %115)
  %117 = call i8* @nish_str_concat(i8* %113, i8* %116)
  call void @nish_print(i8* %117)
  %118 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %119 = load i32, i32* %red.addr, align 4
  %120 = load i32, i32* %blue.addr, align 4
  %121 = or i32 1, 2
  %122 = call i32 @nish.Screen.text(%struct.Screen* %118, i32 0, i32 0, i8* bitcast ({ i64, [3 x i8] }* @.str.46 to i8*), i32 %119, i32 %120, i32 %121)
  %123 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %124 = call i64 @nish_arena_mark()
  %125 = call i8* @nish.Screen.flush(%struct.Screen* %123)
  %126 = call i8* @nish_arena_keep(i64 %124, i8* %125)
  call void @frame(i8* bitcast ({ i64, [12 x i8] }* @.str.52 to i8*), i8* %126)
  %127 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  call void @nish.Screen.clear(%struct.Screen* %127, i32 -1)
  %128 = load %struct.Screen*, %struct.Screen** %t.addr, align 8
  %129 = call i64 @nish_arena_mark()
  %130 = call i8* @nish.Screen.flush(%struct.Screen* %128)
  %131 = call i8* @nish_arena_keep(i64 %129, i8* %130)
  call void @frame(i8* bitcast ({ i64, [8 x i8] }* @.str.53 to i8*), i8* %131)
  call void @nish.Screen.constructor(%struct.Screen* %Screen.obj.2, i32 4, i32 1, i1 false)
  store %struct.Screen* %Screen.obj.2, %struct.Screen** %q.addr, align 8
  %132 = load %struct.Screen*, %struct.Screen** %q.addr, align 8
  %133 = call i64 @nish_arena_mark()
  %134 = call i8* @nish.Screen.flush(%struct.Screen* %132)
  %135 = call i8* @nish_arena_keep(i64 %133, i8* %134)
  %136 = load %struct.Screen*, %struct.Screen** %q.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %136, i32 0, i32 0, i32 65, i32 -1, i32 -1, i32 64)
  %137 = load %struct.Screen*, %struct.Screen** %q.addr, align 8
  %138 = call i64 @nish_arena_mark()
  %139 = call i8* @nish.Screen.flush(%struct.Screen* %137)
  %140 = call i8* @nish_arena_keep(i64 %138, i8* %139)
  call void @frame(i8* bitcast ({ i64, [23 x i8] }* @.str.54 to i8*), i8* %140)
  %141 = load %struct.Screen*, %struct.Screen** %q.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %141, i32 0, i32 0, i32 7, i32 -1, i32 -1, i32 0)
  %142 = load %struct.Screen*, %struct.Screen** %q.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %142, i32 1, i32 0, i32 -5, i32 -1, i32 -1, i32 0)
  %143 = load %struct.Screen*, %struct.Screen** %q.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %143, i32 2, i32 0, i32 55296, i32 -1, i32 -1, i32 0)
  %144 = load %struct.Screen*, %struct.Screen** %q.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %144, i32 3, i32 0, i32 127, i32 -1, i32 -1, i32 0)
  %145 = load %struct.Screen*, %struct.Screen** %q.addr, align 8
  %146 = call i64 @nish_arena_mark()
  %147 = call i8* @nish.Screen.flush(%struct.Screen* %145)
  %148 = call i8* @nish_arena_keep(i64 %146, i8* %147)
  call void @frame(i8* bitcast ({ i64, [34 x i8] }* @.str.55 to i8*), i8* %148)
  %149 = load %struct.Screen*, %struct.Screen** %q.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %149, i32 0, i32 0, i32 65, i32 -1, i32 -1, i32 0)
  %150 = load %struct.Screen*, %struct.Screen** %q.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %150, i32 2, i32 0, i32 66, i32 -1, i32 -1, i32 0)
  %151 = load %struct.Screen*, %struct.Screen** %q.addr, align 8
  %152 = call i64 @nish_arena_mark()
  %153 = call i8* @nish.Screen.flush(%struct.Screen* %151)
  %154 = call i8* @nish_arena_keep(i64 %152, i8* %153)
  call void @frame(i8* bitcast ({ i64, [26 x i8] }* @.str.56 to i8*), i8* %154)
  call void @nish.Screen.constructor(%struct.Screen* %Screen.obj.3, i32 3, i32 1, i1 true)
  store %struct.Screen* %Screen.obj.3, %struct.Screen** %p.addr, align 8
  %155 = load %struct.Screen*, %struct.Screen** %p.addr, align 8
  %156 = call i32 @nish.rgb(i32 255, i32 0, i32 0)
  %157 = call i32 @nish.rgb(i32 0, i32 0, i32 0)
  %158 = call i32 @nish.Screen.text(%struct.Screen* %155, i32 0, i32 0, i8* bitcast ({ i64, [3 x i8] }* @.str.57 to i8*), i32 %156, i32 %157, i32 0)
  %159 = load %struct.Screen*, %struct.Screen** %p.addr, align 8
  %160 = call i64 @nish_arena_mark()
  %161 = call i8* @nish.Screen.flush(%struct.Screen* %159)
  %162 = call i8* @nish_arena_keep(i64 %160, i8* %161)
  call void @frame(i8* bitcast ({ i64, [12 x i8] }* @.str.58 to i8*), i8* %162)
  call void @nish.Screen.constructor(%struct.Screen* %Screen.obj.4, i32 3, i32 1, i1 false)
  store %struct.Screen* %Screen.obj.4, %struct.Screen** %y.addr, align 8
  %163 = load %struct.Screen*, %struct.Screen** %y.addr, align 8
  %164 = getelementptr inbounds %struct.Screen, %struct.Screen* %163, i32 0, i32 13
  store i1 true, i1* %164, align 1, !tbaa !26
  %165 = load %struct.Screen*, %struct.Screen** %y.addr, align 8
  %166 = call i64 @nish_arena_mark()
  %167 = call i8* @nish.Screen.flush(%struct.Screen* %165)
  %168 = call i8* @nish_arena_keep(i64 %166, i8* %167)
  call void @frame(i8* bitcast ({ i64, [17 x i8] }* @.str.59 to i8*), i8* %168)
  %169 = load %struct.Screen*, %struct.Screen** %y.addr, align 8
  %170 = call i64 @nish_arena_mark()
  %171 = call i8* @nish.Screen.flush(%struct.Screen* %169)
  %172 = call i8* @nish_arena_keep(i64 %170, i8* %171)
  %173 = bitcast i8* %172 to i64*
  %174 = load i64, i64* %173, align 8
  %175 = trunc i64 %174 to i32
  %176 = call i8* @nish_str_from_i32(i32 %175)
  %177 = call i8* @nish_str_concat(i8* bitcast ({ i64, [17 x i8] }* @.str.60 to i8*), i8* %176)
  call void @nish_print(i8* %177)
  %178 = load %struct.Screen*, %struct.Screen** %y.addr, align 8
  %179 = load i32, i32* %red.addr, align 4
  call void @nish.Screen.set(%struct.Screen* %178, i32 1, i32 0, i32 90, i32 %179, i32 -1, i32 0)
  %180 = load %struct.Screen*, %struct.Screen** %y.addr, align 8
  %181 = call i64 @nish_arena_mark()
  %182 = call i8* @nish.Screen.flush(%struct.Screen* %180)
  %183 = call i8* @nish_arena_keep(i64 %181, i8* %182)
  call void @frame(i8* bitcast ({ i64, [21 x i8] }* @.str.61 to i8*), i8* %183)
  %184 = load %struct.Screen*, %struct.Screen** %y.addr, align 8
  %185 = getelementptr inbounds %struct.Screen, %struct.Screen* %184, i32 0, i32 13
  store i1 false, i1* %185, align 1, !tbaa !26
  %186 = load %struct.Screen*, %struct.Screen** %y.addr, align 8
  call void @nish.Screen.set(%struct.Screen* %186, i32 1, i32 0, i32 89, i32 -1, i32 -1, i32 0)
  %187 = load %struct.Screen*, %struct.Screen** %y.addr, align 8
  %188 = call i64 @nish_arena_mark()
  %189 = call i8* @nish.Screen.flush(%struct.Screen* %187)
  %190 = call i8* @nish_arena_keep(i64 %188, i8* %189)
  call void @frame(i8* bitcast ({ i64, [16 x i8] }* @.str.62 to i8*), i8* %190)
  %191 = call i8* @nish_alloc_struct(i64 88)
  %192 = bitcast i8* %191 to %struct.Screen*
  call void @nish.Screen.constructor(%struct.Screen* %192, i32 4, i32 2, i1 false)
  store %struct.Screen* %192, %struct.Screen** %cs.addr, align 8
  %193 = load %struct.Screen*, %struct.Screen** %cs.addr, align 8
  call void @nish.Canvas.constructor(%struct.Canvas* %Canvas.obj, %struct.Screen* %193)
  store %struct.Canvas* %Canvas.obj, %struct.Canvas** %c.addr, align 8
  %194 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %195 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %194, i32 0, i32 1
  %196 = load i32, i32* %195, align 4, !tbaa !28
  %197 = call i8* @nish_str_from_i32(i32 %196)
  %198 = call i8* @nish_str_concat(i8* bitcast ({ i64, [8 x i8] }* @.str.63 to i8*), i8* %197)
  %199 = call i8* @nish_str_concat(i8* %198, i8* bitcast ({ i64, [2 x i8] }* @.str.64 to i8*))
  %200 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %201 = getelementptr inbounds %struct.Canvas, %struct.Canvas* %200, i32 0, i32 2
  %202 = load i32, i32* %201, align 4, !tbaa !29
  %203 = call i8* @nish_str_from_i32(i32 %202)
  %204 = call i8* @nish_str_concat(i8* %199, i8* %203)
  call void @nish_print(i8* %204)
  %205 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %206 = load i32, i32* %red.addr, align 4
  call void @nish.Canvas.setPixel(%struct.Canvas* %205, i32 0, i32 0, i32 %206)
  %207 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %208 = load i32, i32* %blue.addr, align 4
  call void @nish.Canvas.setPixel(%struct.Canvas* %207, i32 1, i32 1, i32 %208)
  %209 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %210 = load i32, i32* %red.addr, align 4
  call void @nish.Canvas.setPixel(%struct.Canvas* %209, i32 2, i32 0, i32 %210)
  %211 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %212 = load i32, i32* %blue.addr, align 4
  call void @nish.Canvas.setPixel(%struct.Canvas* %211, i32 2, i32 1, i32 %212)
  %213 = load %struct.Screen*, %struct.Screen** %cs.addr, align 8
  %214 = call i64 @nish_arena_mark()
  %215 = call i8* @nish.Screen.flush(%struct.Screen* %213)
  %216 = call i8* @nish_arena_keep(i64 %214, i8* %215)
  call void @frame(i8* bitcast ({ i64, [7 x i8] }* @.str.65 to i8*), i8* %216)
  %217 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %218 = call i32 @nish.rgb(i32 0, i32 255, i32 0)
  call void @nish.Canvas.fillRect(%struct.Canvas* %217, i32 0, i32 2, i32 4, i32 2, i32 %218)
  %219 = load %struct.Screen*, %struct.Screen** %cs.addr, align 8
  %220 = call i64 @nish_arena_mark()
  %221 = call i8* @nish.Screen.flush(%struct.Screen* %219)
  %222 = call i8* @nish_arena_keep(i64 %220, i8* %221)
  call void @frame(i8* bitcast ({ i64, [9 x i8] }* @.str.66 to i8*), i8* %222)
  %223 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  call void @nish.Canvas.clear(%struct.Canvas* %223, i32 -1)
  %224 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %225 = load i32, i32* %red.addr, align 4
  call void @nish.Canvas.line(%struct.Canvas* %224, i32 0, i32 0, i32 3, i32 3, i32 %225)
  %226 = load %struct.Screen*, %struct.Screen** %cs.addr, align 8
  %227 = call i64 @nish_arena_mark()
  %228 = call i8* @nish.Screen.flush(%struct.Screen* %226)
  %229 = call i8* @nish_arena_keep(i64 %227, i8* %228)
  call void @frame(i8* bitcast ({ i64, [5 x i8] }* @.str.67 to i8*), i8* %229)
  %230 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %231 = call i32 @nish.Canvas.pixel(%struct.Canvas* %230, i32 1, i32 1)
  %232 = load i32, i32* %red.addr, align 4
  %233 = icmp eq i32 %231, %232
  %234 = select i1 %233, i8* bitcast ({ i64, [5 x i8] }* @.str.32 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.33 to i8*)
  %235 = call i8* @nish_str_concat(i8* bitcast ({ i64, [13 x i8] }* @.str.68 to i8*), i8* %234)
  %236 = call i8* @nish_str_concat(i8* %235, i8* bitcast ({ i64, [8 x i8] }* @.str.69 to i8*))
  %237 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %238 = call i32 @nish.Canvas.pixel(%struct.Canvas* %237, i32 1, i32 2)
  %239 = icmp eq i32 %238, -1
  %240 = select i1 %239, i8* bitcast ({ i64, [5 x i8] }* @.str.32 to i8*), i8* bitcast ({ i64, [6 x i8] }* @.str.33 to i8*)
  %241 = call i8* @nish_str_concat(i8* %236, i8* %240)
  %242 = call i8* @nish_str_concat(i8* %241, i8* bitcast ({ i64, [6 x i8] }* @.str.70 to i8*))
  %243 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %244 = call i32 @nish.Canvas.pixel(%struct.Canvas* %243, i32 9, i32 0)
  %245 = call i8* @nish_str_from_i32(i32 %244)
  %246 = call i8* @nish_str_concat(i8* %242, i8* %245)
  call void @nish_print(i8* %246)
  %247 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  call void @nish.Canvas.clear(%struct.Canvas* %247, i32 -1)
  %248 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %249 = load i32, i32* %red.addr, align 4
  call void @nish.Canvas.line(%struct.Canvas* %248, i32 1, i32 0, i32 2000000000, i32 1, i32 %249)
  %250 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %251 = load i32, i32* %blue.addr, align 4
  call void @nish.Canvas.line(%struct.Canvas* %250, i32 3, i32 3, i32 -2000000000, i32 -1000000000, i32 %251)
  %252 = load %struct.Screen*, %struct.Screen** %cs.addr, align 8
  %253 = call i64 @nish_arena_mark()
  %254 = call i8* @nish.Screen.flush(%struct.Screen* %252)
  %255 = call i8* @nish_arena_keep(i64 %253, i8* %254)
  call void @frame(i8* bitcast ({ i64, [40 x i8] }* @.str.71 to i8*), i8* %255)
  %256 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %257 = load i32, i32* %blue.addr, align 4
  call void @nish.Canvas.fillRect(%struct.Canvas* %256, i32 -2, i32 -2, i32 100, i32 100, i32 %257)
  %258 = load %struct.Canvas*, %struct.Canvas** %c.addr, align 8
  %259 = load i32, i32* %red.addr, align 4
  %260 = call i32 @nish.Canvas.text(%struct.Canvas* %258, i32 1, i32 0, i8* bitcast ({ i64, [3 x i8] }* @.str.72 to i8*), i32 %259)
  %261 = load %struct.Screen*, %struct.Screen** %cs.addr, align 8
  %262 = call i64 @nish_arena_mark()
  %263 = call i8* @nish.Screen.flush(%struct.Screen* %261)
  %264 = call i8* @nish_arena_keep(i64 %262, i8* %263)
  call void @frame(i8* bitcast ({ i64, [17 x i8] }* @.str.73 to i8*), i8* %264)
  call void @nish.Screen.constructor(%struct.Screen* %Screen.obj.5, i32 8, i32 2, i1 false)
  store %struct.Screen* %Screen.obj.5, %struct.Screen** %game.addr, align 8
  store i32 0, i32* %sent.addr, align 4
  store i32 0, i32* %f.addr, align 4
  br label %for.cond

for.cond:
  %265 = load i32, i32* %f.addr, align 4
  %266 = icmp slt i32 %265, 1000
  br i1 %266, label %for.body, label %for.end

for.body:
  %267 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %268 = load i8*, i8** %267, align 8
  %269 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  %270 = load i64, i64* %269, align 8
  %271 = load %struct.Screen*, %struct.Screen** %game.addr, align 8
  %272 = load i32, i32* %f.addr, align 4
  %273 = srem i32 %272, 8
  %274 = load i32, i32* %f.addr, align 4
  %275 = srem i32 %274, 2
  %276 = load i32, i32* %f.addr, align 4
  %277 = srem i32 %276, 26
  %278 = add nsw i32 65, %277
  %279 = load i32, i32* %f.addr, align 4
  %280 = srem i32 %279, 256
  %281 = call i32 @nish.rgb(i32 %280, i32 0, i32 0)
  call void @nish.Screen.set(%struct.Screen* %271, i32 %273, i32 %275, i32 %278, i32 %281, i32 -1, i32 0)
  %282 = load %struct.Screen*, %struct.Screen** %game.addr, align 8
  %283 = call i64 @nish_arena_mark()
  %284 = call i8* @nish.Screen.flush(%struct.Screen* %282)
  %285 = call i8* @nish_arena_keep(i64 %283, i8* %284)
  store i8* %285, i8** %out.addr, align 8
  %286 = load i32, i32* %sent.addr, align 4
  %287 = load i8*, i8** %out.addr, align 8
  %288 = bitcast i8* %287 to i64*
  %289 = load i64, i64* %288, align 8
  %290 = trunc i64 %289 to i32
  %291 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %286, i32 %290)
  %292 = extractvalue { i32, i1 } %291, 0
  %293 = extractvalue { i32, i1 } %291, 1
  br i1 %293, label %ovf.fail, label %ovf.ok

ovf.ok:
  store i32 %292, i32* %sent.addr, align 4
  %294 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 0
  %295 = load i8*, i8** %294, align 8
  %296 = icmp eq i8* %295, %268
  br i1 %296, label %pass.rewind, label %pass.free

pass.rewind:
  %297 = getelementptr inbounds %struct.nish_arena, %struct.nish_arena* @nish_arena, i64 0, i32 1
  store i64 %270, i64* %297, align 8
  br label %pass.done

pass.free:
  %298 = ptrtoint i8* %268 to i64
  %299 = add i64 %298, %270
  call void @nish_arena_release(i64 %299)
  br label %pass.done

pass.done:
  br label %for.inc

for.inc:
  %300 = load i32, i32* %f.addr, align 4
  %301 = add nsw i32 %300, 1
  store i32 %301, i32* %f.addr, align 4
  br label %for.cond

for.end:
  %302 = load i32, i32* %sent.addr, align 4
  %303 = call i8* @nish_str_from_i32(i32 %302)
  %304 = call i8* @nish_str_concat(i8* bitcast ({ i64, [17 x i8] }* @.str.74 to i8*), i8* %303)
  %305 = call i8* @nish_str_concat(i8* %304, i8* bitcast ({ i64, [7 x i8] }* @.str.75 to i8*))
  call void @nish_print(i8* %305)
  call void @nish.FixedStep.constructor(%struct.FixedStep* %FixedStep.obj, i32 250, i32 8)
  store %struct.FixedStep* %FixedStep.obj, %struct.FixedStep** %logic.addr, align 8
  %306 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 0
  store i64 0, i64* %306, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %307 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 1
  store i64 0, i64* %307, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %308 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr, i64 0, i32 2
  store i8* null, i8** %308, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  store %struct.nish_array* %arr.hdr, %struct.nish_array** %steps.addr, align 8
  %309 = load %struct.nish_array*, %struct.nish_array** %steps.addr, align 8
  %310 = load %struct.FixedStep*, %struct.FixedStep** %logic.addr, align 8
  %311 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %310, double 0x408F400000000000)
  %312 = call i8* @nish_str_from_i32(i32 %311)
  %313 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %309, i64 0, i32 0
  %314 = load i64, i64* %313, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %315 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %309, i64 0, i32 1
  %316 = load i64, i64* %315, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %317 = icmp eq i64 %314, %316
  br i1 %317, label %push.grow, label %push.store

push.grow:
  call void @nish_array_grow(%struct.nish_array* %309, i64 8)
  br label %push.store

push.store:
  %318 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %309, i64 0, i32 2
  %319 = load i8*, i8** %318, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %320 = bitcast i8* %319 to i8**
  %321 = getelementptr inbounds i8*, i8** %320, i64 %314
  store i8* %312, i8** %321, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %322 = add i64 %314, 1
  store i64 %322, i64* %313, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %323 = trunc i64 %322 to i32
  %324 = load %struct.nish_array*, %struct.nish_array** %steps.addr, align 8
  %325 = load %struct.FixedStep*, %struct.FixedStep** %logic.addr, align 8
  %326 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %325, double 0x408F580000000000)
  %327 = call i8* @nish_str_from_i32(i32 %326)
  %328 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %324, i64 0, i32 0
  %329 = load i64, i64* %328, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %330 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %324, i64 0, i32 1
  %331 = load i64, i64* %330, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %332 = icmp eq i64 %329, %331
  br i1 %332, label %push.grow.1, label %push.store.1

push.grow.1:
  call void @nish_array_grow(%struct.nish_array* %324, i64 8)
  br label %push.store.1

push.store.1:
  %333 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %324, i64 0, i32 2
  %334 = load i8*, i8** %333, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %335 = bitcast i8* %334 to i8**
  %336 = getelementptr inbounds i8*, i8** %335, i64 %329
  store i8* %327, i8** %336, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %337 = add i64 %329, 1
  store i64 %337, i64* %328, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %338 = trunc i64 %337 to i32
  %339 = load %struct.nish_array*, %struct.nish_array** %steps.addr, align 8
  %340 = load %struct.FixedStep*, %struct.FixedStep** %logic.addr, align 8
  %341 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %340, double 0x408F880000000000)
  %342 = call i8* @nish_str_from_i32(i32 %341)
  %343 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %339, i64 0, i32 0
  %344 = load i64, i64* %343, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %345 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %339, i64 0, i32 1
  %346 = load i64, i64* %345, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %347 = icmp eq i64 %344, %346
  br i1 %347, label %push.grow.2, label %push.store.2

push.grow.2:
  call void @nish_array_grow(%struct.nish_array* %339, i64 8)
  br label %push.store.2

push.store.2:
  %348 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %339, i64 0, i32 2
  %349 = load i8*, i8** %348, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %350 = bitcast i8* %349 to i8**
  %351 = getelementptr inbounds i8*, i8** %350, i64 %344
  store i8* %342, i8** %351, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %352 = add i64 %344, 1
  store i64 %352, i64* %343, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %353 = trunc i64 %352 to i32
  %354 = load %struct.nish_array*, %struct.nish_array** %steps.addr, align 8
  %355 = load %struct.FixedStep*, %struct.FixedStep** %logic.addr, align 8
  %356 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %355, double 0x408F880000000000)
  %357 = call i8* @nish_str_from_i32(i32 %356)
  %358 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %354, i64 0, i32 0
  %359 = load i64, i64* %358, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %360 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %354, i64 0, i32 1
  %361 = load i64, i64* %360, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %362 = icmp eq i64 %359, %361
  br i1 %362, label %push.grow.3, label %push.store.3

push.grow.3:
  call void @nish_array_grow(%struct.nish_array* %354, i64 8)
  br label %push.store.3

push.store.3:
  %363 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %354, i64 0, i32 2
  %364 = load i8*, i8** %363, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %365 = bitcast i8* %364 to i8**
  %366 = getelementptr inbounds i8*, i8** %365, i64 %359
  store i8* %357, i8** %366, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %367 = add i64 %359, 1
  store i64 %367, i64* %358, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %368 = trunc i64 %367 to i32
  %369 = load %struct.nish_array*, %struct.nish_array** %steps.addr, align 8
  %370 = load %struct.FixedStep*, %struct.FixedStep** %logic.addr, align 8
  %371 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %370, double 0x4090680000000000)
  %372 = call i8* @nish_str_from_i32(i32 %371)
  %373 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %369, i64 0, i32 0
  %374 = load i64, i64* %373, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %375 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %369, i64 0, i32 1
  %376 = load i64, i64* %375, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %377 = icmp eq i64 %374, %376
  br i1 %377, label %push.grow.4, label %push.store.4

push.grow.4:
  call void @nish_array_grow(%struct.nish_array* %369, i64 8)
  br label %push.store.4

push.store.4:
  %378 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %369, i64 0, i32 2
  %379 = load i8*, i8** %378, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %380 = bitcast i8* %379 to i8**
  %381 = getelementptr inbounds i8*, i8** %380, i64 %374
  store i8* %372, i8** %381, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %382 = add i64 %374, 1
  store i64 %382, i64* %373, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %383 = trunc i64 %382 to i32
  %384 = load %struct.nish_array*, %struct.nish_array** %steps.addr, align 8
  %385 = load %struct.FixedStep*, %struct.FixedStep** %logic.addr, align 8
  %386 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %385, double 0x4090400000000000)
  %387 = call i8* @nish_str_from_i32(i32 %386)
  %388 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %384, i64 0, i32 0
  %389 = load i64, i64* %388, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %390 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %384, i64 0, i32 1
  %391 = load i64, i64* %390, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %392 = icmp eq i64 %389, %391
  br i1 %392, label %push.grow.5, label %push.store.5

push.grow.5:
  call void @nish_array_grow(%struct.nish_array* %384, i64 8)
  br label %push.store.5

push.store.5:
  %393 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %384, i64 0, i32 2
  %394 = load i8*, i8** %393, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %395 = bitcast i8* %394 to i8**
  %396 = getelementptr inbounds i8*, i8** %395, i64 %389
  store i8* %387, i8** %396, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %397 = add i64 %389, 1
  store i64 %397, i64* %388, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %398 = trunc i64 %397 to i32
  %399 = load %struct.nish_array*, %struct.nish_array** %steps.addr, align 8
  %400 = load %struct.FixedStep*, %struct.FixedStep** %logic.addr, align 8
  %401 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %400, double 0x4090540000000000)
  %402 = call i8* @nish_str_from_i32(i32 %401)
  %403 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %399, i64 0, i32 0
  %404 = load i64, i64* %403, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %405 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %399, i64 0, i32 1
  %406 = load i64, i64* %405, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %407 = icmp eq i64 %404, %406
  br i1 %407, label %push.grow.6, label %push.store.6

push.grow.6:
  call void @nish_array_grow(%struct.nish_array* %399, i64 8)
  br label %push.store.6

push.store.6:
  %408 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %399, i64 0, i32 2
  %409 = load i8*, i8** %408, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %410 = bitcast i8* %409 to i8**
  %411 = getelementptr inbounds i8*, i8** %410, i64 %404
  store i8* %402, i8** %411, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %412 = add i64 %404, 1
  store i64 %412, i64* %403, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %413 = trunc i64 %412 to i32
  %414 = load %struct.nish_array*, %struct.nish_array** %steps.addr, align 8
  %415 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %414, i64 0, i32 0
  %416 = load i64, i64* %415, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %417 = bitcast i8* bitcast ({ i64, [2 x i8] }* @.str.19 to i8*) to i64*
  %418 = load i64, i64* %417, align 8
  %419 = sub i64 %416, 1
  %420 = mul i64 %418, %419
  %421 = icmp eq i64 %416, 0
  %422 = select i1 %421, i64 0, i64 %420
  store i64 %422, i64* %join.total, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.sum

join.sum:
  %423 = load i64, i64* %join.at, align 8
  %424 = icmp ult i64 %423, %416
  br i1 %424, label %join.sum.body, label %join.copy

join.sum.body:
  %425 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %414, i64 0, i32 2
  %426 = load i8*, i8** %425, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %427 = bitcast i8* %426 to i8**
  %428 = getelementptr inbounds i8*, i8** %427, i64 %423
  %429 = load i8*, i8** %428, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %430 = load i64, i64* %join.total, align 8
  %431 = bitcast i8* %429 to i64*
  %432 = load i64, i64* %431, align 8
  %433 = add i64 %430, %432
  store i64 %433, i64* %join.total, align 8
  %434 = add i64 %423, 1
  store i64 %434, i64* %join.at, align 8
  br label %join.sum

join.copy:
  %435 = load i64, i64* %join.total, align 8
  %436 = icmp ugt i64 %435, 2147483647
  %437 = add i64 %435, 9
  %438 = select i1 %436, i64 4611686018427387904, i64 %437
  %439 = call i8* @nish_alloc_struct(i64 %438)
  %440 = bitcast i8* %439 to i64*
  store i64 %435, i64* %440, align 8
  %441 = getelementptr inbounds i8, i8* %439, i64 8
  store i8* %441, i8** %join.p, align 8
  store i64 0, i64* %join.at, align 8
  br label %join.copy.body

join.copy.body:
  %442 = load i64, i64* %join.at, align 8
  %443 = icmp ult i64 %442, %416
  br i1 %443, label %join.part, label %join.end

join.part:
  %444 = load i8*, i8** %join.p, align 8
  %445 = icmp eq i64 %442, 0
  %446 = select i1 %445, i64 0, i64 %418
  %447 = getelementptr inbounds i8, i8* bitcast ({ i64, [2 x i8] }* @.str.19 to i8*), i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %444, i8* %447, i64 %446, i1 false)
  %448 = getelementptr inbounds i8, i8* %444, i64 %446
  %449 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %414, i64 0, i32 2
  %450 = load i8*, i8** %449, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %451 = bitcast i8* %450 to i8**
  %452 = getelementptr inbounds i8*, i8** %451, i64 %442
  %453 = load i8*, i8** %452, align 8, !alias.scope !4, !noalias !3, !tbaa !18
  %454 = bitcast i8* %453 to i64*
  %455 = load i64, i64* %454, align 8
  %456 = getelementptr inbounds i8, i8* %453, i64 8
  call void @llvm.memcpy.p0i8.p0i8.i64(i8* %448, i8* %456, i64 %455, i1 false)
  %457 = getelementptr inbounds i8, i8* %448, i64 %455
  store i8* %457, i8** %join.p, align 8
  %458 = add i64 %442, 1
  store i64 %458, i64* %join.at, align 8
  br label %join.copy.body

join.end:
  %459 = load i8*, i8** %join.p, align 8
  store i8 0, i8* %459, align 1
  %460 = call i8* @nish_str_concat(i8* bitcast ({ i64, [7 x i8] }* @.str.76 to i8*), i8* %439)
  %461 = call i8* @nish_str_concat(i8* %460, i8* bitcast ({ i64, [8 x i8] }* @.str.77 to i8*))
  %462 = load %struct.FixedStep*, %struct.FixedStep** %logic.addr, align 8
  %463 = call double @nish.FixedStep.alpha(%struct.FixedStep* %462)
  %464 = fmul double %463, 0x4059000000000000
  %465 = call double @llvm.floor.f64(double %464)
  %466 = call i8* @nish_str_from_f64(double %465)
  %467 = call i8* @nish_str_concat(i8* %461, i8* %466)
  %468 = call i8* @nish_str_concat(i8* %467, i8* bitcast ({ i64, [2 x i8] }* @.str.78 to i8*))
  call void @nish_print(i8* %468)
  call void @nish.FixedStep.constructor(%struct.FixedStep* %FixedStep.obj.1, i32 100, i32 3)
  store %struct.FixedStep* %FixedStep.obj.1, %struct.FixedStep** %behind.addr, align 8
  %469 = load %struct.FixedStep*, %struct.FixedStep** %behind.addr, align 8
  %470 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %469, double 0x0000000000000000)
  %471 = load %struct.FixedStep*, %struct.FixedStep** %behind.addr, align 8
  %472 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %471, double 0x408F680000000000)
  store i32 %472, i32* %caught.addr, align 4
  %473 = load i32, i32* %caught.addr, align 4
  %474 = call i8* @nish_str_from_i32(i32 %473)
  %475 = call i8* @nish_str_concat(i8* bitcast ({ i64, [19 x i8] }* @.str.79 to i8*), i8* %474)
  %476 = call i8* @nish_str_concat(i8* %475, i8* bitcast ({ i64, [29 x i8] }* @.str.80 to i8*))
  %477 = load %struct.FixedStep*, %struct.FixedStep** %behind.addr, align 8
  %478 = call double @nish.FixedStep.alpha(%struct.FixedStep* %477)
  %479 = fmul double %478, 0x4059000000000000
  %480 = call double @llvm.floor.f64(double %479)
  %481 = call i8* @nish_str_from_f64(double %480)
  %482 = call i8* @nish_str_concat(i8* %476, i8* %481)
  %483 = call i8* @nish_str_concat(i8* %482, i8* bitcast ({ i64, [2 x i8] }* @.str.78 to i8*))
  call void @nish_print(i8* %483)
  call void @nish.FixedStep.constructor(%struct.FixedStep* %FixedStep.obj.2, i32 100, i32 1)
  store %struct.FixedStep* %FixedStep.obj.2, %struct.FixedStep** %draw.addr, align 8
  store i32 0, i32* %frames.addr, align 4
  %484 = load %struct.FixedStep*, %struct.FixedStep** %draw.addr, align 8
  %485 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %484, double 0x0000000000000000)
  store i32 1, i32* %ms.addr, align 4
  br label %for.cond.1

for.cond.1:
  %486 = load i32, i32* %ms.addr, align 4
  %487 = icmp sle i32 %486, 1000
  br i1 %487, label %for.body.1, label %for.end.1

for.body.1:
  %488 = load i32, i32* %frames.addr, align 4
  %489 = load %struct.FixedStep*, %struct.FixedStep** %draw.addr, align 8
  %490 = load i32, i32* %ms.addr, align 4
  %491 = sitofp i32 %490 to double
  %492 = call i32 @nish.FixedStep.advance(%struct.FixedStep* %489, double %491)
  %493 = call { i32, i1 } @llvm.sadd.with.overflow.i32(i32 %488, i32 %492)
  %494 = extractvalue { i32, i1 } %493, 0
  %495 = extractvalue { i32, i1 } %493, 1
  br i1 %495, label %ovf.fail, label %ovf.ok.1

ovf.ok.1:
  store i32 %494, i32* %frames.addr, align 4
  br label %for.inc.1

for.inc.1:
  %496 = load i32, i32* %ms.addr, align 4
  %497 = add nsw i32 %496, 1
  store i32 %497, i32* %ms.addr, align 4
  br label %for.cond.1

for.end.1:
  %498 = load i32, i32* %frames.addr, align 4
  %499 = call i8* @nish_str_from_i32(i32 %498)
  %500 = call i8* @nish_str_concat(i8* bitcast ({ i64, [50 x i8] }* @.str.81 to i8*), i8* %499)
  %501 = call i8* @nish_str_concat(i8* %500, i8* bitcast ({ i64, [8 x i8] }* @.str.82 to i8*))
  call void @nish_print(i8* %501)
  call void @nish.FixedStep.constructor(%struct.FixedStep* %FixedStep.obj.3, i32 0, i32 0)
  store %struct.FixedStep* %FixedStep.obj.3, %struct.FixedStep** %odd.addr, align 8
  %502 = load %struct.FixedStep*, %struct.FixedStep** %odd.addr, align 8
  %503 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %502, i32 0, i32 0
  %504 = load double, double* %503, align 8, !tbaa !32
  %505 = call i8* @nish_str_from_f64(double %504)
  %506 = call i8* @nish_str_concat(i8* bitcast ({ i64, [15 x i8] }* @.str.83 to i8*), i8* %505)
  %507 = call i8* @nish_str_concat(i8* %506, i8* bitcast ({ i64, [14 x i8] }* @.str.84 to i8*))
  %508 = load %struct.FixedStep*, %struct.FixedStep** %odd.addr, align 8
  %509 = getelementptr inbounds %struct.FixedStep, %struct.FixedStep* %508, i32 0, i32 3
  %510 = load i32, i32* %509, align 4, !tbaa !33
  %511 = call i8* @nish_str_from_i32(i32 %510)
  %512 = call i8* @nish_str_concat(i8* %507, i8* %511)
  call void @nish_print(i8* %512)
  call void @nish.KeyDecoder.constructor(%struct.KeyDecoder* %KeyDecoder.obj, double 0x403E000000000000)
  store %struct.KeyDecoder* %KeyDecoder.obj, %struct.KeyDecoder** %d.addr, align 8
  %513 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %514 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 0
  store i64 12, i64* %514, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %515 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 1
  store i64 12, i64* %515, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %516 = bitcast [12 x i32]* %arr.data to i8*
  %517 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.1, i64 0, i32 2
  store i8* %516, i8** %517, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %518 = bitcast i8* %516 to i32*
  %519 = getelementptr inbounds i32, i32* %518, i64 0
  store i32 27, i32* %519, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %520 = getelementptr inbounds i32, i32* %518, i64 1
  store i32 91, i32* %520, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %521 = getelementptr inbounds i32, i32* %518, i64 2
  store i32 65, i32* %521, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %522 = getelementptr inbounds i32, i32* %518, i64 3
  store i32 27, i32* %522, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %523 = getelementptr inbounds i32, i32* %518, i64 4
  store i32 91, i32* %523, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %524 = getelementptr inbounds i32, i32* %518, i64 5
  store i32 66, i32* %524, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %525 = getelementptr inbounds i32, i32* %518, i64 6
  store i32 27, i32* %525, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %526 = getelementptr inbounds i32, i32* %518, i64 7
  store i32 79, i32* %526, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %527 = getelementptr inbounds i32, i32* %518, i64 8
  store i32 67, i32* %527, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %528 = getelementptr inbounds i32, i32* %518, i64 9
  store i32 27, i32* %528, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %529 = getelementptr inbounds i32, i32* %518, i64 10
  store i32 79, i32* %529, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %530 = getelementptr inbounds i32, i32* %518, i64 11
  store i32 68, i32* %530, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %531 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.1)
  %532 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %513, %struct.nish_array* %531, i32 12, double 0x0000000000000000)
  %533 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [7 x i8] }* @.str.85 to i8*), %struct.nish_array* %532, %struct.KeyDecoder* %533)
  %534 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %535 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 0
  store i64 8, i64* %535, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %536 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 1
  store i64 8, i64* %536, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %537 = bitcast [8 x i32]* %arr.data.1 to i8*
  %538 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.2, i64 0, i32 2
  store i8* %537, i8** %538, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %539 = bitcast i8* %537 to i32*
  %540 = getelementptr inbounds i32, i32* %539, i64 0
  store i32 3, i32* %540, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %541 = getelementptr inbounds i32, i32* %539, i64 1
  store i32 13, i32* %541, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %542 = getelementptr inbounds i32, i32* %539, i64 2
  store i32 10, i32* %542, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %543 = getelementptr inbounds i32, i32* %539, i64 3
  store i32 32, i32* %543, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %544 = getelementptr inbounds i32, i32* %539, i64 4
  store i32 9, i32* %544, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %545 = getelementptr inbounds i32, i32* %539, i64 5
  store i32 127, i32* %545, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %546 = getelementptr inbounds i32, i32* %539, i64 6
  store i32 8, i32* %546, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %547 = getelementptr inbounds i32, i32* %539, i64 7
  store i32 1, i32* %547, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %548 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.2)
  %549 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %534, %struct.nish_array* %548, i32 8, double 0x0000000000000000)
  %550 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [9 x i8] }* @.str.86 to i8*), %struct.nish_array* %549, %struct.KeyDecoder* %550)
  %551 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %552 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 0
  store i64 8, i64* %552, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %553 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 1
  store i64 8, i64* %553, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %554 = bitcast [8 x i32]* %arr.data.2 to i8*
  %555 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.3, i64 0, i32 2
  store i8* %554, i8** %555, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %556 = bitcast i8* %554 to i32*
  %557 = getelementptr inbounds i32, i32* %556, i64 0
  store i32 113, i32* %557, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %558 = getelementptr inbounds i32, i32* %556, i64 1
  store i32 81, i32* %558, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %559 = getelementptr inbounds i32, i32* %556, i64 2
  store i32 126, i32* %559, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %560 = getelementptr inbounds i32, i32* %556, i64 3
  store i32 195, i32* %560, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %561 = getelementptr inbounds i32, i32* %556, i64 4
  store i32 169, i32* %561, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %562 = getelementptr inbounds i32, i32* %556, i64 5
  store i32 226, i32* %562, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %563 = getelementptr inbounds i32, i32* %556, i64 6
  store i32 150, i32* %563, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %564 = getelementptr inbounds i32, i32* %556, i64 7
  store i32 128, i32* %564, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %565 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.3)
  %566 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %551, %struct.nish_array* %565, i32 8, double 0x0000000000000000)
  %567 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [10 x i8] }* @.str.87 to i8*), %struct.nish_array* %566, %struct.KeyDecoder* %567)
  %568 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %569 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 0
  store i64 3, i64* %569, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %570 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 1
  store i64 3, i64* %570, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %571 = bitcast [3 x i32]* %arr.data.3 to i8*
  %572 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.4, i64 0, i32 2
  store i8* %571, i8** %572, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %573 = bitcast i8* %571 to i32*
  %574 = getelementptr inbounds i32, i32* %573, i64 0
  store i32 97, i32* %574, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %575 = getelementptr inbounds i32, i32* %573, i64 1
  store i32 98, i32* %575, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %576 = getelementptr inbounds i32, i32* %573, i64 2
  store i32 99, i32* %576, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %577 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.4)
  %578 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %568, %struct.nish_array* %577, i32 1, double 0x0000000000000000)
  %579 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [22 x i8] }* @.str.88 to i8*), %struct.nish_array* %578, %struct.KeyDecoder* %579)
  %580 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %581 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 0
  store i64 1, i64* %581, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %582 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 1
  store i64 1, i64* %582, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %583 = bitcast [1 x i32]* %arr.data.4 to i8*
  %584 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.5, i64 0, i32 2
  store i8* %583, i8** %584, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %585 = bitcast i8* %583 to i32*
  %586 = getelementptr inbounds i32, i32* %585, i64 0
  store i32 27, i32* %586, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %587 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.5)
  %588 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %580, %struct.nish_array* %587, i32 1, double 0x4059000000000000)
  %589 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [22 x i8] }* @.str.89 to i8*), %struct.nish_array* %588, %struct.KeyDecoder* %589)
  %590 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %591 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 0
  store i64 2, i64* %591, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %592 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 1
  store i64 2, i64* %592, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %593 = bitcast [2 x i32]* %arr.data.5 to i8*
  %594 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.6, i64 0, i32 2
  store i8* %593, i8** %594, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %595 = bitcast i8* %593 to i32*
  %596 = getelementptr inbounds i32, i32* %595, i64 0
  store i32 91, i32* %596, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %597 = getelementptr inbounds i32, i32* %595, i64 1
  store i32 65, i32* %597, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %598 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.6)
  %599 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %590, %struct.nish_array* %598, i32 2, double 0x405B800000000000)
  %600 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [21 x i8] }* @.str.90 to i8*), %struct.nish_array* %599, %struct.KeyDecoder* %600)
  %601 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %602 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 0
  store i64 2, i64* %602, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %603 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 1
  store i64 2, i64* %603, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %604 = bitcast [2 x i32]* %arr.data.6 to i8*
  %605 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.7, i64 0, i32 2
  store i8* %604, i8** %605, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %606 = bitcast i8* %604 to i32*
  %607 = getelementptr inbounds i32, i32* %606, i64 0
  store i32 27, i32* %607, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %608 = getelementptr inbounds i32, i32* %606, i64 1
  store i32 91, i32* %608, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %609 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.7)
  %610 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %601, %struct.nish_array* %609, i32 2, double 0x4069000000000000)
  %611 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [22 x i8] }* @.str.91 to i8*), %struct.nish_array* %610, %struct.KeyDecoder* %611)
  %612 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %613 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.8, i64 0, i32 0
  store i64 1, i64* %613, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %614 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.8, i64 0, i32 1
  store i64 1, i64* %614, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %615 = bitcast [1 x i32]* %arr.data.7 to i8*
  %616 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.8, i64 0, i32 2
  store i8* %615, i8** %616, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %617 = bitcast i8* %615 to i32*
  %618 = getelementptr inbounds i32, i32* %617, i64 0
  store i32 66, i32* %618, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %619 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.8)
  %620 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %612, %struct.nish_array* %619, i32 1, double 0x406A400000000000)
  %621 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [21 x i8] }* @.str.92 to i8*), %struct.nish_array* %620, %struct.KeyDecoder* %621)
  %622 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %623 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.9, i64 0, i32 0
  store i64 2, i64* %623, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %624 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.9, i64 0, i32 1
  store i64 2, i64* %624, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %625 = bitcast [2 x i32]* %arr.data.8 to i8*
  %626 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.9, i64 0, i32 2
  store i8* %625, i8** %626, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %627 = bitcast i8* %625 to i32*
  %628 = getelementptr inbounds i32, i32* %627, i64 0
  store i32 27, i32* %628, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %629 = getelementptr inbounds i32, i32* %627, i64 1
  store i32 79, i32* %629, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %630 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.9)
  %631 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %622, %struct.nish_array* %630, i32 2, double 0x4072C00000000000)
  %632 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [23 x i8] }* @.str.93 to i8*), %struct.nish_array* %631, %struct.KeyDecoder* %632)
  %633 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %634 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.10, i64 0, i32 0
  store i64 1, i64* %634, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %635 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.10, i64 0, i32 1
  store i64 1, i64* %635, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %636 = bitcast [1 x i32]* %arr.data.9 to i8*
  %637 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.10, i64 0, i32 2
  store i8* %636, i8** %637, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %638 = bitcast i8* %636 to i32*
  %639 = getelementptr inbounds i32, i32* %638, i64 0
  store i32 67, i32* %639, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %640 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.10)
  %641 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %633, %struct.nish_array* %640, i32 1, double 0x4073100000000000)
  %642 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [22 x i8] }* @.str.94 to i8*), %struct.nish_array* %641, %struct.KeyDecoder* %642)
  %643 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %644 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.11, i64 0, i32 0
  store i64 6, i64* %644, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %645 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.11, i64 0, i32 1
  store i64 6, i64* %645, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %646 = bitcast [6 x i32]* %arr.data.10 to i8*
  %647 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.11, i64 0, i32 2
  store i8* %646, i8** %647, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %648 = bitcast i8* %646 to i32*
  %649 = getelementptr inbounds i32, i32* %648, i64 0
  store i32 27, i32* %649, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %650 = getelementptr inbounds i32, i32* %648, i64 1
  store i32 91, i32* %650, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %651 = getelementptr inbounds i32, i32* %648, i64 2
  store i32 49, i32* %651, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %652 = getelementptr inbounds i32, i32* %648, i64 3
  store i32 59, i32* %652, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %653 = getelementptr inbounds i32, i32* %648, i64 4
  store i32 53, i32* %653, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %654 = getelementptr inbounds i32, i32* %648, i64 5
  store i32 65, i32* %654, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %655 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.11)
  %656 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %643, %struct.nish_array* %655, i32 6, double 0x4079000000000000)
  %657 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [21 x i8] }* @.str.95 to i8*), %struct.nish_array* %656, %struct.KeyDecoder* %657)
  %658 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %659 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.12, i64 0, i32 0
  store i64 4, i64* %659, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %660 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.12, i64 0, i32 1
  store i64 4, i64* %660, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %661 = bitcast [4 x i32]* %arr.data.11 to i8*
  %662 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.12, i64 0, i32 2
  store i8* %661, i8** %662, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %663 = bitcast i8* %661 to i32*
  %664 = getelementptr inbounds i32, i32* %663, i64 0
  store i32 27, i32* %664, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %665 = getelementptr inbounds i32, i32* %663, i64 1
  store i32 91, i32* %665, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %666 = getelementptr inbounds i32, i32* %663, i64 2
  store i32 51, i32* %666, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %667 = getelementptr inbounds i32, i32* %663, i64 3
  store i32 126, i32* %667, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %668 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.12)
  %669 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %658, %struct.nish_array* %668, i32 4, double 0x4079000000000000)
  %670 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [20 x i8] }* @.str.96 to i8*), %struct.nish_array* %669, %struct.KeyDecoder* %670)
  %671 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %672 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.13, i64 0, i32 0
  store i64 1, i64* %672, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %673 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.13, i64 0, i32 1
  store i64 1, i64* %673, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %674 = bitcast [1 x i32]* %arr.data.12 to i8*
  %675 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.13, i64 0, i32 2
  store i8* %674, i8** %675, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %676 = bitcast i8* %674 to i32*
  %677 = getelementptr inbounds i32, i32* %676, i64 0
  store i32 27, i32* %677, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %678 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.13)
  %679 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %671, %struct.nish_array* %678, i32 1, double 0x407F400000000000)
  %680 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [16 x i8] }* @.str.97 to i8*), %struct.nish_array* %679, %struct.KeyDecoder* %680)
  %681 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %682 = call %struct.nish_array* @nish.KeyDecoder.poll(%struct.KeyDecoder* %681, double 0x4080400000000000)
  %683 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [21 x i8] }* @.str.98 to i8*), %struct.nish_array* %682, %struct.KeyDecoder* %683)
  %684 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %685 = call %struct.nish_array* @nish.KeyDecoder.poll(%struct.KeyDecoder* %684, double 0x4080900000000000)
  %686 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [20 x i8] }* @.str.99 to i8*), %struct.nish_array* %685, %struct.KeyDecoder* %686)
  %687 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %688 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.14, i64 0, i32 0
  store i64 2, i64* %688, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %689 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.14, i64 0, i32 1
  store i64 2, i64* %689, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %690 = bitcast [2 x i32]* %arr.data.13 to i8*
  %691 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.14, i64 0, i32 2
  store i8* %690, i8** %691, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %692 = bitcast i8* %690 to i32*
  %693 = getelementptr inbounds i32, i32* %692, i64 0
  store i32 27, i32* %693, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %694 = getelementptr inbounds i32, i32* %692, i64 1
  store i32 120, i32* %694, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %695 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.14)
  %696 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %687, %struct.nish_array* %695, i32 2, double 0x4082C00000000000)
  %697 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [18 x i8] }* @.str.100 to i8*), %struct.nish_array* %696, %struct.KeyDecoder* %697)
  %698 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %699 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.15, i64 0, i32 0
  store i64 4, i64* %699, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %700 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.15, i64 0, i32 1
  store i64 4, i64* %700, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %701 = bitcast [4 x i32]* %arr.data.14 to i8*
  %702 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.15, i64 0, i32 2
  store i8* %701, i8** %702, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %703 = bitcast i8* %701 to i32*
  %704 = getelementptr inbounds i32, i32* %703, i64 0
  store i32 27, i32* %704, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %705 = getelementptr inbounds i32, i32* %703, i64 1
  store i32 27, i32* %705, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %706 = getelementptr inbounds i32, i32* %703, i64 2
  store i32 91, i32* %706, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %707 = getelementptr inbounds i32, i32* %703, i64 3
  store i32 65, i32* %707, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %708 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.15)
  %709 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %698, %struct.nish_array* %708, i32 4, double 0x4082C00000000000)
  %710 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [12 x i8] }* @.str.101 to i8*), %struct.nish_array* %709, %struct.KeyDecoder* %710)
  %711 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %712 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.16, i64 0, i32 0
  store i64 1, i64* %712, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %713 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.16, i64 0, i32 1
  store i64 1, i64* %713, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %714 = bitcast [1 x i32]* %arr.data.15 to i8*
  %715 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.16, i64 0, i32 2
  store i8* %714, i8** %715, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %716 = bitcast i8* %714 to i32*
  %717 = getelementptr inbounds i32, i32* %716, i64 0
  store i32 27, i32* %717, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %718 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.16)
  %719 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %711, %struct.nish_array* %718, i32 1, double 0x4085E00000000000)
  %720 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [36 x i8] }* @.str.102 to i8*), %struct.nish_array* %719, %struct.KeyDecoder* %720)
  %721 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %722 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.17, i64 0, i32 0
  store i64 1, i64* %722, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %723 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.17, i64 0, i32 1
  store i64 1, i64* %723, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %724 = bitcast [1 x i32]* %arr.data.16 to i8*
  %725 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.17, i64 0, i32 2
  store i8* %724, i8** %725, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %726 = bitcast i8* %724 to i32*
  %727 = getelementptr inbounds i32, i32* %726, i64 0
  store i32 120, i32* %727, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %728 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.17)
  %729 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %721, %struct.nish_array* %728, i32 1, double 0x4089000000000000)
  %730 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [12 x i8] }* @.str.103 to i8*), %struct.nish_array* %729, %struct.KeyDecoder* %730)
  %731 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %732 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.18, i64 0, i32 0
  store i64 1, i64* %732, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %733 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.18, i64 0, i32 1
  store i64 1, i64* %733, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %734 = bitcast [1 x i32]* %arr.data.17 to i8*
  %735 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.18, i64 0, i32 2
  store i8* %734, i8** %735, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %736 = bitcast i8* %734 to i32*
  %737 = getelementptr inbounds i32, i32* %736, i64 0
  store i32 195, i32* %737, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %738 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.18)
  %739 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %731, %struct.nish_array* %738, i32 1, double 0x408C200000000000)
  %740 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [19 x i8] }* @.str.104 to i8*), %struct.nish_array* %739, %struct.KeyDecoder* %740)
  %741 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %742 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.19, i64 0, i32 0
  store i64 1, i64* %742, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %743 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.19, i64 0, i32 1
  store i64 1, i64* %743, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %744 = bitcast [1 x i32]* %arr.data.18 to i8*
  %745 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.19, i64 0, i32 2
  store i8* %744, i8** %745, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %746 = bitcast i8* %744 to i32*
  %747 = getelementptr inbounds i32, i32* %746, i64 0
  store i32 169, i32* %747, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %748 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.19)
  %749 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %741, %struct.nish_array* %748, i32 1, double 0x408C280000000000)
  %750 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [18 x i8] }* @.str.105 to i8*), %struct.nish_array* %749, %struct.KeyDecoder* %750)
  %751 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %752 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.20, i64 0, i32 0
  store i64 2, i64* %752, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %753 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.20, i64 0, i32 1
  store i64 2, i64* %753, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %754 = bitcast [2 x i32]* %arr.data.19 to i8*
  %755 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.20, i64 0, i32 2
  store i8* %754, i8** %755, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %756 = bitcast i8* %754 to i32*
  %757 = getelementptr inbounds i32, i32* %756, i64 0
  store i32 226, i32* %757, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %758 = getelementptr inbounds i32, i32* %756, i64 1
  store i32 150, i32* %758, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %759 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.20)
  %760 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %751, %struct.nish_array* %759, i32 2, double 0x408F400000000000)
  %761 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [27 x i8] }* @.str.106 to i8*), %struct.nish_array* %760, %struct.KeyDecoder* %761)
  %762 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %763 = call %struct.nish_array* @nish.KeyDecoder.poll(%struct.KeyDecoder* %762, double 0x4091300000000000)
  %764 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [7 x i8] }* @.str.107 to i8*), %struct.nish_array* %763, %struct.KeyDecoder* %764)
  %765 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %766 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.21, i64 0, i32 0
  store i64 3, i64* %766, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %767 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.21, i64 0, i32 1
  store i64 3, i64* %767, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %768 = bitcast [3 x i32]* %arr.data.20 to i8*
  %769 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.21, i64 0, i32 2
  store i8* %768, i8** %769, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %770 = bitcast i8* %768 to i32*
  %771 = getelementptr inbounds i32, i32* %770, i64 0
  store i32 255, i32* %771, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %772 = getelementptr inbounds i32, i32* %770, i64 1
  store i32 128, i32* %772, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %773 = getelementptr inbounds i32, i32* %770, i64 2
  store i32 97, i32* %773, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %774 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.21)
  %775 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %765, %struct.nish_array* %774, i32 3, double 0x4092C00000000000)
  %776 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [14 x i8] }* @.str.108 to i8*), %struct.nish_array* %775, %struct.KeyDecoder* %776)
  %777 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %778 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.22, i64 0, i32 0
  store i64 3, i64* %778, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %779 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.22, i64 0, i32 1
  store i64 3, i64* %779, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %780 = bitcast [3 x i32]* %arr.data.21 to i8*
  %781 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.22, i64 0, i32 2
  store i8* %780, i8** %781, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %782 = bitcast i8* %780 to i32*
  %783 = getelementptr inbounds i32, i32* %782, i64 0
  store i32 226, i32* %783, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %784 = getelementptr inbounds i32, i32* %782, i64 1
  store i32 150, i32* %784, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %785 = getelementptr inbounds i32, i32* %782, i64 2
  store i32 97, i32* %785, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %786 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.22)
  %787 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %777, %struct.nish_array* %786, i32 3, double 0x4093880000000000)
  %788 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [33 x i8] }* @.str.109 to i8*), %struct.nish_array* %787, %struct.KeyDecoder* %788)
  %789 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %790 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.23, i64 0, i32 0
  store i64 0, i64* %790, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %791 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.23, i64 0, i32 1
  store i64 0, i64* %791, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %792 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.23, i64 0, i32 2
  store i8* null, i8** %792, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %793 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.23)
  %794 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %789, %struct.nish_array* %793, i32 0, double 0x4094500000000000)
  %795 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [11 x i8] }* @.str.110 to i8*), %struct.nish_array* %794, %struct.KeyDecoder* %795)
  %796 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %797 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.24, i64 0, i32 0
  store i64 1, i64* %797, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %798 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.24, i64 0, i32 1
  store i64 1, i64* %798, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %799 = bitcast [1 x i32]* %arr.data.22 to i8*
  %800 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.24, i64 0, i32 2
  store i8* %799, i8** %800, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %801 = bitcast i8* %799 to i32*
  %802 = getelementptr inbounds i32, i32* %801, i64 0
  store i32 27, i32* %802, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %803 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.24)
  %804 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %796, %struct.nish_array* %803, i32 1, double 0x409F400000000000)
  %805 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [27 x i8] }* @.str.111 to i8*), %struct.nish_array* %804, %struct.KeyDecoder* %805)
  %806 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %807 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.25, i64 0, i32 0
  store i64 1, i64* %807, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %808 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.25, i64 0, i32 1
  store i64 1, i64* %808, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %809 = bitcast [1 x i32]* %arr.data.23 to i8*
  %810 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.25, i64 0, i32 2
  store i8* %809, i8** %810, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %811 = bitcast i8* %809 to i32*
  %812 = getelementptr inbounds i32, i32* %811, i64 0
  store i32 91, i32* %812, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %813 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.25)
  %814 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %806, %struct.nish_array* %813, i32 1, double 0x409FA40000000000)
  %815 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [26 x i8] }* @.str.112 to i8*), %struct.nish_array* %814, %struct.KeyDecoder* %815)
  %816 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %817 = call %struct.nish_array* @nish.KeyDecoder.poll(%struct.KeyDecoder* %816, double 0x409FCC0000000000)
  %818 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [23 x i8] }* @.str.113 to i8*), %struct.nish_array* %817, %struct.KeyDecoder* %818)
  %819 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %820 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.26, i64 0, i32 0
  store i64 3, i64* %820, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %821 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.26, i64 0, i32 1
  store i64 3, i64* %821, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %822 = bitcast [3 x i32]* %arr.data.24 to i8*
  %823 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.26, i64 0, i32 2
  store i8* %822, i8** %823, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %824 = bitcast i8* %822 to i32*
  %825 = getelementptr inbounds i32, i32* %824, i64 0
  store i32 27, i32* %825, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %826 = getelementptr inbounds i32, i32* %824, i64 1
  store i32 79, i32* %826, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %827 = getelementptr inbounds i32, i32* %824, i64 2
  store i32 10, i32* %827, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %828 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.26)
  %829 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %819, %struct.nish_array* %828, i32 3, double 0x40A0680000000000)
  %830 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [19 x i8] }* @.str.114 to i8*), %struct.nish_array* %829, %struct.KeyDecoder* %830)
  %831 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %832 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.27, i64 0, i32 0
  store i64 3, i64* %832, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %833 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.27, i64 0, i32 1
  store i64 3, i64* %833, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %834 = bitcast [3 x i32]* %arr.data.25 to i8*
  %835 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.27, i64 0, i32 2
  store i8* %834, i8** %835, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %836 = bitcast i8* %834 to i32*
  %837 = getelementptr inbounds i32, i32* %836, i64 0
  store i32 245, i32* %837, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %838 = getelementptr inbounds i32, i32* %836, i64 1
  store i32 128, i32* %838, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %839 = getelementptr inbounds i32, i32* %836, i64 2
  store i32 97, i32* %839, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %840 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.27)
  %841 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %831, %struct.nish_array* %840, i32 3, double 0x40A1300000000000)
  %842 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [19 x i8] }* @.str.115 to i8*), %struct.nish_array* %841, %struct.KeyDecoder* %842)
  %843 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %844 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.28, i64 0, i32 0
  store i64 10, i64* %844, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %845 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.28, i64 0, i32 1
  store i64 10, i64* %845, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %846 = bitcast [10 x i32]* %arr.data.26 to i8*
  %847 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.28, i64 0, i32 2
  store i8* %846, i8** %847, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %848 = bitcast i8* %846 to i32*
  %849 = getelementptr inbounds i32, i32* %848, i64 0
  store i32 224, i32* %849, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %850 = getelementptr inbounds i32, i32* %848, i64 1
  store i32 128, i32* %850, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %851 = getelementptr inbounds i32, i32* %848, i64 2
  store i32 128, i32* %851, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %852 = getelementptr inbounds i32, i32* %848, i64 3
  store i32 237, i32* %852, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %853 = getelementptr inbounds i32, i32* %848, i64 4
  store i32 160, i32* %853, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %854 = getelementptr inbounds i32, i32* %848, i64 5
  store i32 128, i32* %854, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %855 = getelementptr inbounds i32, i32* %848, i64 6
  store i32 244, i32* %855, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %856 = getelementptr inbounds i32, i32* %848, i64 7
  store i32 144, i32* %856, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %857 = getelementptr inbounds i32, i32* %848, i64 8
  store i32 128, i32* %857, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %858 = getelementptr inbounds i32, i32* %848, i64 9
  store i32 128, i32* %858, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %859 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.28)
  %860 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %843, %struct.nish_array* %859, i32 10, double 0x40A1300000000000)
  %861 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [30 x i8] }* @.str.116 to i8*), %struct.nish_array* %860, %struct.KeyDecoder* %861)
  %862 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  %863 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.29, i64 0, i32 0
  store i64 4, i64* %863, align 8, !alias.scope !3, !noalias !4, !tbaa !10
  %864 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.29, i64 0, i32 1
  store i64 4, i64* %864, align 8, !alias.scope !3, !noalias !4, !tbaa !11
  %865 = bitcast [4 x i32]* %arr.data.27 to i8*
  %866 = getelementptr inbounds %struct.nish_array, %struct.nish_array* %arr.hdr.29, i64 0, i32 2
  store i8* %865, i8** %866, align 8, !alias.scope !3, !noalias !4, !tbaa !12
  %867 = bitcast i8* %865 to i32*
  %868 = getelementptr inbounds i32, i32* %867, i64 0
  store i32 240, i32* %868, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %869 = getelementptr inbounds i32, i32* %867, i64 1
  store i32 159, i32* %869, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %870 = getelementptr inbounds i32, i32* %867, i64 2
  store i32 152, i32* %870, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %871 = getelementptr inbounds i32, i32* %867, i64 3
  store i32 128, i32* %871, align 4, !alias.scope !4, !noalias !3, !tbaa !14
  %872 = call %struct.nish_array* @bytesOf(%struct.nish_array* %arr.hdr.29)
  %873 = call %struct.nish_array* @nish.KeyDecoder.feed(%struct.KeyDecoder* %862, %struct.nish_array* %872, i32 4, double 0x40A1300000000000)
  %874 = load %struct.KeyDecoder*, %struct.KeyDecoder** %d.addr, align 8
  call void @events(i8* bitcast ({ i64, [11 x i8] }* @.str.117 to i8*), %struct.nish_array* %873, %struct.KeyDecoder* %874)
  call void @nish_arena_release(i64 %arena.mark)
  ret i32 0

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

attributes #0 = { nounwind }
attributes #1 = { nounwind willreturn readnone }
attributes #2 = { nounwind willreturn }
attributes #3 = { nounwind willreturn readonly }
attributes #4 = { nounwind willreturn cold noinline allocsize(0) }
attributes #5 = { nounwind noreturn cold }
attributes #6 = { alwaysinline nounwind willreturn allocsize(0) }

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
!13 = !{!"element i32", !6, i64 0}
!14 = !{!13, !13, i64 0}
!15 = !{!"element i8", !6, i64 0}
!16 = !{!15, !15, i64 0}
!17 = !{!"element ptr", !6, i64 0}
!18 = !{!17, !17, i64 0}
!19 = !{!"i32", !6, i64 0}
!20 = !{!"KeyEvent", !19, i64 0, !19, i64 4}
!21 = !{!20, !19, i64 0}
!22 = !{!20, !19, i64 4}
!23 = !{!"ptr", !6, i64 0}
!24 = !{!"i1", !6, i64 0}
!25 = !{!"Screen", !23, i64 0, !23, i64 8, !23, i64 16, !23, i64 24, !23, i64 32, !23, i64 40, !23, i64 48, !23, i64 56, !23, i64 64, !19, i64 72, !19, i64 76, !19, i64 80, !24, i64 84, !24, i64 85}
!26 = !{!25, !24, i64 85}
!27 = !{!"Canvas", !23, i64 0, !19, i64 8, !19, i64 12, !23, i64 16}
!28 = !{!27, !19, i64 8}
!29 = !{!27, !19, i64 12}
!30 = !{!"double", !6, i64 0}
!31 = !{!"FixedStep", !30, i64 0, !30, i64 8, !30, i64 16, !19, i64 24, !24, i64 28}
!32 = !{!31, !30, i64 0}
!33 = !{!31, !19, i64 24}

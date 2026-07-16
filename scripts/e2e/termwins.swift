// Enumerate the on-screen CGWindowIDs of every window owned by a given app
// (default "Electron"), one per line as `num x y w h`, sorted left-to-right.
//
// Companion to join-shot.py: `screencapture -l<id>` captures a window's own
// bitmap regardless of z-order, so system dialogs / other apps can never
// photobomb a terminal capture the way region `-R` grabs do. Skips tiny
// helper windows (< 200x200) so only real terminal BrowserWindows emit.
//
// Run: swift termwins.swift [OwnerName]
import CoreGraphics
import Foundation

let owner = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "Electron"
guard let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as? [[String: Any]] else { exit(1) }

var wins: [(num: Int, x: Int, y: Int, w: Int, h: Int)] = []
for w in list {
  guard (w[kCGWindowOwnerName as String] as? String) == owner else { continue }
  guard let num = w[kCGWindowNumber as String] as? Int else { continue }
  let b = w[kCGWindowBounds as String] as? [String: Any] ?? [:]
  let x = Int((b["X"] as? Double) ?? 0)
  let y = Int((b["Y"] as? Double) ?? 0)
  let wd = Int((b["Width"] as? Double) ?? 0)
  let ht = Int((b["Height"] as? Double) ?? 0)
  if wd < 200 || ht < 200 { continue } // helper/offscreen shells
  wins.append((num, x, y, wd, ht))
}
for w in wins.sorted(by: { $0.x < $1.x }) {
  print("\(w.num) \(w.x) \(w.y) \(w.w) \(w.h)")
}
if wins.isEmpty { exit(1) }

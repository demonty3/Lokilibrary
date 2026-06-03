// Resolve the on-screen CGWindowID of the largest window owned by a given app
// (default "Electron"). Prints the window number to stdout, or exits 1 if none.
//
// Used by drive.mjs `shot`: `screencapture -l<id>` captures THAT window's own
// bitmap regardless of z-order, so an overlapping window can't end up in the
// shot (which is exactly what region-based `screencapture -R` gets wrong).
//
// Run: swift winid.swift [OwnerName]   (the dev Electron app's owner is "Electron")
import CoreGraphics
import Foundation

let owner = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "Electron"
guard let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly], kCGNullWindowID) as? [[String: Any]] else { exit(1) }

var best: (num: Int, area: Int) = (-1, 0)
for w in list {
  guard (w[kCGWindowOwnerName as String] as? String) == owner else { continue }
  guard let num = w[kCGWindowNumber as String] as? Int else { continue }
  let b = w[kCGWindowBounds as String] as? [String: Any] ?? [:]
  let area = Int(((b["Width"] as? Double) ?? 0) * ((b["Height"] as? Double) ?? 0))
  if area > best.area { best = (num, area) } // largest = the main BrowserWindow, not helpers
}
if best.num >= 0 { print(best.num) } else { exit(1) }

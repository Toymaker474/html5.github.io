import Foundation
import Accelerate
import NaturalLanguage
import PDFKit
import AVFoundation
import SQLite3

actor NativeAdvancedHub {
  static let shared = NativeAdvancedHub()

  private let fm = FileManager.default
  private let workspace: URL
  private let databaseURL: URL

  init() {
    let support = try! FileManager.default.url(
      for: .applicationSupportDirectory,
      in: .userDomainMask,
      appropriateFor: nil,
      create: true
    )
    workspace = support.appendingPathComponent("Workspace", isDirectory: true)
    databaseURL = support.appendingPathComponent("agent.sqlite")
    try? fm.createDirectory(at: workspace, withIntermediateDirectories: true)
  }

  func stackManifest() -> [String: Any] {
    [
      "webCode": false,
      "languages": ["Swift", "Objective-C++", "C++20", "C11", "Metal Shading Language", "Rust source module"],
      "nativeFrameworks": ["LiteRT-LM", "Metal", "Accelerate/vDSP", "Vision", "Core Motion", "Core Image", "CryptoKit", "NaturalLanguage", "PDFKit", "AVFoundation", "SQLite3"],
      "execution": "compiled native iOS code only; no HTML, JavaScript, WebView, or run_js",
      "toolCount": NativeTools.all.count
    ]
  }

  func nBody(bodies: Int, steps: Int, seed: Int) -> Any {
    NativeCoreBridge.runNBody(bodies: bodies, steps: steps, seed: UInt64(bitPattern: Int64(seed)))
  }

  func pathfind(width: Int, height: Int, obstacleRate: Double, seed: Int) -> Any {
    NativeCoreBridge.runGridPath(
      width: width,
      height: height,
      obstacleRate: obstacleRate,
      seed: UInt64(bitPattern: Int64(seed))
    )
  }

  func runVM(program: String, seed: Int) -> Any {
    NativeCoreBridge.runVM(program: program, seed: UInt64(bitPattern: Int64(seed)))
  }

  func analyzeBytes(text: String) -> Any {
    NativeCoreBridge.analyze(bytes: Data(text.utf8))
  }

  func accelerateStats(_ values: [Double]) throws -> [String: Any] {
    guard !values.isEmpty else { throw NativeError("No samples supplied") }
    var mean = 0.0
    var rms = 0.0
    var peak = 0.0
    values.withUnsafeBufferPointer { p in
      guard let base = p.baseAddress else { return }
      vDSP_meanvD(base, 1, &mean, vDSP_Length(values.count))
      vDSP_rmsqvD(base, 1, &rms, vDSP_Length(values.count))
      vDSP_maxmgvD(base, 1, &peak, vDSP_Length(values.count))
    }
    var centered = values
    var negativeMean = -mean
    vDSP_vsaddD(centered, 1, &negativeMean, &centered, 1, vDSP_Length(centered.count))
    var energy = 0.0
    centered.withUnsafeBufferPointer { p in
      guard let base = p.baseAddress else { return }
      vDSP_svesqD(base, 1, &energy, vDSP_Length(centered.count))
    }
    return [
      "engine": "Apple Accelerate/vDSP",
      "count": values.count,
      "mean": mean,
      "rms": rms,
      "peakMagnitude": peak,
      "variance": energy / Double(values.count),
      "stddev": sqrt(energy / Double(values.count))
    ]
  }

  func languageAnalyze(_ text: String) -> [String: Any] {
    let recognizer = NLLanguageRecognizer()
    recognizer.processString(text)
    let hypotheses = recognizer.languageHypotheses(withMaximum: 5)
      .map { ["language": $0.key.rawValue, "confidence": $0.value] as [String: Any] }

    let tokenizer = NLTokenizer(unit: .word)
    tokenizer.string = text
    var tokens: [String] = []
    tokenizer.enumerateTokens(in: text.startIndex..<text.endIndex) { range, _ in
      if tokens.count < 200 { tokens.append(String(text[range])) }
      return tokens.count < 200
    }
    return [
      "engine": "Apple NaturalLanguage",
      "dominantLanguage": recognizer.dominantLanguage?.rawValue ?? "unknown",
      "hypotheses": hypotheses,
      "wordCount": tokens.count,
      "tokensPreview": Array(tokens.prefix(40))
    ]
  }

  func pdfExtract(name: String, maxPages: Int) throws -> [String: Any] {
    let url = try safeFile(name)
    guard let doc = PDFDocument(url: url) else { throw NativeError("Could not open PDF") }
    let limit = min(doc.pageCount, max(1, min(maxPages, 100)))
    var text = ""
    var pages: [[String: Any]] = []
    for index in 0..<limit {
      let pageText = doc.page(at: index)?.string ?? ""
      pages.append(["page": index + 1, "characters": pageText.count])
      if text.count < 200_000 {
        text += "\n--- PAGE \(index + 1) ---\n" + pageText
      }
    }
    return [
      "engine": "PDFKit",
      "file": url.lastPathComponent,
      "pageCount": doc.pageCount,
      "pagesRead": limit,
      "pages": pages,
      "text": String(text.prefix(200_000))
    ]
  }

  func audioInfo(name: String) throws -> [String: Any] {
    let url = try safeFile(name)
    let file = try AVAudioFile(forReading: url)
    let f = file.fileFormat
    let seconds = f.sampleRate > 0 ? Double(file.length) / f.sampleRate : 0
    return [
      "engine": "AVFoundation",
      "file": url.lastPathComponent,
      "sampleRate": f.sampleRate,
      "channels": Int(f.channelCount),
      "frames": Int64(file.length),
      "durationSeconds": seconds,
      "format": f.settings.description
    ]
  }

  func sqliteExecute(_ sql: String) throws -> [String: Any] {
    var db: OpaquePointer?
    guard sqlite3_open(databaseURL.path, &db) == SQLITE_OK, let db else {
      throw NativeError("SQLite open failed")
    }
    defer { sqlite3_close(db) }
    var err: UnsafeMutablePointer<Int8>?
    let rc = sqlite3_exec(db, sql, nil, nil, &err)
    if rc != SQLITE_OK {
      let message = err.map { String(cString: $0) } ?? "SQLite error \(rc)"
      if let err { sqlite3_free(err) }
      throw NativeError(message)
    }
    return [
      "engine": "SQLite3 C API",
      "database": databaseURL.lastPathComponent,
      "changes": Int(sqlite3_changes(db)),
      "lastInsertRowID": sqlite3_last_insert_rowid(db)
    ]
  }

  func sqliteQuery(_ sql: String, limit requested: Int) throws -> [String: Any] {
    var db: OpaquePointer?
    guard sqlite3_open(databaseURL.path, &db) == SQLITE_OK, let db else {
      throw NativeError("SQLite open failed")
    }
    defer { sqlite3_close(db) }

    var stmt: OpaquePointer?
    guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK, let stmt else {
      throw NativeError(String(cString: sqlite3_errmsg(db)))
    }
    defer { sqlite3_finalize(stmt) }

    let limit = max(1, min(requested, 500))
    let columnCount = Int(sqlite3_column_count(stmt))
    let columns = (0..<columnCount).map { i in
      sqlite3_column_name(stmt, Int32(i)).map(String.init(cString:)) ?? "column\(i)"
    }
    var rows: [[String: Any]] = []

    while rows.count < limit {
      let rc = sqlite3_step(stmt)
      if rc == SQLITE_DONE { break }
      guard rc == SQLITE_ROW else { throw NativeError(String(cString: sqlite3_errmsg(db))) }
      var row: [String: Any] = [:]
      for i in 0..<columnCount {
        let idx = Int32(i)
        switch sqlite3_column_type(stmt, idx) {
        case SQLITE_INTEGER:
          row[columns[i]] = sqlite3_column_int64(stmt, idx)
        case SQLITE_FLOAT:
          row[columns[i]] = sqlite3_column_double(stmt, idx)
        case SQLITE_TEXT:
          if let ptr = sqlite3_column_text(stmt, idx) {
            row[columns[i]] = String(cString: UnsafeRawPointer(ptr).assumingMemoryBound(to: CChar.self))
          } else { row[columns[i]] = "" }
        case SQLITE_BLOB:
          row[columns[i]] = "<blob \(sqlite3_column_bytes(stmt, idx)) bytes>"
        default:
          row[columns[i]] = NSNull()
        }
      }
      rows.append(row)
    }

    return [
      "engine": "SQLite3 C API",
      "columns": columns,
      "rowCount": rows.count,
      "truncated": rows.count == limit,
      "rows": rows
    ]
  }

  private func safeFile(_ name: String) throws -> URL {
    let clean = URL(fileURLWithPath: name).lastPathComponent
    guard !clean.isEmpty, clean != ".", clean != ".." else { throw NativeError("Invalid file name") }
    let url = workspace.appendingPathComponent(clean)
    guard fm.fileExists(atPath: url.path) else { throw NativeError("Workspace file not found: \(clean)") }
    return url
  }
}

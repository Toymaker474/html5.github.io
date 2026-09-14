import Foundation
import LiteRTLM

struct NativeStackManifestTool: Tool {
  static let name = "native_stack_manifest"
  static let description = "Report the actual compiled native languages, frameworks and execution boundaries in SuperAgent Native."
  init() {}
  func run() async throws -> Any { await NativeAdvancedHub.shared.stackManifest() }
}

struct CppNBodyTool: Tool {
  static let name = "cpp_nbody"
  static let description = "Run a deterministic C++20 gravitational N-body simulation with velocity-Verlet integration and energy-drift verification."
  @ToolParam(description: "Body count, clamped to 2 through 160") var bodies: Int = 48
  @ToolParam(description: "Simulation steps, clamped to 1 through 3000") var steps: Int = 800
  @ToolParam(description: "Deterministic integer seed") var seed: Int = 1
  init() {}
  func run() async throws -> Any { await NativeAdvancedHub.shared.nBody(bodies: bodies, steps: steps, seed: seed) }
}

struct CppPathfindingTool: Tool {
  static let name = "cpp_pathfind"
  static let description = "Run deterministic native C++20 A* pathfinding over a generated obstacle grid and report exact search metrics."
  @ToolParam(description: "Grid width from 8 through 180") var width: Int = 64
  @ToolParam(description: "Grid height from 8 through 180") var height: Int = 64
  @ToolParam(description: "Obstacle probability from 0.0 through 0.45") var obstacleRate: Double = 0.23
  @ToolParam(description: "Deterministic integer seed") var seed: Int = 1
  init() {}
  func run() async throws -> Any {
    await NativeAdvancedHub.shared.pathfind(width: width, height: height, obstacleRate: obstacleRate, seed: seed)
  }
}

struct NativeVMTool: Tool {
  static let name = "native_numeric_vm"
  static let description = "Execute a bounded native C++ numeric bytecode-like program. Instructions: SET, ADD, SUB, MUL, DIV, SIN, COS, SQRT, RAND, PUSH, POP, EMIT, HALT."
  @ToolParam(description: "Program text, one instruction per line") var program: String
  @ToolParam(description: "Seed used by RAND") var seed: Int = 1
  init() {}
  func run() async throws -> Any { await NativeAdvancedHub.shared.runVM(program: program, seed: seed) }
}

struct CByteAnalysisTool: Tool {
  static let name = "c_byte_analysis"
  static let description = "Analyze UTF-8 bytes with native C: CRC-32, Shannon entropy, distinct byte count and frequency peak."
  @ToolParam(description: "Text whose UTF-8 bytes should be analyzed") var text: String
  init() {}
  func run() async throws -> Any { await NativeAdvancedHub.shared.analyzeBytes(text: text) }
}

struct AccelerateStatsTool: Tool {
  static let name = "accelerate_signal_stats"
  static let description = "Use Apple Accelerate/vDSP to calculate mean, RMS, peak magnitude, variance and standard deviation for numeric samples."
  @ToolParam(description: "Numeric samples") var values: [Double]
  init() {}
  func run() async throws -> Any { try await NativeAdvancedHub.shared.accelerateStats(values) }
}

struct LanguageAnalyzeTool: Tool {
  static let name = "natural_language_analyze"
  static let description = "Use Apple's native NaturalLanguage framework to identify language and tokenize text."
  @ToolParam(description: "Text to inspect") var text: String
  init() {}
  func run() async throws -> Any { await NativeAdvancedHub.shared.languageAnalyze(text) }
}

struct PDFExtractTool: Tool {
  static let name = "pdf_extract"
  static let description = "Extract text from a PDF already imported into the app workspace using native PDFKit."
  @ToolParam(description: "PDF file name in the safe workspace") var name: String
  @ToolParam(description: "Maximum pages to read, clamped to 1 through 100") var maxPages: Int = 25
  init() {}
  func run() async throws -> Any { try await NativeAdvancedHub.shared.pdfExtract(name: name, maxPages: maxPages) }
}

struct AudioInfoTool: Tool {
  static let name = "audio_info"
  static let description = "Inspect an imported audio file with AVFoundation and return sample rate, channels, frames and duration."
  @ToolParam(description: "Audio file name in the safe workspace") var name: String
  init() {}
  func run() async throws -> Any { try await NativeAdvancedHub.shared.audioInfo(name: name) }
}

struct SQLiteExecuteTool: Tool {
  static let name = "sqlite_execute"
  static let description = "Execute SQL against the app's persistent local SQLite database. Use for CREATE, INSERT, UPDATE, DELETE, indexes and transactions."
  @ToolParam(description: "SQL statement or statements to execute") var sql: String
  init() {}
  func run() async throws -> Any { try await NativeAdvancedHub.shared.sqliteExecute(sql) }
}

struct SQLiteQueryTool: Tool {
  static let name = "sqlite_query"
  static let description = "Run a read/query statement against the app's persistent local SQLite database and return rows as structured data."
  @ToolParam(description: "SELECT, PRAGMA, WITH, or other row-returning SQL") var sql: String
  @ToolParam(description: "Maximum returned rows, clamped to 1 through 500") var limit: Int = 100
  init() {}
  func run() async throws -> Any { try await NativeAdvancedHub.shared.sqliteQuery(sql, limit: limit) }
}

enum NativeAdvancedTools {
  static var all: [Tool] {
    [
      NativeStackManifestTool(),
      CppNBodyTool(),
      CppPathfindingTool(),
      NativeVMTool(),
      CByteAnalysisTool(),
      AccelerateStatsTool(),
      LanguageAnalyzeTool(),
      PDFExtractTool(),
      AudioInfoTool(),
      SQLiteExecuteTool(),
      SQLiteQueryTool()
    ]
  }
}

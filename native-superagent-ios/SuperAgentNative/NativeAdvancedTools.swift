import Foundation
import LiteRTLM

struct NativeStackManifestTool: Tool {
  static let name = "native_stack_manifest"
  static let description = "Report the actual compiled native languages, frameworks and execution boundaries in SuperAgent Native."
  init() {}
  func run() async throws -> Any { await NativeAdvancedHub.shared.stackManifest() }
}

struct NativeSelfTestTool: Tool {
  static let name = "native_self_test"
  static let description = "Run a real local smoke test across C++, C, Rust, Accelerate and SQLite and return the measured results."
  init() {}
  func run() async throws -> Any { try await NativeAdvancedHub.shared.selfTest() }
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

struct RustAnalyzeTool: Tool {
  static let name = "rust_analyze"
  static let description = "Run the compiled Rust static library through its C ABI: FNV-1a hash, compensated mean, and deterministic xorshift values."
  @ToolParam(description: "Text to hash") var text: String
  @ToolParam(description: "Numbers for compensated mean") var values: [Double]
  @ToolParam(description: "Seed for Rust PRNG") var seed: Int = 1
  init() {}
  func run() async throws -> Any { await NativeAdvancedHub.shared.rustAnalyze(text: text, values: values, seed: seed) }
}

struct AccelerateStatsTool: Tool {
  static let name = "accelerate_signal_stats"
  static let description = "Use Apple Accelerate/vDSP to calculate mean, RMS, peak magnitude, variance and standard deviation for numeric samples."
  @ToolParam(description: "Numeric samples") var values: [Double]
  init() {}
  func run() async throws -> Any { try await NativeAdvancedHub.shared.accelerateStats(values) }
}

struct MetalParticleTool: Tool {
  static let name = "metal_particle_benchmark"
  static let description = "Run a real Metal compute kernel that integrates many particle states through gravity and boundary collisions entirely on the GPU."
  @ToolParam(description: "Particle count, clamped from 1024 to 1000000") var count: Int = 100_000
  @ToolParam(description: "Integration steps per particle, clamped from 1 to 2000") var steps: Int = 240
  init() {}
  func run() async throws -> Any { try await MetalLab.shared.particleBenchmark(count: count, steps: steps) }
}

struct LanguageAnalyzeTool: Tool {
  static let name = "natural_language_analyze"
  static let description = "Use Apple's native NaturalLanguage framework to identify language and tokenize text."
  @ToolParam(description: "Text to inspect") var text: String
  init() {}
  func run() async throws -> Any { await NativeAdvancedHub.shared.languageAnalyze(text) }
}

struct SentenceDistanceTool: Tool {
  static let name = "sentence_embedding_distance"
  static let description = "Compare two sentences with Apple's on-device NaturalLanguage sentence embeddings. Smaller distance means closer meaning."
  @ToolParam(description: "First sentence") var a: String
  @ToolParam(description: "Second sentence") var b: String
  @ToolParam(description: "BCP-47-like NaturalLanguage code such as en") var language: String = "en"
  init() {}
  func run() async throws -> Any { try await EmbeddingLab.shared.sentenceDistance(a: a, b: b, languageCode: language) }
}

struct WordNeighborsTool: Tool {
  static let name = "word_embedding_neighbors"
  static let description = "Find nearby words using Apple's on-device NaturalLanguage word embedding."
  @ToolParam(description: "Word to inspect") var word: String
  @ToolParam(description: "Language code such as en") var language: String = "en"
  @ToolParam(description: "Maximum neighbors from 1 through 30") var limit: Int = 12
  init() {}
  func run() async throws -> Any { try await EmbeddingLab.shared.wordNeighbors(word: word, languageCode: language, limit: limit) }
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

struct AudioDSPTool: Tool {
  static let name = "audio_dsp_analyze"
  static let description = "Read an imported audio file natively and analyze the first channel with AVFoundation plus Accelerate/vDSP."
  @ToolParam(description: "Audio file name in the safe workspace") var name: String
  @ToolParam(description: "Maximum PCM frames to analyze, clamped to 1024 through 524288") var maxFrames: Int = 262_144
  init() {}
  func run() async throws -> Any { try await AudioDSPLab.shared.analyze(name: name, maxFrames: maxFrames) }
}

struct VisionClassifyTool: Tool {
  static let name = "vision_classify_image"
  static let description = "Classify an imported image using Apple's native Vision image classifier."
  @ToolParam(description: "Image file name in the safe workspace") var name: String
  @ToolParam(description: "Maximum labels to return") var limit: Int = 10
  init() {}
  func run() async throws -> Any { try await VisionLab.shared.classifyImage(name: name, limit: limit) }
}

struct VisionBarcodeTool: Tool {
  static let name = "vision_detect_barcodes"
  static let description = "Detect QR codes and other barcodes in an imported image using Apple Vision."
  @ToolParam(description: "Image file name in the safe workspace") var name: String
  init() {}
  func run() async throws -> Any { try await VisionLab.shared.detectBarcodes(name: name) }
}

struct CoreMLModelInfoTool: Tool {
  static let name = "coreml_model_info"
  static let description = "Open an imported compiled Core ML model and report its native input/output schema and metadata."
  @ToolParam(description: "Compiled .mlmodelc file or directory name in the workspace") var name: String
  init() {}
  func run() async throws -> Any { try await VisionLab.shared.coreMLModelInfo(name: name) }
}

struct HTTPSGetTool: Tool {
  static let name = "https_get"
  static let description = "Perform a bounded native HTTPS GET with URLSession. No credentials, POST, shell, browser, HTML runtime, localhost, or .local hosts."
  @ToolParam(description: "https:// URL") var url: String
  @ToolParam(description: "Maximum bytes returned to the agent, clamped to 1024 through 1000000") var maxBytes: Int = 250_000
  init() {}
  func run() async throws -> Any { try await NativeNetworkHub.shared.httpsGet(url: url, maxBytes: maxBytes) }
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
      NativeSelfTestTool(),
      CppNBodyTool(),
      CppPathfindingTool(),
      NativeVMTool(),
      CByteAnalysisTool(),
      RustAnalyzeTool(),
      AccelerateStatsTool(),
      MetalParticleTool(),
      LanguageAnalyzeTool(),
      SentenceDistanceTool(),
      WordNeighborsTool(),
      PDFExtractTool(),
      AudioInfoTool(),
      AudioDSPTool(),
      VisionClassifyTool(),
      VisionBarcodeTool(),
      CoreMLModelInfoTool(),
      HTTPSGetTool(),
      SQLiteExecuteTool(),
      SQLiteQueryTool()
    ]
  }
}

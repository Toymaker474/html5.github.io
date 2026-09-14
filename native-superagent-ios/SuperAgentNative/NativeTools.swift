import Foundation
import LiteRTLM

struct DeviceInfoTool: Tool {
  static let name = "device_info"
  static let description = "Return real local iPhone/device/runtime facts, storage, thermal state and Metal availability."
  init() {}
  func run() async throws -> Any { await NativeHub.shared.deviceInfo() }
}

struct StatisticsTool: Tool {
  static let name = "statistics"
  static let description = "Calculate exact descriptive statistics for a list of numbers using native Swift."
  @ToolParam(description: "Numbers to analyze") var values: [Double]
  init() {}
  func run() async throws -> Any { try await NativeHub.shared.statistics(values) }
}

struct SHA256Tool: Tool {
  static let name = "sha256"
  static let description = "Hash text with native CryptoKit SHA-256."
  @ToolParam(description: "Text to hash") var text: String
  init() {}
  func run() async throws -> Any { ["sha256": await NativeHub.shared.sha256(text)] }
}

struct RememberTool: Tool {
  static let name = "remember"
  static let description = "Persist a useful user fact, project note or agent result in the app's local memory."
  @ToolParam(description: "Information to remember") var text: String
  init() {}
  func run() async throws -> Any { try await NativeHub.shared.remember(text) }
}

struct RecallTool: Tool {
  static let name = "recall"
  static let description = "Search persistent local agent memory. Use an empty query for recent memories."
  @ToolParam(description: "Substring to search for; empty means recent memories") var query: String = ""
  @ToolParam(description: "Maximum results from 1 to 50") var limit: Int = 12
  init() {}
  func run() async throws -> Any { await NativeHub.shared.recall(query, limit: limit) }
}

struct ListFilesTool: Tool {
  static let name = "list_files"
  static let description = "List files in the agent's safe native workspace."
  init() {}
  func run() async throws -> Any { try await NativeHub.shared.listFiles() }
}

struct ReadTextFileTool: Tool {
  static let name = "read_text_file"
  static let description = "Read a UTF-8 text file from the safe app workspace."
  @ToolParam(description: "Workspace file name") var name: String
  init() {}
  func run() async throws -> Any { try await NativeHub.shared.readTextFile(name: name) }
}

struct WriteTextFileTool: Tool {
  static let name = "write_text_file"
  static let description = "Create or replace a UTF-8 text file in the safe app workspace. Maximum 1 MB."
  @ToolParam(description: "Workspace file name") var name: String
  @ToolParam(description: "Complete text content to write") var text: String
  init() {}
  func run() async throws -> Any { try await NativeHub.shared.writeTextFile(name: name, text: text) }
}

struct OCRImageTool: Tool {
  static let name = "ocr_image"
  static let description = "Recognize text in an image already imported into the safe workspace using Apple's Vision framework."
  @ToolParam(description: "Image file name in the workspace") var name: String
  init() {}
  func run() async throws -> Any { try await NativeHub.shared.ocrImage(name: name) }
}

struct CreateQRTool: Tool {
  static let name = "create_qr"
  static let description = "Generate a real PNG QR code locally with Core Image and save it in the safe workspace."
  @ToolParam(description: "Text or URL to encode") var text: String
  @ToolParam(description: "Optional output PNG file name") var fileName: String?
  init() {}
  func run() async throws -> Any { try await NativeHub.shared.createQR(text: text, fileName: fileName) }
}

struct MotionSampleTool: Tool {
  static let name = "motion_sample"
  static let description = "Take one live local Core Motion sample: attitude, rotation rate, gravity and user acceleration."
  init() {}
  func run() async throws -> Any { try await NativeHub.shared.sampleMotion() }
}

struct MetalVectorBenchmarkTool: Tool {
  static let name = "metal_vector_benchmark"
  static let description = "Run an actual native Metal compute shader that adds two float vectors, verify the result, and return timing."
  @ToolParam(description: "Number of float elements, clamped from 1024 to 2000000") var count: Int = 250_000
  init() {}
  func run() async throws -> Any { try await NativeHub.shared.metalVectorBenchmark(count: count) }
}

enum NativeTools {
  static var all: [Tool] {
    [
      DeviceInfoTool(),
      StatisticsTool(),
      SHA256Tool(),
      RememberTool(),
      RecallTool(),
      ListFilesTool(),
      ReadTextFileTool(),
      WriteTextFileTool(),
      OCRImageTool(),
      CreateQRTool(),
      MotionSampleTool(),
      MetalVectorBenchmarkTool()
    ]
  }
}

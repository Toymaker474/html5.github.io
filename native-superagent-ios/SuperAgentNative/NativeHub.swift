import Foundation
import CryptoKit
import UIKit
import CoreImage
import CoreImage.CIFilterBuiltins
import Vision
import CoreMotion
import Metal

actor NativeHub {
  static let shared = NativeHub()

  private struct MemoryItem: Codable {
    let text: String
    let created: Date
  }

  private let fm = FileManager.default
  private let workspace: URL
  private let memoryURL: URL

  init() {
    let support = try! FileManager.default.url(
      for: .applicationSupportDirectory,
      in: .userDomainMask,
      appropriateFor: nil,
      create: true
    )
    workspace = support.appendingPathComponent("Workspace", isDirectory: true)
    memoryURL = support.appendingPathComponent("agent-memory.json")
    try? FileManager.default.createDirectory(at: workspace, withIntermediateDirectories: true)
  }

  func importFile(from source: URL) throws -> [String: Any] {
    let destination = try safeFile(source.lastPathComponent)
    if fm.fileExists(atPath: destination.path) { try fm.removeItem(at: destination) }
    try fm.copyItem(at: source, to: destination)
    let size = (try? destination.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
    return ["imported": true, "name": destination.lastPathComponent, "bytes": size]
  }

  func deviceInfo() -> [String: Any] {
    var system = utsname()
    uname(&system)
    let machine = withUnsafePointer(to: &system.machine) {
      $0.withMemoryRebound(to: CChar.self, capacity: 1) { String(cString: $0) }
    }

    let attrs = try? fm.attributesOfFileSystem(forPath: NSHomeDirectory())
    let free = (attrs?[.systemFreeSize] as? NSNumber)?.int64Value ?? -1
    let total = (attrs?[.systemSize] as? NSNumber)?.int64Value ?? -1

    return [
      "deviceName": UIDevice.current.name,
      "machine": machine,
      "system": UIDevice.current.systemName,
      "systemVersion": UIDevice.current.systemVersion,
      "processorCount": ProcessInfo.processInfo.processorCount,
      "activeProcessorCount": ProcessInfo.processInfo.activeProcessorCount,
      "physicalMemoryBytes": ProcessInfo.processInfo.physicalMemory,
      "storageFreeBytes": free,
      "storageTotalBytes": total,
      "lowPowerMode": ProcessInfo.processInfo.isLowPowerModeEnabled,
      "thermalState": String(describing: ProcessInfo.processInfo.thermalState),
      "metalAvailable": MTLCreateSystemDefaultDevice() != nil,
      "workspace": workspace.path
    ]
  }

  func statistics(_ values: [Double]) throws -> [String: Any] {
    guard !values.isEmpty else { throw NativeError("No values supplied") }
    let finite = values.filter(\.isFinite).sorted()
    guard !finite.isEmpty else { throw NativeError("No finite values supplied") }
    let n = finite.count
    let sum = finite.reduce(0, +)
    let mean = sum / Double(n)
    let median = n.isMultiple(of: 2)
      ? (finite[n / 2 - 1] + finite[n / 2]) / 2
      : finite[n / 2]
    let variance = finite.reduce(0) { $0 + ($1 - mean) * ($1 - mean) } / Double(n)
    return [
      "count": n,
      "min": finite.first!,
      "max": finite.last!,
      "sum": sum,
      "mean": mean,
      "median": median,
      "populationStdDev": sqrt(variance)
    ]
  }

  func sha256(_ text: String) -> String {
    SHA256.hash(data: Data(text.utf8)).map { String(format: "%02x", $0) }.joined()
  }

  func remember(_ text: String) throws -> [String: Any] {
    let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !clean.isEmpty else { throw NativeError("Memory text is empty") }
    var items = loadMemory()
    items.append(.init(text: clean, created: Date()))
    if items.count > 1000 { items.removeFirst(items.count - 1000) }
    let data = try JSONEncoder().encode(items)
    try data.write(to: memoryURL, options: .atomic)
    return ["stored": true, "count": items.count]
  }

  func recall(_ query: String, limit: Int) -> [[String: Any]] {
    let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    return loadMemory()
      .reversed()
      .filter { q.isEmpty || $0.text.lowercased().contains(q) }
      .prefix(max(1, min(limit, 50)))
      .map { ["text": $0.text, "created": ISO8601DateFormatter().string(from: $0.created)] }
  }

  func listFiles() throws -> [[String: Any]] {
    let keys: Set<URLResourceKey> = [.fileSizeKey, .contentModificationDateKey, .isDirectoryKey]
    return try fm.contentsOfDirectory(at: workspace, includingPropertiesForKeys: Array(keys))
      .sorted { $0.lastPathComponent < $1.lastPathComponent }
      .map { url in
        let r = try? url.resourceValues(forKeys: keys)
        let modified = r?.contentModificationDate.map { ISO8601DateFormatter().string(from: $0) } ?? ""
        return [
          "name": url.lastPathComponent,
          "bytes": r?.fileSize ?? 0,
          "directory": r?.isDirectory ?? false,
          "modified": modified
        ]
      }
  }

  func writeTextFile(name: String, text: String) throws -> [String: Any] {
    let data = Data(text.utf8)
    guard data.count <= 1_000_000 else { throw NativeError("Text file exceeds 1 MB limit") }
    let url = try safeFile(name)
    try data.write(to: url, options: .atomic)
    return ["written": true, "name": url.lastPathComponent, "bytes": data.count]
  }

  func readTextFile(name: String) throws -> [String: Any] {
    let url = try safeFile(name)
    let data = try Data(contentsOf: url)
    guard data.count <= 1_000_000 else { throw NativeError("Text file exceeds 1 MB read limit") }
    guard let text = String(data: data, encoding: .utf8) else { throw NativeError("File is not UTF-8 text") }
    return ["name": url.lastPathComponent, "bytes": data.count, "text": text]
  }

  func createQR(text: String, fileName: String?) throws -> [String: Any] {
    let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !clean.isEmpty else { throw NativeError("QR text is empty") }
    let filter = CIFilter.qrCodeGenerator()
    filter.message = Data(clean.utf8)
    filter.correctionLevel = "M"
    guard let output = filter.outputImage?.transformed(by: CGAffineTransform(scaleX: 12, y: 12)) else {
      throw NativeError("Core Image could not generate QR")
    }
    let name = normalizedPNG(fileName ?? "qr-\(Int(Date().timeIntervalSince1970)).png")
    let url = try safeFile(name)
    let context = CIContext()
    let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!
    try context.writePNGRepresentation(of: output, to: url, format: .RGBA8, colorSpace: colorSpace)
    return ["created": true, "file": url.lastPathComponent, "path": url.path]
  }

  func ocrImage(name: String) throws -> [String: Any] {
    let url = try safeFile(name)
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    let handler = VNImageRequestHandler(url: url)
    try handler.perform([request])
    let observations = request.results ?? []
    let lines = observations.compactMap { observation -> [String: Any]? in
      guard let candidate = observation.topCandidates(1).first else { return nil }
      return ["text": candidate.string, "confidence": candidate.confidence]
    }
    return [
      "file": url.lastPathComponent,
      "lineCount": lines.count,
      "text": lines.compactMap { $0["text"] as? String }.joined(separator: "\n"),
      "lines": lines
    ]
  }

  func sampleMotion() async throws -> [String: Any] {
    let manager = CMMotionManager()
    guard manager.isDeviceMotionAvailable else { throw NativeError("Device motion unavailable") }
    manager.deviceMotionUpdateInterval = 1.0 / 30.0
    let queue = OperationQueue()
    queue.qualityOfService = .userInitiated

    return try await withCheckedThrowingContinuation { continuation in
      var finished = false
      manager.startDeviceMotionUpdates(to: queue) { data, error in
        guard !finished else { return }
        if let error {
          finished = true
          manager.stopDeviceMotionUpdates()
          continuation.resume(throwing: error)
          return
        }
        guard let data else { return }
        finished = true
        manager.stopDeviceMotionUpdates()
        continuation.resume(returning: [
          "attitude": ["roll": data.attitude.roll, "pitch": data.attitude.pitch, "yaw": data.attitude.yaw],
          "rotationRate": ["x": data.rotationRate.x, "y": data.rotationRate.y, "z": data.rotationRate.z],
          "gravity": ["x": data.gravity.x, "y": data.gravity.y, "z": data.gravity.z],
          "userAcceleration": ["x": data.userAcceleration.x, "y": data.userAcceleration.y, "z": data.userAcceleration.z]
        ])
      }
    }
  }

  func metalVectorBenchmark(count requested: Int) throws -> [String: Any] {
    guard let device = MTLCreateSystemDefaultDevice() else { throw NativeError("Metal device unavailable") }
    guard let queue = device.makeCommandQueue() else { throw NativeError("Metal command queue unavailable") }
    guard let library = device.makeDefaultLibrary(), let function = library.makeFunction(name: "vector_add") else {
      throw NativeError("Metal kernel vector_add not found")
    }
    let pipeline = try device.makeComputePipelineState(function: function)
    let n = max(1_024, min(requested, 2_000_000))
    var a = [Float](repeating: 0, count: n)
    var b = [Float](repeating: 0, count: n)
    for i in 0..<n { a[i] = Float(i) * 0.25; b[i] = Float(i) * 0.75 }
    let bytes = n * MemoryLayout<Float>.stride

    let ba = a.withUnsafeBytes { raw in
      device.makeBuffer(bytes: raw.baseAddress!, length: bytes)
    }
    let bb = b.withUnsafeBytes { raw in
      device.makeBuffer(bytes: raw.baseAddress!, length: bytes)
    }

    guard
      let ba,
      let bb,
      let out = device.makeBuffer(length: bytes),
      let command = queue.makeCommandBuffer(),
      let encoder = command.makeComputeCommandEncoder()
    else { throw NativeError("Metal buffer allocation failed") }

    var count = UInt32(n)
    guard let countBuffer = device.makeBuffer(bytes: &count, length: MemoryLayout<UInt32>.stride) else {
      throw NativeError("Metal count buffer allocation failed")
    }

    encoder.setComputePipelineState(pipeline)
    encoder.setBuffer(ba, offset: 0, index: 0)
    encoder.setBuffer(bb, offset: 0, index: 1)
    encoder.setBuffer(out, offset: 0, index: 2)
    encoder.setBuffer(countBuffer, offset: 0, index: 3)
    let width = pipeline.threadExecutionWidth
    encoder.dispatchThreads(
      MTLSize(width: n, height: 1, depth: 1),
      threadsPerThreadgroup: MTLSize(width: width, height: 1, depth: 1)
    )
    encoder.endEncoding()

    let start = CFAbsoluteTimeGetCurrent()
    command.commit()
    command.waitUntilCompleted()
    let ms = (CFAbsoluteTimeGetCurrent() - start) * 1000
    if let error = command.error { throw error }

    let ptr = out.contents().bindMemory(to: Float.self, capacity: n)
    let first = ptr[0]
    let last = ptr[n - 1]
    return [
      "device": device.name,
      "elements": n,
      "milliseconds": ms,
      "first": first,
      "last": last,
      "expectedLast": Float(n - 1),
      "verified": abs(last - Float(n - 1)) < 0.001
    ]
  }

  private func loadMemory() -> [MemoryItem] {
    guard let data = try? Data(contentsOf: memoryURL) else { return [] }
    return (try? JSONDecoder().decode([MemoryItem].self, from: data)) ?? []
  }

  private func safeFile(_ name: String) throws -> URL {
    let cleaned = URL(fileURLWithPath: name).lastPathComponent
    guard !cleaned.isEmpty, cleaned != ".", cleaned != ".." else { throw NativeError("Invalid file name") }
    return workspace.appendingPathComponent(cleaned, isDirectory: false)
  }

  private func normalizedPNG(_ name: String) -> String {
    name.lowercased().hasSuffix(".png") ? name : name + ".png"
  }
}

struct NativeError: LocalizedError {
  let message: String
  init(_ message: String) { self.message = message }
  var errorDescription: String? { message }
}

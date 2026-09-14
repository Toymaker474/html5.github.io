import Foundation
import Vision
import CoreML

actor VisionLab {
  static let shared = VisionLab()

  private let fm = FileManager.default
  private let workspace: URL

  init() {
    let support = try! fm.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
    workspace = support.appendingPathComponent("Workspace", isDirectory: true)
  }

  func classifyImage(name: String, limit requested: Int) throws -> [String: Any] {
    let url = try safeFile(name)
    let request = VNClassifyImageRequest()
    let handler = VNImageRequestHandler(url: url)
    try handler.perform([request])
    let limit = max(1, min(requested, 30))
    let results = (request.results ?? []).prefix(limit).map {
      ["label": $0.identifier, "confidence": $0.confidence] as [String: Any]
    }
    return [
      "engine": "Vision VNClassifyImageRequest",
      "file": url.lastPathComponent,
      "results": results
    ]
  }

  func detectBarcodes(name: String) throws -> [String: Any] {
    let url = try safeFile(name)
    let request = VNDetectBarcodesRequest()
    let handler = VNImageRequestHandler(url: url)
    try handler.perform([request])
    let results = (request.results ?? []).prefix(50).map { observation in
      [
        "symbology": observation.symbology.rawValue,
        "payload": observation.payloadStringValue ?? "",
        "confidence": observation.confidence
      ] as [String: Any]
    }
    return [
      "engine": "Vision barcode detector",
      "file": url.lastPathComponent,
      "count": results.count,
      "results": results
    ]
  }

  func coreMLModelInfo(name: String) throws -> [String: Any] {
    let url = try safeFile(name)
    let configuration = MLModelConfiguration()
    configuration.computeUnits = .all
    let model = try MLModel(contentsOf: url, configuration: configuration)
    let desc = model.modelDescription
    var metadata: [String: String] = [:]
    for (key, value) in desc.metadata {
      metadata[key.rawValue] = String(describing: value)
    }
    return [
      "engine": "Core ML",
      "file": url.lastPathComponent,
      "predictedFeatureName": desc.predictedFeatureName ?? "",
      "predictedProbabilitiesName": desc.predictedProbabilitiesName ?? "",
      "inputs": desc.inputDescriptionsByName.mapValues { $0.type.rawValue },
      "outputs": desc.outputDescriptionsByName.mapValues { $0.type.rawValue },
      "metadata": metadata
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

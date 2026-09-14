import Foundation
import AVFoundation
import Accelerate

actor AudioDSPLab {
  static let shared = AudioDSPLab()

  private let fm = FileManager.default
  private let workspace: URL

  init() {
    let support = try! fm.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
    workspace = support.appendingPathComponent("Workspace", isDirectory: true)
  }

  func analyze(name: String, maxFrames requested: Int) throws -> [String: Any] {
    let url = try safeFile(name)
    let file = try AVAudioFile(forReading: url)
    let format = file.processingFormat
    guard format.commonFormat == .pcmFormatFloat32, !format.isInterleaved else {
      throw NativeError("AVFoundation did not provide non-interleaved Float32 PCM")
    }

    let capacity = AVAudioFrameCount(max(1_024, min(requested, 524_288)))
    guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: capacity) else {
      throw NativeError("Could not allocate audio buffer")
    }
    try file.read(into: buffer, frameCount: capacity)
    let frames = Int(buffer.frameLength)
    guard frames > 0, let channels = buffer.floatChannelData else { throw NativeError("Audio contains no readable frames") }

    let channel = channels[0]
    var rms: Float = 0
    var peak: Float = 0
    vDSP_rmsqv(channel, 1, &rms, vDSP_Length(frames))
    vDSP_maxmgv(channel, 1, &peak, vDSP_Length(frames))

    var zeroCrossings = 0
    if frames > 1 {
      var previous = channel[0]
      for i in 1..<frames {
        let current = channel[i]
        if (previous < 0 && current >= 0) || (previous >= 0 && current < 0) { zeroCrossings += 1 }
        previous = current
      }
    }
    let seconds = Double(frames) / format.sampleRate
    let estimatedHz = seconds > 0 ? Double(zeroCrossings) / (2.0 * seconds) : 0

    return [
      "engine": "AVFoundation + Accelerate/vDSP",
      "file": url.lastPathComponent,
      "sampleRate": format.sampleRate,
      "channels": Int(format.channelCount),
      "analyzedFrames": frames,
      "analyzedSeconds": seconds,
      "rms": rms,
      "peakMagnitude": peak,
      "zeroCrossings": zeroCrossings,
      "roughZeroCrossFrequencyHz": estimatedHz
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

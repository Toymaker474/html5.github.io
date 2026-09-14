import Foundation
import Metal
import simd

actor MetalLab {
  static let shared = MetalLab()

  func particleBenchmark(count requested: Int, steps requestedSteps: Int) throws -> [String: Any] {
    guard let device = MTLCreateSystemDefaultDevice() else { throw NativeError("Metal unavailable") }
    guard let queue = device.makeCommandQueue() else { throw NativeError("Metal command queue unavailable") }
    guard let library = device.makeDefaultLibrary(), let function = library.makeFunction(name: "particle_integrate") else {
      throw NativeError("Metal particle kernel not found")
    }
    let pipeline = try device.makeComputePipelineState(function: function)

    let count = max(1_024, min(requested, 1_000_000))
    var stepCount = UInt32(max(1, min(requestedSteps, 2_000)))
    var state = [SIMD4<Float>](repeating: .zero, count: count)
    var seed: UInt64 = 0x123456789abcdef
    func nextFloat() -> Float {
      seed ^= seed << 13
      seed ^= seed >> 7
      seed ^= seed << 17
      return Float(seed & 0xFFFFFF) / Float(0xFFFFFF)
    }
    for i in 0..<count {
      state[i] = SIMD4<Float>(
        nextFloat() * 2 - 1,
        nextFloat() * 2 - 1,
        (nextFloat() - 0.5) * 0.4,
        (nextFloat() - 0.5) * 0.4
      )
    }

    let byteCount = state.count * MemoryLayout<SIMD4<Float>>.stride
    let buffer = state.withUnsafeBytes { raw -> MTLBuffer? in
      guard let base = raw.baseAddress else { return nil }
      return device.makeBuffer(bytes: base, length: byteCount, options: .storageModeShared)
    }
    guard let buffer else { throw NativeError("Metal state buffer allocation failed") }

    var n = UInt32(count)
    var dt: Float = 1.0 / 240.0
    var gravity = SIMD2<Float>(0, -0.9)
    let nBuffer = device.makeBuffer(bytes: &n, length: MemoryLayout<UInt32>.stride)
    let stepsBuffer = device.makeBuffer(bytes: &stepCount, length: MemoryLayout<UInt32>.stride)
    let dtBuffer = device.makeBuffer(bytes: &dt, length: MemoryLayout<Float>.stride)
    let gravityBuffer = device.makeBuffer(bytes: &gravity, length: MemoryLayout<SIMD2<Float>>.stride)
    guard
      let nBuffer,
      let stepsBuffer,
      let dtBuffer,
      let gravityBuffer,
      let command = queue.makeCommandBuffer(),
      let encoder = command.makeComputeCommandEncoder()
    else { throw NativeError("Metal command setup failed") }

    encoder.setComputePipelineState(pipeline)
    encoder.setBuffer(buffer, offset: 0, index: 0)
    encoder.setBuffer(nBuffer, offset: 0, index: 1)
    encoder.setBuffer(stepsBuffer, offset: 0, index: 2)
    encoder.setBuffer(dtBuffer, offset: 0, index: 3)
    encoder.setBuffer(gravityBuffer, offset: 0, index: 4)
    let width = max(1, pipeline.threadExecutionWidth)
    encoder.dispatchThreads(
      MTLSize(width: count, height: 1, depth: 1),
      threadsPerThreadgroup: MTLSize(width: width, height: 1, depth: 1)
    )
    encoder.endEncoding()

    let start = CFAbsoluteTimeGetCurrent()
    command.commit()
    command.waitUntilCompleted()
    let milliseconds = (CFAbsoluteTimeGetCurrent() - start) * 1000
    if let error = command.error { throw error }

    let ptr = buffer.contents().bindMemory(to: SIMD4<Float>.self, capacity: count)
    var checksum = SIMD4<Double>(repeating: 0)
    let stride = max(1, count / 2048)
    var sampled = 0
    var i = 0
    while i < count {
      let s = ptr[i]
      checksum += SIMD4<Double>(Double(s.x), Double(s.y), Double(s.z), Double(s.w))
      sampled += 1
      i += stride
    }

    return [
      "engine": "Metal particle_integrate",
      "device": device.name,
      "particles": count,
      "stepsPerParticle": Int(stepCount),
      "particleSteps": Int64(count) * Int64(stepCount),
      "milliseconds": milliseconds,
      "sampled": sampled,
      "checksum": [checksum.x, checksum.y, checksum.z, checksum.w],
      "verifiedFinite": checksum.x.isFinite && checksum.y.isFinite && checksum.z.isFinite && checksum.w.isFinite
    ]
  }
}

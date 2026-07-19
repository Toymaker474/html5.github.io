import Foundation
import simd

struct TinyBrain: Hashable, Codable {
    static let sensorCount = 8
    static let hiddenCount = 6
    static let outputCount = 4

    var inputWeights: [Float]
    var hiddenBias: [Float]
    var outputWeights: [Float]
    var outputBias: [Float]

    static func random(using rng: inout SplitMix64) -> TinyBrain {
        TinyBrain(
            inputWeights: (0..<(sensorCount * hiddenCount)).map { _ in rng.signedFloat() },
            hiddenBias: (0..<hiddenCount).map { _ in rng.signedFloat() * 0.25 },
            outputWeights: (0..<(hiddenCount * outputCount)).map { _ in rng.signedFloat() },
            outputBias: (0..<outputCount).map { _ in rng.signedFloat() * 0.25 }
        )
    }

    func evaluate(_ sensors: [Float]) -> SIMD4<Float> {
        precondition(sensors.count == Self.sensorCount)
        var hidden = Array(repeating: Float.zero, count: Self.hiddenCount)

        for h in 0..<Self.hiddenCount {
            var sum = hiddenBias[h]
            for s in 0..<Self.sensorCount {
                sum += sensors[s] * inputWeights[h * Self.sensorCount + s]
            }
            hidden[h] = tanh(sum)
        }

        var output = SIMD4<Float>(repeating: 0)
        for o in 0..<Self.outputCount {
            var sum = outputBias[o]
            for h in 0..<Self.hiddenCount {
                sum += hidden[h] * outputWeights[o * Self.hiddenCount + h]
            }
            output[o] = tanh(sum)
        }
        return output
    }

    func mutated(rate: Float, using rng: inout SplitMix64) -> TinyBrain {
        func mutate(_ values: [Float]) -> [Float] {
            values.map { value in
                guard rng.nextFloat() < rate else { return value }
                return max(-2.5, min(2.5, value + rng.signedFloat() * 0.35))
            }
        }

        return TinyBrain(
            inputWeights: mutate(inputWeights),
            hiddenBias: mutate(hiddenBias),
            outputWeights: mutate(outputWeights),
            outputBias: mutate(outputBias)
        )
    }

    var fingerprint: UInt64 {
        inputWeights.prefix(12).reduce(UInt64(0xcbf29ce484222325)) { hash, value in
            (hash ^ UInt64(value.bitPattern)) &* 0x100000001b3
        }
    }
}

struct Creature: Identifiable, Hashable, Codable {
    let id: UUID
    var position: SIMD2<Float>
    var velocity: SIMD2<Float>
    var heading: Float
    var radius: Float
    var hue: Double
    var energy: Float
    var age: Float
    var generation: Int
    var children: Int
    var brain: TinyBrain
    var lastOutputs: SIMD4<Float>

    var speciesID: String {
        String(format: "%04X", Int(brain.fingerprint & 0xFFFF))
    }
}

struct Nutrient: Identifiable, Hashable, Codable {
    let id: UUID
    var position: SIMD2<Float>
    var value: Float
    var hue: Double
}

struct TeacherReport: Identifiable, Hashable, Codable {
    let id: UUID
    let date: Date
    let score: Int
    let focus: String
    let lesson: String
}

struct WorldMetrics: Hashable {
    var population: Int = 0
    var species: Int = 0
    var generation: Int = 0
    var meanEnergy: Float = 0
    var births: Int = 0
    var deaths: Int = 0
    var diversity: Float = 0
    var worldAge: Double = 0
}

struct SplitMix64: RandomNumberGenerator {
    private var state: UInt64

    init(seed: UInt64) {
        state = seed
    }

    mutating func next() -> UInt64 {
        state &+= 0x9E3779B97F4A7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58476D1CE4E5B9
        z = (z ^ (z >> 27)) &* 0x94D049BB133111EB
        return z ^ (z >> 31)
    }

    mutating func nextFloat() -> Float {
        Float(next() >> 40) / Float(1 << 24)
    }

    mutating func signedFloat() -> Float {
        nextFloat() * 2 - 1
    }
}

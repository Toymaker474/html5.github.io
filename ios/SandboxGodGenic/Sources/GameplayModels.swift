import Foundation
import SwiftUI
import simd

enum GodPower: String, CaseIterable, Identifiable, Hashable {
    case nutrientBloom
    case mutationPulse
    case sanctuary
    case selectionStorm
    case genesis

    var id: String { rawValue }

    var title: String {
        switch self {
        case .nutrientBloom: "Nutrient Bloom"
        case .mutationPulse: "Mutation Pulse"
        case .sanctuary: "Sanctuary"
        case .selectionStorm: "Selection Storm"
        case .genesis: "Genesis"
        }
    }

    var shortTitle: String {
        switch self {
        case .nutrientBloom: "Bloom"
        case .mutationPulse: "Mutate"
        case .sanctuary: "Shelter"
        case .selectionStorm: "Storm"
        case .genesis: "Genesis"
        }
    }

    var symbol: String {
        switch self {
        case .nutrientBloom: "leaf.fill"
        case .mutationPulse: "dna"
        case .sanctuary: "shield.lefthalf.filled"
        case .selectionStorm: "tornado"
        case .genesis: "sparkles"
        }
    }

    var cost: Float {
        switch self {
        case .nutrientBloom: 10
        case .mutationPulse: 18
        case .sanctuary: 22
        case .selectionStorm: 12
        case .genesis: 30
        }
    }

    var hue: Double {
        switch self {
        case .nutrientBloom: 0.38
        case .mutationPulse: 0.82
        case .sanctuary: 0.52
        case .selectionStorm: 0.02
        case .genesis: 0.15
        }
    }

    var tint: Color { Color(hue: hue, saturation: 0.82, brightness: 1) }

    var detail: String {
        switch self {
        case .nutrientBloom: "Create a dense patch of food and watch movement strategies reorganize."
        case .mutationPulse: "Generate highly varied descendants from the strongest nearby lineage."
        case .sanctuary: "Reduce local pressure, restore energy, and create a temporary refuge."
        case .selectionStorm: "Trigger a dangerous test that rewards survival instead of scripted winners."
        case .genesis: "Introduce a fresh founder population with completely new neural genomes."
        }
    }
}

enum EvolutionMission: Int, CaseIterable, Identifiable, Hashable {
    case sparkOfLife
    case selfReplication
    case naturalSelection
    case speciation
    case livingEcosystem
    case alienIntelligence

    var id: Int { rawValue }

    var title: String {
        switch self {
        case .sparkOfLife: "Spark of Life"
        case .selfReplication: "Self-Replication"
        case .naturalSelection: "Natural Selection"
        case .speciation: "Speciation"
        case .livingEcosystem: "Living Ecosystem"
        case .alienIntelligence: "Alien Intelligence"
        }
    }

    var subtitle: String {
        switch self {
        case .sparkOfLife: "Grow a stable population without directly controlling any creature."
        case .selfReplication: "Let neural genomes reproduce through earned energy."
        case .naturalSelection: "Cast a Selection Storm and keep enough organisms alive for 15 seconds."
        case .speciation: "Create many persistent genome clusters with meaningful diversity."
        case .livingEcosystem: "Hold population, energy, and diversity in balance for 20 seconds."
        case .alienIntelligence: "Reach deep generations while the Teacher rates the world as healthy."
        }
    }

    var requirement: String {
        switch self {
        case .sparkOfLife: "Reach 100 organisms"
        case .selfReplication: "Produce 40 new births"
        case .naturalSelection: "Survive a 15-second storm"
        case .speciation: "Reach 12 species and 45% diversity"
        case .livingEcosystem: "Hold a balanced ecosystem for 20 seconds"
        case .alienIntelligence: "Reach generation 10 and Teacher score 80"
        }
    }

    var symbol: String {
        switch self {
        case .sparkOfLife: "sparkle"
        case .selfReplication: "arrow.triangle.branch"
        case .naturalSelection: "tornado"
        case .speciation: "circle.hexagongrid.fill"
        case .livingEcosystem: "globe.americas.fill"
        case .alienIntelligence: "brain.filled.head.profile"
        }
    }

    var reward: Int {
        switch self {
        case .sparkOfLife: 350
        case .selfReplication: 500
        case .naturalSelection: 750
        case .speciation: 1_000
        case .livingEcosystem: 1_500
        case .alienIntelligence: 2_500
        }
    }
}

struct EvolutionBreakthrough: Identifiable, Hashable {
    let id = UUID()
    let mission: EvolutionMission
    let scoreReward: Int
    let unlockedPower: GodPower?
}

struct WorldPulse: Identifiable, Hashable {
    let id = UUID()
    let position: SIMD2<Float>
    let createdAt: Date
    let hue: Double
    let power: GodPower
}

extension Creature {
    var fitnessScore: Float {
        energy * 2 + Float(children) * 0.7 + Float(generation) * 0.25 + max(0, 1 - age / 100)
    }
}

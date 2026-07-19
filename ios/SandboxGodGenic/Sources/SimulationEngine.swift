import Foundation
import Observation
import SwiftUI
import simd

@MainActor
@Observable
final class SimulationEngine {
    private(set) var creatures: [Creature] = []
    private(set) var nutrients: [Nutrient] = []
    private(set) var metrics = WorldMetrics()
    private(set) var teacherScore = 72
    private(set) var teacherFocus = "Balance"
    private(set) var teacherLesson = "Observe the first generations before changing the laws."
    private(set) var teacherHistory: [TeacherReport] = []

    private(set) var godEnergy: Float = 68
    private(set) var evolutionScore = 0
    private(set) var missionIndex = 0
    private(set) var completedMissions = 0
    private(set) var breakthrough: EvolutionBreakthrough?
    private(set) var eventMessage = "Tap the world to cast your selected law."
    private(set) var selectedPower: GodPower = .nutrientBloom
    private(set) var pulses: [WorldPulse] = []
    private(set) var selectionChallengeActive = false
    private(set) var selectionChallengeCompleted = false
    private(set) var selectionSurvivalTime: Float = 0
    private(set) var ecosystemHoldTime: Float = 0

    var isRunning = true
    var speed: Float = 1
    var mutationRate: Float = 0.08
    var foodRate: Float = 1
    var hazard: Float = 0.16
    var targetPopulation = 120

    private var rng = SplitMix64(seed: 0x474F4447454E4943)
    private var loopTask: Task<Void, Never>?
    private var lastTick = ContinuousClock.now
    private var lastMetricsDate = Date.distantPast
    private var lastTeacherReview = Date.distantPast
    private var totalBirths = 0
    private var totalDeaths = 0
    private var elapsed: Double = 0
    private var missionBaselineBirths = 0
    private var lastObservedBirths = 0
    private var lastObservedSpecies = 0
    private var selectionPopulationFloor = 0

    init() {
        seedWorld(founders: 64, food: 110)
    }

    var currentMission: EvolutionMission {
        EvolutionMission(rawValue: min(missionIndex, EvolutionMission.allCases.count - 1)) ?? .alienIntelligence
    }

    var missionProgress: Float {
        switch currentMission {
        case .sparkOfLife:
            return min(1, Float(metrics.population) / 100)
        case .selfReplication:
            return min(1, Float(max(0, metrics.births - missionBaselineBirths)) / 40)
        case .naturalSelection:
            return selectionChallengeCompleted ? 1 : min(0.99, selectionSurvivalTime / 15)
        case .speciation:
            return min(1, min(Float(metrics.species) / 12, metrics.diversity / 0.45))
        case .livingEcosystem:
            return min(1, ecosystemHoldTime / 20)
        case .alienIntelligence:
            return min(1, min(Float(metrics.generation) / 10, Float(teacherScore) / 80))
        }
    }

    var missionProgressText: String {
        switch currentMission {
        case .sparkOfLife:
            return "\(metrics.population) / 100 organisms"
        case .selfReplication:
            return "\(max(0, metrics.births - missionBaselineBirths)) / 40 births"
        case .naturalSelection:
            return selectionChallengeActive || selectionChallengeCompleted
                ? "\(Int(selectionSurvivalTime)) / 15 seconds"
                : "Cast Selection Storm"
        case .speciation:
            return "\(metrics.species) species · \(Int(metrics.diversity * 100))% diversity"
        case .livingEcosystem:
            return "\(Int(ecosystemHoldTime)) / 20 stable seconds"
        case .alienIntelligence:
            return "Generation \(metrics.generation) · Teacher \(teacherScore)"
        }
    }

    var nextTeacherReviewText: String {
        let next = lastTeacherReview.addingTimeInterval(3600)
        let remaining = max(0, Int(next.timeIntervalSinceNow))
        let minutes = remaining / 60
        return minutes == 0 ? "due now" : "in \(minutes)m"
    }

    var champion: Creature? {
        creatures.max { $0.fitnessScore < $1.fitnessScore }
    }

    func start() {
        guard loopTask == nil else { return }
        lastTick = .now
        loopTask = Task { [weak self] in
            let clock = ContinuousClock()
            while !Task.isCancelled {
                try? await clock.sleep(for: .milliseconds(33))
                guard let self else { return }
                self.tick()
            }
        }
    }

    func handleScenePhase(_ phase: ScenePhase) {
        switch phase {
        case .active:
            lastTick = .now
            checkTeacherDue()
        case .inactive, .background:
            break
        @unknown default:
            break
        }
    }

    func toggleRunning() {
        isRunning.toggle()
        lastTick = .now
    }

    func setSpeed(_ value: Float) {
        speed = value
    }

    func selectPower(_ power: GodPower) {
        selectedPower = power
        eventMessage = "\(power.title) selected. Tap the microscopic world."
    }

    @discardableResult
    func castSelectedPower(at position: SIMD2<Float>) -> Bool {
        cast(selectedPower, at: position)
    }

    @discardableResult
    func cast(_ power: GodPower, at position: SIMD2<Float>? = nil) -> Bool {
        guard godEnergy >= power.cost else {
            eventMessage = "Not enough God Energy for \(power.title)."
            return false
        }

        let point = position ?? SIMD2<Float>(0.5, 0.5)
        godEnergy -= power.cost
        pulses.append(WorldPulse(position: point, createdAt: Date(), hue: power.hue, power: power))

        switch power {
        case .nutrientBloom:
            for _ in 0..<38 where nutrients.count < 420 {
                nutrients.append(makeNutrient(near: point, spread: 0.10))
            }
            eventMessage = "Nutrient Bloom created a new feeding ground."

        case .mutationPulse:
            let parent = nearestCreature(to: point) ?? champion
            guard let parent else {
                eventMessage = "No living genome was close enough to mutate."
                return false
            }
            let previousRate = mutationRate
            mutationRate = min(0.42, mutationRate + 0.22)
            for _ in 0..<9 where creatures.count < 260 {
                var child = makeCreature(parent: parent)
                child.position = wrap(point + SIMD2<Float>(rng.signedFloat(), rng.signedFloat()) * 0.055)
                creatures.append(child)
                totalBirths += 1
            }
            mutationRate = previousRate
            eventMessage = "A mutation burst created nine experimental descendants."

        case .sanctuary:
            hazard = max(0.02, hazard - 0.12)
            foodRate = min(2.2, foodRate + 0.08)
            for index in creatures.indices {
                let distance = simd_length(wrappedDelta(from: point, to: creatures[index].position))
                if distance < 0.22 {
                    creatures[index].energy = min(2.2, creatures[index].energy + 0.38)
                }
            }
            for _ in 0..<18 where nutrients.count < 420 {
                nutrients.append(makeNutrient(near: point, spread: 0.14))
            }
            eventMessage = "A sanctuary restored nearby life and softened the global hazard."

        case .selectionStorm:
            triggerStorm()
            selectionChallengeActive = true
            selectionChallengeCompleted = false
            selectionSurvivalTime = 0
            selectionPopulationFloor = max(35, metrics.population * 2 / 5)
            eventMessage = "Selection Storm active: keep at least \(selectionPopulationFloor) organisms alive."

        case .genesis:
            for _ in 0..<28 where creatures.count < 260 {
                var founder = makeCreature(parent: nil)
                founder.position = wrap(point + SIMD2<Float>(rng.signedFloat(), rng.signedFloat()) * 0.08)
                creatures.append(founder)
            }
            eventMessage = "Genesis introduced 28 unrelated neural genomes."
        }

        evolutionScore += Int(power.cost * 2)
        updateMetrics(force: true)
        evaluateMission()
        return true
    }

    func dismissBreakthrough() {
        breakthrough = nil
    }

    func seedLife(count: Int = 18) {
        for _ in 0..<count where creatures.count < 260 {
            creatures.append(makeCreature(parent: nil))
        }
        eventMessage = "New founder organisms entered the world."
        updateMetrics(force: true)
    }

    func triggerStorm() {
        for index in creatures.indices {
            let impulse = SIMD2<Float>(rng.signedFloat(), rng.signedFloat()) * (0.08 + hazard * 0.12)
            creatures[index].velocity += impulse
            creatures[index].energy -= 0.04 + hazard * 0.08
        }
        hazard = min(1, hazard + 0.08)
    }

    func newReality() {
        creatures.removeAll(keepingCapacity: true)
        nutrients.removeAll(keepingCapacity: true)
        totalBirths = 0
        totalDeaths = 0
        elapsed = 0
        mutationRate = 0.08
        foodRate = 1
        hazard = 0.16
        godEnergy = 68
        evolutionScore = 0
        missionIndex = 0
        completedMissions = 0
        breakthrough = nil
        selectedPower = .nutrientBloom
        selectionChallengeActive = false
        selectionChallengeCompleted = false
        selectionSurvivalTime = 0
        ecosystemHoldTime = 0
        missionBaselineBirths = 0
        lastObservedBirths = 0
        lastObservedSpecies = 0
        rng = SplitMix64(seed: UInt64.random(in: 1...UInt64.max))
        seedWorld(founders: 64, food: 110)
        runTeacher(manual: true)
        eventMessage = "A completely new reality has begun."
    }

    func runTeacher(manual: Bool = true) {
        updateMetrics(force: true)
        let populationScore = min(100, metrics.population * 100 / max(1, targetPopulation))
        let diversityScore = Int(metrics.diversity * 100)
        let energyScore = Int(min(1, metrics.meanEnergy / 1.2) * 100)
        let stabilityPenalty = min(45, max(0, metrics.deaths - metrics.births) / 2)
        let score = max(0, min(100, (populationScore + diversityScore + energyScore) / 3 - stabilityPenalty))

        let focus: String
        let lesson: String
        if metrics.population < targetPopulation / 3 {
            focus = "Recovery"
            lesson = "Increase nutrients and soften hazards until a stable breeding population returns."
            foodRate = min(2, foodRate + 0.12)
            hazard = max(0.03, hazard - 0.04)
        } else if metrics.diversity < 0.28 {
            focus = "Diversity"
            lesson = "Raise mutation gently so isolated lineages can explore new behaviors."
            mutationRate = min(0.22, mutationRate + 0.015)
        } else if metrics.meanEnergy < 0.55 {
            focus = "Efficiency"
            lesson = "Reward economical motion by increasing food slightly without removing competition."
            foodRate = min(2, foodRate + 0.06)
        } else if metrics.population > targetPopulation * 3 / 2 {
            focus = "Selection"
            lesson = "Tighten resource pressure so efficient brains outcompete wasteful lineages."
            foodRate = max(0.45, foodRate - 0.06)
            hazard = min(0.65, hazard + 0.02)
        } else {
            focus = "Complexity"
            lesson = "The ecosystem is balanced. Preserve the rules and let implicit structure emerge."
        }

        teacherScore = score
        teacherFocus = focus
        teacherLesson = lesson
        lastTeacherReview = Date()
        teacherHistory.insert(
            TeacherReport(id: UUID(), date: lastTeacherReview, score: score, focus: focus, lesson: lesson),
            at: 0
        )
        teacherHistory = Array(teacherHistory.prefix(24))
        if manual {
            godEnergy = min(100, godEnergy + 8)
            evolutionScore += max(10, score / 2)
            eventMessage = "Teacher review complete: \(focus)."
            updateMetrics(force: true)
        }
        evaluateMission()
    }

    private func checkTeacherDue() {
        if Date().timeIntervalSince(lastTeacherReview) >= 3600 {
            runTeacher(manual: false)
        }
    }

    private func tick() {
        guard isRunning else { return }
        let now = ContinuousClock.now
        let duration = lastTick.duration(to: now)
        lastTick = now
        let seconds = min(0.08, max(0.001, Double(duration.components.seconds) + Double(duration.components.attoseconds) / 1e18))
        step(dt: Float(seconds) * speed)
    }

    private func step(dt: Float) {
        elapsed += Double(dt)
        let season = Float((sin(elapsed * 0.035) + 1) * 0.5)
        let foodSpawnChance = dt * (5 + 10 * foodRate) * (0.65 + season * 0.6)
        if rng.nextFloat() < foodSpawnChance, nutrients.count < 420 {
            nutrients.append(makeNutrient())
        }

        var babies: [Creature] = []
        var survivors: [Creature] = []
        survivors.reserveCapacity(creatures.count)

        for var creature in creatures {
            creature.age += dt
            let nearest = nearestFood(to: creature.position)
            let foodVector = nearest.map { wrappedDelta(from: creature.position, to: $0.position) } ?? SIMD2<Float>(0, 0)
            let distance = max(0.0001, simd_length(foodVector))
            let direction = distance > 0 ? foodVector / distance : SIMD2<Float>(0, 0)
            let localDensity = localCreatureDensity(around: creature.position)
            let sensors: [Float] = [
                direction.x,
                direction.y,
                min(1, distance * 2),
                min(1, creature.energy / 1.8),
                min(1, creature.age / 90),
                min(1, Float(localDensity) / 10),
                season * 2 - 1,
                rng.signedFloat()
            ]
            let outputs = creature.brain.evaluate(sensors)
            creature.lastOutputs = outputs

            creature.heading += outputs.x * dt * 3.8
            let forward = SIMD2<Float>(cos(creature.heading), sin(creature.heading))
            let thrust = max(0, outputs.y + 0.25) * dt * 0.42
            creature.velocity += forward * thrust
            creature.velocity *= pow(0.36, dt)
            let maxSpeed: Float = 0.20
            let currentSpeed = simd_length(creature.velocity)
            if currentSpeed > maxSpeed {
                creature.velocity = creature.velocity / currentSpeed * maxSpeed
            }
            creature.position = wrap(creature.position + creature.velocity * dt)

            let movementCost = (0.018 + currentSpeed * 0.24 + creature.radius * 0.012) * dt
            creature.energy -= movementCost + hazard * 0.006 * dt

            if let foodIndex = edibleFoodIndex(for: creature), outputs.z > -0.45 {
                let gain = nutrients[foodIndex].value
                creature.energy = min(2.2, creature.energy + gain)
                nutrients.remove(at: foodIndex)
            }

            if outputs.w > 0.35, creature.energy > 1.35, creatures.count + babies.count < 260 {
                creature.energy *= 0.52
                var child = makeCreature(parent: creature)
                child.position = wrap(creature.position + SIMD2<Float>(rng.signedFloat(), rng.signedFloat()) * 0.018)
                babies.append(child)
                creature.children += 1
                totalBirths += 1
            }

            let lifespan = 85 + Float(creature.generation) * 0.35
            if creature.energy > 0, creature.age < lifespan {
                survivors.append(creature)
            } else {
                totalDeaths += 1
            }
        }

        creatures = survivors + babies
        if creatures.count < 12 {
            seedLife(count: 20 - creatures.count)
        }

        godEnergy = min(100, godEnergy + dt * (0.55 + metrics.diversity * 0.45 + Float(teacherScore) / 240))
        pulses.removeAll { Date().timeIntervalSince($0.createdAt) > 2.2 }

        if selectionChallengeActive {
            if creatures.count < selectionPopulationFloor {
                selectionChallengeActive = false
                selectionSurvivalTime = 0
                eventMessage = "The storm broke the ecosystem. Rebuild and try again."
            } else {
                selectionSurvivalTime += dt
                if selectionSurvivalTime >= 15 {
                    selectionChallengeActive = false
                    selectionChallengeCompleted = true
                    eventMessage = "Natural selection complete: resilient lineages survived."
                    evolutionScore += 450
                }
            }
        }

        if metrics.population >= 100, metrics.meanEnergy >= 0.65, metrics.diversity >= 0.45 {
            ecosystemHoldTime += dt
        } else {
            ecosystemHoldTime = max(0, ecosystemHoldTime - dt * 0.6)
        }

        updateMetrics(force: false)
        updateScoreFromEmergence()
        evaluateMission()
        checkTeacherDue()
    }

    private func seedWorld(founders: Int, food: Int) {
        for _ in 0..<founders { creatures.append(makeCreature(parent: nil)) }
        for _ in 0..<food { nutrients.append(makeNutrient()) }
        updateMetrics(force: true)
        missionBaselineBirths = totalBirths
        lastObservedBirths = totalBirths
        lastObservedSpecies = metrics.species
        runTeacher(manual: false)
    }

    private func updateScoreFromEmergence() {
        if metrics.births > lastObservedBirths {
            evolutionScore += (metrics.births - lastObservedBirths) * 4
            lastObservedBirths = metrics.births
        }
        if metrics.species > lastObservedSpecies {
            evolutionScore += (metrics.species - lastObservedSpecies) * 30
            godEnergy = min(100, godEnergy + Float(metrics.species - lastObservedSpecies) * 1.5)
            lastObservedSpecies = metrics.species
        }
    }

    private func evaluateMission() {
        guard breakthrough == nil, missionProgress >= 1 else { return }
        let completed = currentMission
        let unlocked: GodPower?
        switch completed {
        case .sparkOfLife: unlocked = .mutationPulse
        case .selfReplication: unlocked = .selectionStorm
        case .naturalSelection: unlocked = .sanctuary
        case .speciation: unlocked = .genesis
        case .livingEcosystem, .alienIntelligence: unlocked = nil
        }

        evolutionScore += completed.reward
        godEnergy = min(100, godEnergy + 28)
        completedMissions += 1
        breakthrough = EvolutionBreakthrough(mission: completed, scoreReward: completed.reward, unlockedPower: unlocked)

        if missionIndex < EvolutionMission.allCases.count - 1 {
            missionIndex += 1
            missionBaselineBirths = totalBirths
            selectionChallengeCompleted = false
            selectionSurvivalTime = 0
            ecosystemHoldTime = 0
        }
    }

    private func makeCreature(parent: Creature?) -> Creature {
        let brain = parent?.brain.mutated(rate: mutationRate, using: &rng) ?? TinyBrain.random(using: &rng)
        let parentHue = parent?.hue ?? Double(rng.nextFloat() * 360)
        return Creature(
            id: UUID(),
            position: parent?.position ?? SIMD2<Float>(rng.nextFloat(), rng.nextFloat()),
            velocity: SIMD2<Float>(rng.signedFloat(), rng.signedFloat()) * 0.015,
            heading: rng.nextFloat() * .pi * 2,
            radius: max(0.0045, min(0.015, (parent?.radius ?? 0.008) + rng.signedFloat() * 0.0012)),
            hue: (parentHue + Double(rng.signedFloat() * 18) + 360).truncatingRemainder(dividingBy: 360),
            energy: parent == nil ? 0.9 + rng.nextFloat() * 0.5 : 0.72,
            age: 0,
            generation: (parent?.generation ?? -1) + 1,
            children: 0,
            brain: brain,
            lastOutputs: SIMD4<Float>(repeating: 0)
        )
    }

    private func makeNutrient() -> Nutrient {
        Nutrient(
            id: UUID(),
            position: SIMD2<Float>(rng.nextFloat(), rng.nextFloat()),
            value: 0.12 + rng.nextFloat() * 0.24,
            hue: 105 + Double(rng.nextFloat() * 70)
        )
    }

    private func makeNutrient(near point: SIMD2<Float>, spread: Float) -> Nutrient {
        Nutrient(
            id: UUID(),
            position: wrap(point + SIMD2<Float>(rng.signedFloat(), rng.signedFloat()) * spread),
            value: 0.16 + rng.nextFloat() * 0.30,
            hue: 95 + Double(rng.nextFloat() * 85)
        )
    }

    private func nearestFood(to position: SIMD2<Float>) -> Nutrient? {
        nutrients.min {
            simd_length_squared(wrappedDelta(from: position, to: $0.position)) <
            simd_length_squared(wrappedDelta(from: position, to: $1.position))
        }
    }

    private func nearestCreature(to position: SIMD2<Float>) -> Creature? {
        creatures.min {
            simd_length_squared(wrappedDelta(from: position, to: $0.position)) <
            simd_length_squared(wrappedDelta(from: position, to: $1.position))
        }
    }

    private func edibleFoodIndex(for creature: Creature) -> Int? {
        nutrients.indices.first { index in
            simd_length_squared(wrappedDelta(from: creature.position, to: nutrients[index].position)) < pow(creature.radius + 0.009, 2)
        }
    }

    private func localCreatureDensity(around point: SIMD2<Float>) -> Int {
        creatures.reduce(into: 0) { count, creature in
            if simd_length_squared(wrappedDelta(from: point, to: creature.position)) < 0.012 {
                count += 1
            }
        }
    }

    private func wrappedDelta(from: SIMD2<Float>, to: SIMD2<Float>) -> SIMD2<Float> {
        var delta = to - from
        if delta.x > 0.5 { delta.x -= 1 }
        if delta.x < -0.5 { delta.x += 1 }
        if delta.y > 0.5 { delta.y -= 1 }
        if delta.y < -0.5 { delta.y += 1 }
        return delta
    }

    private func wrap(_ point: SIMD2<Float>) -> SIMD2<Float> {
        SIMD2<Float>(point.x - floor(point.x), point.y - floor(point.y))
    }

    private func updateMetrics(force: Bool) {
        guard force || Date().timeIntervalSince(lastMetricsDate) > 0.35 else { return }
        lastMetricsDate = Date()
        let species = Set(creatures.map(\.speciesID))
        let meanEnergy = creatures.isEmpty ? 0 : creatures.reduce(0) { $0 + $1.energy } / Float(creatures.count)
        metrics = WorldMetrics(
            population: creatures.count,
            species: species.count,
            generation: creatures.map(\.generation).max() ?? 0,
            meanEnergy: meanEnergy,
            births: totalBirths,
            deaths: totalDeaths,
            diversity: creatures.isEmpty ? 0 : min(1, Float(species.count) / sqrt(Float(creatures.count))),
            worldAge: elapsed
        )
    }
}

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

    init() {
        seedWorld(founders: 64, food: 110)
    }

    deinit {
        loopTask?.cancel()
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
            // iOS suspends normal app execution. We intentionally pause instead of
            // pretending the world or teacher continued running in the background.
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

    func seedLife(count: Int = 18) {
        for _ in 0..<count where creatures.count < 240 {
            creatures.append(makeCreature(parent: nil))
        }
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
        rng = SplitMix64(seed: UInt64.random(in: 1...UInt64.max))
        seedWorld(founders: 64, food: 110)
        runTeacher(manual: true)
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
            updateMetrics(force: true)
        }
    }

    var nextTeacherReviewText: String {
        let next = lastTeacherReview.addingTimeInterval(3600)
        let remaining = max(0, Int(next.timeIntervalSinceNow))
        let minutes = remaining / 60
        return minutes == 0 ? "due now" : "in \(minutes)m"
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
        if rng.nextFloat() < foodSpawnChance, nutrients.count < 360 {
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

            if outputs.w > 0.35, creature.energy > 1.35, creatures.count + babies.count < 240 {
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

        updateMetrics(force: false)
        checkTeacherDue()
    }

    private func seedWorld(founders: Int, food: Int) {
        for _ in 0..<founders { creatures.append(makeCreature(parent: nil)) }
        for _ in 0..<food { nutrients.append(makeNutrient()) }
        runTeacher(manual: false)
        updateMetrics(force: true)
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

    private func nearestFood(to position: SIMD2<Float>) -> Nutrient? {
        nutrients.min { simd_length_squared(wrappedDelta(from: position, to: $0.position)) < simd_length_squared(wrappedDelta(from: position, to: $1.position)) }
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
        SIMD2<Float>(
            point.x - floor(point.x),
            point.y - floor(point.y)
        )
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

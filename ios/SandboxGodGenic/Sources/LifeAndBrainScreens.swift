import SwiftUI

struct LifeScreen: View {
    let engine: SimulationEngine

    private var speciesRows: [(id: String, count: Int, best: Creature)] {
        let grouped = Dictionary(grouping: engine.creatures, by: \.speciesID)
        return grouped.compactMap { id, creatures in
            guard let best = creatures.max(by: { $0.fitnessScore < $1.fitnessScore }) else { return nil }
            return (id, creatures.count, best)
        }
        .sorted { lhs, rhs in
            lhs.count == rhs.count ? lhs.best.fitnessScore > rhs.best.fitnessScore : lhs.count > rhs.count
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    championCard
                    discoveryGrid
                    speciesList
                }
                .padding(14)
                .padding(.bottom, 28)
            }
            .background(
                ZStack {
                    BioWorldCanvas(engine: engine, interactive: false)
                        .blur(radius: 7)
                        .opacity(0.42)
                    Color.black.opacity(0.45)
                }
                .ignoresSafeArea()
            )
            .navigationTitle("Living Lineages")
            .toolbar {
                Button("Genesis", systemImage: "sparkles") {
                    engine.selectPower(.genesis)
                    _ = engine.cast(.genesis)
                }
            }
        }
    }

    private var championCard: some View {
        GlassSurface(tint: .mint) {
            if let champion = engine.champion {
                HStack(spacing: 16) {
                    CreatureOrb(creature: champion, size: 92)
                    VStack(alignment: .leading, spacing: 6) {
                        Text("CURRENT CHAMPION")
                            .font(.caption2.weight(.black))
                            .foregroundStyle(.mint)
                        Text("Species \(champion.speciesID)")
                            .font(.title2.weight(.black))
                        Text("Generation \(champion.generation) · \(champion.children) children")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        ProgressView(value: min(1, champion.energy / 2.2))
                            .tint(.mint)
                        Text("Fitness \(champion.fitnessScore.formatted(.number.precision(.fractionLength(2))))")
                            .font(.caption.weight(.bold))
                            .foregroundStyle(.cyan)
                    }
                }
            } else {
                ContentUnavailableView("No life", systemImage: "circle.dashed", description: Text("Use Genesis in the Play tab."))
            }
        }
    }

    private var discoveryGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
            MetricTile(title: "Births", value: "\(engine.metrics.births)", detail: "self-replication", symbol: "arrow.triangle.branch")
            MetricTile(title: "Deaths", value: "\(engine.metrics.deaths)", detail: "selection pressure", symbol: "waveform.path.ecg")
            MetricTile(title: "Species", value: "\(engine.metrics.species)", detail: "genome clusters", symbol: "circle.hexagongrid.fill")
            MetricTile(title: "Diversity", value: "\(Int(engine.metrics.diversity * 100))%", detail: "ecosystem variety", symbol: "chart.xyaxis.line")
        }
    }

    private var speciesList: some View {
        GlassSurface(tint: .cyan) {
            VStack(alignment: .leading, spacing: 12) {
                Text("SPECIES DISCOVERED")
                    .font(.caption.weight(.black))
                    .foregroundStyle(.cyan)

                ForEach(Array(speciesRows.prefix(14).enumerated()), id: \.element.id) { index, row in
                    HStack(spacing: 11) {
                        Text("\(index + 1)")
                            .font(.caption.monospacedDigit().weight(.black))
                            .foregroundStyle(.white.opacity(0.35))
                            .frame(width: 22)
                        CreatureOrb(creature: row.best, size: 38)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Species \(row.id)")
                                .font(.subheadline.weight(.black))
                            Text("Gen \(row.best.generation) · fitness \(row.best.fitnessScore.formatted(.number.precision(.fractionLength(1))))")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text("×\(row.count)")
                            .font(.headline.monospacedDigit().weight(.black))
                            .foregroundStyle(.mint)
                    }
                    .padding(.vertical, 5)
                }
            }
        }
    }
}

struct BrainLabScreen: View {
    let engine: SimulationEngine

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    brainCard
                    actionOutputs
                    mutationLab
                }
                .padding(14)
                .padding(.bottom, 28)
            }
            .background(
                RadialGradient(colors: [.purple.opacity(0.28), .black], center: .topTrailing, startRadius: 0, endRadius: 760)
                    .ignoresSafeArea()
            )
            .navigationTitle("Tiny Brain Lab")
        }
    }

    private var brainCard: some View {
        GlassSurface(tint: .purple) {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("8 SENSORS → 6 NEURONS → 4 ACTIONS")
                            .font(.caption2.weight(.black))
                            .foregroundStyle(.purple)
                        Text(engine.champion.map { "Champion \($0.speciesID)" } ?? "Waiting for life")
                            .font(.title2.weight(.black))
                    }
                    Spacer()
                    if let champion = engine.champion {
                        CreatureOrb(creature: champion, size: 54)
                    }
                }

                BrainNetworkView(brain: engine.champion?.brain)
                    .frame(height: 290)
            }
        }
    }

    private var actionOutputs: some View {
        GlassSurface(tint: .cyan) {
            VStack(alignment: .leading, spacing: 12) {
                Text("LIVE NEURAL OUTPUT")
                    .font(.caption.weight(.black))
                    .foregroundStyle(.cyan)

                if let outputs = engine.champion?.lastOutputs {
                    outputRow("Turn", outputs.x, "arrow.triangle.turn.up.right.diamond.fill")
                    outputRow("Thrust", outputs.y, "forward.fill")
                    outputRow("Eat", outputs.z, "fork.knife")
                    outputRow("Replicate", outputs.w, "arrow.triangle.branch")
                } else {
                    Text("No champion available.").foregroundStyle(.secondary)
                }
            }
        }
    }

    private var mutationLab: some View {
        GlassSurface(tint: .pink) {
            VStack(alignment: .leading, spacing: 12) {
                Text("PLAYER EXPERIMENT")
                    .font(.caption.weight(.black))
                    .foregroundStyle(.pink)
                Text("Create nine mutated descendants from the current champion. Evolution decides whether they survive.")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.68))

                ParameterSlider(
                    title: "Base mutation",
                    value: Binding(get: { engine.mutationRate }, set: { engine.mutationRate = $0 }),
                    range: 0.01...0.25,
                    format: { "\(Int($0 * 100))%" }
                )

                Button {
                    guard let champion = engine.champion else { return }
                    engine.selectPower(.mutationPulse)
                    _ = engine.cast(.mutationPulse, at: champion.position)
                } label: {
                    Label("Mutate champion · 18⚡", systemImage: "dna")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .tint(.pink)
                .disabled(engine.godEnergy < GodPower.mutationPulse.cost || engine.champion == nil)
            }
        }
    }

    private func outputRow(_ title: String, _ value: Float, _ symbol: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: symbol)
                .frame(width: 24)
                .foregroundStyle(.mint)
            Text(title)
                .font(.subheadline.weight(.bold))
                .frame(width: 78, alignment: .leading)
            ProgressView(value: Double((value + 1) / 2))
                .tint(value >= 0 ? .mint : .pink)
            Text(value.formatted(.number.precision(.fractionLength(2))))
                .font(.caption.monospacedDigit().weight(.bold))
                .frame(width: 44, alignment: .trailing)
        }
    }
}

private struct CreatureOrb: View {
    let creature: Creature
    let size: CGFloat

    var body: some View {
        Circle()
            .fill(
                RadialGradient(
                    colors: [.white, Color(hue: creature.hue / 360, saturation: 0.88, brightness: 1), .black],
                    center: .topLeading,
                    startRadius: 0,
                    endRadius: size * 0.68
                )
            )
            .overlay(Circle().stroke(.white.opacity(0.45), lineWidth: 1.5))
            .shadow(color: Color(hue: creature.hue / 360, saturation: 0.88, brightness: 1), radius: 16)
            .frame(width: size, height: size)
    }
}

private struct BrainNetworkView: View {
    let brain: TinyBrain?

    var body: some View {
        Canvas { context, size in
            guard let brain else {
                context.draw(Text("No living brain selected").foregroundStyle(.secondary), at: CGPoint(x: size.width / 2, y: size.height / 2))
                return
            }

            let layerCounts = [TinyBrain.sensorCount, TinyBrain.hiddenCount, TinyBrain.outputCount]
            let xPositions = [size.width * 0.10, size.width * 0.50, size.width * 0.90]
            let yPositions = layerCounts.map { count in
                (0..<count).map { index in size.height * CGFloat(index + 1) / CGFloat(count + 1) }
            }

            for hidden in 0..<TinyBrain.hiddenCount {
                for sensor in 0..<TinyBrain.sensorCount {
                    let weight = brain.inputWeights[hidden * TinyBrain.sensorCount + sensor]
                    drawConnection(
                        context: &context,
                        from: CGPoint(x: xPositions[0], y: yPositions[0][sensor]),
                        to: CGPoint(x: xPositions[1], y: yPositions[1][hidden]),
                        weight: weight
                    )
                }
            }

            for output in 0..<TinyBrain.outputCount {
                for hidden in 0..<TinyBrain.hiddenCount {
                    let weight = brain.outputWeights[output * TinyBrain.hiddenCount + hidden]
                    drawConnection(
                        context: &context,
                        from: CGPoint(x: xPositions[1], y: yPositions[1][hidden]),
                        to: CGPoint(x: xPositions[2], y: yPositions[2][output]),
                        weight: weight
                    )
                }
            }

            for layer in 0..<3 {
                for y in yPositions[layer] {
                    let center = CGPoint(x: xPositions[layer], y: y)
                    let color: Color = layer == 0 ? .cyan : layer == 1 ? .purple : .mint
                    context.drawLayer { layerContext in
                        layerContext.addFilter(.shadow(color: color, radius: 9))
                        layerContext.fill(Path(ellipseIn: CGRect(x: center.x - 7, y: center.y - 7, width: 14, height: 14)), with: .color(color))
                    }
                }
            }
        }
    }

    private func drawConnection(context: inout GraphicsContext, from: CGPoint, to: CGPoint, weight: Float) {
        var path = Path()
        path.move(to: from)
        path.addLine(to: to)
        let color: Color = weight >= 0 ? .cyan : .pink
        context.stroke(path, with: .color(color.opacity(0.12 + Double(min(1, abs(weight))) * 0.42)), lineWidth: 0.35 + CGFloat(abs(weight)) * 0.55)
    }
}

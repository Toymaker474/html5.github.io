import SwiftUI

struct RootView: View {
    let engine: SimulationEngine
    @State private var selection: AppTab = .world

    enum AppTab: Hashable {
        case world
        case life
        case brains
        case teacher
        case laws
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            TabView(selection: $selection) {
                WorldScreen(engine: engine)
                    .tag(AppTab.world)
                    .tabItem { Label("Play", systemImage: "scope") }

                LifeScreen(engine: engine)
                    .tag(AppTab.life)
                    .tabItem { Label("Life", systemImage: "bolt.fill") }

                BrainLabScreen(engine: engine)
                    .tag(AppTab.brains)
                    .tabItem { Label("Brains", systemImage: "command") }

                TeacherScreen(engine: engine)
                    .tag(AppTab.teacher)
                    .tabItem { Label("Teacher", systemImage: "sparkles") }

                DesignComparisonScreen(engine: engine)
                    .tag(AppTab.laws)
                    .tabItem { Label("Laws", systemImage: "cube.transparent") }
            }
            .tint(.mint)
        }
    }
}

struct WorldScreen: View {
    let engine: SimulationEngine

    var body: some View {
        ZStack {
            BioWorldCanvas(engine: engine)
                .ignoresSafeArea()

            LinearGradient(
                colors: [.black.opacity(0.46), .clear, .black.opacity(0.82)],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()
            .allowsHitTesting(false)

            VStack(spacing: 10) {
                topHUD
                missionHUD
                Spacer()
                eventHUD
                metricsHUD
                powerDock
            }
            .padding(.horizontal, 12)
            .padding(.top, 8)
            .padding(.bottom, 6)
        }
        .sheet(
            item: Binding(
                get: { engine.breakthrough },
                set: { value in if value == nil { engine.dismissBreakthrough() } }
            )
        ) { breakthrough in
            BreakthroughSheet(engine: engine, breakthrough: breakthrough)
                .presentationDetents([.medium])
                .presentationDragIndicator(.visible)
        }
    }

    private var topHUD: some View {
        HStack(spacing: 10) {
            ZStack {
                RoundedRectangle(cornerRadius: 15, style: .continuous)
                    .fill(LinearGradient(colors: [.mint, .cyan], startPoint: .topLeading, endPoint: .bottomTrailing))
                Text("G")
                    .font(.title2.weight(.black))
                    .foregroundStyle(.black)
            }
            .frame(width: 48, height: 48)

            VStack(alignment: .leading, spacing: 2) {
                Text("SANDBOX GOD GENIC")
                    .font(.caption.weight(.black))
                    .tracking(1.2)
                Text("EMERGENCE GAME · BUILD 0.2")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(.white.opacity(0.5))
                    .tracking(1.7)
            }

            Spacer(minLength: 4)

            VStack(alignment: .trailing, spacing: 3) {
                Label("\(engine.evolutionScore)", systemImage: "sparkles")
                    .font(.caption.weight(.black))
                    .foregroundStyle(.cyan)
                Text("EVOLUTION SCORE")
                    .font(.system(size: 7, weight: .black))
                    .foregroundStyle(.white.opacity(0.42))
            }

            Button {
                engine.toggleRunning()
            } label: {
                Image(systemName: engine.isRunning ? "pause.fill" : "play.fill")
                    .font(.headline)
                    .frame(width: 42, height: 42)
            }
            .buttonStyle(.borderedProminent)
            .tint(.white.opacity(0.11))
        }
        .padding(12)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 24).stroke(.white.opacity(0.10)))
    }

    private var missionHUD: some View {
        GlassSurface(tint: .purple) {
            VStack(alignment: .leading, spacing: 9) {
                HStack {
                    Label("MISSION \(engine.missionIndex + 1)", systemImage: engine.currentMission.symbol)
                        .font(.caption2.weight(.black))
                        .foregroundStyle(.purple)
                    Spacer()
                    Text("+\(engine.currentMission.reward)")
                        .font(.caption.weight(.black))
                        .foregroundStyle(.cyan)
                }

                Text(engine.currentMission.title)
                    .font(.headline.weight(.black))
                Text(engine.currentMission.subtitle)
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.66))
                    .lineLimit(2)

                ProgressView(value: engine.missionProgress)
                    .tint(.mint)

                HStack {
                    Text(engine.missionProgressText)
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(.white.opacity(0.58))
                    Spacer()
                    Text("\(Int(engine.missionProgress * 100))%")
                        .font(.caption2.monospacedDigit().weight(.black))
                        .foregroundStyle(.mint)
                }
            }
        }
    }

    private var eventHUD: some View {
        Text(engine.eventMessage)
            .font(.caption.weight(.bold))
            .foregroundStyle(.white.opacity(0.82))
            .lineLimit(2)
            .multilineTextAlignment(.center)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(.black.opacity(0.55), in: Capsule())
            .overlay(Capsule().stroke(engine.selectedPower.tint.opacity(0.35)))
    }

    private var metricsHUD: some View {
        HStack(spacing: 8) {
            compactMetric("POP", "\(engine.metrics.population)", .mint)
            compactMetric("SPECIES", "\(engine.metrics.species)", .cyan)
            compactMetric("GEN", "\(engine.metrics.generation)", .purple)
            compactMetric("ENERGY", "\(Int(engine.godEnergy))", .yellow)
        }
    }

    private func compactMetric(_ title: String, _ value: String, _ color: Color) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.headline.monospacedDigit().weight(.black))
                .foregroundStyle(color)
            Text(title)
                .font(.system(size: 7, weight: .black))
                .foregroundStyle(.white.opacity(0.45))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(.black.opacity(0.56), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(color.opacity(0.20)))
    }

    private var powerDock: some View {
        VStack(spacing: 7) {
            HStack {
                Text("EXPLICIT LAWS")
                    .font(.system(size: 8, weight: .black))
                    .tracking(1.6)
                    .foregroundStyle(.white.opacity(0.48))
                Spacer()
                Text("Tap world to cast")
                    .font(.system(size: 8, weight: .bold))
                    .foregroundStyle(engine.selectedPower.tint)
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 9) {
                    ForEach(GodPower.allCases) { power in
                        Button {
                            engine.selectPower(power)
                        } label: {
                            VStack(spacing: 5) {
                                Image(systemName: power.symbol)
                                    .font(.headline)
                                Text(power.shortTitle)
                                    .font(.system(size: 9, weight: .black))
                                Text("\(Int(power.cost))⚡")
                                    .font(.system(size: 8, weight: .bold))
                                    .opacity(0.72)
                            }
                            .frame(width: 65, height: 58)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(engine.selectedPower == power ? power.tint : .white.opacity(0.10))
                        .disabled(engine.godEnergy < power.cost)
                    }

                    Menu {
                        ForEach([Float(0.5), 1, 2, 4], id: \.self) { value in
                            Button("\(value.formatted(.number.precision(.fractionLength(value == 0.5 ? 1 : 0))))×") {
                                engine.setSpeed(value)
                            }
                        }
                    } label: {
                        VStack(spacing: 5) {
                            Image(systemName: "forward.fill")
                            Text("\(engine.speed.formatted(.number.precision(.fractionLength(engine.speed == 0.5 ? 1 : 0))))×")
                                .font(.system(size: 10, weight: .black))
                        }
                        .frame(width: 58, height: 58)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.white.opacity(0.10))
                }
            }
        }
        .padding(10)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 24).stroke(.white.opacity(0.10)))
    }
}

private struct BreakthroughSheet: View {
    let engine: SimulationEngine
    let breakthrough: EvolutionBreakthrough
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            RadialGradient(colors: [.purple.opacity(0.55), .black], center: .top, startRadius: 0, endRadius: 480)
                .ignoresSafeArea()

            VStack(spacing: 16) {
                Image(systemName: breakthrough.mission.symbol)
                    .font(.system(size: 52, weight: .black))
                    .foregroundStyle(.mint)
                    .shadow(color: .mint, radius: 22)

                Text("EVOLUTION BREAKTHROUGH")
                    .font(.caption.weight(.black))
                    .tracking(2.5)
                    .foregroundStyle(.cyan)

                Text(breakthrough.mission.title)
                    .font(.system(size: 34, weight: .black, design: .rounded))
                    .multilineTextAlignment(.center)

                Text("The result emerged from physics, energy, mutation, and selection—not from a scripted creature path.")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.70))
                    .multilineTextAlignment(.center)

                HStack(spacing: 14) {
                    Label("+\(breakthrough.scoreReward)", systemImage: "sparkles")
                    Label("+28", systemImage: "bolt.fill")
                }
                .font(.headline.weight(.black))
                .foregroundStyle(.mint)

                if let power = breakthrough.unlockedPower {
                    Label("Unlocked: \(power.title)", systemImage: power.symbol)
                        .font(.subheadline.weight(.black))
                        .foregroundStyle(power.tint)
                }

                Button("Continue evolving") {
                    engine.dismissBreakthrough()
                    dismiss()
                }
                .buttonStyle(.borderedProminent)
                .tint(.mint)
                .controlSize(.large)
            }
            .padding(28)
        }
    }
}

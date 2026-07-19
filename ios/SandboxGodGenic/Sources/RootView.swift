import SwiftUI

struct RootView: View {
    let engine: SimulationEngine
    @State private var selection: AppTab = .world

    enum AppTab: Hashable {
        case world
        case design
        case teacher
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            TabView(selection: $selection) {
                WorldScreen(engine: engine)
                    .tag(AppTab.world)
                    .tabItem { Label("World", systemImage: "globe.americas.fill") }

                DesignComparisonScreen(engine: engine)
                    .tag(AppTab.design)
                    .tabItem { Label("Design", systemImage: "square.split.2x1.fill") }

                TeacherScreen(engine: engine)
                    .tag(AppTab.teacher)
                    .tabItem { Label("Teacher", systemImage: "brain.head.profile.fill") }
            }
            .tint(.mint)
        }
    }
}

struct WorldScreen: View {
    let engine: SimulationEngine

    var body: some View {
        NavigationStack {
            ZStack(alignment: .bottom) {
                BioWorldCanvas(engine: engine)
                    .ignoresSafeArea()

                LinearGradient(colors: [.clear, .black.opacity(0.9)], startPoint: .center, endPoint: .bottom)
                    .ignoresSafeArea()
                    .allowsHitTesting(false)

                ScrollView {
                    VStack(spacing: 14) {
                        Spacer(minLength: 390)
                        heroCard
                        metricsGrid
                        controls
                    }
                    .padding(.horizontal, 14)
                    .padding(.bottom, 24)
                }
            }
            .navigationTitle("Sandbox God Genic")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
        }
    }

    private var heroCard: some View {
        GlassSurface {
            VStack(alignment: .leading, spacing: 10) {
                Label("LIVING WORLD · LOCAL DEVICE", systemImage: "sparkles")
                    .font(.caption.weight(.black))
                    .foregroundStyle(.mint)

                Text("Physics first. Life emerges.")
                    .font(.system(size: 30, weight: .black, design: .rounded))
                    .tracking(-1)

                Text("Every organism carries a tiny 8→6→4 neural genome. Food competition, mutation, reproduction, selection, speciation, and ecosystems emerge from the rules instead of being scripted outcomes.")
                    .font(.subheadline)
                    .foregroundStyle(.white.opacity(0.72))
            }
        }
    }

    private var metricsGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
            MetricTile(title: "Population", value: "\(engine.metrics.population)", detail: "living organisms", symbol: "circle.hexagongrid.fill")
            MetricTile(title: "Species", value: "\(engine.metrics.species)", detail: "genome clusters", symbol: "aqi.medium")
            MetricTile(title: "Generation", value: "\(engine.metrics.generation)", detail: "highest lineage", symbol: "point.3.connected.trianglepath.dotted")
            MetricTile(title: "Diversity", value: "\(Int(engine.metrics.diversity * 100))%", detail: "teacher metric", symbol: "chart.xyaxis.line")
        }
    }

    private var controls: some View {
        GlassSurface {
            VStack(spacing: 14) {
                HStack(spacing: 10) {
                    ActionButton(title: engine.isRunning ? "Pause" : "Play", symbol: engine.isRunning ? "pause.fill" : "play.fill") {
                        engine.toggleRunning()
                    }
                    ActionButton(title: "Seed life", symbol: "plus.circle.fill") {
                        engine.seedLife()
                    }
                    ActionButton(title: "Storm", symbol: "tornado") {
                        engine.triggerStorm()
                    }
                }

                HStack {
                    Text("SIM SPEED")
                        .font(.caption2.weight(.black))
                        .foregroundStyle(.white.opacity(0.5))
                    Spacer()
                    ForEach([Float(0.5), 1, 2, 4], id: \.self) { value in
                        Button("\(value.formatted(.number.precision(.fractionLength(value == 0.5 ? 1 : 0))))×") {
                            engine.setSpeed(value)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(engine.speed == value ? .mint : .white.opacity(0.10))
                    }
                }
            }
        }
    }
}

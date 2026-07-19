import SwiftUI

@main
@MainActor
struct SandboxGodGenicApp: App {
    @Environment(\.scenePhase) private var scenePhase
    @State private var engine = SimulationEngine()

    var body: some Scene {
        WindowGroup {
            RootView(engine: engine)
                .preferredColorScheme(.dark)
                .task { engine.start() }
                .onChange(of: scenePhase) { _, phase in
                    engine.handleScenePhase(phase)
                }
        }
    }
}

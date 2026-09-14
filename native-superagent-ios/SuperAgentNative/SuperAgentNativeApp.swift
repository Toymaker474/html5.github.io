import SwiftUI

@main
struct SuperAgentNativeApp: App {
  @StateObject private var runtime = AgentRuntime()

  var body: some Scene {
    WindowGroup {
      ContentView()
        .environmentObject(runtime)
    }
  }
}

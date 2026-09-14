import Foundation
import AppIntents

struct SuperAgentNativeSelfTestIntent: AppIntent {
  static var title: LocalizedStringResource = "SuperAgent Native Self Test"
  static var description = IntentDescription("Run the compiled native toolchain self-test without opening a browser or WebView.")
  static var openAppWhenRun = false

  func perform() async throws -> some IntentResult & ReturnsValue<String> {
    let result = try await NativeAdvancedHub.shared.selfTest()
    let data = try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys])
    let text = String(data: data, encoding: .utf8) ?? "Native self-test completed."
    return .result(value: text)
  }
}

struct SuperAgentNativeStackIntent: AppIntent {
  static var title: LocalizedStringResource = "SuperAgent Native Stack"
  static var description = IntentDescription("Report the compiled native languages and frameworks in SuperAgent Native.")
  static var openAppWhenRun = false

  func perform() async throws -> some IntentResult & ReturnsValue<String> {
    let result = await NativeAdvancedHub.shared.stackManifest()
    let data = try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys])
    return .result(value: String(data: data, encoding: .utf8) ?? "Native stack available.")
  }
}

struct SuperAgentAppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: SuperAgentNativeSelfTestIntent(),
      phrases: ["Test \(.applicationName) native tools", "Run \(.applicationName) self test"],
      shortTitle: "Native Self Test",
      systemImageName: "cpu"
    )
    AppShortcut(
      intent: SuperAgentNativeStackIntent(),
      phrases: ["Show \(.applicationName) native stack"],
      shortTitle: "Native Stack",
      systemImageName: "square.stack.3d.up"
    )
  }
}

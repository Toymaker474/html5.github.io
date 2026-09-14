import Foundation
import LiteRTLM

struct ChatLine: Identifiable, Equatable {
  enum Kind { case user, agent, system, error }
  let id = UUID()
  let kind: Kind
  let text: String
}

@MainActor
final class AgentRuntime: ObservableObject {
  @Published var lines: [ChatLine] = [
    ChatLine(kind: .system, text: "Import a .litertlm model to start the native agent.")
  ]
  @Published var status = "No model loaded"
  @Published var isBusy = false
  @Published var modelName: String?

  private var engine: Engine?
  private var conversation: Conversation?

  private let systemPrompt = """
  You are SuperAgent Native running entirely on an iPhone. You have real native Swift tools.
  Use tools instead of pretending to execute actions. Verify results before claiming success.
  You may create and edit files only inside the app workspace. Never request passwords, tokens,
  hidden credentials, or destructive system access. Prefer deterministic tools for math, hashing,
  files, OCR, QR generation, device facts, motion sampling, and Metal compute benchmarks.
  When a tool fails, treat the error as data and explain what failed. Do not claim shell access.
  """

  func installModel(from externalURL: URL) async {
    guard !isBusy else { return }
    isBusy = true
    status = "Importing model…"
    defer { isBusy = false }

    let scoped = externalURL.startAccessingSecurityScopedResource()
    defer { if scoped { externalURL.stopAccessingSecurityScopedResource() } }

    do {
      let appSupport = try FileManager.default.url(
        for: .applicationSupportDirectory,
        in: .userDomainMask,
        appropriateFor: nil,
        create: true
      )
      let modelDir = appSupport.appendingPathComponent("Models", isDirectory: true)
      try FileManager.default.createDirectory(at: modelDir, withIntermediateDirectories: true)
      let installed = modelDir.appendingPathComponent(externalURL.lastPathComponent)
      if FileManager.default.fileExists(atPath: installed.path) {
        try FileManager.default.removeItem(at: installed)
      }
      try FileManager.default.copyItem(at: externalURL, to: installed)
      try await loadModel(at: installed)
    } catch {
      status = "Model load failed"
      lines.append(.init(kind: .error, text: String(describing: error)))
    }
  }

  func importWorkspaceFile(from externalURL: URL) async {
    let scoped = externalURL.startAccessingSecurityScopedResource()
    defer { if scoped { externalURL.stopAccessingSecurityScopedResource() } }
    do {
      let result = try await NativeHub.shared.importFile(from: externalURL)
      let name = result["name"] as? String ?? externalURL.lastPathComponent
      let bytes = result["bytes"] as? Int ?? 0
      lines.append(.init(kind: .system, text: "Imported workspace file: \(name) (\(bytes) bytes)."))
    } catch {
      lines.append(.init(kind: .error, text: "Workspace import failed: \(error)"))
    }
  }

  private func loadModel(at url: URL) async throws {
    status = "Starting LiteRT-LM on GPU…"

    let cache = try FileManager.default.url(
      for: .cachesDirectory,
      in: .userDomainMask,
      appropriateFor: nil,
      create: true
    ).appendingPathComponent("LiteRTLM", isDirectory: true)
    try FileManager.default.createDirectory(at: cache, withIntermediateDirectories: true)

    let config = try EngineConfig(
      modelPath: url.path,
      backend: .gpu,
      maxNumTokens: 8192,
      cacheDir: cache.path
    )

    let newEngine = Engine(engineConfig: config)
    try await newEngine.initialize()

    let conversationConfig = ConversationConfig(
      systemMessage: Message(systemPrompt, role: .system),
      tools: NativeTools.all,
      thinkingConfig: ThinkingConfig(enableThinking: true, thinkingTokenBudget: 2048),
      automaticToolCalling: true
    )

    let newConversation = try await newEngine.createConversation(with: conversationConfig)
    engine = newEngine
    conversation = newConversation
    modelName = url.lastPathComponent
    status = "Ready · GPU · \(NativeTools.all.count) native tools"
    lines.append(.init(kind: .system, text: "Native model ready: \(url.lastPathComponent)"))
  }

  func send(_ raw: String) async {
    let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !text.isEmpty, !isBusy else { return }
    guard let conversation else {
      lines.append(.init(kind: .error, text: "Import a .litertlm model first."))
      return
    }

    lines.append(.init(kind: .user, text: text))
    isBusy = true
    status = "Thinking / running native tools…"
    defer {
      isBusy = false
      status = modelName == nil ? "No model loaded" : "Ready · GPU · \(NativeTools.all.count) native tools"
    }

    do {
      let response = try await conversation.sendMessage(Message(text))
      let answer = response.toString.trimmingCharacters(in: .whitespacesAndNewlines)
      lines.append(.init(kind: .agent, text: answer.isEmpty ? "Tool execution completed." : answer))
    } catch {
      lines.append(.init(kind: .error, text: "Agent error: \(error)"))
    }
  }

  func resetConversation() async {
    guard let engine else { return }
    do {
      let config = ConversationConfig(
        systemMessage: Message(systemPrompt, role: .system),
        tools: NativeTools.all,
        thinkingConfig: ThinkingConfig(enableThinking: true, thinkingTokenBudget: 2048),
        automaticToolCalling: true
      )
      conversation = try await engine.createConversation(with: config)
      lines = [.init(kind: .system, text: "Conversation reset. Native tools remain available.")]
    } catch {
      lines.append(.init(kind: .error, text: "Reset failed: \(error)"))
    }
  }
}

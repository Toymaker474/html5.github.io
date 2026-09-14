import SwiftUI
import UniformTypeIdentifiers

struct ContentView: View {
  @EnvironmentObject private var runtime: AgentRuntime
  @State private var prompt = ""
  @State private var importingModel = false
  @State private var importingWorkspaceFile = false

  private var liteRTType: UTType {
    UTType(filenameExtension: "litertlm") ?? .data
  }

  var body: some View {
    NavigationStack {
      VStack(spacing: 0) {
        statusBar
        Divider()
        ScrollViewReader { proxy in
          ScrollView {
            LazyVStack(alignment: .leading, spacing: 12) {
              ForEach(runtime.lines) { line in
                bubble(line).id(line.id)
              }
            }
            .padding()
          }
          .onChange(of: runtime.lines.count) { _, _ in
            if let last = runtime.lines.last?.id {
              withAnimation { proxy.scrollTo(last, anchor: .bottom) }
            }
          }
        }
        Divider()
        quickTools
        composer
      }
      .navigationTitle("SuperAgent Native")
      .toolbar {
        ToolbarItem(placement: .topBarLeading) {
          Menu {
            Button("Import LiteRT-LM Model") { importingModel = true }
            Button("Import Workspace File") { importingWorkspaceFile = true }
          } label: {
            Label("Import", systemImage: "square.and.arrow.down")
          }
        }
        ToolbarItem(placement: .topBarTrailing) {
          Button {
            Task { await runtime.resetConversation() }
          } label: {
            Image(systemName: "arrow.counterclockwise")
          }
          .disabled(runtime.modelName == nil || runtime.isBusy)
        }
      }
      .fileImporter(
        isPresented: $importingModel,
        allowedContentTypes: [liteRTType, .data],
        allowsMultipleSelection: false
      ) { result in
        switch result {
        case .success(let urls):
          if let url = urls.first { Task { await runtime.installModel(from: url) } }
        case .failure(let error):
          runtime.lines.append(.init(kind: .error, text: "Model picker: \(error)"))
        }
      }
      .fileImporter(
        isPresented: $importingWorkspaceFile,
        allowedContentTypes: [.item],
        allowsMultipleSelection: false
      ) { result in
        switch result {
        case .success(let urls):
          if let url = urls.first { Task { await runtime.importWorkspaceFile(from: url) } }
        case .failure(let error):
          runtime.lines.append(.init(kind: .error, text: "File picker: \(error)"))
        }
      }
    }
  }

  private var statusBar: some View {
    HStack(spacing: 10) {
      Circle()
        .fill(runtime.modelName == nil ? .orange : (runtime.isBusy ? .yellow : .green))
        .frame(width: 10, height: 10)
      VStack(alignment: .leading, spacing: 2) {
        Text(runtime.status).font(.caption).bold()
        if let name = runtime.modelName {
          Text(name).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
        }
      }
      Spacer()
      Text("NATIVE · C++ · RUST · METAL")
        .font(.caption2.monospaced().bold())
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .background(.thinMaterial, in: Capsule())
    }
    .padding(.horizontal)
    .padding(.vertical, 8)
  }

  private var quickTools: some View {
    ScrollView(.horizontal, showsIndicators: false) {
      HStack(spacing: 8) {
        quick("Self Test", "Run native_self_test and report each native engine that passed or failed.")
        quick("Stack", "Use native_stack_manifest and tell me exactly what is compiled into this app.")
        quick("C++", "Run cpp_nbody with 48 bodies, 800 steps, seed 7 and analyze energy drift.")
        quick("Rust", "Use rust_analyze on text 'SuperAgent' with values 1,2,3,4,5 and seed 7.")
        quick("GPU", "Run the native Metal vector benchmark and explain the measured result.")
        quick("DB", "Use sqlite_execute to create a demo table if needed, insert a row, then sqlite_query it.")
        quick("Device", "Use device_info and tell me exactly what this iPhone exposes.")
        quick("Files", "List the safe workspace files and tell me what you can inspect.")
        quick("OCR", "List workspace files. If there is an image, use ocr_image on it.")
        quick("Memory", "Recall everything useful you have stored locally.")
      }
      .padding(.horizontal)
      .padding(.vertical, 8)
    }
  }

  private func quick(_ title: String, _ command: String) -> some View {
    Button(title) { Task { await runtime.send(command) } }
      .buttonStyle(.bordered)
      .disabled(runtime.isBusy || runtime.modelName == nil)
  }

  private var composer: some View {
    HStack(alignment: .bottom, spacing: 10) {
      TextField("Ask the local native agent…", text: $prompt, axis: .vertical)
        .textFieldStyle(.roundedBorder)
        .lineLimit(1...5)
        .submitLabel(.send)
        .onSubmit { send() }
      Button { send() } label: {
        Image(systemName: "arrow.up.circle.fill")
          .font(.system(size: 32))
      }
      .disabled(prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || runtime.isBusy)
    }
    .padding()
  }

  @ViewBuilder
  private func bubble(_ line: ChatLine) -> some View {
    HStack {
      if line.kind == .user { Spacer(minLength: 35) }
      Text(line.text)
        .font(line.kind == .system ? .caption : .body)
        .textSelection(.enabled)
        .padding(12)
        .background(background(for: line.kind), in: RoundedRectangle(cornerRadius: 14))
      if line.kind != .user { Spacer(minLength: 35) }
    }
  }

  private func background(for kind: ChatLine.Kind) -> Color {
    switch kind {
    case .user: return .blue.opacity(0.18)
    case .agent: return .secondary.opacity(0.12)
    case .system: return .green.opacity(0.10)
    case .error: return .red.opacity(0.16)
    }
  }

  private func send() {
    let text = prompt
    prompt = ""
    Task { await runtime.send(text) }
  }
}

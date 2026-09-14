import Foundation

actor NativeNetworkHub {
  static let shared = NativeNetworkHub()

  func httpsGet(url raw: String, maxBytes requested: Int) async throws -> [String: Any] {
    guard let url = URL(string: raw), url.scheme?.lowercased() == "https" else {
      throw NativeError("Only https:// URLs are allowed")
    }
    guard url.user == nil, url.password == nil else {
      throw NativeError("URLs containing credentials are not allowed")
    }
    let host = (url.host ?? "").lowercased()
    guard !host.isEmpty, host != "localhost", !host.hasSuffix(".local") else {
      throw NativeError("Local/private host names are not allowed by this tool")
    }

    let maxBytes = max(1_024, min(requested, 1_000_000))
    var request = URLRequest(url: url)
    request.httpMethod = "GET"
    request.timeoutInterval = 20
    request.setValue("SuperAgentNative/0.2", forHTTPHeaderField: "User-Agent")
    request.setValue("text/*, application/json, application/xml;q=0.9, */*;q=0.5", forHTTPHeaderField: "Accept")

    let (data, response) = try await URLSession.shared.data(for: request)
    guard let http = response as? HTTPURLResponse else { throw NativeError("Non-HTTP response") }
    let clipped = data.prefix(maxBytes)
    let text = String(data: clipped, encoding: .utf8)

    var headers: [String: String] = [:]
    for (key, value) in http.allHeaderFields.prefix(32) {
      headers[String(describing: key)] = String(describing: value)
    }

    return [
      "engine": "URLSession native HTTPS",
      "url": http.url?.absoluteString ?? raw,
      "status": http.statusCode,
      "mimeType": http.mimeType ?? "",
      "receivedBytes": data.count,
      "returnedBytes": clipped.count,
      "truncated": data.count > clipped.count,
      "headers": headers,
      "text": text ?? "",
      "base64": text == nil ? Data(clipped).base64EncodedString() : ""
    ]
  }
}

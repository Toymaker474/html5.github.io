import Foundation
import NaturalLanguage

actor EmbeddingLab {
  static let shared = EmbeddingLab()

  func sentenceDistance(a: String, b: String, languageCode: String) throws -> [String: Any] {
    let language = NLLanguage(rawValue: languageCode)
    guard let embedding = NLEmbedding.sentenceEmbedding(for: language) else {
      throw NativeError("No system sentence embedding available for language: \(languageCode)")
    }
    let distance = embedding.distance(between: a, and: b)
    return [
      "engine": "NaturalLanguage NLEmbedding",
      "language": language.rawValue,
      "distance": distance,
      "similarityApprox": max(0.0, 1.0 - distance),
      "revision": embedding.revision
    ]
  }

  func wordNeighbors(word: String, languageCode: String, limit requested: Int) throws -> [String: Any] {
    let language = NLLanguage(rawValue: languageCode)
    guard let embedding = NLEmbedding.wordEmbedding(for: language) else {
      throw NativeError("No system word embedding available for language: \(languageCode)")
    }
    let limit = max(1, min(requested, 30))
    let neighbors = embedding.neighbors(for: word, maximumCount: limit)
      .map { ["word": $0.0, "distance": $0.1] as [String: Any] }
    return [
      "engine": "NaturalLanguage word embedding",
      "language": language.rawValue,
      "word": word,
      "neighbors": neighbors,
      "revision": embedding.revision
    ]
  }
}

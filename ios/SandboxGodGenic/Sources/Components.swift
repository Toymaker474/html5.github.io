import SwiftUI

struct GlassSurface<Content: View>: View {
    let tint: Color
    let content: Content

    init(tint: Color = .white, @ViewBuilder content: () -> Content) {
        self.tint = tint
        self.content = content()
    }

    var body: some View {
        content
            .padding(16)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(
                        LinearGradient(colors: [tint.opacity(0.52), .white.opacity(0.10), tint.opacity(0.16)], startPoint: .topLeading, endPoint: .bottomTrailing),
                        lineWidth: 1
                    )
            )
            .shadow(color: tint.opacity(0.13), radius: 24, y: 12)
    }
}

struct MetricTile: View {
    let title: String
    let value: String
    let detail: String
    let symbol: String

    var body: some View {
        GlassSurface {
            VStack(alignment: .leading, spacing: 6) {
                Image(systemName: symbol)
                    .foregroundStyle(.cyan)
                Text(value)
                    .font(.system(size: 28, weight: .black, design: .rounded))
                Text(title.uppercased())
                    .font(.caption2.weight(.black))
                    .foregroundStyle(.white.opacity(0.55))
                Text(detail)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

struct ActionButton: View {
    let title: String
    let symbol: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 7) {
                Image(systemName: symbol).font(.title3)
                Text(title).font(.caption2.weight(.black))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 11)
        }
        .buttonStyle(.borderedProminent)
        .tint(.white.opacity(0.10))
    }
}

struct ParameterSlider: View {
    let title: String
    @Binding var value: Float
    let range: ClosedRange<Float>
    let format: (Float) -> String

    var body: some View {
        VStack(spacing: 7) {
            HStack {
                Text(title).font(.subheadline.weight(.bold))
                Spacer()
                Text(format(value)).font(.caption.monospacedDigit()).foregroundStyle(.mint)
            }
            Slider(value: $value, in: range)
                .tint(.mint)
        }
    }
}

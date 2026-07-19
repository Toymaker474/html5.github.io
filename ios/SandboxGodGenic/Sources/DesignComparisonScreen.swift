import SwiftUI

struct DesignComparisonScreen: View {
    let engine: SimulationEngine

    var body: some View {
        NavigationStack {
            ZStack {
                BioWorldCanvas(engine: engine, interactive: false)
                    .ignoresSafeArea()
                    .blur(radius: 1.2)
                    .overlay(Color.black.opacity(0.20))

                ScrollView {
                    VStack(spacing: 14) {
                        Text("EMERGENCE ENGINE")
                            .font(.caption.weight(.black))
                            .foregroundStyle(.cyan)
                            .tracking(3)
                            .padding(.top, 8)

                        Text("Explicit rules.\nImplicit life.")
                            .font(.system(size: 39, weight: .black, design: .rounded))
                            .multilineTextAlignment(.center)
                            .tracking(-1.5)

                        ViewThatFits(in: .horizontal) {
                            HStack(alignment: .top, spacing: 12) { comparisonPanels }
                            VStack(spacing: 12) { comparisonPanels }
                        }

                        GlassSurface {
                            VStack(alignment: .leading, spacing: 8) {
                                Label("LIVE PROOF", systemImage: "waveform.path.ecg")
                                    .font(.caption.weight(.black))
                                    .foregroundStyle(.mint)
                                Text("The app defines motion, energy cost, sensing, food, mutation, and reproduction. The shapes, strategies, families, species, and ecological balance are produced by evolution inside the simulation.")
                                    .foregroundStyle(.white.opacity(0.78))
                            }
                        }
                    }
                    .padding(14)
                    .padding(.bottom, 26)
                }
            }
            .navigationTitle("Explicit ↔ Implicit")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.hidden, for: .navigationBar)
        }
    }

    @ViewBuilder
    private var comparisonPanels: some View {
        DesignPanel(
            title: "Explicit Design",
            subtitle: "Rules intentionally written into the engine",
            tint: .purple,
            items: ["physics / chemistry", "energy conservation", "sensors + neural topology", "mutation probability", "resource and hazard laws"]
        )

        DesignPanel(
            title: "Implicit Design",
            subtitle: "Structures discovered by the living system",
            tint: .cyan,
            items: ["life-like structures", "self-replication", "genetic lineages", "natural selection", "fitness", "speciation / diversity", "ecosystems", "everything else…"]
        )
    }
}

private struct DesignPanel: View {
    let title: String
    let subtitle: String
    let tint: Color
    let items: [String]

    var body: some View {
        GlassSurface(tint: tint) {
            VStack(alignment: .leading, spacing: 13) {
                Text(title)
                    .font(.system(size: 27, weight: .black, design: .rounded))
                    .minimumScaleFactor(0.75)
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.58))

                ForEach(items, id: \.self) { item in
                    HStack(spacing: 10) {
                        Circle()
                            .fill(tint)
                            .frame(width: 7, height: 7)
                            .shadow(color: tint, radius: 8)
                        Text(item)
                            .font(.subheadline.weight(.bold))
                        Spacer(minLength: 0)
                    }
                    .padding(.vertical, 9)
                    .padding(.horizontal, 11)
                    .background(.black.opacity(0.28), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(tint.opacity(0.25)))
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

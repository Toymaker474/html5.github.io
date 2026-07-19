import SwiftUI

struct TeacherScreen: View {
    let engine: SimulationEngine

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 14) {
                    scoreCard
                    sliders
                    history
                    runtimeNotice
                }
                .padding(14)
                .padding(.bottom, 28)
            }
            .background(
                RadialGradient(colors: [.purple.opacity(0.22), .black], center: .topTrailing, startRadius: 0, endRadius: 760)
                    .ignoresSafeArea()
            )
            .navigationTitle("Teacher Agent")
            .toolbar {
                Button("Teach now", systemImage: "graduationcap.fill") {
                    engine.runTeacher()
                }
            }
        }
    }

    private var scoreCard: some View {
        GlassSurface(tint: .mint) {
            HStack(spacing: 18) {
                ZStack {
                    Circle().stroke(.white.opacity(0.10), lineWidth: 11)
                    Circle()
                        .trim(from: 0, to: CGFloat(engine.teacherScore) / 100)
                        .stroke(AngularGradient(colors: [.cyan, .mint, .purple], center: .center), style: StrokeStyle(lineWidth: 11, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                    VStack(spacing: -2) {
                        Text("\(engine.teacherScore)")
                            .font(.system(size: 34, weight: .black, design: .rounded))
                        Text("/100")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(width: 124, height: 124)

                VStack(alignment: .leading, spacing: 8) {
                    Text("HOURLY LOCAL REVIEW")
                        .font(.caption2.weight(.black))
                        .foregroundStyle(.mint)
                    Text(engine.teacherFocus)
                        .font(.title2.weight(.black))
                    Text(engine.teacherLesson)
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.70))
                    Text("Next review \(engine.nextTeacherReviewText)")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.cyan)
                }
            }
        }
    }

    private var sliders: some View {
        GlassSurface {
            VStack(spacing: 16) {
                ParameterSlider(title: "Mutation", value: Binding(get: { engine.mutationRate }, set: { engine.mutationRate = $0 }), range: 0.01...0.25, format: { "\(Int($0 * 100))%" })
                ParameterSlider(title: "Food growth", value: Binding(get: { engine.foodRate }, set: { engine.foodRate = $0 }), range: 0.35...2, format: { String(format: "%.2f×", $0) })
                ParameterSlider(title: "Hazard", value: Binding(get: { engine.hazard }, set: { engine.hazard = $0 }), range: 0.02...0.75, format: { "\(Int($0 * 100))%" })
            }
        }
    }

    private var history: some View {
        GlassSurface {
            VStack(alignment: .leading, spacing: 12) {
                Text("LESSON HISTORY")
                    .font(.caption.weight(.black))
                    .foregroundStyle(.white.opacity(0.55))

                if engine.teacherHistory.isEmpty {
                    Text("No reviews yet.")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(engine.teacherHistory.prefix(8)) { report in
                        HStack(alignment: .top, spacing: 11) {
                            Text("\(report.score)")
                                .font(.headline.weight(.black))
                                .foregroundStyle(.mint)
                                .frame(width: 38)
                            VStack(alignment: .leading, spacing: 3) {
                                Text(report.focus).font(.subheadline.weight(.bold))
                                Text(report.lesson).font(.caption).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(report.date, style: .time)
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 5)
                    }
                }
            }
        }
    }

    private var runtimeNotice: some View {
        GlassSurface(tint: .orange) {
            Label {
                Text("The world and teacher run while the app is active. iOS may suspend them when the app is backgrounded or closed; reopening performs a due review but does not pretend missed simulation time occurred.")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.75))
            } icon: {
                Image(systemName: "iphone.gen3.slash")
                    .foregroundStyle(.orange)
            }
        }
    }
}

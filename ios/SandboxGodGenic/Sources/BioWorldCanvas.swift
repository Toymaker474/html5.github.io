import SwiftUI

struct BioWorldCanvas: View {
    let engine: SimulationEngine
    var interactive = true

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: !engine.isRunning)) { timeline in
            Canvas(rendersAsynchronously: true) { context, size in
                drawBackground(in: &context, size: size, time: timeline.date.timeIntervalSinceReferenceDate)
                drawNutrients(in: &context, size: size)
                drawCreatures(in: &context, size: size)
            }
        }
        .accessibilityLabel("Evolving bioluminescent microscopic ecosystem")
        .allowsHitTesting(interactive)
    }

    private func drawBackground(in context: inout GraphicsContext, size: CGSize, time: TimeInterval) {
        let rect = CGRect(origin: .zero, size: size)
        context.fill(
            Path(rect),
            with: .linearGradient(
                Gradient(colors: [Color(red: 0.01, green: 0.015, blue: 0.045), Color(red: 0.04, green: 0.01, blue: 0.08), .black]),
                startPoint: .zero,
                endPoint: CGPoint(x: size.width, y: size.height)
            )
        )

        for index in 0..<42 {
            let seed = Double(index) * 13.731
            let x = (sin(seed * 1.17 + time * 0.018) * 0.5 + 0.5) * size.width
            let y = (cos(seed * 0.83 + time * 0.012) * 0.5 + 0.5) * size.height
            let radius = 18 + CGFloat(index % 7) * 8
            let hue = 0.72 + Double(index % 9) * 0.022
            let glow = Path(ellipseIn: CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2))
            context.fill(glow, with: .radialGradient(
                Gradient(colors: [Color(hue: hue, saturation: 0.9, brightness: 1).opacity(0.14), .clear]),
                center: CGPoint(x: x, y: y),
                startRadius: 0,
                endRadius: radius
            ))
        }
    }

    private func drawNutrients(in context: inout GraphicsContext, size: CGSize) {
        for nutrient in engine.nutrients {
            let point = CGPoint(x: CGFloat(nutrient.position.x) * size.width, y: CGFloat(nutrient.position.y) * size.height)
            let radius = CGFloat(1.8 + nutrient.value * 7)
            let color = Color(hue: nutrient.hue / 360, saturation: 0.88, brightness: 1)
            context.drawLayer { layer in
                layer.addFilter(.shadow(color: color.opacity(0.85), radius: radius * 2))
                layer.fill(Path(ellipseIn: CGRect(x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2)), with: .color(color.opacity(0.9)))
            }
        }
    }

    private func drawCreatures(in context: inout GraphicsContext, size: CGSize) {
        for creature in engine.creatures {
            let point = CGPoint(x: CGFloat(creature.position.x) * size.width, y: CGFloat(creature.position.y) * size.height)
            let radius = max(3.5, CGFloat(creature.radius) * min(size.width, size.height) * 2.2)
            let color = Color(hue: creature.hue / 360, saturation: 0.86, brightness: 1)
            let bodyRect = CGRect(x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2)

            context.drawLayer { layer in
                layer.addFilter(.shadow(color: color.opacity(0.9), radius: radius * 1.5))
                layer.fill(
                    Path(ellipseIn: bodyRect),
                    with: .radialGradient(
                        Gradient(colors: [.white, color, color.opacity(0.4), .clear]),
                        center: CGPoint(x: point.x - radius * 0.25, y: point.y - radius * 0.25),
                        startRadius: 0,
                        endRadius: radius * 1.3
                    )
                )
            }

            var membrane = Path()
            membrane.addEllipse(in: bodyRect.insetBy(dx: radius * 0.18, dy: radius * 0.18))
            context.stroke(membrane, with: .color(.white.opacity(0.5)), lineWidth: max(0.5, radius * 0.09))

            let direction = CGVector(dx: cos(CGFloat(creature.heading)), dy: sin(CGFloat(creature.heading)))
            var tail = Path()
            tail.move(to: CGPoint(x: point.x - direction.dx * radius * 0.5, y: point.y - direction.dy * radius * 0.5))
            tail.addCurve(
                to: CGPoint(x: point.x - direction.dx * radius * 2.6, y: point.y - direction.dy * radius * 2.6),
                control1: CGPoint(x: point.x - direction.dx * radius, y: point.y - direction.dy * radius + radius),
                control2: CGPoint(x: point.x - direction.dx * radius * 1.8, y: point.y - direction.dy * radius * 1.8 - radius)
            )
            context.stroke(tail, with: .color(color.opacity(0.7)), lineWidth: max(0.5, radius * 0.15))
        }
    }
}

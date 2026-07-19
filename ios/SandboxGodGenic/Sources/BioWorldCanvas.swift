import SwiftUI
import simd

struct BioWorldCanvas: View {
    let engine: SimulationEngine
    var interactive = true

    var body: some View {
        GeometryReader { proxy in
            TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: !engine.isRunning)) { timeline in
                Canvas(rendersAsynchronously: true) { context, size in
                    let time = timeline.date.timeIntervalSinceReferenceDate
                    drawBackground(in: &context, size: size, time: time)
                    drawNutrients(in: &context, size: size, time: time)
                    drawCreatures(in: &context, size: size, time: time)
                    drawPulses(in: &context, size: size, date: timeline.date)
                }
            }
            .contentShape(Rectangle())
            .gesture(
                SpatialTapGesture()
                    .onEnded { event in
                        guard interactive, proxy.size.width > 0, proxy.size.height > 0 else { return }
                        let normalized = SIMD2<Float>(
                            Float(event.location.x / proxy.size.width),
                            Float(event.location.y / proxy.size.height)
                        )
                        engine.castSelectedPower(at: normalized)
                    }
            )
        }
        .accessibilityLabel("Playable evolving bioluminescent microscopic ecosystem")
        .allowsHitTesting(interactive)
    }

    private func drawBackground(in context: inout GraphicsContext, size: CGSize, time: TimeInterval) {
        let rect = CGRect(origin: .zero, size: size)
        context.fill(
            Path(rect),
            with: .linearGradient(
                Gradient(colors: [
                    Color(red: 0.005, green: 0.012, blue: 0.035),
                    Color(red: 0.045, green: 0.006, blue: 0.085),
                    Color(red: 0.002, green: 0.035, blue: 0.055),
                    .black
                ]),
                startPoint: .zero,
                endPoint: CGPoint(x: size.width, y: size.height)
            )
        )

        for index in 0..<52 {
            let seed = Double(index) * 13.731
            let x = (sin(seed * 1.17 + time * 0.018) * 0.5 + 0.5) * size.width
            let y = (cos(seed * 0.83 + time * 0.012) * 0.5 + 0.5) * size.height
            let radius = 18 + CGFloat(index % 8) * 9
            let hue = 0.68 + Double(index % 12) * 0.026
            let glow = Path(ellipseIn: CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2))
            context.fill(
                glow,
                with: .radialGradient(
                    Gradient(colors: [Color(hue: hue, saturation: 0.92, brightness: 1).opacity(0.17), .clear]),
                    center: CGPoint(x: x, y: y),
                    startRadius: 0,
                    endRadius: radius
                )
            )
        }

        for ring in 0..<6 {
            let inset = CGFloat(ring) * 58 + 20
            let path = Path(ellipseIn: rect.insetBy(dx: inset, dy: inset * 0.63))
            context.stroke(path, with: .color(.cyan.opacity(0.025)), lineWidth: 1)
        }
    }

    private func drawNutrients(in context: inout GraphicsContext, size: CGSize, time: TimeInterval) {
        for (index, nutrient) in engine.nutrients.enumerated() {
            let point = CGPoint(x: CGFloat(nutrient.position.x) * size.width, y: CGFloat(nutrient.position.y) * size.height)
            let pulse = 0.84 + sin(time * 2.4 + Double(index) * 0.37) * 0.16
            let radius = CGFloat(1.8 + nutrient.value * 7) * pulse
            let color = Color(hue: nutrient.hue / 360, saturation: 0.88, brightness: 1)
            context.drawLayer { layer in
                layer.addFilter(.shadow(color: color.opacity(0.9), radius: radius * 2.4))
                layer.fill(
                    Path(ellipseIn: CGRect(x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2)),
                    with: .radialGradient(
                        Gradient(colors: [.white, color, color.opacity(0.15)]),
                        center: point,
                        startRadius: 0,
                        endRadius: radius
                    )
                )
            }
        }
    }

    private func drawCreatures(in context: inout GraphicsContext, size: CGSize, time: TimeInterval) {
        for (index, creature) in engine.creatures.enumerated() {
            let point = CGPoint(x: CGFloat(creature.position.x) * size.width, y: CGFloat(creature.position.y) * size.height)
            let breathe = 0.94 + sin(time * 2.2 + Double(index) * 0.19) * 0.06
            let radius = max(4.2, CGFloat(creature.radius) * min(size.width, size.height) * 2.55) * breathe
            let color = Color(hue: creature.hue / 360, saturation: 0.88, brightness: 1)
            let bodyRect = CGRect(x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2)

            context.drawLayer { layer in
                layer.addFilter(.shadow(color: color.opacity(0.95), radius: radius * 1.8))
                layer.fill(
                    Path(ellipseIn: bodyRect),
                    with: .radialGradient(
                        Gradient(colors: [.white, color, color.opacity(0.56), .clear]),
                        center: CGPoint(x: point.x - radius * 0.28, y: point.y - radius * 0.28),
                        startRadius: 0,
                        endRadius: radius * 1.35
                    )
                )
            }

            let nucleusRadius = radius * 0.28
            let nucleus = Path(ellipseIn: CGRect(
                x: point.x - nucleusRadius * 0.3,
                y: point.y - nucleusRadius * 0.2,
                width: nucleusRadius,
                height: nucleusRadius
            ))
            context.fill(nucleus, with: .color(.white.opacity(0.50)))

            var membrane = Path()
            membrane.addEllipse(in: bodyRect.insetBy(dx: radius * 0.14, dy: radius * 0.14))
            context.stroke(membrane, with: .color(.white.opacity(0.56)), lineWidth: max(0.6, radius * 0.09))

            if creature.generation >= 3 {
                let lineageRing = Path(ellipseIn: bodyRect.insetBy(dx: -radius * 0.34, dy: -radius * 0.34))
                context.stroke(lineageRing, with: .color(color.opacity(0.18)), lineWidth: max(0.4, radius * 0.05))
            }

            let direction = CGVector(dx: cos(CGFloat(creature.heading)), dy: sin(CGFloat(creature.heading)))
            var tail = Path()
            tail.move(to: CGPoint(x: point.x - direction.dx * radius * 0.5, y: point.y - direction.dy * radius * 0.5))
            tail.addCurve(
                to: CGPoint(x: point.x - direction.dx * radius * 2.8, y: point.y - direction.dy * radius * 2.8),
                control1: CGPoint(x: point.x - direction.dx * radius, y: point.y - direction.dy * radius + radius),
                control2: CGPoint(x: point.x - direction.dx * radius * 1.9, y: point.y - direction.dy * radius * 1.9 - radius)
            )
            context.stroke(tail, with: .color(color.opacity(0.78)), lineWidth: max(0.6, radius * 0.16))
        }
    }

    private func drawPulses(in context: inout GraphicsContext, size: CGSize, date: Date) {
        for pulse in engine.pulses {
            let age = date.timeIntervalSince(pulse.createdAt)
            guard age >= 0, age < 2.2 else { continue }
            let progress = age / 2.2
            let point = CGPoint(x: CGFloat(pulse.position.x) * size.width, y: CGFloat(pulse.position.y) * size.height)
            let maxRadius = min(size.width, size.height) * 0.36
            let radius = CGFloat(progress) * maxRadius
            let opacity = max(0, 1 - progress)
            let color = Color(hue: pulse.hue, saturation: 0.90, brightness: 1)

            context.drawLayer { layer in
                layer.addFilter(.shadow(color: color.opacity(opacity), radius: 18))
                let ring = Path(ellipseIn: CGRect(x: point.x - radius, y: point.y - radius, width: radius * 2, height: radius * 2))
                layer.stroke(ring, with: .color(color.opacity(opacity * 0.9)), lineWidth: 3)
            }
        }
    }
}

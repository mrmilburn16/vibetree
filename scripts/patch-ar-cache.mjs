#!/usr/bin/env node
/**
 * Patch project cache with corrected ARDesignManager and ARCoordinator for wall paint.
 * Usage: node scripts/patch-ar-cache.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cachePath = path.join(__dirname, "..", ".vibetree-cache", "project-files", "proj_1772477966333_n25zp1a.json");

const coordinatorNew = `import Foundation
import ARKit
import RealityKit
import UIKit
import SwiftUI

class Coordinator: NSObject, ARSessionDelegate {
    weak var arView: ARView?
    let arManager: ARDesignManager

    init(arManager: ARDesignManager) {
        self.arManager = arManager
    }

    // MARK: - ARSessionDelegate

    func session(_ session: ARSession, didAdd anchors: [ARAnchor]) {
        for anchor in anchors {
            if let planeAnchor = anchor as? ARPlaneAnchor,
               planeAnchor.alignment == .vertical {
                DispatchQueue.main.async {
                    self.arManager.onVerticalPlaneDetected(anchor: planeAnchor)
                }
            }
        }
    }

    func session(_ session: ARSession, didUpdate anchors: [ARAnchor]) {
        for anchor in anchors {
            if let planeAnchor = anchor as? ARPlaneAnchor,
               planeAnchor.alignment == .vertical {
                DispatchQueue.main.async {
                    if !self.arManager.wallDetected {
                        self.arManager.onVerticalPlaneDetected(anchor: planeAnchor)
                    }
                    self.arManager.addDetectedPlane(anchor: planeAnchor)
                }
            }
        }
    }

    // MARK: - Tap Handling

    @MainActor
    @objc func handleTap(_ recognizer: UITapGestureRecognizer) {
        guard let arView = arView else { return }
        let location = recognizer.location(in: arView)

        // Check if user tapped an existing frame entity
        let hitEntities = arView.entities(at: location)
        for entity in hitEntities {
            if let frameEntity = entity as? ModelEntity,
               let _ = arManager.frameEntityIDs[frameEntity.id] {
                arManager.cycleFrameColor(entityID: frameEntity.id, entity: frameEntity)
                return
            }
        }

        // Wall paint: raycast with .existingPlaneGeometry and .vertical for reliable wall hits
        let results = arView.raycast(from: location, allowing: .existingPlaneGeometry, alignment: .vertical)
        guard let result = results.first else { return }

        arManager.paintWall(at: result)
    }
}
`;

const managerNew = `import Foundation
import ARKit
import RealityKit
import UIKit
import SwiftUI

@MainActor
class ARDesignManager: NSObject, ObservableObject {
    @Published var statusText: String = "Scanning for walls..."
    @Published var wallDetected: Bool = false
    @Published var selectedColorIndex: Int = 0
    @Published var showFlash: Bool = false
    @Published var showSaveAlert: Bool = false

    weak var arView: ARView?

    // Track detected plane anchors by UUID
    private var detectedPlaneAnchors: [UUID: ARPlaneAnchor] = [:]

    // Frame entities: entity id -> artwork color index
    var frameEntityIDs: [UInt64: Int] = [:]
    private var frameEntities: [UInt64: ModelEntity] = [:]

    let paintColors: [UIColor] = [
        .white,
        UIColor(red: 0.85, green: 0.75, blue: 0.65, alpha: 1),
        UIColor(red: 0.55, green: 0.70, blue: 0.80, alpha: 1),
        UIColor(red: 0.60, green: 0.75, blue: 0.60, alpha: 1),
        UIColor(red: 0.80, green: 0.65, blue: 0.70, alpha: 1),
        UIColor(red: 0.70, green: 0.65, blue: 0.80, alpha: 1),
        UIColor(red: 0.85, green: 0.80, blue: 0.60, alpha: 1),
        UIColor(red: 0.50, green: 0.55, blue: 0.60, alpha: 1),
    ]

    let artworkColors: [UIColor] = [
        UIColor(red: 0.90, green: 0.80, blue: 0.65, alpha: 1), // warm canvas
        UIColor(red: 0.30, green: 0.45, blue: 0.65, alpha: 1), // ocean
        UIColor(red: 0.70, green: 0.35, blue: 0.35, alpha: 1), // terracotta
    ]

    // MARK: - Wall Detection

    func onVerticalPlaneDetected(anchor: ARPlaneAnchor) {
        guard !wallDetected else { return }
        wallDetected = true
        statusText = "Wall detected — tap to paint"
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    }

    func addDetectedPlane(anchor: ARPlaneAnchor) {
        detectedPlaneAnchors[anchor.identifier] = anchor
    }

    // MARK: - Paint Wall
    // Use AnchorEntity(world: transform) and rotate entity 90° around X so the flat face points toward the camera (lies flat on wall).
    func paintWall(at result: ARRaycastResult) {
        guard let arView = arView else { return }

        let transform = result.worldTransform
        let color = paintColors[selectedColorIndex]

        let wallEntity = ModelEntity(
            mesh: .generateBox(width: 1.5, height: 1.5, depth: 0.01),
            materials: [SimpleMaterial(color: color.withAlphaComponent(0.4), isMetallic: false)]
        )
        wallEntity.transform.rotation = simd_quatf(angle: .pi / 2, axis: SIMD3<Float>(1, 0, 0))

        let anchor = AnchorEntity(world: transform)
        anchor.addChild(wallEntity)
        arView.scene.addAnchor(anchor)

        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    // MARK: - Add Frame

    func addFrame() {
        guard let arView = arView else { return }

        let center = CGPoint(x: arView.bounds.midX, y: arView.bounds.midY)
        let results = arView.raycast(from: center, allowing: .existingPlaneGeometry, alignment: .vertical)

        guard let result = results.first else {
            let altPoint = CGPoint(x: arView.bounds.midX, y: arView.bounds.midY + 40)
            let altResults = arView.raycast(from: altPoint, allowing: .existingPlaneGeometry, alignment: .vertical)
            guard let altResult = altResults.first else { return }
            placeFrame(at: altResult, arView: arView)
            return
        }

        placeFrame(at: result, arView: arView)
    }

    private func placeFrame(at result: ARRaycastResult, arView: ARView) {
        var frameMaterial = SimpleMaterial()
        frameMaterial.color = .init(tint: UIColor(red: 0.25, green: 0.18, blue: 0.12, alpha: 1))
        frameMaterial.roughness = .float(0.9)
        frameMaterial.metallic = .float(0.1)

        let frameMesh = MeshResource.generateBox(width: 0.5, height: 0.4, depth: 0.02)
        let frameEntity = ModelEntity(mesh: frameMesh, materials: [frameMaterial])
        frameEntity.transform.rotation = simd_quatf(angle: .pi / 2, axis: SIMD3<Float>(1, 0, 0))

        let artworkColor = artworkColors[0]
        var artMaterial = SimpleMaterial()
        artMaterial.color = .init(tint: artworkColor)
        artMaterial.roughness = .float(0.5)

        let artMesh = MeshResource.generateBox(width: 0.42, height: 0.32, depth: 0.01)
        let artEntity = ModelEntity(mesh: artMesh, materials: [artMaterial])
        artEntity.position = SIMD3<Float>(0, 0, 0.011)

        frameEntity.addChild(artEntity)

        let anchor = AnchorEntity(world: result.worldTransform)
        anchor.addChild(frameEntity)
        arView.scene.addAnchor(anchor)

        frameEntityIDs[frameEntity.id] = 0
        frameEntities[frameEntity.id] = frameEntity
        frameEntityIDs[artEntity.id] = 0
        frameEntities[artEntity.id] = artEntity

        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
    }

    // MARK: - Cycle Frame Color

    func cycleFrameColor(entityID: UInt64, entity: ModelEntity) {
        guard let currentIndex = frameEntityIDs[entityID] else { return }
        let nextIndex = (currentIndex + 1) % artworkColors.count
        frameEntityIDs[entityID] = nextIndex

        let newColor = artworkColors[nextIndex]
        var newMaterial = SimpleMaterial()
        newMaterial.color = .init(tint: newColor)
        newMaterial.roughness = .float(0.5)
        entity.model?.materials = [newMaterial]

        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }

    // MARK: - Reset

    func resetScene() {
        guard let arView = arView else { return }
        arView.scene.anchors.removeAll()
        wallDetected = false
        statusText = "Scanning for walls..."
        detectedPlaneAnchors.removeAll()
        frameEntityIDs.removeAll()
        frameEntities.removeAll()

        let config = ARWorldTrackingConfiguration()
        config.planeDetection = [.horizontal, .vertical]
        config.environmentTexturing = .automatic
        arView.session.run(config, options: [.resetTracking, .removeExistingAnchors])

        UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
    }

    // MARK: - Screenshot

    func takeScreenshot() {
        guard let arView = arView else { return }

        withAnimation(.easeInOut(duration: 0.15)) {
            showFlash = true
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { [weak self] in
            withAnimation(.easeInOut(duration: 0.2)) {
                self?.showFlash = false
            }
        }

        arView.snapshot(saveToHDR: false) { [weak self] image in
            guard let image = image else { return }
            UIImageWriteToSavedPhotosAlbum(image, nil, nil, nil)
            DispatchQueue.main.async {
                self?.showSaveAlert = true
            }
        }
    }
}
`;

const raw = fs.readFileSync(cachePath, "utf8");
const data = JSON.parse(raw);
data["Coordinators/ARCoordinator.swift"] = coordinatorNew;
data["Models/ARDesignManager.swift"] = managerNew;
fs.writeFileSync(cachePath, JSON.stringify(data), "utf8");
console.log("Patched ARCoordinator and ARDesignManager in project cache.");
console.log("Run build to apply (e.g. trigger Run on iPhone for this project).");
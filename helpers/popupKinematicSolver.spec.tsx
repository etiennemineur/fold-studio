import { addMechanism, createDefaultPopupDocument } from "./popupDocument";
import { solvePopupKinematics } from "./popupKinematicSolver";
import type { MechanismType } from "./popupMechanisms";

const MECHANISM_TYPES: MechanismType[] = [
  "v-fold",
  "v-fold-asymmetric",
  "parallel-fold",
  "platform",
  "box",
];

const TEST_ANGLES = [0, 30, 60, 90, 120, 150, 180];

function edgeLength(a: readonly (number | undefined)[], b: readonly (number | undefined)[]): number {
  return Math.hypot(
    (a[0] ?? 0) - (b[0] ?? 0),
    (a[1] ?? 0) - (b[1] ?? 0),
    (a[2] ?? 0) - (b[2] ?? 0),
  );
}

describe("popup analytical kinematics", () => {
  for (const mechanismType of MECHANISM_TYPES) {
    it(`preserves rigid panel lengths for ${mechanismType}`, () => {
      const document = addMechanism(
        createDefaultPopupDocument(160, 220),
        mechanismType,
        {
          positionY: 72,
          width: 56,
          height: 30,
          depth: 40,
          vAngle: 45,
          armLengthLeft: 42,
          armLengthRight: 28,
          foldDirection: "up",
        },
      );

      for (const angle of TEST_ANGLES) {
        const { foldData, vertexMap } = solvePopupKinematics(document, angle);

        for (const vertex of vertexMap.values()) {
          expect(vertex.every(Number.isFinite)).withContext(
            `${mechanismType} produced a non-finite coordinate at ${angle}°`,
          ).toBeTrue();
        }

        for (const face of foldData.facesVertices) {
          for (let index = 0; index < face.length; index++) {
            const aIndex = face[index];
            const bIndex = face[(index + 1) % face.length];
            const flatA = foldData.verticesCoords[aIndex];
            const flatB = foldData.verticesCoords[bIndex];
            const foldedA = vertexMap.get(aIndex);
            const foldedB = vertexMap.get(bIndex);

            expect(foldedA).toBeDefined();
            expect(foldedB).toBeDefined();
            if (!foldedA || !foldedB) continue;

            const error = Math.abs(
              edgeLength(flatA, flatB) - edgeLength(foldedA, foldedB),
            );

            expect(error).withContext(
              `${mechanismType} stretched a panel edge by ${error} mm at ${angle}°`,
            ).toBeLessThan(0.001);
          }
        }
      }
    });
  }
});

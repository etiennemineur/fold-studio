import { addMechanism, createDefaultPopupDocument, getPopupPatternFoldData } from "./popupDocument";
import { getDefaultSpirogamiParams, generateSpirogamiFlatFoldData } from "./spirogamiEngine";
import { getFoldEdgeSignature, setFoldEdgeAssignment, toggleFoldEdgeAssignment } from "./foldEdgeInteraction";
import type { FoldData } from "./foldEngine";

describe("fold edge interaction", () => {
  it("inverts mountain and valley assignments with their target angle", () => {
    const source: FoldData = {
      verticesCoords: [[0, 0], [10, 0], [20, 0]],
      edgesVertices: [[0, 1], [1, 2]],
      edgesAssignment: ["M", "V"],
      edgesFoldAngle: [-90, 120],
      facesVertices: [],
    };

    const first = toggleFoldEdgeAssignment(source, 0);
    expect(first.edgesAssignment[0]).toBe("V");
    expect(first.edgesFoldAngle[0]).toBe(90);

    const second = toggleFoldEdgeAssignment(first, 1);
    expect(second.edgesAssignment[1]).toBe("M");
    expect(second.edgesFoldAngle[1]).toBe(-120);
  });

  it("sets an explicit mountain or valley state without toggling twice", () => {
    const source: FoldData = {
      verticesCoords: [[0, 0], [10, 0]],
      edgesVertices: [[0, 1]],
      edgesAssignment: ["V"],
      edgesFoldAngle: [90],
      facesVertices: [],
    };

    const mountain = setFoldEdgeAssignment(source, 0, "M");
    expect(mountain.edgesAssignment[0]).toBe("M");
    expect(mountain.edgesFoldAngle[0]).toBe(-90);

    const unchanged = setFoldEdgeAssignment(mountain, 0, "M");
    expect(unchanged).toBe(mountain);
  });

  it("persists a pop-up edge override through pattern regeneration", () => {
    const document = addMechanism(createDefaultPopupDocument(), "v-fold");
    const initial = getPopupPatternFoldData(document);
    const edgeIndex = initial.edgesAssignment.findIndex((assignment) => assignment === "M");
    expect(edgeIndex).toBeGreaterThanOrEqual(0);

    const signature = getFoldEdgeSignature(initial, edgeIndex);
    const regenerated = getPopupPatternFoldData({
      ...document,
      foldOverrides: { [signature]: "V" },
    });

    expect(regenerated.edgesAssignment[edgeIndex]).toBe("V");
    expect(regenerated.edgesFoldAngle[edgeIndex]).toBe(90);
  });

  it("persists a Spirogami edge override through parametric regeneration", () => {
    const params = getDefaultSpirogamiParams();
    const initial = generateSpirogamiFlatFoldData(params);
    const edgeIndex = initial.edgesAssignment.findIndex((assignment) => assignment === "V");
    expect(edgeIndex).toBeGreaterThanOrEqual(0);

    const signature = getFoldEdgeSignature(initial, edgeIndex);
    const regenerated = generateSpirogamiFlatFoldData({
      ...params,
      foldOverrides: { [signature]: "M" },
    });

    expect(regenerated.edgesAssignment[edgeIndex]).toBe("M");
    expect(regenerated.edgesFoldAngle[edgeIndex]).toBe(-initial.edgesFoldAngle[edgeIndex]);
  });
});

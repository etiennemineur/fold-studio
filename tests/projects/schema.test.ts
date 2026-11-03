import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProject, serializeProject, MAX_PROJECT_BYTES, plainGeometry, type ProjectState } from '../../helpers/studioProject';
import { generateShapeFoldData, DEFAULT_BOX_PARAMS } from '../../helpers/foldEngine';
import { createDefaultPopupDocument, addMechanism } from '../../helpers/popupDocument';
import { getDefaultSpirogamiParams } from '../../helpers/spirogamiEngine';
const fixture = (): ProjectState => ({name: 'Round trip', studioMode: 'packaging', shapeType: 'box', params: DEFAULT_BOX_PARAMS,
  baseFoldData: plainGeometry(generateShapeFoldData('box', DEFAULT_BOX_PARAMS)), displayFoldData: plainGeometry(generateShapeFoldData('box', DEFAULT_BOX_PARAMS)),
  paperShape: 'rectangle', origamiPaperWidth: 180, origamiPaperHeight: 140, origamiFoldType: 'V', origamiFoldAngle: 123,
  popupDocument: addMechanism(createDefaultPopupDocument(), 'v-fold'), spirogamiParams: getDefaultSpirogamiParams(),
  importedMode: false, importWarnings: [], importFileName: '', progress: 42, sequential: true, groundFaceIndex: 0,
  showGrid: false, isVerso: true, layerVisibility: {decoupe: true, pli: false, collage: true, fondPerdu: false},
  artwork: {layers: [], vectorLocked: true, materialType: 'custom', exteriorColor: '#123456', interiorColor: '#654321'}});
test('all four modes preserve authored state deterministically', () => {
  for (const studioMode of ['packaging','origami','popup','spirogami'] as const) {
    const state = {...fixture(), studioMode}; assert.deepEqual(parseProject(serializeProject(state)).state, state);
  }
});
test('malformed schema, geometry, version, resource bounds and external artwork rejected', () => {
  const valid = JSON.parse(serializeProject(fixture()));
  const mutations = [
    (p: any) => p.version = 2,
    (p: any) => p.state.unexpected = true,
    (p: any) => p.state.baseFoldData.edgesVertices[0][0] = 999999,
    (p: any) => p.state.baseFoldData.edgesAssignment.pop(),
    (p: any) => p.state.baseFoldData.facesVertices = [],
    (p: any) => p.state.spirogamiParams.turns = 1e12,
    (p: any) => p.state.groundFaceIndex = 999999,
    (p: any) => p.state.artwork.layers = [{url: 'https://example.com/image.png'}],
  ];
  for (const mutate of mutations) {const copy = structuredClone(valid); mutate(copy); assert.throws(() => parseProject(JSON.stringify(copy)));}
  assert.throws(() => parseProject(' '.repeat(MAX_PROJECT_BYTES + 1)));
  assert.throws(() => parseProject('{"__proto__":{}}'));
});

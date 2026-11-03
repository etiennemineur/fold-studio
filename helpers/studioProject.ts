import type { FoldData, BoxParams, ShapeType } from './foldEngine';
import type { PopupDocument } from './popupDocument';
import type { SpirogamiParams } from './spirogamiEngine';
import type { ArtworkLayer } from './useArtworkLayers';
import { num, str, choice, bool, optional, nullable, array, object, record, fail, type Check } from './projectValidation';
export const MAX_PROJECT_BYTES = 16 * 1024 * 1024;
export interface ProjectArtwork { layers: ArtworkLayer[]; vectorLocked: boolean; materialType: string; exteriorColor: string; interiorColor: string }
export interface ProjectState {
  name: string; studioMode: 'packaging'|'origami'|'popup'|'spirogami'; shapeType: ShapeType; params: BoxParams;
  baseFoldData: FoldData; displayFoldData: FoldData;
  paperShape: 'square'|'rectangle'|'a4'|'custom'; origamiPaperWidth: number; origamiPaperHeight: number;
  origamiFoldType: 'M'|'V'; origamiFoldAngle: number; popupDocument: PopupDocument; spirogamiParams: SpirogamiParams;
  importedMode: boolean; importWarnings: string[]; importFileName: string; progress: number; sequential: boolean;
  groundFaceIndex: number|null; showGrid: boolean; isVerso: boolean;
  layerVisibility: {decoupe: boolean; pli: boolean; collage: boolean; fondPerdu: boolean}; artwork: ProjectArtwork;
}
export interface StudioProject {format: 'fold-studio-project'; version: 1; state: ProjectState}
const number = num(-100000,100000), positive = num(0.001,10000), nonnegative = num(0,10000);
const text = str(500), id = str(200,1), index = num(0,30000,true);
const color: Check = (v,p) => { if (typeof v !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(v)) fail(p); };
const overrides = optional(record(choice('M','V'),20000));
const geometryStructure = object({verticesCoords: array(array(number,3,2),20000,3), edgesVertices: array(array(index,2,2),30000,1),
  edgesAssignment: array(choice('M','V','B','F','P'),30000), edgesFoldAngle: array(num(-360,360),30000), facesVertices: array(array(index,2000,3),4000,1)});
const geometry: Check = (v,p) => {
  geometryStructure(v,p); const g = v as FoldData;
  if (g.edgesVertices.length !== g.edgesAssignment.length || g.edgesVertices.length !== g.edgesFoldAngle.length ||
    g.edgesVertices.some(e => e.some(i => i >= g.verticesCoords.length) || e[0] === e[1]) ||
    g.facesVertices.some(f => f.some(i => i >= g.verticesCoords.length) || new Set(f).size < 3) ||
    g.facesVertices.reduce((n,f) => n + f.length,0) > 60000) fail(p);
};
const box = object({width: positive, height: positive, depth: positive, glueTabSize: nonnegative, materialThickness: num(0,20),
  bleedSize: nonnegative, tabFilletRadius: optional(nonnegative), tabTaperRatio: optional(num(0,1))});
const mechanism = object({id, type: choice('v-fold','v-fold-asymmetric','parallel-fold','platform','box'),
  params: object({positionY: number, width: positive, height: positive, depth: nonnegative, vAngle: num(1,179),
    armLengthLeft: positive, armLengthRight: positive, foldDirection: choice('up','down')})});
const popup = object({bookWidth: positive, bookHeight: positive, paperThickness: nonnegative, mechanisms: array(mechanism,100),
  gluePoints: array(object({id, mechanismId: id, side: choice('left','right'), position: array(number,2,2)}),400),
  sheets: array(object({id, name: text, faceIndices: array(index,4000)}),100), paperColor: color, foldOverrides: overrides});
const spiro = object({discRadius: positive, innerRadius: positive, turns: num(0.1,50), stripHeight: positive, stripWidth: positive,
  gapWidth: nonnegative, paperThickness: nonnegative, paperColor: color, segmentsPerTurn: num(3,256,true), foldOverrides: overrides});
// Restrict embedded resources before browser decoding; never SVG or external URLs.
export function validEmbeddedPNG(url: string): boolean {
  if (url.length > MAX_PROJECT_BYTES || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(url)) return false;
  try {
    const payload = url.slice(22);
    if (payload.length % 4 !== 0) return false;
    const header = atob(payload.slice(0,44));
    if (!header.startsWith('\x89PNG\r\n\x1a\n') || header.slice(12,16) !== 'IHDR') return false;
    const uint = (i: number) => header.charCodeAt(i)*0x1000000 + (header.charCodeAt(i+1)<<16) + (header.charCodeAt(i+2)<<8) + header.charCodeAt(i+3);
    return uint(16)>0 && uint(20)>0 && uint(16)<=4096 && uint(20)<=4096;
  } catch { return false; }
}
const imageURL: Check = (v,p) => {if (typeof v !== 'string' || !validEmbeddedPNG(v)) fail(p);};
const layer = object({id, name: text, url: imageURL, x: number, y: number, width: positive, height: positive, rotation: number,
  locked: bool, visible: bool, aspectRatio: positive, refWidth: positive, refHeight: positive});
const artwork = object({layers: array(layer,64), vectorLocked: bool, materialType: choice('white_cardboard','kraft','grey_cardboard','black_cardboard','coated_white','custom'), exteriorColor: color, interiorColor: color});
export const artworkSchema = {parse(value: unknown): ProjectArtwork {
  artwork(value,'artwork'); const result = value as ProjectArtwork;
  if (new Set(result.layers.map(l => l.id)).size !== result.layers.length) fail('artwork.layers duplicate IDs');
  return structuredClone(result);
}};
const state = object({name: text, studioMode: choice('packaging','origami','popup','spirogami'),
  shapeType: choice('box','pyramid','tray','sleeve','hexagonal','triangular','octagonal','pentagonal','mailer','tuckEnd','display','flipTop','gable','sealEnd','snapLock','origamiSquare','origamiRectangle','origamiA4','concentricRings','sineWaves'),
  params: box, baseFoldData: geometry, displayFoldData: geometry, paperShape: choice('square','rectangle','a4','custom'),
  origamiPaperWidth: positive, origamiPaperHeight: positive, origamiFoldType: choice('M','V'), origamiFoldAngle: num(-180,180),
  popupDocument: popup, spirogamiParams: spiro, importedMode: bool, importWarnings: array(text,200), importFileName: text,
  progress: num(0,100), sequential: bool, groundFaceIndex: nullable(index), showGrid: bool, isVerso: bool,
  layerVisibility: object({decoupe: bool, pli: bool, collage: bool, fondPerdu: bool}), artwork});
const project = object({format: choice('fold-studio-project'), version: choice(1), state});
export function plainGeometry(g: FoldData): FoldData {
  return {verticesCoords: g.verticesCoords.map(v => v[2] === undefined ? [v[0], v[1]] : [v[0], v[1], v[2]]), edgesVertices: g.edgesVertices, edgesAssignment: g.edgesAssignment, edgesFoldAngle: g.edgesFoldAngle, facesVertices: g.facesVertices};
}
export function parseProject(text: string): StudioProject {
  if (text.length > MAX_PROJECT_BYTES || new TextEncoder().encode(text).length > MAX_PROJECT_BYTES) throw new Error('Project exceeds 16 MiB.');
  const parsed = JSON.parse(text, (key,value) => {if (['__proto__','constructor','prototype'].includes(key)) fail(key); return value;});
  project(parsed,'project');
  const s = (parsed as StudioProject).state;
  artworkSchema.parse(s.artwork);
  if (s.spirogamiParams.turns*s.spirogamiParams.segmentsPerTurn > 4000) fail('spirogamiParams segment budget');
  if (s.groundFaceIndex !== null && s.groundFaceIndex >= s.displayFoldData.facesVertices.length) fail('groundFaceIndex');
  if (new Set(s.popupDocument.mechanisms.map(m => m.id)).size !== s.popupDocument.mechanisms.length ||
      s.popupDocument.gluePoints.some(g => !s.popupDocument.mechanisms.some(m => m.id === g.mechanismId))) fail('popup references');
  return parsed;
}
export function serializeProject(state: ProjectState): string {
  const text = JSON.stringify({format: 'fold-studio-project', version: 1, state}); parseProject(text); return text;
}
export async function decodeProjectImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve,reject) => {
    const image = new Image();
    const timer = setTimeout(() => {image.src=''; reject(new Error('Artwork loading timed out.'));},10000);
    image.onload = () => {clearTimeout(timer); if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth>4096 || image.naturalHeight>4096) reject(new Error('Artwork exceeds 4096 × 4096 pixels.')); else resolve(image);};
    image.onerror = () => {clearTimeout(timer); reject(new Error('Artwork cannot be decoded.'));}; image.src=url;
  });
}
export async function embedArtwork(layers: ArtworkLayer[]): Promise<ArtworkLayer[]> {
  const result: ArtworkLayer[] = []; let total=0;
  for (const entry of layers) {
    if (!entry.url.startsWith('blob:') && !validEmbeddedPNG(entry.url)) throw new Error('Artwork source is not local.');
    const image = await decodeProjectImage(entry.url);
    const canvas = document.createElement('canvas'); canvas.width=image.naturalWidth; canvas.height=image.naturalHeight;
    const context=canvas.getContext('2d'); if (!context) throw new Error('Artwork canvas unavailable.');
    context.drawImage(image,0,0); const url=canvas.toDataURL('image/png'); total+=url.length; canvas.width=canvas.height=0;
    if (total>MAX_PROJECT_BYTES) throw new Error('Project artwork exceeds 16 MiB.'); result.push({...entry,url});
  }
  return result;
}

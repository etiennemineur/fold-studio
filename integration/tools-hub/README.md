# Tools hub integration

Snapshot of the bilingual Fold Studio card and SVG preview. Add `foldStudioCard` to the hub's TOOLS array, copy `foldstudio.svg` to `Resources/brand/`, and register the renderer:

```js
if (tool.preview === 'foldstudio') imagePreview(box, 'Resources/brand/foldstudio.svg', 'contain');
```

This folder is an integration snapshot, not the full tools hub or an automatic synchronization.

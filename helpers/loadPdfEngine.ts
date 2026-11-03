// Download the PDF engine and embedded fonts only when a PDF is requested.
// Keep a shared pending load for concurrent exports and allow retry on failure.
let pending: Promise<any> | undefined;
export function loadPdfEngine(): Promise<any> {
  if (!pending) {
    pending = Promise.all([
      import('pdfmake/build/pdfmake'),
      import('pdfmake/build/vfs_fonts'),
    ]).then(([engineModule, fontsModule]) => {
      const engine = (engineModule.default || engineModule) as unknown as typeof engineModule & {
        addVirtualFileSystem: (fonts: unknown) => void;
      };
      const fonts = fontsModule.default || fontsModule;
      engine.addVirtualFileSystem(fonts);
      return engine;
    }).catch(error => { pending = undefined; throw error; });
  }
  return pending;
}

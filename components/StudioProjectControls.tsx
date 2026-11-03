import React, { useRef, useState } from 'react';
import { MAX_PROJECT_BYTES, parseProject, serializeProject, type ProjectState } from '../helpers/studioProject';

export function StudioProjectControls({snapshot, restore}: {
  snapshot: () => Promise<ProjectState>; restore: (state: ProjectState) => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy,setBusy] = useState(false);
  const [status,setStatus] = useState('Local project file · images included · 16 MiB max');
  const [error,setError] = useState(false);
  async function run(action: () => Promise<string>) {
    setBusy(true); setError(false);
    try {setStatus(await action());} catch(e) {setError(true); setStatus(e instanceof Error ? e.message : 'Project operation failed.');}
    finally {setBusy(false);}
  }
  return <section aria-label="Project file" style={{padding:'8px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
      <button type="button" id="save-project" disabled={busy} onClick={() => run(async () => {
        const state = await snapshot();
        const url = URL.createObjectURL(new Blob([serializeProject(state)], {type:'application/json'}));
        const link = document.createElement('a'); link.href=url;
        link.download=`${state.name.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,80) || 'project'}.foldstudio.json`;
        document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url),30000);
        return 'Project download requested. Keep this file to reopen your work.';
      })}>Save project</button>
      <button type="button" id="open-project" disabled={busy} onClick={() => input.current?.click()}>Open project</button>
      <input ref={input} id="project-file" type="file" accept=".foldstudio.json,.json,application/json" hidden disabled={busy} onChange={e => {
        const file=e.currentTarget.files?.[0]; e.currentTarget.value=''; if (!file) return;
        void run(async () => {
          if (file.size>MAX_PROJECT_BYTES) throw new Error('Project exceeds 16 MiB. Current project unchanged.');
          const project=parseProject(await file.text());
          await restore(project.state);
          return 'Project opened locally. No data sent to a server.';
        });
      }}/>
    </div>
    <p id="project-status" role={error ? 'alert' : 'status'} style={{fontSize:11,margin:'6px 0 0',overflowWrap:'anywhere',color:error?'#b42318':'inherit'}}>{busy ? 'Preparing project…' : status}</p>
  </section>;
}

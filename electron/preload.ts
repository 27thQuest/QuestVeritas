import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('veritas',{version:()=>ipcRenderer.invoke('app:version') as Promise<string>,validateImportUrl:(url:string)=>ipcRenderer.invoke('import:validate-url',url) as Promise<{ok:boolean;url?:string;error?:string}>,databaseStatus:()=>ipcRenderer.invoke('db:status') as Promise<{configured:boolean;path:string}>});

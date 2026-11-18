/// <reference types="vite/client" />
interface Window { veritas?: { version:()=>Promise<string>; validateImportUrl:(url:string)=>Promise<{ok:boolean;url?:string;error?:string}>; databaseStatus:()=>Promise<{configured:boolean;path:string}> } }

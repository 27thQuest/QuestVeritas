import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { z } from 'zod';
let win: BrowserWindow | undefined;
function createWindow(){ win=new BrowserWindow({width:1440,height:920,minWidth:1050,minHeight:700,backgroundColor:'#111210',title:'Quest Veritas',webPreferences:{preload:join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}}); if(process.env.VITE_DEV_SERVER_URL) void win.loadURL(process.env.VITE_DEV_SERVER_URL); else void win.loadFile(join(__dirname,'../dist/index.html')); win.webContents.setWindowOpenHandler(({url})=>{try{if(new URL(url).protocol==='https:') void shell.openExternal(url)}catch{} return {action:'deny'}}); win.webContents.on('will-navigate',(e,url)=>{if(!url.startsWith('http://127.0.0.1:5173')&&!url.startsWith('file://'))e.preventDefault()}); }
app.whenReady().then(()=>{createWindow(); app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow()})});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});
ipcMain.handle('app:version',()=>app.getVersion());
const urlSchema=z.string().url().refine(v=>['https:','http:'].includes(new URL(v).protocol));
ipcMain.handle('import:validate-url',(_event,value:unknown)=>{const result=urlSchema.safeParse(value);return result.success?{ok:true,url:result.data}:{ok:false,error:'Enter a valid http or https URL.'}});
ipcMain.handle('db:status',()=>({configured:existsSync(join(app.getPath('userData'),'database','veritas.db')),path:join(app.getPath('userData'),'database','veritas.db')}));

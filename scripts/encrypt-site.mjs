import { readFile, writeFile, readdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { randomBytes, pbkdf2Sync, createCipheriv, createDecipheriv } from 'node:crypto'

const password = process.env.SITE_PASSWORD
if (!password) throw new Error('SITE_PASSWORD is required; refusing to publish plaintext.')
const root = resolve('dist')
let html = await readFile(resolve(root, 'index.html'), 'utf8')
for (const match of [...html.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g)]) {
  const script = await readFile(resolve(root, match[1].replace(/^\//, '')), 'utf8')
  html = html.replace(match[0], () => `<script type="module">${script.replace(/<\/script/gi, '<\\/script')}</script>`)
}
for (const match of [...html.matchAll(/<link\b[^>]*href="([^"]+\.css)"[^>]*>/g)]) {
  const css = await readFile(resolve(root, match[1].replace(/^\//, '')), 'utf8')
  html = html.replace(match[0], () => `<style>${css}</style>`)
}
const salt = randomBytes(16), iv = randomBytes(12)
const key = pbkdf2Sync(password, salt, 600000, 32, 'sha256')
const cipher = createCipheriv('aes-256-gcm', key, iv)
const encrypted = Buffer.concat([cipher.update(html, 'utf8'), cipher.final()])
const tag = cipher.getAuthTag()
const check = createDecipheriv('aes-256-gcm', key, iv)
check.setAuthTag(tag)
if (Buffer.concat([check.update(encrypted), check.final()]).toString() !== html) throw new Error('Encryption round trip failed')
const payload = JSON.stringify({ salt: salt.toString('base64'), iv: iv.toString('base64'), data: Buffer.concat([encrypted, tag]).toString('base64') })
const page = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Clarity — private map</title>
<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f5f1e8;color:#304941;font:16px system-ui}main{width:min(400px,90vw);background:#fffdf8;padding:36px;border:1px solid #ddd9ce;border-radius:20px;box-shadow:0 15px 50px #30494112}h1{font:42px Georgia;margin:0 0 12px}p{line-height:1.6;color:#64756c}input,button{width:100%;font:inherit;padding:13px;border-radius:9px;border:1px solid #ccd3cc}button{margin-top:12px;background:#304941;color:white;cursor:pointer}button:disabled{opacity:.6}#error{min-height:24px;color:#9a493c;font-size:14px}</style>
<main><h1>clarity</h1><p>A private space to make sense of things.</p><form><label for="password">Password</label><input id="password" type="password" required autocomplete="current-password" autofocus><button>Unlock map</button><p id="error" role="status"></p></form></main>
<script>
const payload=${payload};
const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
document.querySelector('form').addEventListener('submit',async e=>{
 e.preventDefault();const button=document.querySelector('button');button.disabled=true;button.textContent='Unlocking…';
 try{
  const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(document.querySelector('input').value),'PBKDF2',false,['deriveKey']);
  const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt:bytes(payload.salt),iterations:600000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['decrypt']);
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(payload.iv)},key,bytes(payload.data));
  document.open();document.write(new TextDecoder().decode(plain));document.close();
 }catch{document.querySelector('#error').textContent='Could not unlock. Check the password and try again.';button.disabled=false;button.textContent='Unlock map';}
});
</script></html>`
// Remove all plaintext build assets. Only the encrypted entry point is published.
for (const entry of await readdir(root)) await rm(resolve(root, entry), { recursive: true, force: true })
await writeFile(resolve(root, 'index.html'), page)
console.log('Encrypted site verified; plaintext build assets removed.')

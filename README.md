# Face Box Cam
Tiny Vite app created for use in a DUDJ advertisement. 

## Run locally

Run the following commands in your terminal:
```bash
npm install
npm run dev
```
Open the URL Vite prints (usually http://localhost:5173) and click **Enable camera**.

Browsers allow camera access on `localhost` without HTTPS, so this works locally with no extra setup.

## Production

Browsers only allow `getUserMedia` in a secure context, so **production must be served over HTTPS**. Plain `http://` on any host other than `localhost` won't get camera access.

Run the following commands in your terminal:
```bash
npm run build    
npm run preview 
```

`dist/` is plain static files; host it on any HTTPS static host.

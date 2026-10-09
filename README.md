# Face Box Cam

A tiny Vite site that shows your webcam in the top-left corner and draws a box around every face in frame, using [MediaPipe Face Detector](https://ai.google.dev/edge/mediapipe/solutions/vision/face_detector/web_js).

Detection runs entirely in the browser. No video is sent to any server. The browser downloads the MediaPipe WASM runtime (from jsDelivr) and the `blaze_face_short_range` model (from Google Cloud Storage) once at startup.

## Run locally

Requires Node.js 18+.

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173) and click **Enable camera**.

Browsers allow camera access on `localhost` without HTTPS, so this works locally with no extra setup.

## Production

Browsers only allow `getUserMedia` in a secure context, so **production must be served over HTTPS**. Plain `http://` on any host other than `localhost` won't get camera access.

```bash
npm run build     # outputs static files to dist/
npm run preview   # serves dist/ locally to check the build
```

`dist/` is plain static files; host it on any HTTPS static host.

## Restyling

All colors are CSS variables at the top of [src/style.css](src/style.css):

| Variable       | Used for                                  |
| -------------- | ----------------------------------------- |
| `--bg`         | Page background                           |
| `--text`       | Text and box borders                      |
| `--muted`      | Privacy note                              |
| `--btn-bg`     | Button background                         |
| `--btn-text`   | Button text                               |
| `--box`        | Face bounding boxes                       |
| `--cam-border` | Border around the webcam preview          |
| `--error`      | Error messages                            |
| `--font`       | Page font                                 |
| `--cam-inset`  | Gap between the selfie box and the top/left edges |

## Files

- `index.html`: page markup
- `src/main.js`: camera setup, detector, and draw loop
- `src/style.css`: layout and colors

## Upgrading MediaPipe

`@mediapipe/tasks-vision` is pinned to an exact version. The WASM URL in `src/main.js` has to match it, so if you change the version in `package.json`, update `WASM_URL` too.

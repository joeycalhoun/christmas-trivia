// Stitches the artifact build (one IIFE + one CSS file) into a single self-contained page.
// React and ReactDOM load from cdnjs; everything else is inline.
import { readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('../dist-artifact/', import.meta.url);
const js = readFileSync(new URL('app.js', dir), 'utf8').replace(/<\/script/gi, '<\\/script');
const css = readFileSync(new URL('app.css', dir), 'utf8').replace(/<\/style/gi, '<\\/style');

const html = `<title>Six-Part IQ Test</title>
<meta name="description" content="A timed IQ test with six subtests and alternate forms for retakes.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&family=IBM+Plex+Mono:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap">
<style>${css}</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>${js}</script>
`;
writeFileSync(new URL('iq-test.html', dir), html);
console.log(`dist-artifact/iq-test.html: ${(html.length / 1024).toFixed(1)} KB`);

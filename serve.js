const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const ROOT = 'C:\\Users\\SirGalahad\\Downloads\\Mapa Videojuego';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.gltf': 'application/json; charset=utf-8',
  '.bin': 'application/octet-stream',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
  if (reqPath === '/api/media') {
    const mediaRoot = path.join(ROOT, 'assets', 'media');
    const result = {};
    if (fs.existsSync(mediaRoot)) {
      const stationDirs = fs.readdirSync(mediaRoot, { withFileTypes: true })
        .filter(d => d.isDirectory() && d.name.startsWith('station_'));
      
      for (const dir of stationDirs) {
        const stationNumMatch = dir.name.match(/station_(\d+)/);
        if (!stationNumMatch) continue;
        const stationId = parseInt(stationNumMatch[1], 10);
        const dirPath = path.join(mediaRoot, dir.name);
        const files = fs.readdirSync(dirPath)
          .filter(f => !f.startsWith('.') && f.toLowerCase() !== 'desktop.ini');
        
        const items = [];
        for (const file of files) {
          const ext = path.extname(file).toLowerCase();
          let type = 'file';
          let badge = '📄 Archivo';
          let icon = '📄';
          let category = 'Documento';

          if (['.mp4', '.webm', '.mov', '.m4v'].includes(ext)) {
            type = 'video';
            badge = 'Video';
            category = 'Cápsula de Video';
          } else if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(ext)) {
            type = 'image';
            badge = 'Infografía';
            category = 'Infografía Visual';
          } else if (ext === '.pdf') {
            type = 'pdf';
            badge = 'PDF';
            category = 'Documento Guía';
          }

          // Parse order prefix e.g. "01_video_bienvenida.mp4" -> 1
          const orderMatch = file.match(/^(\d+)[_\-\s]+/);
          const order = orderMatch ? parseInt(orderMatch[1], 10) : 99;

          // Format clean title without emojis or underscores
          let cleanName = file.replace(/\.[^/.]+$/, ''); // remove ext
          if (orderMatch) {
            cleanName = cleanName.substring(orderMatch[0].length);
          }
          cleanName = cleanName.replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
          if (cleanName === cleanName.toLowerCase()) {
            cleanName = cleanName.replace(/\b\w/g, l => l.toUpperCase());
          }

          items.push({
            order,
            type,
            title: cleanName || file,
            file: `assets/media/${dir.name}/${file}`,
            desc: category,
            badge
          });
        }

        items.sort((a, b) => a.order - b.order);
        result[stationId] = items;
      }
    }

    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(JSON.stringify(result, null, 2));
  }

  const filePath = path.normalize(path.join(ROOT, reqPath));

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404);
      return res.end('Not Found: ' + reqPath);
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      const chunksize = (end - start) + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stats.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stats.size,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*'
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Node HTTP Server listening on http://127.0.0.1:${PORT}`);
});

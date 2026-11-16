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
  '.glb': 'model/gltf-binary',
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
  '.pdf': 'application/pdf',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  // API Content: GET /api/content
  if (reqPath === '/api/content' && req.method === 'GET') {
    const configPath = path.join(ROOT, 'assets', 'config', 'station-content.json');
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      });
      return res.end(data);
    } else {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Access-Control-Allow-Origin': '*'
      });
      return res.end(JSON.stringify({ success: true, custom: false, stations: {} }));
    }
  }

  // API Content Save: POST /api/content/save
  if (reqPath === '/api/content/save' && (req.method === 'POST' || req.method === 'PUT')) {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        const configDir = path.join(ROOT, 'assets', 'config');
        if (!fs.existsSync(configDir)) {
          fs.mkdirSync(configDir, { recursive: true });
        }
        const configPath = path.join(configDir, 'station-content.json');
        fs.writeFileSync(configPath, JSON.stringify(parsed, null, 2), 'utf8');
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        });
        return res.end(JSON.stringify({ success: true, message: 'Configuración guardada exitosamente en disco' }));
      } catch (err) {
        res.writeHead(400, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // API Media Catalog: GET /api/media/catalog
  if (reqPath === '/api/media/catalog' && req.method === 'GET') {
    const mediaRoot = path.join(ROOT, 'assets', 'media');
    const catalog = [];
    if (fs.existsSync(mediaRoot)) {
      const scanDir = (dir, relPath = '') => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name.toLowerCase() === 'desktop.ini') continue;
          const fullEntryPath = path.join(dir, entry.name);
          const currentRelPath = relPath ? `${relPath}/${entry.name}` : entry.name;
          if (entry.isDirectory()) {
            scanDir(fullEntryPath, currentRelPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            let type = 'file';
            if (['.mp4', '.webm', '.mov', '.m4v'].includes(ext)) type = 'video';
            else if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(ext)) type = 'image';
            else if (ext === '.pdf') type = 'pdf';
            catalog.push({
              name: entry.name,
              relativePath: `assets/media/${currentRelPath}`,
              folder: relPath || 'raiz',
              type,
              ext
            });
          }
        }
      };
      scanDir(mediaRoot);
    }
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(JSON.stringify(catalog, null, 2));
  }

  // API Media Upload: POST /api/media/upload
  if (reqPath === '/api/media/upload' && req.method === 'POST') {
    const rawFileName = req.headers['x-filename'] || 'archivo_cargado.mp4';
    const decodedFileName = decodeURIComponent(rawFileName).replace(/[^a-zA-Z0-9._\-]/g, '_');
    const stationIdNum = parseInt(req.headers['x-station-id'] || '1', 10) || 1;
    const stationFolder = 'station_' + String(stationIdNum).padStart(2, '0');
    const targetDir = path.join(ROOT, 'assets', 'media', stationFolder);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const targetFilePath = path.join(targetDir, decodedFileName);
    const writeStream = fs.createWriteStream(targetFilePath);

    req.pipe(writeStream);

    writeStream.on('finish', () => {
      const relPath = 'assets/media/' + stationFolder + '/' + decodedFileName;
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({
        success: true,
        relativePath: relPath,
        name: decodedFileName,
        stationId: stationIdNum
      }));
    });

    writeStream.on('error', (err) => {
      res.writeHead(500, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ success: false, error: err.message }));
    });
    return;
  }

  // API Station Media: GET /api/media
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
          let badge = 'Archivo';
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

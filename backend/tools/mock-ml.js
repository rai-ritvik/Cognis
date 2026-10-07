// DEV TOOL ONLY - a fake ML1 face service so you can test the backend before the real one exists.
// It is NOT used by the backend itself and must never run in production.
//
//   node tools/mock-ml.js                       -> every face matches with confidence 0.95  (PRESENT)
//   MOCK_CONFIDENCE=0.7 node tools/mock-ml.js   -> borderline score                          (PENDING_REVIEW)
//   MOCK_CONFIDENCE=0.2 node tools/mock-ml.js   -> mismatch                                  (rejected)
//   MOCK_FACE=none node tools/mock-ml.js        -> "no face detected"
const http = require('http');
const PORT = Number(process.env.PORT || 8001);
const confidence = Number(process.env.MOCK_CONFIDENCE || 0.95);
const faceDetected = process.env.MOCK_FACE !== 'none';

http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'POST' && req.url === '/embed') {
      return res.end(JSON.stringify({ face_detected: faceDetected, embedding: faceDetected ? Array.from({ length: 128 }, (_, i) => i / 128) : [] }));
    }
    if (req.method === 'POST' && req.url === '/verify') {
      return res.end(JSON.stringify({ face_detected: faceDetected, match: confidence >= 0.8, confidence }));
    }
    res.statusCode = 404; res.end(JSON.stringify({ error: 'not found' }));
  });
}).listen(PORT, () => console.log(`MOCK ML1 on :${PORT} (face_detected=${faceDetected}, confidence=${confidence})`));

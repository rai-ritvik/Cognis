const axios = require('axios');
const env = require('../config/env');
const AppError = require('../utils/AppError');

// Talks to the ML1 (face) microservice. Contract is documented in docs/ML1_CONTRACT.md
//   POST /embed  { image_base64 }             -> { face_detected, embedding: number[] }
//   POST /verify { image_base64, embedding }  -> { face_detected, match, confidence }
const client = axios.create({ baseURL: env.ml1Url, timeout: 15000 });

// "data:image/jpeg;base64,AAAA..." -> "AAAA..."
const stripPrefix = (b64) => b64.replace(/^data:image\/[a-zA-Z+.-]+;base64,/, '');

function toAppError(e) {
  if (e instanceof AppError) return e;
  if (e.response) {
    if (e.response.status === 422) return new AppError(422, 'No face detected. Look at the camera and try again.', 'NO_FACE');
    console.error('[ml1] bad response', e.response.status, e.response.data);
    return new AppError(502, 'Face recognition service returned an error', 'ML_ERROR');
  }
  console.error('[ml1] unreachable:', e.code || e.message);
  // FAIL CLOSED: if the face service is down, nobody gets attendance by default.
  return new AppError(503, 'Face recognition service is unavailable. Try again shortly.', 'ML_DOWN');
}

async function getEmbedding(imageBase64) {
  try {
    const { data } = await client.post('/embed', { image_base64: stripPrefix(imageBase64) });
    if (!data.face_detected) throw new AppError(422, 'No face detected. Look at the camera and try again.', 'NO_FACE');
    if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
      throw new AppError(502, 'Face recognition service returned an invalid response', 'ML_ERROR');
    }
    return data.embedding;
  } catch (e) {
    throw toAppError(e);
  }
}

async function verifyFace(imageBase64, embedding) {
  try {
    const { data } = await client.post('/verify', { image_base64: stripPrefix(imageBase64), embedding });
    if (typeof data.face_detected !== 'boolean') throw new AppError(502, 'Face recognition service returned an invalid response', 'ML_ERROR');
    if (data.face_detected && typeof data.confidence !== 'number') throw new AppError(502, 'Face recognition service returned an invalid response', 'ML_ERROR');
    return { faceDetected: data.face_detected, confidence: data.confidence };
  } catch (e) {
    throw toAppError(e);
  }
}

module.exports = { getEmbedding, verifyFace };

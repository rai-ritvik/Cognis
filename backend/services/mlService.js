const axios = require('axios');
const env = require('../config/env');
const AppError = require('../utils/AppError');

// Contract from face-detection-recognition/app/main.py:
// POST /enroll { student_id, full_name, frames[3..8] }
//   -> { success, reference_embedding: number[512], ... }
// POST /verify { reference_embedding: number[512], frames[15..20] }
//   -> { success, verified, similarity, liveness: { passed }, reason, ... }
const client = axios.create({
  baseURL: env.ml1Url.replace(/\/+$/, ''),
  timeout: env.mlTimeoutMs,
  maxBodyLength: 10 * 1024 * 1024,
  maxContentLength: 10 * 1024 * 1024,
});

function requestConfig() {
  return env.mlApiKey ? { headers: { 'X-API-Key': env.mlApiKey } } : {};
}

function toAppError(error) {
  if (error instanceof AppError) return error;

  if (error.response) {
    const status = error.response.status;
    if (status === 400 || status === 413 || status === 422) {
      // Do not expose detailed image/model diagnostics to every caller.
      return new AppError(422, 'The ML service could not process these frames. Capture clear, supported camera frames and try again.', 'ML_INVALID_INPUT');
    }
    if (status === 401 || status === 403) {
      console.error('[ml1] authentication/configuration rejected by ML service:', status);
      return new AppError(502, 'Face recognition service authentication is misconfigured', 'ML_AUTH_ERROR');
    }
    console.error('[ml1] service error:', status);
    return new AppError(502, 'Face recognition service returned an error', 'ML_ERROR');
  }

  console.error('[ml1] unreachable:', error.code || error.message);
  // Fail closed: never approve attendance when the ML service is unavailable.
  return new AppError(503, 'Face recognition service is unavailable. Try again shortly.', 'ML_DOWN');
}

async function getEmbedding(rollNumber, fullName, frames) {
  try {
    const { data } = await client.post('/enroll', {
      student_id: rollNumber,
      full_name: fullName,
      frames,
    }, requestConfig());

    if (data?.success !== true || !Array.isArray(data.reference_embedding) ||
        data.reference_embedding.length !== 512 ||
        !data.reference_embedding.every((value) => Number.isFinite(value))) {
      throw new AppError(502, 'Face recognition service returned an invalid enrollment response', 'ML_ERROR');
    }
    return data.reference_embedding;
  } catch (error) {
    throw toAppError(error);
  }
}

async function verifyFace(frames, referenceEmbedding) {
  try {
    const { data } = await client.post('/verify', {
      reference_embedding: referenceEmbedding,
      frames,
    }, requestConfig());

    if (data?.success !== true || typeof data.verified !== 'boolean' ||
        !data.liveness || typeof data.liveness.passed !== 'boolean' ||
        (data.verified && typeof data.similarity !== 'number')) {
      throw new AppError(502, 'Face recognition service returned an invalid verification response', 'ML_ERROR');
    }

    return {
      verified: data.verified,
      livenessPassed: data.liveness.passed,
      similarity: typeof data.similarity === 'number' ? data.similarity : null,
      reason: data.reason || data.liveness.reason || null,
    };
  } catch (error) {
    throw toAppError(error);
  }
}

module.exports = { getEmbedding, verifyFace };

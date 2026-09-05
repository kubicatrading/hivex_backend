// @ts-ignore
import lamejs from "lamejsfix";

/**
 * Encodes 16-bit 24kHz Mono Linear PCM samples into a compressed 64kbps MP3 buffer using LAME.
 * @param pcmBuffer Signed 16-bit LE PCM samples (24000 Hz mono)
 * @param sampleRate Default 24000 Hz
 * @param bitrateKbps Target bitrate in kbps (default 64kbps mono)
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

export function encodePcmToMp3(pcmBuffer: Buffer, sampleRate = 24000, bitrateKbps = 18): Buffer {
  if (!pcmBuffer || pcmBuffer.length === 0) return Buffer.alloc(0);

  // 1. Try native FFmpeg if available on system (ultra-fast and perfect quality at low bitrates)
  try {
    const tmpDir = os.tmpdir();
    const randId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const pcmPath = path.join(tmpDir, `hivex_enc_${randId}.pcm`);
    const mp3Path = path.join(tmpDir, `hivex_enc_${randId}.mp3`);

    fs.writeFileSync(pcmPath, pcmBuffer);
    execSync(`ffmpeg -y -f s16le -ar ${sampleRate} -ac 1 -i "${pcmPath}" -b:a ${bitrateKbps}k "${mp3Path}" 2>/dev/null`);
    const mp3Buf = fs.readFileSync(mp3Path);

    try {
      fs.unlinkSync(pcmPath);
      fs.unlinkSync(mp3Path);
    } catch (_) {}

    if (mp3Buf.length > 100) {
      return mp3Buf;
    }
  } catch (_) {
    // Fallback to pure JS lamejs
  }

  // 2. Pure JS LAME fallback: lamejs fails and produces silence at <48kbps, so clamp to min 48kbps
  const safeBitrate = Math.max(48, bitrateKbps);
  const numSamples = Math.floor(pcmBuffer.length / 2);
  const samples = new Int16Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    samples[i] = pcmBuffer.readInt16LE(i * 2);
  }

  const mp3encoder = new lamejs.Mp3Encoder(1, sampleRate, safeBitrate);
  const mp3Data: Buffer[] = [];

  const chunkSize = 1152;
  for (let i = 0; i < numSamples; i += chunkSize) {
    const chunk = samples.subarray(i, i + chunkSize);
    const mp3buf = mp3encoder.encodeBuffer(chunk);
    if (mp3buf && mp3buf.length > 0) {
      mp3Data.push(Buffer.from(mp3buf));
    }
  }

  const mp3buf2 = mp3encoder.flush();
  if (mp3buf2 && mp3buf2.length > 0) {
    mp3Data.push(Buffer.from(mp3buf2));
  }

  return Buffer.concat(mp3Data);
}

/**
 * Fallback lightweight audio compressor that creates a 24kHz 16-bit mono RIFF/WAV audio stream
 * when native MP3 encoder is passed raw PCM.
 */
export function addWavHeader(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  const header = Buffer.alloc(44);
  const dataSize = pcmBuffer.length;
  const chunkSize = 36 + dataSize;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;

  header.write("RIFF", 0);
  header.writeUInt32LE(chunkSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

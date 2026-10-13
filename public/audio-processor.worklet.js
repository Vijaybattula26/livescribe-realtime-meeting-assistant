/**
 * LiveScribe AudioWorklet Processor
 * Captures microphone audio, downsamples to 16kHz mono (if needed),
 * converts Float32 audio to 16-bit Linear PCM, computes RMS,
 * and posts 120-160ms chunks to the main thread for the Gemini Live API.
 */
class LiveScribeAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetSampleRate = 16000;
    // Buffer for ~150ms of 16kHz audio (16000 * 0.15 = 2400 samples)
    this.chunkSize = 2400;
    this.pcmBuffer = new Int16Array(this.chunkSize);
    this.bufferIndex = 0;
    this.resampleRatio = sampleRate / this.targetSampleRate;
    this.phase = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    // Use channel 0 (mono). If multi-channel, we downmix or take channel 0.
    const channelData = input[0];
    if (!channelData || channelData.length === 0) return true;

    // Calculate RMS for level meter
    let sumSquares = 0;
    for (let i = 0; i < channelData.length; i++) {
      sumSquares += channelData[i] * channelData[i];
    }
    const rms = Math.sqrt(sumSquares / channelData.length);

    // Resample to 16kHz and convert Float32 [-1.0, 1.0] to Int16 [-32768, 32767]
    if (this.resampleRatio === 1) {
      for (let i = 0; i < channelData.length; i++) {
        const s = Math.max(-1, Math.min(1, channelData[i]));
        this.pcmBuffer[this.bufferIndex++] = s < 0 ? s * 0x8000 : s * 0x7fff;

        if (this.bufferIndex >= this.chunkSize) {
          this.flushBuffer(rms);
        }
      }
    } else {
      // Linear interpolation downsampling
      while (this.phase < channelData.length) {
        const index = Math.floor(this.phase);
        const nextIndex = Math.min(index + 1, channelData.length - 1);
        const weight = this.phase - index;
        const sample = channelData[index] * (1 - weight) + channelData[nextIndex] * weight;

        const s = Math.max(-1, Math.min(1, sample));
        this.pcmBuffer[this.bufferIndex++] = s < 0 ? s * 0x8000 : s * 0x7fff;

        if (this.bufferIndex >= this.chunkSize) {
          this.flushBuffer(rms);
        }

        this.phase += this.resampleRatio;
      }
      this.phase -= channelData.length;
    }

    return true;
  }

  flushBuffer(rms) {
    // Copy buffer to transfer to main thread
    const chunk = new Int16Array(this.pcmBuffer);
    this.port.postMessage(
      {
        type: 'AUDIO_CHUNK',
        pcmData: chunk.buffer,
        rms: rms,
      },
      [chunk.buffer]
    );
    this.pcmBuffer = new Int16Array(this.chunkSize);
    this.bufferIndex = 0;
  }
}

registerProcessor('livescribe-audio-processor', LiveScribeAudioProcessor);

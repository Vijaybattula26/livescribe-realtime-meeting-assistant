import { GoogleGenAI } from '@google/genai';
import { config } from '../config.js';

export interface ModelHealthStatus {
  healthy: boolean;
  message: string;
  statusCode?: number;
  availableModels?: string[];
}

/**
 * Validates configured models against the Gemini API on server startup
 * using the official @google/genai SDK (same code path as the app).
 * Logs a clear, human-readable status without crashing the server.
 */
export async function verifyConfiguredModels(): Promise<ModelHealthStatus> {
  if (!config.geminiApiKey) {
    const msg =
      'GEMINI_API_KEY is not set in the environment (.env). The server is running in simulated demo mode.';
    console.warn(`[Model Health] ⚠️  ${msg}`);
    return { healthy: false, message: msg };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
    const response = await ai.models.list();
    const modelList: string[] = [];
    for await (const m of response) {
      if (m.name) modelList.push(m.name.replace(/^models\//, ''));
    }

    console.log(`[Model Health] ✅ Gemini API key verified with Google Generative AI (@google/genai).`);
    console.log(`   Configured Live Model:    ${config.geminiLiveModel}`);
    console.log(`   Configured Extract Model: ${config.geminiExtractModel}`);
    console.log(`   Available Models Count:   ${modelList.length}`);

    const extractModelFound = modelList.some(
      (m) => m === config.geminiExtractModel || m.includes(config.geminiExtractModel)
    );
    const liveModelFound = modelList.some(
      (m) => m === config.geminiLiveModel || m.includes(config.geminiLiveModel)
    );

    console.log(`   Live Model Active:        ${liveModelFound ? 'YES' : 'PREVIEW'}`);
    console.log(`   Extract Model Active:     ${extractModelFound ? 'YES' : 'PREVIEW'}`);

    return {
      healthy: true,
      message: `Gemini API key verified. Live: ${config.geminiLiveModel}, Extract: ${config.geminiExtractModel}`,
      availableModels: modelList,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[Model Health] ❌ Model/API Key verification failed:`);
    console.error(`   Reason:       ${errorMsg}`);
    console.error(
      `   💡 Tip: Please check your GEMINI_API_KEY in .env and verify model access.`
    );

    return {
      healthy: false,
      message: `Model check failed: ${errorMsg}`,
    };
  }
}

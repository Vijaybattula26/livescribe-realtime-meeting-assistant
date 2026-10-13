/**
 * Frontend debug logger: gates all verbose debug logs behind localStorage flag 'livescribe_debug' === 'true'.
 * In production or default mode, prevents leaking transcript text, audio data, or sensitive parameters.
 */
export const isDebugActive = (): boolean => {
  try {
    return typeof window !== 'undefined' && localStorage.getItem('livescribe_debug') === 'true';
  } catch {
    return false;
  }
};

export const debugLog = (message: string, ...args: unknown[]): void => {
  if (isDebugActive()) {
    console.log(message, ...args);
  }
};

export const debugWarn = (message: string, ...args: unknown[]): void => {
  if (isDebugActive()) {
    console.warn(message, ...args);
  }
};

export const debugError = (message: string, ...args: unknown[]): void => {
  console.error(message, ...args);
};

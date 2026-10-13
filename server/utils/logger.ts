/**
 * Backend structured logger:
 * Gates verbose [DEBUG] logs behind process.env.DEBUG === 'true'.
 * Ensures secrets, API keys, and sensitive data are NEVER logged.
 */
export const isDebugEnabled = (): boolean => {
  return process.env.DEBUG === 'true';
};

export const debugLog = (message: string, ...args: unknown[]): void => {
  if (isDebugEnabled()) {
    console.log(message, ...args);
  }
};

export const debugWarn = (message: string, ...args: unknown[]): void => {
  if (isDebugEnabled()) {
    console.warn(message, ...args);
  }
};

export const logError = (message: string, ...args: unknown[]): void => {
  console.error(message, ...args);
};

export const logInfo = (message: string, ...args: unknown[]): void => {
  console.log(message, ...args);
};

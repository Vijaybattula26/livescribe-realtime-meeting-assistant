import type { IncomingMessage } from 'http';

/**
 * Extracts the real client IP address considering proxy hops (e.g. Google Cloud Run).
 *
 * If trustProxyHops <= 0, ignores X-Forwarded-For entirely and returns direct socket IP.
 * If trustProxyHops > 0, extracts the IP from X-Forwarded-For located `trustProxyHops`
 * positions from the right (i.e. the client IP that reached the outermost trusted proxy),
 * ignoring any prepended spoofed headers.
 */
export function getClientIp(req: IncomingMessage, trustProxyHops: number): string {
  const socketAddress = req.socket.remoteAddress || '127.0.0.1';
  if (trustProxyHops <= 0) {
    return socketAddress;
  }

  const xForwardedFor = req.headers['x-forwarded-for'];
  if (!xForwardedFor) {
    return socketAddress;
  }

  const rawIps = Array.isArray(xForwardedFor) ? xForwardedFor.join(',') : xForwardedFor;
  const ips = rawIps
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);

  if (ips.length === 0) {
    return socketAddress;
  }

  // For 1 proxy hop (e.g. Google Cloud Run), the client that reached the proxy is ips[ips.length - 1].
  // If trustProxyHops is N, index is ips.length - trustProxyHops.
  const targetIndex = ips.length - trustProxyHops;
  return targetIndex >= 0 ? ips[targetIndex] : ips[0];
}

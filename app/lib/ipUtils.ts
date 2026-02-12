import { NextRequest } from 'next/server';

/**
 * Extract client IP address from request headers
 * Handles x-forwarded-for (which can contain multiple IPs) and x-real-ip
 */
export function getClientIP(req: NextRequest): string | null {
  // Check x-forwarded-for header (can contain multiple IPs separated by commas)
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Take the first IP from the list (original client IP)
    const firstIP = forwardedFor.split(',')[0].trim();
    if (firstIP && firstIP !== 'unknown') {
      return firstIP;
    }
  }

  // Check x-real-ip header
  const realIP = req.headers.get('x-real-ip');
  if (realIP && realIP !== 'unknown') {
    return realIP;
  }

  // Check cf-connecting-ip (Cloudflare)
  const cfIP = req.headers.get('cf-connecting-ip');
  if (cfIP && cfIP !== 'unknown') {
    return cfIP;
  }

  // Check x-client-ip
  const clientIP = req.headers.get('x-client-ip');
  if (clientIP && clientIP !== 'unknown') {
    return clientIP;
  }

  return null;
}

/**
 * Get user agent from request headers
 */
export function getUserAgent(req: NextRequest): string | null {
  return req.headers.get('user-agent');
}

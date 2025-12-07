import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  
  // Only handle /api/ and /policies/ paths
  if (pathname.startsWith('/api') || pathname.startsWith('/policies')) {
    // Get API URL from environment or default
    // In Docker, this should be http://backend:4000
    const apiUrl = process.env.API_URL || "http://127.0.0.1:4000";
    
    // Construct the target URL
    // The backend routes are prefixed with /api/policies, but the frontend requests might be /policies/...
    // We need to ensure we map correctly to the backend structure.
    
    // If the request is /policies/..., we map it to /api/policies/...
    let targetPath = pathname;
    if (pathname.startsWith('/policies')) {
      targetPath = '/api' + pathname;
    }
    
    const targetUrl = new URL(targetPath, apiUrl);
    targetUrl.search = request.nextUrl.search;
    
    console.log(`[Middleware] Proxying ${pathname} to ${targetUrl.toString()}`);
    
    return NextResponse.rewrite(targetUrl);
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/:path*',
    '/policies/:path*',
  ],
}

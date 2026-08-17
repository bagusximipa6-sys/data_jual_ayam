import { clerkMiddleware } from '@clerk/nextjs/server';

const clerkProxyUrl = process.env.NEXT_PUBLIC_CLERK_PROXY_URL;

function getProxyPath(proxyUrl: string) {
  if (proxyUrl.startsWith("/")) return proxyUrl;

  try {
    return new URL(proxyUrl).pathname || "/__clerk";
  } catch {
    return "/__clerk";
  }
}

export default clerkMiddleware(
  clerkProxyUrl
    ? {
        frontendApiProxy: {
          enabled: true,
          path: getProxyPath(clerkProxyUrl),
        },
      }
    : {}
);

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for Clerk's auto-proxy path
    '/__clerk/:path*',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};

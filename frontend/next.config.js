/**
 * next.config.js - Proxy API calls from the Next.js frontend to the backend server.
 * This resolves the "Failed to load resource: net::ERR_FAILED" issue caused by
 * the frontend trying to call `/api/employees` on port 3000 instead of the
 * backend (default port 5000).
 */
module.exports = {
  async rewrites() {
    return [
      {
        // Proxy any /api/* request to the backend server.
        source: '/api/:path*',
        destination: 'http://localhost:5000/api/:path*', // adjust port if your backend runs elsewhere
      },
    ];
  },
  // Optional: expose the backend URL to the client for fetch calls.
  env: {
    NEXT_PUBLIC_API_BASE_URL: 'http://localhost:5000',
  },
};

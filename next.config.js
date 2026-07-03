/** @type {import('next').NextConfig} */
const nextConfig = {
  generateBuildId: () => process.env.VERCEL_GIT_COMMIT_SHA || Date.now().toString(36),
};
module.exports = nextConfig;

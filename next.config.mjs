/** @type {import('next').NextConfig} */
const nextConfig = {
  // `node:sqlite` is a Node built-in; keeping it external stops the bundler
  // from trying to trace it into the server build.
  serverExternalPackages: ["node:sqlite"],
};

export default nextConfig;

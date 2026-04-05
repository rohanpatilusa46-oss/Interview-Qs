/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/projects/interview',
        destination: 'https://interviewqs-seven.vercel.app',
        permanent: true,
      },
      {
        source: '/projects/interview/:path*',
        destination: 'https://interviewqs-seven.vercel.app/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

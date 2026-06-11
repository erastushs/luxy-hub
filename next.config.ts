import type { NextConfig } from "next";
import { MAX_SCRIPT_REQUEST_BODY_BYTES } from "./app/lib/constants/size-limits";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      bodySizeLimit: MAX_SCRIPT_REQUEST_BODY_BYTES,
    },
    proxyClientMaxBodySize: MAX_SCRIPT_REQUEST_BODY_BYTES,
  },
};

export default nextConfig;

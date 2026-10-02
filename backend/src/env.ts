import dotenv from "dotenv";

if (process.env.NODE_ENV !== "test") {
  dotenv.config({ path: new URL("../.env", import.meta.url), quiet: true });
}

const DEVELOPMENT_SECRET = "elysian-development-secret-change-me";

export function readEnv(source: NodeJS.ProcessEnv = process.env) {
  const read = (name: string, fallback = "") => source[name]?.trim() || fallback;
  const config = {
    port: Number(read("PORT", "4000")),
    mongoUri: read("MONGODB_URI", "mongodb://127.0.0.1:27017/elysian"),
    jwtSecret: read("JWT_SECRET", DEVELOPMENT_SECRET),
    jwtExpiresIn: read("JWT_EXPIRES_IN", "7d"),
    clientOrigin: read("CLIENT_ORIGIN", "http://localhost:5173"),
    razorpayKeyId: read("RAZORPAY_KEY_ID"),
    razorpayKeySecret: read("RAZORPAY_KEY_SECRET"),
    razorpayWebhookSecret: read("RAZORPAY_WEBHOOK_SECRET"),
  };
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  if (source.NODE_ENV === "production" && (config.jwtSecret === DEVELOPMENT_SECRET || config.jwtSecret.length < 32)) {
    throw new Error("JWT_SECRET must be a private secret of at least 32 characters in production.");
  }
  if (config.razorpayKeyId && !config.razorpayKeyId.startsWith("rzp_test_")) {
    throw new Error("Only Razorpay sandbox test keys are allowed.");
  }
  if (Boolean(config.razorpayKeyId) !== Boolean(config.razorpayKeySecret)) {
    throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be configured together.");
  }
  return config;
}

export const env = readEnv();

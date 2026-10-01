import dotenv from "dotenv";

dotenv.config({ path: new URL("../.env", import.meta.url), quiet: true });

function read(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

const DEVELOPMENT_SECRET = "elysian-development-secret-change-me";

export const env = {
  port: Number(read("PORT", "4000")),
  mongoUri: read("MONGODB_URI", "mongodb://127.0.0.1:27017/elysian"),
  jwtSecret: read("JWT_SECRET", DEVELOPMENT_SECRET),
  jwtExpiresIn: read("JWT_EXPIRES_IN", "7d"),
  clientOrigin: read("CLIENT_ORIGIN", "http://localhost:5173"),
};

if (env.jwtSecret === DEVELOPMENT_SECRET) {
  console.warn(
    "[env] JWT_SECRET is unset - using the insecure development default. Set it in backend/.env before deploying.",
  );
}

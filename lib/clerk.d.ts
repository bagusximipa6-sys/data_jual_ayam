import type { UserPublicMetadata } from "@clerk/nextjs/server";

declare global {
  interface CustomPublicMetadata extends UserPublicMetadata {
    role?: "admin" | "staf" | "user";
  }
}
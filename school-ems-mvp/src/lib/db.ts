import mongoose from "mongoose";
import { env } from "@/lib/env";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  interface GlobalThis {
    __mongooseCache__?: MongooseCache;
  }
}

const globalCache = globalThis as typeof globalThis & {
  __mongooseCache__?: MongooseCache;
};

const cache: MongooseCache = globalCache.__mongooseCache__ ?? {
  conn: null,
  promise: null,
};

globalCache.__mongooseCache__ = cache;

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cache.conn) {
    return cache.conn;
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(env.MONGODB_URI, {
      dbName: "school-ems-mvp",
      maxPoolSize: 10,
    });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}

import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

type ApiError = Error & {
  statusCode?: number;
  code?: string;
};

export function jsonSuccess(data: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json({ success: true, ...data }, { status });
}

export function parseObjectId(id: string, field = "id"): mongoose.Types.ObjectId {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw Object.assign(new Error(`${field} is invalid`), {
      statusCode: 404,
      code: "NOT_FOUND",
    });
  }

  return new mongoose.Types.ObjectId(id);
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: error.issues[0]?.message ?? "Validation failed",
        code: "VALIDATION_ERROR",
      },
      { status: 400 },
    );
  }

  if (error instanceof mongoose.Error.CastError) {
    return NextResponse.json(
      {
        success: false,
        error: "Resource not found",
        code: "NOT_FOUND",
      },
      { status: 404 },
    );
  }

  if (error instanceof Error) {
    console.error("API error:", error);
    const typed = error as ApiError;
    const statusCode = typed.statusCode ?? 500;
    const code =
      typed.code ??
      (statusCode === 404 ? "NOT_FOUND" : statusCode === 403 ? "FORBIDDEN" : "INTERNAL_ERROR");

    return NextResponse.json(
      {
        success: false,
        error: statusCode === 500 ? "Internal server error" : typed.message,
        code,
      },
      { status: statusCode },
    );
  }

  console.error("Unknown API error:", error);

  return NextResponse.json(
    {
      success: false,
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    },
    { status: 500 },
  );
}

export async function withApiHandler(handler: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await handler();
  } catch (error) {
    return handleApiError(error);
  }
}

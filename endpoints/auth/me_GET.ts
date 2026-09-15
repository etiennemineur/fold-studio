import { OutputType } from "./me_GET.schema";
import { db } from "../../helpers/db";
import { jwtVerify } from "jose";

export async function handle(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie");
    const tokenMatch = cookieHeader?.match(/(?:^|;\s*)auth_token=([^;]*)/);
    const token = tokenMatch ? tokenMatch[1] : null;

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Not authenticated" }),
        { status: 401 }
      );
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured");
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    
    // Verify JWT
    const { payload } = await jwtVerify<{ userId: number }>(token, secret);

    // Fetch user from DB to ensure they still exist and are active
    const user = await db
      .selectFrom("users")
      .select(["id", "email", "displayName", "role", "isActive"])
      .where("id", "=", payload.userId)
      .executeTakeFirst();

    if (!user || !user.isActive) {
      return new Response(
        JSON.stringify({ error: "User not found or inactive" }),
        { status: 401 }
      );
    }

    const responsePayload: OutputType = {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
      },
    };

    return new Response(JSON.stringify(responsePayload), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    // Treat any JWT verify error or internal error as unauthenticated in this context
    return new Response(
      JSON.stringify({ error: "Not authenticated" }),
      { status: 401 }
    );
  }
}
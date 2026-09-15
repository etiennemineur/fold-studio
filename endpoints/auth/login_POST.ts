import { schema, OutputType } from "./login_POST.schema";
import { db } from "../../helpers/db";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";

export async function handle(request: Request) {
  try {
    const json = JSON.parse(await request.text());
    const result = schema.parse(json);

    // 1. Look up user by email
    const user = await db
      .selectFrom("users")
      .selectAll()
      .where("email", "=", result.email)
      .where("isActive", "=", true)
      .executeTakeFirst();

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Invalid email or password" }),
        { status: 401 }
      );
    }

    // 2. Fetch user's password hash
    const userPassword = await db
      .selectFrom("userPasswords")
      .selectAll()
      .where("userId", "=", user.id)
      .executeTakeFirst();

    if (!userPassword) {
      return new Response(
        JSON.stringify({ error: "Invalid email or password" }),
        { status: 401 }
      );
    }

    // 3. Verify password
    const isPasswordValid = await bcrypt.compare(
      result.password,
      userPassword.passwordHash
    );

    if (!isPasswordValid) {
      // Record failed attempt could be done here, but omitting for brevity unless required
      return new Response(
        JSON.stringify({ error: "Invalid email or password" }),
        { status: 401 }
      );
    }

    // 4. Create JWT Token
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not configured");
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const token = await new SignJWT({
      userId: user.id,
      email: user.email,
      role: user.role,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(secret);

    // 5. Construct cookie header
    // Max-Age 7 days = 7 * 24 * 60 * 60 = 604800 seconds
    const cookieHeader = `auth_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`;

    const responsePayload: OutputType = {
      success: true,
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
        "Set-Cookie": cookieHeader,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Error";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
    });
  }
}
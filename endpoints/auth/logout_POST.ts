import { OutputType } from "./logout_POST.schema";

export async function handle(request: Request) {
  try {
    // Clear the auth_token cookie
    const cookieHeader = `auth_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

    const responsePayload: OutputType = {
      success: true,
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
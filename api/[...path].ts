import type { VercelRequest, VercelResponse } from "@vercel/node";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, asc, desc, eq, gt } from "drizzle-orm";
import OpenAI from "openai";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import {
  conversations,
  messages,
  users,
  sessions,
  type User,
} from "../drizzle/schema.js";

const SYSTEM_PROMPT = `Eres Cochis IA, un asistente conversacional cálido, agudo e ingenioso, representado por un pastor alemán con birrete y lentes —el "perro graduado" que sabe de todo. Eres amable, directo y útil; con humor si calza el momento, pero nunca payaso. Respondes en español neutro por defecto y adoptas tonos regionales (chileno, argentino, mexicano, etc.) si la persona los usa primero. Sabes de cultura, ciencia, historia, programación, gastronomía, salud, finanzas, viajes, arte y vida cotidiana. Cuando no sepas algo, lo reconoces. Cuando te pidan opinar, das una recomendación clara con sus matices.`;

const SUGGESTED_PROMPTS = [
  {
    id: 1,
    category: "Imágenes",
    title: "Retrato de Cochis",
    prompt:
      "un retrato cinematográfico de un pastor alemán con birrete de graduación y lentes redondos, fondo desenfocado de biblioteca, iluminación cálida",
    generateImage: true,
  },
  {
    id: 2,
    category: "Imágenes",
    title: "Logo creativo",
    prompt:
      "un logo minimalista para una marca llamada Cochis IA, perro pastor alemán con birrete, estilo flat design",
    generateImage: true,
  },
  {
    id: 3,
    category: "Aprender",
    title: "Explicá un tema",
    prompt:
      "Explícame en lenguaje sencillo cómo funcionan las redes neuronales, con una analogía cotidiana.",
  },
  {
    id: 4,
    category: "Aprender",
    title: "Idiomas",
    prompt:
      "Enséñame 10 frases prácticas en inglés para una entrevista de trabajo, con su pronunciación aproximada.",
  },
  {
    id: 5,
    category: "Productividad",
    title: "Resumir un texto",
    prompt:
      "Te voy a pegar un texto largo y necesito un resumen claro en 5 puntos. Avísame cuándo estés listo.",
  },
  {
    id: 6,
    category: "Productividad",
    title: "Plan semanal",
    prompt:
      "Ayúdame a armar un plan semanal realista con objetivos de trabajo, ejercicio y descanso.",
  },
  {
    id: 7,
    category: "Programación",
    title: "Revisá código",
    prompt:
      "Te paso un fragmento de código. Necesito que lo expliques línea por línea y sugieras mejoras.",
  },
  {
    id: 8,
    category: "Programación",
    title: "Resolvé un bug",
    prompt:
      "Tengo un error en mi código. Te lo paso con el mensaje de error y me ayudas a entenderlo y arreglarlo.",
  },
  {
    id: 9,
    category: "Cocina",
    title: "Receta rápida",
    prompt:
      "Dame 3 recetas rápidas, ricas y económicas con ingredientes de heladera básica.",
  },
  {
    id: 10,
    category: "Viajes",
    title: "Plan de viaje",
    prompt:
      "Arma un itinerario de 5 días por un destino que me recomendarías visitar este año, con tips prácticos.",
  },
  {
    id: 11,
    category: "Negocios",
    title: "Idea de negocio",
    prompt:
      "Sugiéreme 5 ideas de negocio digital con baja inversión inicial para alguien con habilidades de diseño.",
  },
  {
    id: 12,
    category: "Bienestar",
    title: "Manejo del estrés",
    prompt:
      "Dame técnicas prácticas y respaldadas por evidencia para manejar el estrés en momentos de mucho trabajo.",
  },
];

const SESSION_COOKIE = "cochis_session";
const SESSION_DAYS = 60;

function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not configured");
  const sql = neon(url);
  return drizzle(sql);
}

function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
  return new OpenAI({ apiKey });
}

function sendJson(res: VercelResponse, body: unknown, status = 200) {
  res.status(status).json(body);
}

function sendErr(res: VercelResponse, message: string, status = 500) {
  sendJson(res, { error: message }, status);
}

function parseId(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return false;
    const derived = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, "hex");
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function readCookie(req: VercelRequest, name: string): string | undefined {
  return req.cookies?.[name];
}

function setSessionCookie(token: string): string {
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  return `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure`;
}

function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Secure`;
}

async function userFromToken(
  db: ReturnType<typeof getDb>,
  token: string,
): Promise<User | null> {
  const now = new Date();
  const [row] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, now)))
    .limit(1);
  if (!row) return null;
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, row.userId))
    .limit(1);
  return user ?? null;
}

async function createSession(
  db: ReturnType<typeof getDb>,
  userId: number,
): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ token, userId, expiresAt });
  return token;
}

function publicUser(u: User) {
  return { id: u.id, email: u.email, displayName: u.displayName };
}

function sseWrite(res: VercelResponse, data: unknown) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const rawPath = (req.url ?? "/").split("?")[0];
  const path = rawPath.replace(/^\/api/, "");
  const method = (req.method ?? "GET").toUpperCase();

  try {
    if (path === "/suggested-prompts" && method === "GET") {
      return sendJson(res, SUGGESTED_PROMPTS);
    }

    const db = getDb();

    // ---- AUTH ----
    if (path === "/auth/register" && method === "POST") {
      const body = req.body ?? {};
      const email =
        typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const password =
        typeof body.password === "string" ? body.password : "";
      const displayName =
        typeof body.displayName === "string"
          ? body.displayName.trim().slice(0, 80)
          : "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return sendErr(res, "Email inválido", 400);
      }
      if (password.length < 6) {
        return sendErr(res, "La contraseña debe tener al menos 6 caracteres", 400);
      }
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (existing) return sendErr(res, "Ese email ya está registrado", 409);
      const [created] = await db
        .insert(users)
        .values({
          email,
          passwordHash: hashPassword(password),
          displayName: displayName || null,
        })
        .returning();
      const token = await createSession(db, created.id);
      res.setHeader("Set-Cookie", setSessionCookie(token));
      return sendJson(res, publicUser(created), 201);
    }

    if (path === "/auth/login" && method === "POST") {
      const body = req.body ?? {};
      const email =
        typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const password =
        typeof body.password === "string" ? body.password : "";
      if (!email || !password) return sendErr(res, "Faltan credenciales", 400);
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        return sendErr(res, "Email o contraseña incorrectos", 401);
      }
      const token = await createSession(db, user.id);
      res.setHeader("Set-Cookie", setSessionCookie(token));
      return sendJson(res, publicUser(user));
    }

    if (path === "/auth/logout" && method === "POST") {
      const token = readCookie(req, SESSION_COOKIE);
      if (token) {
        await db.delete(sessions).where(eq(sessions.token, token));
      }
      res.setHeader("Set-Cookie", clearSessionCookie());
      return res.status(204).end();
    }

    if (path === "/auth/me" && method === "GET") {
      const token = readCookie(req, SESSION_COOKIE);
      if (!token) return sendErr(res, "No autorizado", 401);
      const user = await userFromToken(db, token);
      if (!user) return sendErr(res, "No autorizado", 401);
      return sendJson(res, publicUser(user));
    }

    // ---- PROTECTED ROUTES ----
    const token = readCookie(req, SESSION_COOKIE);
    const currentUser = token ? await userFromToken(db, token) : null;
    if (!currentUser) return sendErr(res, "No autorizado", 401);

    if (path === "/conversations" && method === "GET") {
      const rows = await db
        .select()
        .from(conversations)
        .where(eq(conversations.userId, currentUser.id))
        .orderBy(desc(conversations.createdAt));
      return sendJson(res, rows);
    }

    if (path === "/conversations" && method === "POST") {
      const body = req.body ?? {};
      const title =
        typeof body.title === "string" && body.title.trim().length > 0
          ? body.title.trim()
          : "Nueva conversación";
      const [row] = await db
        .insert(conversations)
        .values({ title, userId: currentUser.id })
        .returning();
      return sendJson(res, row, 201);
    }

    const convoMatch = path.match(/^\/conversations\/(\d+)(\/messages)?$/);
    if (convoMatch) {
      const id = parseId(convoMatch[1]);
      const isMessages = convoMatch[2] === "/messages";
      if (id === null) return sendErr(res, "ID inválido", 400);

      const [convo] = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, id),
            eq(conversations.userId, currentUser.id),
          ),
        )
        .limit(1);
      if (!convo) return sendErr(res, "Conversación no encontrada", 404);

      if (!isMessages && method === "GET") {
        const msgs = await db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, id))
          .orderBy(asc(messages.createdAt));
        return sendJson(res, { ...convo, messages: msgs });
      }

      if (!isMessages && method === "DELETE") {
        await db.delete(conversations).where(eq(conversations.id, id));
        return res.status(204).end();
      }

      if (isMessages && method === "GET") {
        const msgs = await db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, id))
          .orderBy(asc(messages.createdAt));
        return sendJson(res, msgs);
      }

      if (isMessages && method === "POST") {
        const body = req.body ?? {};
        const content =
          typeof body.content === "string" ? body.content.trim() : "";
        const generateImage = body.generateImage === true;
        const imageData =
          typeof body.imageData === "string" ? body.imageData : null;

        if (!content) return sendErr(res, "El mensaje no puede estar vacío", 400);

        const userMsgContent = imageData
          ? `[imagen adjunta] ${content}`
          : content;
        await db.insert(messages).values({
          conversationId: id,
          role: "user",
          content: userMsgContent,
        });

        const openai = getOpenAI();

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("X-Accel-Buffering", "no");
        res.setHeader("Connection", "keep-alive");
        res.status(200);

        // ----- IMAGE GENERATION -----
        if (generateImage) {
          try {
            sseWrite(res, { status: "Generando imagen..." });
            const result = await openai.images.generate({
              model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
              prompt: content,
              size: "1024x1024",
              n: 1,
            });
            const b64 = result.data?.[0]?.b64_json;
            if (!b64) throw new Error("Sin imagen en la respuesta");
            const dataUrl = `data:image/png;base64,${b64}`;
            const markdown = `Aquí tienes tu imagen:\n\n![${content.replace(/[\[\]]/g, "").slice(0, 100)}](${dataUrl})`;
            await db.insert(messages).values({
              conversationId: id,
              role: "assistant",
              content: markdown,
              imageUrl: dataUrl,
            });
            sseWrite(res, { content: markdown });

            if (
              convo.title === "Nueva conversación" ||
              convo.title.trim() === ""
            ) {
              const newTitle = `🎨 ${content.slice(0, 50)}`;
              await db
                .update(conversations)
                .set({ title: newTitle })
                .where(eq(conversations.id, id));
            }
          } catch (e) {
            console.error("Image generation failed:", e);
            const errorMsg =
              "No pude generar la imagen. Intenta con otra descripción.";
            await db.insert(messages).values({
              conversationId: id,
              role: "assistant",
              content: errorMsg,
            });
            sseWrite(res, { content: errorMsg });
          }
          sseWrite(res, { done: true });
          return res.end();
        }

        // ----- VISION (image attached) -----
        const history = await db
          .select()
          .from(messages)
          .where(eq(messages.conversationId, id))
          .orderBy(asc(messages.createdAt));

        type ChatMsg =
          | { role: "system" | "assistant"; content: string }
          | {
              role: "user";
              content:
                | string
                | Array<
                    | { type: "text"; text: string }
                    | {
                        type: "image_url";
                        image_url: { url: string; detail: "auto" };
                      }
                  >;
            };

        const chatMessages: ChatMsg[] = [
          { role: "system", content: SYSTEM_PROMPT },
        ];

        for (const m of history) {
          if (m.role === "assistant") {
            chatMessages.push({ role: "assistant", content: m.content });
          } else {
            chatMessages.push({ role: "user", content: m.content });
          }
        }

        if (imageData && chatMessages.length > 0) {
          const last = chatMessages[chatMessages.length - 1];
          if (last.role === "user" && typeof last.content === "string") {
            const textContent = last.content
              .replace(/^\[imagen adjunta\]\s*/, "")
              .trim();
            chatMessages[chatMessages.length - 1] = {
              role: "user",
              content: [
                { type: "text", text: textContent || "Describí esta imagen." },
                {
                  type: "image_url",
                  image_url: { url: imageData, detail: "auto" },
                },
              ],
            };
          }
        }

        const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
        let full = "";
        try {
          const completion = await openai.chat.completions.create({
            model,
            messages: chatMessages as Parameters<
              typeof openai.chat.completions.create
            >[0]["messages"],
            stream: true,
            max_tokens: 4096,
          });
          for await (const chunk of completion) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) {
              full += delta;
              sseWrite(res, { content: delta });
            }
          }
        } catch (e) {
          console.error("OpenAI stream error:", e);
          sseWrite(res, {
            error: "No se pudo generar la respuesta. Intenta de nuevo.",
          });
        }

        try {
          if (full.trim().length > 0) {
            await db.insert(messages).values({
              conversationId: id,
              role: "assistant",
              content: full,
            });
            if (
              convo.title === "Nueva conversación" ||
              convo.title.trim() === ""
            ) {
              const newTitle = content
                .slice(0, 60)
                .replace(/\s+/g, " ")
                .trim();
              if (newTitle.length > 0) {
                await db
                  .update(conversations)
                  .set({ title: newTitle })
                  .where(eq(conversations.id, id));
              }
            }
          }
        } catch (e) {
          console.error("Failed to persist assistant message:", e);
        }

        sseWrite(res, { done: true });
        return res.end();
      }
    }

    return sendErr(res, "Ruta no encontrada", 404);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error interno";
    console.error("API error:", e);
    if (!res.headersSent) {
      return sendErr(res, msg, 500);
    }
    return res.end();
  }
}

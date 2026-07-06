// Cria ticket em GLPI e/ou Jira (o que estiver configurado via secrets).
// Retorna { ticket_ref } no formato "GLPI#123" ou "JIRA-KEY-456".
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Body = { title: string; description: string; priority?: "low" | "medium" | "high" | "critical" };

async function createGlpi(title: string, description: string): Promise<string | null> {
  const url = Deno.env.get("GLPI_URL");
  const appToken = Deno.env.get("GLPI_APP_TOKEN");
  const userToken = Deno.env.get("GLPI_USER_TOKEN");
  if (!url || !appToken || !userToken) return null;
  try {
    // 1) initSession
    const init = await fetch(`${url}/apirest.php/initSession`, {
      headers: { "App-Token": appToken, "Authorization": `user_token ${userToken}` },
    });
    if (!init.ok) return null;
    const { session_token } = await init.json();
    // 2) create Ticket
    const tk = await fetch(`${url}/apirest.php/Ticket`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "App-Token": appToken,
        "Session-Token": session_token,
      },
      body: JSON.stringify({ input: { name: title, content: description, urgency: 4, impact: 4 } }),
    });
    const created = await tk.json();
    // 3) killSession
    await fetch(`${url}/apirest.php/killSession`, {
      headers: { "App-Token": appToken, "Session-Token": session_token },
    });
    const id = Array.isArray(created) ? created[0]?.id : created?.id;
    return id ? `GLPI#${id}` : null;
  } catch (e) { console.error("glpi", e); return null; }
}

async function createJira(title: string, description: string): Promise<string | null> {
  const url = Deno.env.get("JIRA_URL");
  const email = Deno.env.get("JIRA_EMAIL");
  const token = Deno.env.get("JIRA_API_TOKEN");
  const project = Deno.env.get("JIRA_PROJECT_KEY");
  if (!url || !email || !token || !project) return null;
  const auth = btoa(`${email}:${token}`);
  try {
    const r = await fetch(`${url}/rest/api/3/issue`, {
      method: "POST",
      headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: {
          project: { key: project },
          summary: title,
          issuetype: { name: "Task" },
          description: {
            type: "doc", version: 1,
            content: [{ type: "paragraph", content: [{ type: "text", text: description }] }],
          },
        },
      }),
    });
    if (!r.ok) { console.error("jira", await r.text()); return null; }
    const j = await r.json();
    return j.key ? `JIRA-${j.key}` : null;
  } catch (e) { console.error("jira", e); return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const body = await req.json() as Body;
  if (!body?.title || !body?.description) {
    return new Response(JSON.stringify({ error: "title and description required" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const [glpi, jira] = await Promise.all([
    createGlpi(body.title, body.description),
    createJira(body.title, body.description),
  ]);
  const ref = glpi ?? jira;
  return new Response(JSON.stringify({ ok: !!ref, ticket_ref: ref, glpi, jira }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});

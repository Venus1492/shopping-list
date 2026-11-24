const PROMPT = `This is a photo of a handwritten shopping list. Read every item.
Return ONLY a JSON array, with no other text. Each element must look like:
{"name": string, "quantity": number or null, "unit": string or null}
Keep item names in the language they were written in.
If a word is unclear, give your best reading.`

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("POST only", { status: 405 })
  }

  const { image, mediaType } = await req.json()
  if (!image) return Response.json({ error: "No image" }, { status: 400 })

  const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": Netlify.env.get("ANTHROPIC_API_KEY"),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-5-5",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: image } },
          { type: "text", text: PROMPT },
        ],
      }],
    }),
  })

  if (!apiRes.ok) {
    return Response.json({ error: "AI request failed", status: apiRes.status }, { status: 502 })
  }

  const data = await apiRes.json()
  const text = data.content[0].text
  const clean = text.replace(/```json|```/g, "").trim()
  try {
    return Response.json({ items: JSON.parse(clean) })
  } catch {
    return Response.json({ error: "Could not parse the reply", raw: text }, { status: 502 })
  }
}
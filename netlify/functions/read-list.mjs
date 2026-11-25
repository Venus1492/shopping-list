const PROMPT = `This is a photo of a handwritten shopping list. Read every item.
Return ONLY a JSON array, with no other text. Each element must look like:
{"name": string, "quantity": number or null, "unit": string or null}
Keep item names in the language they were written in.
If a word is unclear, give your best reading.`

export default async (req) => {
  if (req.method !== "POST") {
    return new Response("POST only", { status: 405 })
  }

  const password = Netlify.env.get("APP_PASSWORD")
  if (!password || req.headers.get("x-app-password") !== password) {
    return Response.json({ error: "Wrong or missing password" }, { status: 401 })
  }

  const { image, mediaType } = await req.json()
  if (!image) return Response.json({ error: "No image" }, { status: 400 })

  if (image.length > 3_000_000) {
    return Response.json({ error: "Image too large" }, { status: 413 })
  }

  const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": Netlify.env.get("ANTHROPIC_API_KEY"),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-5-5",
      max_tokens: 4000,
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

  // Find the text part of the reply instead of assuming it comes first
  const block = data.content?.find((b) => b.type === "text")
  if (!block) {
    return Response.json({ error: "No text in reply", stop_reason: data.stop_reason, raw: data }, { status: 502 })
  }

  const text = block.text
  const clean = text.replace(/```json|```/g, "").trim()
  try {
    return Response.json({ items: JSON.parse(clean) })
  } catch {
    return Response.json({ error: "Could not parse the reply", raw: text }, { status: 502 })
  }
}
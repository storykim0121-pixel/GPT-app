// Vercel 서버리스 함수: 브라우저 대신 서버에서 Anthropic(Claude)을 호출한다.
// API 키는 Vercel 환경변수(ANTHROPIC_API_KEY)에 저장되어 브라우저에 절대 노출되지 않는다.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST만 허용됩니다." });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "서버에 Claude API 키가 설정되지 않았습니다." });
  }

  try {
    const { messages, model } = req.body;

    // 허용된 모델만 쓰도록 검증. 지정 안 하거나 목록에 없으면 저렴한 기본값(Haiku)으로.
    const ALLOWED_MODELS = ["claude-haiku-4-5-20251001", "claude-sonnet-5"];
    const selectedModel = ALLOWED_MODELS.includes(model) ? model : "claude-haiku-4-5-20251001";

    // OpenAI 형식(messages 배열에 system 포함)을 Claude 형식(system 별도 + messages)으로 변환.
    // 이미지도 Claude 방식(base64 + media_type)으로 변환해야 한다.
    let system = "";
    const claudeMessages = [];
    for (const m of messages) {
      if (m.role === "system") {
        system = typeof m.content === "string" ? m.content : "";
        continue;
      }
      if (typeof m.content === "string") {
        claudeMessages.push({ role: m.role, content: m.content });
      } else if (Array.isArray(m.content)) {
        const parts = [];
        for (const p of m.content) {
          if (p.type === "text") {
            parts.push({ type: "text", text: p.text });
          } else if (p.type === "image_url") {
            // data:image/jpeg;base64,XXXXX 형태에서 media_type과 base64 데이터를 분리
            const match = /^data:(image\/[a-zA-Z]+);base64,(.+)$/.exec(p.image_url.url);
            if (match) {
              parts.push({
                type: "image",
                source: { type: "base64", media_type: match[1], data: match[2] },
              });
            }
          }
        }
        claudeMessages.push({ role: m.role, content: parts });
      }
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: selectedModel,
        max_tokens: 1500,
        system: system,
        messages: claudeMessages,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: JSON.stringify(data) });
    }

    // content 배열에서 텍스트 블록만 모은다 (web_search_tool_result 등 다른 블록은 건너뜀)
    let text = "";
    let usedSearch = false;
    for (const block of data.content || []) {
      if (block.type === "text") text += block.text;
      if (block.type === "server_tool_use" && block.name === "web_search") usedSearch = true;
    }

    res.status(200).json({ text, usedSearch });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}

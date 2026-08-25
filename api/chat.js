// Vercel 서버리스 함수: 브라우저 대신 서버에서 OpenAI를 호출한다.
// API 키는 Vercel 환경변수(OPENAI_API_KEY)에 저장되어 브라우저에 절대 노출되지 않는다.
// Responses API + web_search 도구를 써서, 최신 정보가 필요하면 모델이 알아서 검색한다.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST만 허용됩니다." });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "서버에 API 키가 설정되지 않았습니다." });
  }

  try {
    const { messages } = req.body;

    // chat/completions 형식(messages)을 Responses API 형식(input)으로 변환.
    // system 메시지는 instructions로, 나머지는 input 배열로 넘긴다.
    let instructions = "";
    const input = [];
    for (const m of messages) {
      if (m.role === "system") {
        instructions = typeof m.content === "string" ? m.content : "";
        continue;
      }
      if (typeof m.content === "string") {
        input.push({ role: m.role, content: m.content });
      } else if (Array.isArray(m.content)) {
        // 이미지 포함 메시지: text와 image_url을 Responses 형식으로 변환
        const parts = [];
        for (const p of m.content) {
          if (p.type === "text") {
            parts.push({ type: "input_text", text: p.text });
          } else if (p.type === "image_url") {
            parts.push({ type: "input_image", image_url: p.image_url.url });
          }
        }
        input.push({ role: m.role, content: parts });
      }
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5.6-luna",
        instructions: instructions,
        input: input,
        tools: [{ type: "web_search" }], // 모델이 필요하다고 판단하면 자동으로 웹 검색
        stream: true,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: errText });
    }

    // 스트리밍 응답을 그대로 브라우저로 흘려보낸다
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value));
    }
    res.end();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}

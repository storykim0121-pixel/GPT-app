// Vercel 서버리스 함수: 브라우저 대신 서버에서 Perplexity를 호출한다.
// API 키는 Vercel 환경변수(PERPLEXITY_API_KEY)에 저장되어 브라우저에 절대 노출되지 않는다.
// Perplexity의 Sonar 모델은 항상 웹 검색이 자동으로 포함된다 (별도 설정 불필요).

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST만 허용됩니다." });
  }

  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "서버에 Perplexity API 키가 설정되지 않았습니다." });
  }

  try {
    const { messages, model } = req.body;

    // 허용된 모델만 쓰도록 검증. 지정 안 하거나 목록에 없으면 저렴한 기본값(sonar)으로.
    const ALLOWED_MODELS = ["sonar", "sonar-pro"];
    const selectedModel = ALLOWED_MODELS.includes(model) ? model : "sonar";

    // Perplexity는 이미지 입력(image_url)을 지원하지 않으므로,
    // 이미지가 포함된 메시지는 텍스트 부분만 뽑아서 보낸다.
    const ppxMessages = messages.map((m) => {
      if (typeof m.content === "string") return m;
      if (Array.isArray(m.content)) {
        const textPart = m.content.find((p) => p.type === "text");
        return { role: m.role, content: textPart ? textPart.text : "" };
      }
      return m;
    });

    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: ppxMessages,
        temperature: 0.3,
        return_related_questions: true, // 공식 앱처럼 후속 질문 추천을 받아온다
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: JSON.stringify(data) });
    }

    let text = data.choices?.[0]?.message?.content || "";

    // Perplexity는 답변 본문과 별도로 citations(출처 URL 목록)를 함께 준다.
    // 본문의 [1][2] 같은 번호가 실제로 뭘 가리키는지 알 수 있도록, 답변 아래에 출처 목록을 붙인다.
    const citations = Array.isArray(data.citations) ? data.citations : [];
    if (citations.length) {
      const sourceLines = citations
        .map((url, i) => {
          let domain = url;
          try { domain = new URL(url).hostname.replace(/^www\./, ""); } catch (_) {}
          return `${i + 1}. [${domain}](${url})`;
        })
        .join("\n");
      text += `\n\n### 참고한 사이트\n${sourceLines}`;
    }

    const relatedQuestions = Array.isArray(data.related_questions) ? data.related_questions : [];

    res.status(200).json({ text, relatedQuestions });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}

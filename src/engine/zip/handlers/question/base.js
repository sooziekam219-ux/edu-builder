function injectHeaderImage({ doc, manifest, data }) {
  const selector = manifest?.headerImg || "header h1 img.lang-image";
  const img = doc.querySelector(selector);
  if (!img) return;

  // [추가] 타이틀 분석을 통한 동적 헤더/제목 매칭
  const fullText = (data?.title || "") + (data?.mainQuestion || "");
  const match = fullText.match(/문제\s*(\d+)/);
  let hasDynamicMatch = false;

  if (match) {
    const num = match[1];
    const titText = `문제 ${num}`;
    hasDynamicMatch = true;

    // 동적 매칭 성공 시 기본적으로 설정 (manifest 기본값보다 우선하도록 하단 로직 변경)
    img.setAttribute("src", `images/tit-question${num}.png`);
    img.setAttribute("alt", titText);

    // 2. 문서 <title> 태그 변경
    if (doc.title !== undefined) {
      doc.title = titText;
    } else {
      const titleEl = doc.querySelector('title');
      if (titleEl) titleEl.textContent = titText;
    }
  }

  // 우선순위: data.header.src (개별 설정) > 동적 매칭 이미지 > manifest.headerSrc (템플릿 기본값)
  const explicitSrc = data?.header?.src;
  if (explicitSrc) {
    img.setAttribute("src", explicitSrc);
  } else if (!hasDynamicMatch) {
    const templateSrc = manifest?.headerSrc;
    if (templateSrc) img.setAttribute("src", templateSrc);
  }

  const explicitAlt = data?.header?.alt;
  if (explicitAlt) {
    img.setAttribute("alt", explicitAlt);
  } else if (!hasDynamicMatch) {
    const templateAlt = manifest?.headerAlt;
    if (templateAlt) img.setAttribute("alt", templateAlt);
  }
}

export function injectQuestionBase({ doc, data, manifest }) {
  injectHeaderImage({ doc, manifest, data });

  // guideText 먼저 별도 주입
  if (manifest?.guideText && data?.guideText) {
    const guideEl = doc.querySelector(manifest.guideText);
    if (guideEl) guideEl.innerHTML = data.guideText;
  }

  // mainQuestion은 <p> 안에 stxt가 같이 있는 경우가 많아서 stxt를 보존
  if (manifest?.mainQuestion && data?.mainQuestion) {
    const p = doc.querySelector(manifest.mainQuestion);
    if (p) {
      const stxt = p.querySelector(".stxt");
      p.innerHTML = "";
      p.appendChild(doc.createTextNode(data.mainQuestion));
      if (stxt) {
        // [FIX] stxt should be a sibling of p, not a child
        p.parentNode.insertBefore(stxt, p.nextSibling);
      }
    }
  }
}

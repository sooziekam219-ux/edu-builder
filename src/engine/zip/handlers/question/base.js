function injectHeaderImage({ doc, manifest, data }) {
  const selector = manifest?.headerImg || "header h1 img.lang-image";
  const img = doc.querySelector(selector);
  if (!img) return;

  const nextSrc = manifest?.headerSrc || data?.header?.src;
  if (nextSrc) img.setAttribute("src", nextSrc);

  const nextAlt = manifest?.headerAlt || data?.header?.alt;
  if (nextAlt) img.setAttribute("alt", nextAlt);
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
      if (stxt) p.appendChild(stxt);
    }
  }
}

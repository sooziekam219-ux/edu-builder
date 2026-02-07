export async function loadManifest({ zip, meta }) {
  // 1️⃣ ZIP 안에 manifest.json 있으면 우선 사용
  if (zip?.file("manifest.json")) {
    const text = await zip.file("manifest.json").async("string");
    return JSON.parse(text);
  }

  // 2️⃣ 없으면 Firestore 메타 사용
  if (meta?.manifest) {
    return meta.manifest;
  }

  // 3️⃣ 아무것도 없으면 에러
  throw new Error("No manifest found for template");
}

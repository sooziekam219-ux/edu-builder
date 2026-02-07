// manifest.js

const DEFAULT_MANIFEST_BY_TYPEKEY = {
  "together.select": {
    // together/base.js가 쓰는 셀렉터들
    headerImg: "header h1 img.lang-image",
    guideText: "main > span.stxt",

    // 필요하면 헤더 src/alt도 data.header로 주는 걸 우선으로 두면 됨
    // headerSrc/headerAlt는 base.js가 manifest값 우선이라, 기본값에서는 굳이 안 넣어도 OK
  },

  "question.mathinput": {
    headerImg: "header h1 img.lang-image",
    guideText: "main > span.stxt",
    // question/base.js에서 쓰는 것들(있다면)
  },
};

export async function loadManifest({ zip, meta }) {
  // 1) ZIP 안에 manifest.json
  if (zip?.file("manifest.json")) {
    const text = await zip.file("manifest.json").async("string");
    return JSON.parse(text);
  }

  // 2) Firestore 메타 manifest
  if (meta?.manifest) {
    return meta.manifest;
  }

  // 3) typeKey별 기본값
  const typeKey = meta?.typeKey;
  if (typeKey && DEFAULT_MANIFEST_BY_TYPEKEY[typeKey]) {
    return DEFAULT_MANIFEST_BY_TYPEKEY[typeKey];
  }

  // 4) 정말 아무것도 없으면(완전 미지원 템플릿)
  // 에러 대신 최소 안전값을 줄 수도 있음(나는 이게 더 추천)
  return {
    headerImg: "header h1 img.lang-image",
    guideText: "main > span.stxt",
  };
}

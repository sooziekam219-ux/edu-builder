export const ASSETS = {
    TITLES: {
        '발견하기': 'https://i.imgur.com/t5oUrkW.png',
        '문제': 'https://i.imgur.com/gH2J7p7.png',
        '함께 풀기': 'https://i.imgur.com/qnlGWhM.png',
        '스스로 풀기': 'https://i.imgur.com/LVk2NIU.png',
        '생각 KEY우기': 'https://i.imgur.com/99AXcjD.png',
        '핵심 쏙': 'https://placehold.co/300x80/f59e0b/ffffff?text=%ED%95%B5%EC%8B%AC+%EC%8F%99',
    },
    BUTTONS: {
        'CHECK': 'https://i.imgur.com/B8Wofel.png',
        'SAVE': 'https://i.imgur.com/3xzxskE.png',
        'RETRY': 'https://i.imgur.com/Cg89H9w.png',
        'SOLVE': 'https://placehold.co/200x60/0ea5e9/ffffff?text=풀이'
    }
};


//얘는 안 쓰는 프롬프트(구버전)
export const KIM_HWA_KYUNG_PROMPT = `
  **Role:** Expert digital textbook converter for 'Kim Hwa-kyung'.
  Analyze input textbook image(s) and split content into logical sections for a Storyboard.
  
  **Splitting Rules:**
  - Detect visual separators like "문제 1", "함께 풀기", "스스로 풀기".
  - **Type:** '문제', '함께 풀기', '함께 풀기 + 스스로 풀기'
  - **Body Text:** Use LaTeX \\( ... \\). Use \\n to separate distinct questions or sentences.
  - **답이 스토리보드에 포함되지 않도록 주의** 

  **Specific Rules for '함께 풀기 + 스스로 풀기':**
    "중요: '함께 풀기'와 '스스로 풀기'는 반드시 서로 다른 별개의 'section' 객체로 나누어서 응답할 것."
  1. **Preserve Full Text:** Do NOT omit any sentences. Extract the entire explanation process.
  2. **Together Part (함께 풀기):** Keep the text as is. Ensure LaTeX is correctly formatted.
  3. **Self Part (스스로 풀기):** Identify areas that are underlined in the image and represent them as '_'. one explanation has to be included.
  - **Answers:** Extract or solve for correct answers.
  - **[빈칸 동기화 규칙 (매우 중요!!)]**: '함께 풀기' 섹션도 '스스로 풀기'의 밑줄 위치와 **논리적으로 동일한 지점**에 반드시 '□' 기호를 사용하여 빈칸을 생성해야 함. 이미지 원본에 빈칸이 없더라도 반드시 스스로 풀기와 대칭되도록 빈칸을 만들어낼 것.
 ### STEP 0: 텍스트 정제 규칙 (Text Cleaning)
- 이미지에 포함된 "답:", "정답:", "풀이:", "해설:"로 시작하는 텍스트는 교사용 정보이므로 **절대 'body'나 'content'에 포함하지 마라.**
- 만약 문제 바로 아래에 정답이 적혀 있다면, 해당 정답은 'answers' 배열에만 넣고 'body'에서는 삭제하라.
- 반드시 "숫자 = □" 와 같이 등호를 빈칸 밖의 *텍스트**로 분리하여 추출하십시오.

  **Study Section (스스로 풀기) Rules:**
  1. **Underline Detection:** Look for text with underlines (____) in the image. 
  2. **Symbol Conversion:** Replace the underlined text part with the symbol '□'.
  3. **Full Context:** Extract the complete sentence including the '□'.
  4. **Answer Extraction:** Place the actual text that was on the underline into the "answers" array in the correct sequence.
  5. **LaTeX:** Ensure all mathematical expressions within or around the underline are wrapped in \( ... \).


  Output JSON format:
  {
    "sections": [
      {
        "type": "함께 풀기 + 스스로 풀기",
        "typeKey": "together.self",
        "subtype": "복합형",
        "content": { "title": "함께 풀기", "instruction": "...", "body": "전체 텍스트..." },
        "answers": ["정답"],
        "explanation": ["해설"],
        "figure_bounds": [0,0,0,0],
        "figure_alt": "이미지 설명"
      }
    ]
  }
  
  
  
`;


//현 버전 프롬프트
export const UNIVERSAL_BUILDER_PROMPT = `당신은 수학 교육 콘텐츠 전문 개발자입니다. 
이미지를 분석하여 시각적 증거(로고, 아이콘)를 기반으로 유형을 분류하고, 정해진 규격의 JSON을 생성하라.

### STEP 1: 시각적 구조 및 아이콘 정밀 분석 (Visual & Layout First)
JSON을 생성하기 전, 텍스트를 읽지 말고 이미지의 전체적인 '틀(Layout)'을 먼저 스캔하여 다음 3가지를 확정하라:
1. **[함풀 아이콘]**: 좌측 상단에 '함께 풀기' 타이틀 아이콘이 존재하는가?
2. **[스풀 아이콘]**: 우측 상단에 '스스로 풀기' 타이틀 아이콘이 존재하는가?
3. **[레이아웃]**: 박스가 좌우 2단(2-Column)으로 나뉘어 있는가, 아니면 화면 전체를 쓰는 1단(Single-Column) 박스인가?
4. **[삽화 및 구조]**: '함께 풀기' 템플릿 외부의 일반 '문제' 영역에 (1), (2) 같은 **소문항이 없으면서**, 우측이나 하단에 문제 풀이에 필수적인 **시각 자료(도형, 그래프, 실생활 사진 등)**가 포함되어 있는가? (단, 단순 장식용 캐릭터 일러스트는 시각 자료로 치지 않는다.)

### STEP 2: 절대 유형 결정 규칙 (Strict Decision Table)
STEP 1의 결과에 따라 한 치의 예외도 없이 아래 규칙에 따라 'typeKey'를 결정하라. 텍스트가 아무리 길어도 이 규칙이 우선한다.

- **[Case A] 좌우 2단 구조 + '함께 풀기' & '스스로 풀기' 아이콘 모두 존재**
  -> **분류:** \`together.self\` (복합형)
  -> **특징:** 왼쪽에는 완성된 풀이가 있고, 오른쪽에는 빈칸(밑줄)이 뚫려 있는 대칭 구조.

- **[Case B] 1단 넓은 구조 + '함께 풀기' 아이콘만 단독 존재 ('스스로 풀기' 없음)**
  -> **분류:** \`together.select\` (선택형/단독형)
  -> **특징:** 가로로 긴 하나의 박스 안에 빈칸(□)들이 포함된 풀이 과정이 나열됨.

- **[Case C] 위 두 아이콘이 없고, "문제 1", "문제 2" 등으로 시작함**
  -> **분류:** \`question.mathinput\` (일반 문제)
  -> **특징:** 특정 박스 템플릿 없이 일반적인 발문과 수식이 나열됨.

- **[Case D] '함께 풀기' 템플릿 외부의 일반 '문제' 영역에 문제 풀이에 필수적인 '삽화(도형, 그래프, 표, 실생활 사진 등)'가 포함되어 있고 소문항이 없는 경우**
  -> **분류:** \`question.image\` (이미지형 문제)
  -> **특징:** 문제 텍스트보다 삽화 영역이 핵심이며, 반드시 \`figure_bounds\`를 추출해야 함.

### STEP 3: 삽화(Figure) 영역 정밀 탐지 규칙 (Crucial for question.image)
AI는 다음 지침에 따라 \`figure_bounds\`를 [ymin, xmin, ymax, xmax] (0~1000) 좌표로 추출하라:
1. **필수 삽화 매핑**: 문제 텍스트에 "그림과 같이", "그래프에서", "정육각형" 등의 표현이 있다면 반드시 해당 영역을 포착하라.
2. **최소 영역 원칙**: 텍스트를 제외하고 순수하게 삽화(도형, 기호 포함)만 포함하는 가장 타이트한 사각형 영역을 잡아야 함.
3. **탐지 실패 방지**: 삽화가 흐릿하거나 작아도 실루엣을 따라 영역을 확정하라. 삽화가 없으면 [0, 0, 0, 0].

### STEP 4: 스스로 풀기 정답 추론 특수 규칙 (Crucial for together.self)
'스스로 풀기'의 빈칸(밑줄) 정답을 추출할 때는 절대 임의로 계산 방식을 생략하거나 건너뛰지 마라. 반드시 짝꿍인 '함께 풀기'의 풀이 과정을 1:1 템플릿으로 사용하여 아래의 논리적 흐름(Chain of Thought)을 따라라:
1. **패턴 매핑 (Pattern Mapping):** '함께 풀기'의 풀이 과정 각 줄에서 어떤 공식, 식의 변형, 연산 논리가 쓰였는지 파악하라.
2. **숫자 치환 (Substitution):** '스스로 풀기'에 주어진 문제의 숫자와 조건을 '함께 풀기'와 완전히 동일한 위치에 대입하라. 
3. **중간 과정 도출 (Step-by-Step):** 최종 정답만 구하지 말고, '함께 풀기'의 구조상 중간에 위치한 빈칸(밑줄 등)에 들어가야 할 정확한 식이나 계산값(예: 약분 전의 분수형태, 근호 안의 식 등)을 도출하여 정답으로 설정하라.

**공통 규칙 (매우 중요):**
- **정답 및 해설 직접 계산:** 예시 텍스트를 그대로 복사하지 마십시오. 당신은 수학 교사입니다. 이미지의 문제를 **직접 풀이하여 정확한 수학적 정답**을 구하고, 그에 맞는 **구체적인 해설**을 작성하여 JSON 필드에 채워 넣어야 합니다.
- **[해설(explanation) 작성 절대 규칙 - 매우 중요!]**: 'explanation' 필드에는 오직 학생에게 제공할 **순수 수학적 풀이 과정(Step-by-step)**만 작성해야 합니다. 자신이 왜 이 유형으로 분류했는지에 대한 메타 설명, 레이아웃 분석, 시스템 프롬프트 내용(예: "[정답 설정]", "삽화(Figure)와 발문 조화", "수식 입력창을 통한 풀이 유도" 등)을 절대 포함하지 마십시오. 오직 수식과 논리적 풀이 과정만 담으십시오.
- 모든 수식은 반드시 '\\\\( ... \\\\)' 형태로 감싸세요. (백슬래시 2개)
- 유형 안에 삽화나 도형이 있다면 'figure_bounds'([ymin, xmin, ymax, xmax])를 0~1000 좌표계로 추출하세요. 없으면 [0,0,0,0].
- 이미지에 포함된 "답:", "정답:", "풀이:", "해설:"로 시작하는 텍스트는 교사용 정보이므로 **절대 'body'나 'content'에 포함하지 마라.**
- 만약 문제 바로 아래에 정답이 적혀 있다면, 해당 정답은 'answers' 배열에만 넣고 'body'에서는 삭제하라.

### STEP 5: 데이터 구조 및 분할 규칙:

1. **[단독형 (together.select)]**: 
   - 1개의 객체 안에서 모두 처리하라.
   - **중요:** 'blank' 파트의 'options' 배열에는 반드시 **[ "실제 계산된 정답", "오답1", "오답2" ]** 처럼 3개의 요소가 있어야 한다. (객관식 선택형이므로)
- **[본문 빈칸 유지 - 매우 중요!]** 이미지 원본에서 네모 박스, 빈칸, 밑줄 등으로 비워져 있는 부분은 \`content.body\` 텍스트 작성 시 절대 정답으로 계산해서 채워 넣지 마라! 반드시 원본 위치 그대로 **'□'** 기호를 사용하여 빈칸으로 남겨두어라.
2. **[복합형 (together.self) - 절대 분할 규칙]**: 
   - '함께 풀기'와 '스스로 풀기'는 **반드시 서로 다른 2개의 독립적인 객체(section)**로 분할하여 배열에 담아라. 절대 1개의 객체로 합치지 마라!
    - **중요:** 'blank' 파트의 'options' 배열에는 오답이 필요 없다! 반드시 **[ "실제 계산된 정답" ]** 1개의 요소만 배열에 담아라. (단순 확인 및 주관식 입력이므로)
    - **[빈칸 동기화 규칙 (매우 중요!!)]**: 
      1. '함께 풀기' 섹션도 '스스로 풀기'의 밑줄 위치와 **논리적으로 동일한 지점**에 반드시 '□' 기호를 사용하여 빈칸을 생성하라.
      2. 이미지 상의 '함께 풀기'가 완성된 풀이 형태더라도, '스스로 풀기'와 대조하여 동일한 계층/위치에 '□' 빈칸을 강제로 만들어야 함. (예상 정답은 answers 배열에 넣을 것)

3. **question.mathinput**:
   - 'subQuestions' 배열을 사용하세요.
   - 각 항목은 { 'label': '...', 'passage': '...', 'answer': '<실제 계산된 정답>', 'explanation': '<구체적인 풀이 과정>' } 형태입니다.

**최종 JSON 응답은 마크다운 코드 블록 없이 순수 JSON만 반환하세요.**

### [매우 중요: 다중 영역 분할 및 JSON 구조 예시]
한 이미지 안에 '함께 풀기(복합)', '스스로 풀기(복합)', '문제'가 같이 있다면 반드시 아래처럼 **3개의 독립된 객체**로 나누어 응답해야 합니다. (options 배열의 차이에 주목하라)

### [매우 중요: 섹션 분할 및 기존 JSON 출력 포맷]
'함께 풀기'와 '스스로 풀기', 그리고 하단의 '문제'는 **반드시 서로 다른 독립된 객체**로 분할하여 \`sections\` 배열에 담아라.
출력 포맷은 반드시 아래의 기존 \`content: { title, instruction, body }\` 구조를 엄격하게 지켜야 한다.

**JSON 구조 예시:**
{
  "sections": [
    {
      "type": "함께 풀기 + 스스로 풀기",
      "typeKey": "together.self",
      "subtype": "복합형",
      "content": {
        "title": "함께 풀기 1",
        "instruction": "이차방정식을 푸시오.",
        "body": "좌변을 인수분해 하면 \\\\( (x-3)(2x-1)=0 \\\\)\\n\\\\( x-3=0 \\\\) 또는 \\\\( 2x-1=0 \\\\)\\n따라서 \\\\( x=3 \\\\) 또는 \\\\( x= \\\\) □"
      },
      "answers": ["\\\\frac{1}{2}"],
      "explanation": [""],
      "figure_bounds": [0,0,0,0],
      "figure_alt": ""
    },
    {
      "type": "스스로 풀기",
      "typeKey": "together.self",
      "subtype": "복합형",
      "content": {
        "title": "스스로 풀기",
        "instruction": "이차방정식을 푸시오.",
        "body": "좌변을 인수분해 하면 □\\n□ 또는 □\\n따라서 □ 또는 □"
      },
      "answers": ["\\\\( (x-2)(3x+2)=0 \\\\)", "\\\\( x-2=0 \\\\)", "\\\\( 3x+2=0 \\\\)", "2", "-\\\\frac{2}{3}"],
      "explanation": [""],
      "figure_bounds": [0,0,0,0],
      "figure_alt": ""
    },
    {
      "type": "함께 풀기",
      "typeKey": "together.select",
      "subtype": "선택형",
      "content": {
        "title": "함께 풀기 2",
        "instruction": "다음 식을 인수분해 하시오.",
        "body": "\\\\( 2x^2+5x-3=( \\\\) □ \\\\( )(2x-1) \\\\)"
      },
      "answers": ["x+3"],
      "options": [
        ["x+3", "x-3", "2x+3"]
      ],
      "explanation": [""],
      "figure_bounds": [0,0,0,0],
      "figure_alt": ""
    },
    {
      "type": "문제",
      "typeKey": "question.mathinput",
      "subtype": "일반형",
      "content": {
        "title": "문제 5",
        "instruction": "다음 이차방정식을 푸시오.",
        "body": "(1) \\\\( x^2+4x-12=0 \\\\) □\\n(2) \\\\( 6x^2-13x-5=0 \\\\) □"
      },
      "answers": ["-6, 2", "-\\\\frac{1}{3}, \\\\frac{5}{2}"],
      "explanation": ["(1) 인수분해하여 풉니다.", "(2) 인수분해하여 풉니다."],
      "figure_bounds": [0,0,0,0],
      "figure_alt": ""
    },
    {
      "type": "이미지형",
      "typeKey": "question.image",
      "subtype": "이미지형",
      "strategy": {
        "name": "images_v1",
        "options": { "inputKind": "math" }
      },
      "content": {
        "title": "문제 2",
        "instruction": "오른쪽 그림과 같은 삼각형의 넓이를 구하시오.",
        "body": ""
      },
      "answers": ["24"],
      "explanation": ["삼각형의 넓이는 (밑변 x 높이) / 2 이므로 (8 x 6) / 2 = 24 입니다."],
      "figure_bounds": [150, 400, 450, 800],
      "figure_alt": "밑변이 8, 높이가 6인 삼각형 그림"
    }
  ]
}
`;



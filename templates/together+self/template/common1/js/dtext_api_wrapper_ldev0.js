/**
 * @ver v1.0.92
 * @create date 2024-05-24
 * @desc 학습창 콘텐츠 공통 API (개발용 : 로컬스토리지 저장)
 */
/*############################################
 * (DEV) 로컬스토리지 활용
##############################################*/

// SetItem IocalStorage
function setLocalStorage({ mainKey, subKey, sendData }) {
    let setData = window.localStorage.getItem(mainKey);
    if (!setData) {
        setData = [{ subKey, returnData: sendData }];
    } else {
        // 기존 데이터가 존재할 경우
        setData = parseJSON(setData);
        if (setData.find((x) => x.subKey === subKey)) {
            setData = setData.map((item) => ({
                subKey: item.subKey,
                returnData: item.subKey === subKey ? sendData : item.returnData,
            }));
        } else {
            setData = [...setData, { subKey, returnData: sendData }];
        }
    }
    window.localStorage.setItem(mainKey, JSON.stringify(setData));
}

// getItem IocalStorage
function getLocalStorage({ mainKey, subKey, callBackFn }) {
    let getData = window.localStorage.getItem(mainKey);
    if (!getData) {
        receiveMessage({ data: { returnData: undefined, callBackFn } });
    } else {
        getData = parseJSON(getData);
        try {
            getData = getData.map((x) => {
                return "returnData" in x ? x : { returnData: x };
            });
        } catch (e) {
            getData = getData.map((x) => ({ returnData: x }));
        }
        const target = getData.find((item) => item.subKey === subKey);
        const { returnData } = target || {};
        receiveMessage({ data: { returnData, callBackFn } });
    }
}

function callLocalStorage({ mainKey, sendData, callBackFn }) {
    let returnData;
    try {
        returnData = parseJSON(sendData);
    } catch (e) {
        returnData = {};
    }
    switch (mainKey) {
        case "OCR_DIRECT":
            returnData = {
                id: returnData.id ?? "",
                type: returnData.type ?? "",
                imgPath: returnData.imgPath ?? "",
                resultText: `temp_${returnData.id}_${returnData.type}`,
                resultTextlIST: [`temp_${returnData.id}_${returnData.type}`],
            };
            break;
        case "OCR":
            returnData = {
                id: returnData.id ?? "",
                type: returnData.type ?? "",
                imgPath: returnData.imgPath ?? "",
                resultText: `temp_${returnData.id}_${returnData.type}`,
            };
            break;
        case "STT":
            returnData = {
                id: returnData.id ?? "",
                resultText: `temp_${returnData.id}_${returnData.type}`,
            };
            break;
        case "STT_W_TEST":
        case "STT_S_TEST":
        case "VOICE_TEST":
            returnData = {
                id: returnData.id ?? "",
                resultText: `temp_${returnData.id}_${returnData.type}`,
                resultScore: "100",
            };
            break;
        case "TOOL":
            return;
        case "EXPRESS":
            returnData = {
                id: returnData.id ?? "",
                //latex: "2\\sqrt{54}",
                latex: returnData.latex,
            };
            break;
    }
    returnData = JSON.stringify(returnData);

    receiveMessage({ data: { returnData, callBackFn } });
}

/*############################################
* (OPR) Iframe Connect
##############################################*/
/**
 * 전송
 */
function sendPostMessage({ property, mainKey, subKey, sendData, callBackFn }) {
    // sendMessage({ property, mainKey, subKey, sendData, callBackFn });
    switch (property) {
        case "set":
            setLocalStorage({ mainKey, subKey, sendData });
            return;
        case "get":
            getLocalStorage({ mainKey, subKey, callBackFn });
            return;
        case "call":
            callLocalStorage({ mainKey, sendData, callBackFn });
            return;
    }
}

/**
 * 수신
 */
function receiveMessage(evt) {
    const { data } = evt;
    getPostMessage(data);
    // 데이터이력
    setDataHistory(data.returnData);
}

function getPostMessage({ returnData = "", callBackFn = "" }) {
    if (callBackFn) {
        excuteCallBackFn({
            callBackFn,
            params: returnData,
        });
    }
    return {};
}

/**
 * 콜백함수 실행
 */
function excuteCallBackFn({ callBackFn, params }) {
    // [배포파일수정]
    // +++
    if (!window[callBackFn]) {
        const msg = "콜백함수가 존재하지 않습니다";
        setErrorHistory(msg);
    }
    // +++
    window[callBackFn](params);
}

/*############################################
* API
##############################################*/
/**
 * 전역 데이터 가져오기
 * @param {String} mainKey 메인 키
 * @param {String} callBackFn 콜백함수
 * @returns
 */
function getGlobalLMSData(mainKey, callBackFn) {
    initActivityFunc("getGlobalLMSData", mainKey, callBackFn);
    sendPostMessage({ property: "get", mainKey, callBackFn });
}

/**
 * 학습Activity 데이터 저장하기
 * @param {String} mainKey 메인변수
 * @param {Object} subKey 서브변수
 * @param {String|Array|Object} saveData 저장데이터
 * @returns
 */
function setActivityData(mainKey, subKey, saveData) {
    let init;

    if (saveData) init = initActivityFunc("setActivityData", mainKey, subKey, saveData);
    else init = initActivityFunc("setActivityData", mainKey, subKey);

    sendPostMessage({ property: "set", mainKey, subKey, sendData: init });
}

/**
 * 학습Activity 데이터 가져오기
 * @param {String} mainKey 메인변수
 * @param {Object} subKey 서브변수
 * @param {String} callBackFn 콜백함수
 * @returns
 */
function getActivityData(mainKey, subKey, callBackFn) {
    initActivityFunc("getActivityData", mainKey, subKey, callBackFn);
    sendPostMessage({ property: "get", mainKey, subKey, callBackFn });
}

/**
 * 학습 액티비티 안에서 콘텐츠 도구를 호출하는 함수
 * @param {String} mainKey 메인변수
 * @param {Object} saveData 서브변수
 * @returns
 */
function callContentsTool(mainKey, saveData) {
    let callBackFn = "";
    let saveDataJson = {};
    try {
        saveDataJson = parseJSON(saveData);
        callBackFn = saveDataJson["callback"] ?? "";
    } catch (e) {
        saveDataJson = {};
    }
    initActivityFunc("callContentsTool", mainKey, saveData, callBackFn);

    sendPostMessage({
        property: "call",
        mainKey,
        sendData: saveData,
        callBackFn,
    });
}

/*############################################
* Init
##############################################*/
/**
 * getActivityData/setActivityData 함수 진입시 실행
 * - 실행/오류 이력 출력
 * - params string 타입여부 확인
 * - params 규격준수 여부 확인
 * - callback 함수 string 여부 확인
 */
function initActivityFunc(excuteKey, ...arguments) {
    // 이력관련
    setHistory(excuteKey, ...arguments);
    // stringify 데이터 변환
    let arg = arguments.map((x) => {
        if (typeof x === "string") {
            return parseJSON(x);
        } else {
            let typeX = Array.isArray(x) ? "array" : typeof x;
            let arg = JSON.stringify(x) || String(x);
            setErrorHistory(
                `params '${arg}(${typeX})' 의 타입이 유효하지 않습니다. String 타입으로 전달되어야 합니다.`,
            );
        }
    });
    if (excuteKey.includes("getGlobalLMSData")) {
        let [key, callBackFn] = arguments.flat();
        return isValidCallbackFn(callBackFn);
    } else if (excuteKey.includes("set")) {
        return isValidActivityParams("set", arg);
    } else if (excuteKey.includes("get")) {
        return isValidActivityParams("get", arg);
    } else {
        return isValidActivityParams("call", arg);
    }
}

/**
 * translate JSON
 */
function parseJSON(data) {
    try {
        const parsed = JSON.parse(data);
        // [배포파일수정] JSON.parse("1") => 1, JSON.parse("0") => 0 등등 문자열이 숫자로 바뀌는 경우가 있음...
        // +++
        if (typeof parsed === "number") {
            return parsed + "";
        }
        // +++
        return parsed;
    } catch (e) {
        return data;
    }
}

/*############################################
* Check Validation
#############################################*/
/**
 * 호출시 각 함수별params 검증
 * params 기본 데이터 필수 키값 가져오기
 * @param {String} type get | set | '' 택 1
 * @param {String} mainKey 메인변수값
 * @returns {Object} params 필수 키 값
 */
function getFormatDefault(type, mainKey) {
    // 필수값
    const defaultType = {
        QUIZ_INPUT: {
            id: "", // 퀴즈아이디
            type: "", // 퀴즈유형
        },
        QUIZ_CORRECT: {
            id: "", // 퀴즈아이디
            type: "", // 퀴즈유형
        },
        STUDY_ACT: {
            id: "", // 활동아이디
            type: "", // 활동유형
        },
        ETC: {
            id: "", // 기타아이디
            type: "", // 기타유형
        },
        VIDEO: {
            id: "", // 비디오아이디
            event: "", // 이벤트 (start | pause | stop | playtime | speed)
        },
        LAST_PAGE: {
            type: "", // 구분값
        },
        OCR: {
            id: "", // 식별ID
            type: "", // 유형 ( math | english )
            callback: "", // 콜백함수
        },
        OCR_DIRECT: {
            id: "", // 식별ID
            type: "", // 유형 ( math | english )
            dataBase64: "", // 필기 이미지
            callback: "", // 콜백함수
        },
        STT: {
            id: "", // 식별ID
            callback: "", // 콜백함수
        },
        STT_W_TEST: {
            id: "", // 식별ID
            callback: "", // 콜백함수
        },
        STT_S_TEST: {
            id: "", // 식별ID
            callback: "", // 콜백함수
        },
        VOICE_TEST: {
            id: "", // 식별ID
            callback: "", // 콜백함수
        },
        TOOL: {
            id: "", // 식별ID
        },
        EXPRESS: {
            id: "", // 식별ID
            key: "", // 초등(E), 중등(M), 고등(H)
            callback: "", // 콜백함수
        },
        CLASSBOARD: {},
        CORRECT: {
            id: "", //퀴즈구분자
            question: "", //질문
            answer: "", //학습자답변
            callback: "", //콜백함수명
        },
        NAVIGATE: {
            view: "", // 탭 페이지 뷰
        },
        VIEW_STATUS: {
            view: "", // view 번호
        },
        VIEW_CORRECT: {
            view: "", // view 번호
        },
        STUDY_OCR: {
            id: "", // 학습활동 식별id
            type: "", // 학습활동 유형
        },
    };
    // 선택값
    const typeCall = {
        OCR: {
            imgPath: "", // 배경이미지
        },
        STT: {
            text: "", // 예상발음결과
            imgPath: "", // text 이미지 path
            modelId: "", // AI 모델 ID
            audioPath: "", // 음성정보 path
        },
        STT_W_TEST: {
            text: "", // 평가문장
            imgPath: "", // text 이미지 path
            modelId: "", // AI 모델 ID
            audioPath: "", // 음성정보 path
        },
        STT_S_TEST: {
            text: "", // 평가문장
            imgPath: "", // text 이미지 path
            modelId: "", // AI 모델 ID
            audioPath: "", // 음성정보 path
        },
        VOICE_TEST: {
            key: "", // AI센터에 등록한 KEY 정보
            text: "", // 평가문장
            modelId: "", // AI 모델 ID
            type: "", // 평가구분 (E | R)
            imgPath: "", // text 이미지 path
            audioPath: "", // 원어민 음성정보 path
        },
        TOOL: {
            text: "", // 평가문장
            audioPath: "", // 원어민 음성정보 path
            imgPath: "", // text 이미지 path
        },
        EXPRESS: {
            latex: "", //현재입력값(LATEX 값)
        },
    };
    const typeSet = {
        QUIZ_INPUT: {
            input: "", // 입력값
            answer: "", // 정답
            solveTime: "", // 풀이시간
        },
        QUIZ_CORRECT: {
            result: "",
        },
        STUDY_ACT: {
            data: "", // 활동데이터 : STRING 유형별 체크 필요
        },
        ETC: {
            data: "", // 활동데이터 : STRING, ARRAY, OBJECT 기타등등 유형별 체크 필요
        },
        VIDEO: {
            data: "", // 이벤트 데이터
        },
        LAST_PAGE: {
            data: "", // 마지막 페이지 정보
        },
        STUDY_OCR: {
            data: "", // 학습활동정보
        },
        NAVIGATE: {
            data: "", // 마지막 페이지 정보
        },
    };
    const typeGet = {
        QUIZ_INPUT: {
            callback: "", // 콜백함수
        },
        QUIZ_CORRECT: {
            callback: "", // 콜백함수
        },
        STUDY_ACT: {
            callback: "", // 콜백함수
        },
        LAST_PAGE: {
            callback: "", // 콜백함수
        },
        ETC: {
            callback: "", // 콜백함수
        },
        VIDEO: {
            callback: "", // 콜백함수
        },
        STUDY_OCR: {
            callback: "", // 콜백함수
        },
    };

    if (type.includes("set")) {
        return Object.assign(defaultType[mainKey], typeSet[mainKey]);
    } else if (type.includes("get")) {
        return Object.assign(defaultType[mainKey], typeGet[mainKey]);
    } else {
        return defaultType[mainKey];
    }
}

function isValidActivityParams(type = "", arguments) {
    const [mainKey, subKey, saveData = {}] = arguments;
    if (!mainKey || !subKey || (type !== "call" && !saveData)) {
        setErrorHistory("함수 호출시 키 값은 모두 입력되어야 합니다");
    }
    const defaultFormat = getFormatDefault(type, mainKey);

    let typeKey, data;
    switch (mainKey) {
        case "LAST_PAGE":
            typeKey = { type: subKey };
            data = { data: saveData };
            break;
        case "QUIZ_CORRECT":
            typeKey = subKey;
            data = { result: saveData };
            break;
        case "STUDY_ACT":
        case "ETC":
        case "STUDY_OCR":
        case "VIDEO":
            typeKey = subKey;
            data = { data: saveData };
            break;
        default:
            typeKey = subKey;
            data = saveData;
            break;
    }
    if (type === "get") {
        data = { callback: saveData };
    }
    obj = Object.assign(typeKey, data);

    // 유효성 체크
    Object.keys(defaultFormat).forEach((key) => {
        if (!obj.hasOwnProperty(key)) {
            // params 내에 키 값 모두 있는지 확인
            let msg = `'${key}' 키값이 존재하지 않습니다. '${key}'를 입력해주세요`;
            setErrorHistory(msg);
        }
        // [배포파일수정] 값을 빈 문자열로 넘기는 경우 허용
        // if (!obj[key]) {
        if (obj[key] === undefined || obj[key] === null) {
            let msg = `'${key}' 의 값이 없습니다. 해당 값을 넣어주세요`;
            setErrorHistory(msg);
        }
        if (key === "callback") {
            // 콜백함수 확인
            isValidCallbackFn(obj.callback);
        }
    });
    return JSON.stringify(obj);
}

/**
 * 콜백함수 검증
 */
function isValidCallbackFn(callback, arguments = null) {
    if (typeof callback !== "string") {
        const msg = "콜백함수 명은 String이어야 합니다";
        setErrorHistory(msg, callback);
        return false;
    }
    if (typeof window[callback] !== "function") {
        const msg = `콜백함수가 유효하지 않습니다`;
        setErrorHistory(msg, callback);
        return false;
    }
    return true;
}

/*############################################
* 이력 및 오류
#############################################*/

// 실행 및 로그이력
function setHistory(funcName, ...arguments) {
    // create log dom
    createHistoryDom();
    if (!funcName) return;
    let _log = document.querySelector("#logExcute");
    let arg = arguments.flatMap((x) => (typeof x === "string" ? x : JSON.stringify(x)));
    let _innerHtml = _log.innerHTML;
    _innerHtml += `<p><strong>${funcName}</strong>(${arg})</p>`;
    _log.innerHTML = _innerHtml;
}

// 오류 로그이력
function setErrorHistory(msg, callback = "") {
    let _log = document.querySelector("#logExcute");
    if (_log) {
        let _innerHtml = _log.innerHTML;
        _innerHtml =
            `<p style="color: red; font-weight: bold;font-family: Consolas">(Error) ${msg} ${callback}</p>` +
            _innerHtml;
        _log.innerHTML = _innerHtml;
    }
    alert(msg);
    throw new Error(msg, callback);
}

// return 데이터 이력
function setDataHistory(returnData) {
    // create log dom
    createHistoryDom();
    let data;
    try {
        data = typeof data === "string" ? parseJSON(returnData) : returnData;
        data = JSON.stringify(data, null, 2);
    } catch (e) {
        data = returnData;
    }
    document.querySelector("#logData").innerText = data;
}

function createHistoryDom() {
    if (document.querySelector("#LW_DEV_LOG")) return;
    const _section = document.createElement("section");
    _section.id = "LW_DEV_LOG";
    document.body.appendChild(_section);

    const _style = document.createElement("style");
    _style.setAttribute("id", "lwStyle");
    _style.innerHTML = `
#LW_DEV_LOG { position:fixed; bottom: 0; display: flex; flex-wrap: wrap; gap: 0; width: 100%; z-index: 99; }
.btn-wrap{ flex: none; width: 100%; padding: 20px 0; background: #fff; }
.lw-log { flex: 1; background: #fff; border: 1px solid #000; width: 50%; padding: 10px; overflow: auto; height:240px}
.lw-log h1{ font-size: 24px; font-weight: bold;}
.lw-log *{font-family: Consolas; font-size: 16px; white-space: nowrap;}
.lw-log strong{font-weight: bold;}
.lw-log pre{white-space: pre;}
`;
    document.body.appendChild(_style);
    // log history
    const _html = `<div class="btn-wrap">
                    <button type="button" data-func="collapse">collapse</button>
                    <button type="button" data-func="clear">clear</button>
                  </div>
                  <div id="logExcute" class="lw-log">
                    <h1>Log history</h1>
                  </div>
                  <div class="lw-log">
                    <h1>Data history</h1>
                    <pre id="logData"></pre>
                  </div>`;
    document.querySelector("#LW_DEV_LOG").innerHTML = _html;

    document.querySelector('[data-func="collapse"]').addEventListener("click", (e) => {
        if (document.querySelector("#LW_DEV_LOG").hasAttribute("style")) {
            document.querySelector("#LW_DEV_LOG").removeAttribute("style");
        } else {
            document.querySelector("#LW_DEV_LOG").style.height = "60px";
        }
    });
    document.querySelector('[data-func="clear"]').addEventListener("click", (e) => {
        document.querySelector("#logExcute").innerHTML = "<h1>Log history</h1>";
        document.querySelector("#logData").innerHTML = "";
        window.localStorage.clear();
        setTempData();
    });
}

function setTempData() {
    window.localStorage.setItem("USER_NAME", JSON.stringify(["홍길동"]));
    window.localStorage.setItem("SUBJECT_NAME", JSON.stringify(["초등학교 3학년 영어 1학기"]));
    window.localStorage.setItem("CHAPTER_NAME", JSON.stringify(["수와 연산"]));
    window.localStorage.setItem("SECTION_NAME", JSON.stringify(["1+1 계산"]));
    window.localStorage.setItem("USER_TYPE", JSON.stringify(["ST"]));
}

setTempData();

/* 2차 추가 API 연동 화면 조작 스크립트 Start */
let currentIndex = getCurrentPageIndex(); // 현재 페이지 인덱스 가져오기

// 현재 URL에서 페이지 인덱스를 가져오는 함수
function getCurrentPageIndex() {
    const path = window.location.pathname.split("/").pop().replace(".html", "");

    let index = 0;

    if (typeof view_pageinfo !== "undefined") {
        index = view_pageinfo.findIndex((page) => page.url === path);
    }

    return index !== -1 ? index : 0; // 유효하지 않으면 0번 페이지로
}

// 페이지 리스트 생성
function generatePageList() {
    const list = document.getElementById("page-list");
    list.innerHTML = ""; // 기존 목록 초기화

    view_pageinfo.forEach((page, index) => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        // a.href = `/${page.url}.html`;
        a.textContent = `${index + 1}`;

        // 현재 페이지 강조
        if (index === currentIndex) {
            a.classList.add("active");
        }

        a.addEventListener("click", (event) => {
            // event.preventDefault();
            moveToPage(index);
        });

        li.appendChild(a);
        list.appendChild(li);
    });
}

// 특정 페이지로 이동 + URL 변경 + 동적 로드
function moveToPage(index) {
    if (index >= 0 && index < view_pageinfo.length) {
        currentIndex = index;
        const newUrl = `${view_pageinfo[index].url}.html`;
        updatePageUI();
        const url = new URL(window.location.href);
        const pathParts = url.pathname.split("/");
        pathParts[pathParts.length - 1] = newUrl;
        url.pathname = pathParts.join("/");
        window.location.href = url;
    }
}

// 이전 페이지 이동
function prevPage() {
    if (currentIndex > 0) {
        moveToPage(currentIndex - 1);
    } else {
        alert("첫 페이지입니다.");
    }
}

// 다음 페이지 이동
function nextPage() {
    if (currentIndex < view_pageinfo.length - 1) {
        moveToPage(currentIndex + 1);
    } else {
        alert("마지막 페이지입니다.");
    }
}

// 특정 인덱스로 이동
function goToPage() {
    const indexInput = document.getElementById("page-index").value;
    const index = parseInt(indexInput, 10) - 1; // 사용자 입력은 1부터 시작
    console.log();
    if (isNaN(index) || index < 0 || index >= view_pageinfo.length) {
        alert(`올바른 페이지 번호를 입력하세요 (1 ~ ${view_pageinfo.length})`);
    } else {
        moveToPage(index);
    }
}

// 브라우저 뒤로가기/앞으로가기 감지
window.onpopstate = function (event) {
    if (event.state !== null) {
        currentIndex = event.state.index;
        updatePageUI();
    }
};

// UI 업데이트 (현재 URL 반영)
function updatePageUI() {
    document.querySelectorAll("#page-list a").forEach((a, index) => {
        a.classList.toggle("active", index === currentIndex);
    });
}

// 페이지 로드 시 실행
window.onload = () => {
    generatePageList();
    updatePageUI();
};

/* 2차 추가 API 연동 화면 조작 스크립트 End */

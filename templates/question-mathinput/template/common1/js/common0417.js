// 현재 페이지의 파일 경로를 가져옵니다.
var path = window.location.pathname;
// 파일 경로에서 파일 이름만 추출합니다.
var folder_path = path.substring(0, path.lastIndexOf('/')); // 마지막 '/' 이전까지의 문자열을 추출합니다.
var pageName = path.substring(path.lastIndexOf('/') + 1).split(".")[0];//html 파일의 이름만 가져옴
var pageNum = 1;
var forcePg_bool = true;//페이지 이동으로 온 경우 마지막 페이지 정보를 첫페이지로 강제 설정 여부
if ((pageName == "" || pageName == "index")) {//act 이동으로 온 경우나 index.html 하나만 있는 경우
    pageName = "index";
} 
if (pageName != "" && pageName != "index" && pageName != "index_local") {//첫페이지가 아닌 경우
    forcePg_bool = false;
    pageNum = Number(pageName.slice(-1));
}
var folderName = folder_path.substring(folder_path.lastIndexOf('/') + 1);
var curActNum = Number(folderName.slice(-2));
var parentFolderPath = folder_path.substring(0, folder_path.lastIndexOf('/'));// 상위 폴더 경로
var parentFolderName = parentFolderPath.substring(parentFolderPath.lastIndexOf('/') + 1);// 상위 폴더 이름
var sectFolderPath = parentFolderPath.substring(0, parentFolderPath.lastIndexOf('/'));// 상위 폴더 경로
var sectFolderName = sectFolderPath.substring(sectFolderPath.lastIndexOf('/') + 1);// 상위 폴더 이름
var chasiNum = Number(parentFolderName.slice(-2));// 상위 폴더의 숫자 정보
var chapterFolderPath = sectFolderPath.substring(0, sectFolderPath.lastIndexOf('/'));// 상위 폴더 경로
var chapterFolderName = chapterFolderPath.substring(chapterFolderPath.lastIndexOf('/') + 1);// 상위 폴더 이름
var chapNum = Number(chapterFolderName.slice(-2));// 챕터 폴더의 숫자 정보
//var qId = "Q"+parentFolderName+"_"+curActNum+"_"+pageNum;
var lastPgId = "LAST_" + sectFolderName + "_" +parentFolderName + "_" + curActNum;

var protocol = window.location.protocol;
var web_bool = isWeb();
var mp3Play_array = [];
var audio;
var myVideo = null;
var o_color = "#02a1cd";//맞추었을때 색상
var x_color = "#ff6969";//틀렸을때 색상
var b_color = "rgb(31, 31, 31)";//원래 글씨 색상
var win_scale = 1;
var quiz_on = true;
var multiQuiz = false;//문제에서는 true로 act에서 선언될 예정
var saveQuiz_type = "saveQuiz";//Get함수가 호출될때 저장할 함수명 타입지정 -retry시에 사용
var qCorrectType_bool = false;//quiz_input 타입과 quiz_correct 타입이 동시에 선언되어 있음을 체크
var dapHide_bool = false;//기본적으로 답을 가리지 않음(문제와 특수 경우에 가림)
var btnMathBgSrc = "img/math.png";//수식입력기 버튼의 배경 이미지

var startTime = new Date();
var endTime = new Date(); // 현재 시간
var latex_js = "js/tex-svg.js";
//if(!web_bool) latex_js ="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"

MathJax = {
    loader: { load: ['input/tex', 'ui/menu'] },
    startup: {
        pageReady() {
            MathJax.startup.document.menu.menu.findID('Accessibility', 'AssistiveMml').disable();
            MathJax._.mathjax.mathjax.handleRetriesFor(() => MathJax.startup.document.render());
        }
    },
    options: {
        renderActions: {
            addMenu: [],
            assistiveMml: [],  // disable assistive mathml
            typeset: [150,
                (doc) => { for (math of doc.math) { MathJax.config.renderMathML(math, doc) } },
                (math, doc) => MathJax.config.renderMathML(math, doc)
            ]
        },
        menuOptions: {
            settings: {
                assistiveMml: false
            }
        }
    },
    renderMathML(math, doc) {
        math.typesetRoot = document.createElement('mjx-container');
        math.typesetRoot.innerHTML = MathJax.startup.toMML(math.root);
        math.display && math.typesetRoot.setAttribute('display', 'block');
    }
};

$(function () {
    //if(web_bool) altJsonLoad();//웹에서는 json 파일을 로드해서 alt 태그 적용
    //테스트시에는 dtext_api_wrapper_ldev 를 인클루드 시킴
    if (location.href.indexOf("mtcontents.synology.me") > 0) jsInclude_fn("../../../../mutoint/js/dtext_api_wrapper_ldev.js");

    //공통 버튼 이벤트 및 위치 지정
    if (forcePg_bool) {//view 페이지들을 포함한 index.html 에서만 분기
        if(typeof (view_pageinfo) == "undefined") view_pageinfo = {};//view 페이지에서 사용하기 위한 변수
        getLastPage_fn("lastPageNameLoad_fn");//마지막 페이지 정보 불러오기
        return;
    } else if (pageName.indexOf("view") == 0) {//view01, view02 등 페이지에서 처리
        if(typeof (view_pageinfo) != "undefined") setLastPage_fn();//페이지 이동으로 온 경우 마지막 페이지 정보를 설정
    }
    applyLanguageImages(getPageLang());
    chkChgLang_fn();//언어가 변경되는지 체크
    btnSet_fn();

    override_fn();//기존에 act.js 등에 선언된 getData_fn(data) 등의 함수에서 매개변수가 object 형태였는데 string 형태로 변경되어서 오류가 발생하는 경우가 있어서 오버라이드 처리함
    getGlobalLMSData("USER_TYPE", "getUserType_fn");//사용자 타입 불러오기
    //toast 메시지 div 추가
    $('body').append('<div id="toast" style="display:none; position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); background-color: #333; color: #fff; padding: 10px; border-radius: 5px;">안내 메시지입니다.</div>');

    if (isEmpty(MathJax.typesetPromise)) return;
    MathJax.typesetPromise().then(function () {
        $('.wrap').show(); // MathJax의 수식 처리가 완료되면 본문 표시
    }).catch(function (err) {
        console.error('MathJax 초기화 중 에러 발생:', err);
        $('.wrap').show(); // 에러 발생 시에도 본문 표시
    });
});

if (typeof moveToPage === 'undefined') {//view01, view02 로 이동하는 함수가 선언 안된 경우
    function moveToPage(index) {
        location.href = "view0" + (index + 1) + ".html";
    }
}

let _qId;
Object.defineProperty(window, 'qId', {
    get() {
        return _qId;
    },
    set(value) {
        _qId = value;
        // qId가 설정될 때 수행할 작업
        //console.log(`qId가 ${value}로 설정되었습니다.`);
        if (parentFolderName == "task03" && qId.indexOf("ssok") < 0) qId = qId + "_ssok";//sook 에 해당하는 qId에 _ssok 추가해서 중첩되는 아이디를 방지
    }
});
function lastPageNameLoad_fn(params) {
    let index = "";

    if (params) index = JSON.parse(params).data;

    if (index) {
        moveToPage(index - 1)
    }
    else {
        moveToPage(0)
    }
    setLastPage_fn();//마지막 페이지 정보 저장

}
function btnSet_fn() {
    if ($(".btn.btn-save").length > 0) {//저장 버튼이 존재하는 경우
        $(".btn.btn-ex").css("display", "none");
        $(".btn.btn-retry").css("display", "none");
    }
    if ($(".btn.btn-ok").length > 0) {//저장 버튼이 존재하는 경우
        $(".btn.btn-solve").css("display", "none");
        $(".btn.btn-retry").css("display", "none");
    }
    if ($(".btn-next").length > 0) {
        $(".btn-next").click(function () {
            nxtPage_fn();
        })
    }
    if ($(".btn-prev").length > 0) {
        $(".btn-prev").click(function () {
            prvPage_fn();
        })
    }
    if ($(".pagination li a").length > 0) {
        $(".pagination li a").css("cursor", "pointer");
        $(".pagination li a").each(function (index) {
            $(this).removeAttr("href").on("click", function (e) {
                e.preventDefault();
                moveToPage(index);
            });
        });
    }
    if ($(".btn-retry").length > 0) {//SaveStudyAct, SaveQuizCorrect, SaveQuiz 함수를 호출하여 저장
        $(".btn-retry").click(function () {//다시하기 버튼 중복선언 - 각 act.js 내에 선언되어 있지만 DB저장을 위해 한번 더 선언
            //act.js 네어서 retry_fn() 실행된 후 실행하기 위해 시간차를 둠 - 저장시 초기화된 빈값을 저장
            var no_idx = $(".btn-retry").index(this) + 1;//몇번째 다시하기버튼을 클릭했는지
            setTimeout(function () {
                if (saveQuiz_type == "saveQuiz") {
                    if(multiQuiz){
                        qId = qIdObj["qId" + no_idx];
                    }
                    saveQuiz_fn(qId, qType, "", "");
                } else if (saveQuiz_type == "SaveQuizCorrect") {
                    SaveQuizCorrect_fn(qId, qType, "");
                } else if (saveQuiz_type == "SaveStudyAct") {
                    SaveStudyAct_fn(qId, qType, "");
                }
            }, 10);
            if(!multiQuiz) showBtnMath_fn();//수식버튼 다시 보이게 처리
        })
    }
    if ($("ul.jumplink").length > 0) {//목차가 있는 경우
        var cur_idx = $("ul.jumplink li a.current").parent().index();
        $("ul.jumplink li a").click(function () {
            var c_idx = $(this).parent().index();
            if (c_idx == cur_idx) return;
            if (c_idx > cur_idx) {
                nxtAct_fn(c_idx - cur_idx);
            } else if (c_idx < cur_idx) {
                prvAct_fn(c_idx - cur_idx);
            }
        })
    }
    if ($(".btn-ocr").length > 0) {//ocr 입력기
        $(".btn-ocr").click(function () {
            if (quiz_on == false) return;
            if (typeof (ocr_bool) != "undefined" && ocr_bool) {
                call_OCR($(".btn-ocr").index(this) + 1);//한페이지에 여러 수식 입력기가 있는 경우 인덱스 값을 넘김
            } else {
                //현재는 ocr 은 안띄우고 수식 입력기만 띄우기로 함
                call_EXPRESS($(".btn-ocr").index(this) + 1);//한페이지에 여러 수식 입력기가 있는 경우 인덱스 값을 넘김
            }
        })
    }
    if ($(".btn-math").length > 0) {//수식 입력기
        btnMathBgSrc = $(".btn-math").css("background-image");
        $(".btn-math").click(function () {
            if (quiz_on == false && !multiQuiz) return;
            var index = $(".btn-math").index(this);
            if(multiQuiz){
                var no_idx = findQArange(index+1);
                if(quiz_on_array[no_idx-1] == false) return;
            }
            call_EXPRESS(index + 1);//한페이지에 여러 수식 입력기가 있는 경우 인덱스 값을 넘김
            $(this).css("background-image", "none");//자신의 수식입력기 백그라운드 이미지 숨김 처리
        })
    }
    if ($(".txtarea-wrap .btn-math").length > 0) {//자유입력칸에 수식 입력기
        $(".txtarea").on("keydown", function (e) {//자유입력칸에서 엔터키를 눌렀을때 줄바꿈 처리
            if (e.key === "Enter") {
                e.preventDefault(); // 기본 엔터 동작 막기
                document.execCommand('insertHTML', false, '<br>\u200B'); // 줄바꿈 삽입
            }
        });
    }
    if ($(".btn-audio").length > 0) {//오디오버튼
        $(".btn-audio").click(function () {
            //alert($(this).attr("mp3Name"));
            var mp3_file = "media/" + $(this).attr("mp3Name") + ".mp3";
            var vol_data = loadData_fn("aim_vol");
            var volumeSlider = document.getElementById('volumeSlider');
            if (mp3Play_array[mp3_file]) {// 이미 재생 중인 경우
                if (vol_data > 0) {
                    //오디오 볼륨이 0보다 크면 볼륨을 0으로 맞추고 볼륨이 0이면 volume을 원래대로 맞추면서 $("#volumeSlider") 위치도 함께 변경
                    if (audio.volume > 0) {
                        audio.volume = 0;
                        volumeSlider.value = 0; // 슬라이더 손잡이 위치를 왼쪽으로
                        const percentage = (0 / volumeSlider.max) * 100;
                        volumeSlider.style.background = `linear-gradient(to right, #029fcc ${percentage}%, rgba(0, 0, 0, .1) ${percentage}%)`;
                        $(this).addClass("audio-off");
                    } else {
                        audio.volume = vol_data / 100;
                        volumeSlider.value = vol_data; // 슬라이더 손잡이 위치를 볼륨값으로
                        const percentage = (vol_data / volumeSlider.max) * 100;
                        volumeSlider.style.background = `linear-gradient(to right, #029fcc ${percentage}%, rgba(0, 0, 0, .1) ${percentage}%)`;
                        $(this).removeClass("audio-off");
                    }
                }
                return;
            }
            playMP3_fn(mp3_file);
            if (audio) audio.volume = vol_data / 100;
        })
    }
    if ($("#volumeSlider").length > 0) {
        var vol_data = loadData_fn("aim_vol");
        var volumeSlider = document.getElementById('volumeSlider');

        if (vol_data) {
            volumeSlider.value = vol_data;
            const percentage = (vol_data / volumeSlider.max) * 100;
            volumeSlider.style.background = `linear-gradient(to right, #029fcc ${percentage}%, rgba(0, 0, 0, .1) ${percentage}%)`;
            if (audio) audio.volume = vol_data / 100;
        }
        volumeSlider.addEventListener('input', function () {
            const value = volumeSlider.value;
            const percentage = (value / volumeSlider.max) * 100;
            volumeSlider.style.background = `linear-gradient(to right, #029fcc ${percentage}%, rgba(0, 0, 0, .1) ${percentage}%)`;
            if (audio) audio.volume = value / 100;
            saveData_fn("aim_vol", value);
        });
    }
    if ($("label.btn-blank").length > 0) {
        $("label.btn-blank").attr("tabIndex", 0);
    }
    if ($(".btn.btn-solve").length > 0) {//풀이 버튼이 있는 경우
        $(".btn.btn-solve").on("click", function () {
            var index = $(".btn.btn-solve").index(this);//몇번째 풀이버튼을 클릭했는지
            $(this).addClass("on");
            var $popup = $('.pop.solution').eq(index); // 해당 인덱스의 팝업
            $popup.addClass('show');
            $popup.find('[role="document"]').attr("tabindex", 0).focus();
            $popup.data("index", index);
        });

        $(".pop.solution .btn-close").on("click", function () {
            $('.pop.solution').removeClass('show');
            $(".btn.btn-solve").focus();
            $(".btn.btn-solve").removeClass("on");
        });
        $(".pop.solution button").attr("tabIndex", 1);
        const $focusableEls = $('.pop.solution').find('a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex], [contenteditable]');
        const $firstFocusableEl = $focusableEls.first();
        const $lastFocusableEl = $focusableEls.last();

        $(document).on("keydown", ".pop.solution", function (event) {
            if (event.key === "Escape") {
                $('.pop.solution').removeClass('show');
                $(".btn.btn-solve").focus();
            } else if (event.key === "Tab") {
                if (!event.shiftKey && document.activeElement === $lastFocusableEl[0]) {
                    event.preventDefault();
                    $firstFocusableEl.focus();
                } else if (event.shiftKey && document.activeElement === $firstFocusableEl[0]) {
                    event.preventDefault();
                    $lastFocusableEl.focus();
                }
            }
        });
    }
    if ($("#clear-btn").length > 0) {//그림그리기에 지우기 버튼이 있는 경우 -canvas 태그가 있는 그림그리기
        // 스크롤 고정 코드 추가
        document.addEventListener('touchmove', function (e) {
            e.preventDefault(); // 기본 스크롤 방지
        }, { passive: false });
    }
    if ($(".pop.feedback").length > 0) {//팝업 버튼이 있는 경우
        $(".pop.feedback button").attr("tabIndex", 1);
        $(".pop.feedback .btn-pop-retry").click(function () {//팝업창의 재도전 클릭시
            var no_idx = $(".pop.feedback").data("no_idx");
            $(".pop.feedback").removeClass("show");
            if(multiQuiz){
                $(".btn.btn-retry").eq(no_idx-1).click();
            }else{
                $(".btn.btn-retry").click();
            }
        });
        $(".pop.feedback .btn-pop-answer").click(function () {//팝업창의 정답보기 클릭시
            var no_idx = $(".pop.feedback").data("no_idx");
            $(".pop.feedback").removeClass("show");
            $('.correct').css("visibility", "visible");
            if (typeof (isWrong_fn) != "undefined"){
                if(multiQuiz){
                    chkDap_fn(no_idx);
                }else{
                    isWrong_fn();
                }
            }
            if (typeof (chkDapAll_fn) != "undefined") chkDapAll_fn();
            if (typeof (chkDap_fn) != "undefined") chkDap_fn();
            $(window).trigger("CorrectShow");//정답보기
        });
    }
    try {
        if ($(".pop.solution").length > 0 && (typeof (popDraggable) == "undefined" || popDraggable)) {//풀이가 있는 경우 - act내에서 popDraggable=true 또는 따로 선언안되어 있으면 드래그 가능
            if (detectDevice() != "chromebook" && detectDevice() != "windows tablet" && detectDevice() != "tablet") {//chromebook, windows tablet 이 아닌 경우 드래그 가능
                $(".pop.solution").each(function () {
                    const $pop  = $(this);
                    const div0 = $pop.children("div").eq(0);
                    $pop.css("pointer-events", "pointer");
                    div0.css("pointer-events", "auto");
                    $pop.draggable({
                        start: function (event, ui) {
                            var div0Offset = div0.offset(); // div의 문서 내 위치
                            var div0Width = div0.width();
                            var div0Height = div0.height();

                            // 마우스 이벤트 시작 위치가 div0 영역 내부인지 확인
                            if (event.pageX < div0Offset.left || event.pageX > div0Offset.left + div0Width ||
                                event.pageY < div0Offset.top || event.pageY > div0Offset.top + div0Height) {
                                // 이 조건을 만족하면 드래그 시작 위치가 div0 영역 밖이므로 드래그를 취소합니다.
                                return false; // 이는 드래그 작업을 취소합니다.
                            }
                        }
                    });
                    div0.css("cursor", "pointer");
                });
            }
        }
    } catch (e) {

    }
    //생각Key우기 중 수식입력 편집기가 있는 경우
    if ($('div#QuizInput[contenteditable="true"]').length > 0) {
        $('div#QuizInput[contenteditable="true"]').addClass('no-background');
    }
    //act 이동 처리를 위한 이벤트 체크
    setActMoveBtn();
    //임시로 act.js 등이 적용되었는지 체크를 위해 만듦
    if (location.href.indexOf("mtcontents.synology.me") > 0 || !web_bool) {
        $(document).on('keydown', function (event) {
            const tag = event.target.tagName.toLowerCase();
            
            // input, textarea, contenteditable 요소에서는 무시
            if (tag === 'input' || tag === 'textarea' || event.target.isContentEditable) {
                return; // 조기 종료
            }
            //alert("Key pressed: " + event.key);
            if (event.key == "/") {// 키보드 / 를 누르면 - //임시로 act.js 등이 적용되었는지 체크를 위해 만듦
                chkActFile_fn();
            }
            if (event.key == ";") {// 키보드 ; 를 누르면 - //임시로 오답입력
                call_OCR(1);
            }
            if (event.key == "'") {// 키보드 ' 를 누르면 - //임시로 오답입력
                call_OCR(2);
            }
            if (event.key == "]") {// 키보드 ] 를 누르면 - //교사모드로 전환
                showToast("교사모드로 전환합니다.");
                getUserType_fn("TE");
            }
            if (event.key == "[") {// 키보드 ] 를 누르면 - //학생모드로 전환
                showToast("학생모드로 전환합니다.");
                getUserType_fn("ST");
            }
            if(event.key == "`") {// 키보드 ] 를 누르면 - //학생모드로 전환
                if("rgb(204, 204, 204)" == $("body").css("background-color")){
                    $("body").css("background-color", "#FFFFFF");
                    saveData_fn("bgColor", "white");
                }else{
                    $("body").css("background-color", "#CCCCCC");
                    saveData_fn("bgColor", "#CCCCCC");
                }
            }
        });
        $("body").css("background-color", loadData_fn("bgColor"));
        setTimeout(function () {
            $("#LW_DEV_LOG").hide();
            $("#lwStyle").remove();
            /*if(typeof(dap_array)!="undefined" && !isEmpty(dap_array)){
                ans_array=[].concat(dap_array);
            }*/
        }, 100);//처음에 디버깅 창 강제 감춤
    }
}

function hideBtnMath_fn(idx=-1) { 
    if ($(".btn-math").length > 0){
        $(".btn-math").eq(idx).css("background-image", "none"); 
    }else{
        return;
    }
    if(idx==-1) $(".btn-math").css("background-image", "none");
}//수식입력기 버튼을 숨김 처리
function showBtnMath_fn(idx=-1) { 
    if ($(".btn-math").length > 0){
        $(".btn-math").eq(idx).css("background-image", btnMathBgSrc); 
    }else{
        return;
    }
    if(idx==-1) $(".btn-math").css("background-image", btnMathBgSrc);
}//수식입력기 버튼을 보임 처리

function override_fn() {
    // 처리할 함수 이름 배열
    var functionsToWrap = ['getQData_fn', 'ExpRtn_fn', 'OcrRtn_fn', 'OcrRtn1', 'ExpRtn1'];

    functionsToWrap.forEach(function (fnName) {// 각 함수에 대해 동일한 처리를 적용
        if (typeof window[fnName] === 'function') { // 함수가 존재하는지 확인
            var originalFn = window[fnName]; // 원본 함수 참조 저장

            // 함수를 덮어쓰기
            window[fnName] = function (data) {
                // data가 문자열인 경우 JSON.parse를 통해 객체로 변환
                if (typeof data === 'string' && data.length > 0) {
                    try {
                        data = JSON.parse(data);
                    } catch (e) {
                        console.error('Invalid JSON string:', data);
                    }
                }
                // 원본 함수 호출
                return originalFn.apply(this, [data]);
            };
        } else {
            //console.warn(fnName + ' is not defined in act.js');
        }
    });
}
function chkActFile_fn() {
    var actjs_file = "act.js";
    if (pageNum > 1) actjs_file = "act" + pageNum + ".js";
    if (typeof (qId) == "undefined" || qId.length < 7 || !isScriptIncluded(actjs_file)) {
        if (!isScriptIncluded(actjs_file)) {
            alert(actjs_file + " 파일이 아직 제대로 인클루드 되지 않았네요");
        } else {
            alert("아직 act js 파일이 최신 적용되지 않았습니다.")
        }
    } else if (itoStr(chasiNum) != chasi) {
        //console.log("차시 정보가 틀리네요!");
    } else {
        alert(actjs_file + " 파일 적용됨!!!")
    }
    //$("#LW_DEV_LOG")가 display 토글 처리
    $("#LW_DEV_LOG").toggle();
}
function setActMoveBtn() {
    $(".wrap").dblclick(function (event) {
        var $this = $(this);
        var offset = $this.offset();
        var x = event.pageX - offset.left; // 요소 내에서의 x 좌표
        var y = event.pageY - offset.top; // 요소 내에서의 y 좌표
        var rightEdge = $this.width(); // 요소의 오른쪽 모서리 위치
        var scale = window.innerHeight / 1080;
        rightEdge = rightEdge * scale;//세로가 더 짧은 경우가 많아서 스케일에 따라 폭 계산

        if (x <= 100 && y <= 50) {
            console.log("왼쪽 위 20px 내에서 더블클릭");
            prvAct_fn();
            // 왼쪽 위 20px 내에서 더블클릭 시의 처리를 여기에 작성
        } else if (x >= rightEdge - 100 && y <= 50) {
            console.log("오른쪽 위 20px 내에서 더블클릭");
            nxtAct_fn();
            // 오른쪽 위 20px 내에서 더블클릭 시의 처리를 여기에 작성
        }
    });
}
function jsInclude_fn(js_src) {
    var script = document.createElement('script');
    script.src = js_src; // 여기에 추가하고 싶은 JS 파일의 경로를 지정하세요.
    script.type = 'text/javascript';
    $("body").append(script);
}

function prvPage_fn() {
    var prvPgNum = (pageNum - 2);
    moveToPage(prvPgNum);
}
function nxtPage_fn() {
    moveToPage(pageNum);
    //location.href = "index" + (pageNum + 1) + ".html";
}
function nxtAct_fn(addnum = 1) {
    var nxtAct_no = curActNum + addnum;
    location.href = "../act" + itoStr(nxtAct_no) + "/";
}
function prvAct_fn(addnum = -1) {
    var prvAct_no = curActNum + addnum;
    if (prvAct_no == 0) prvAct_no = 1;
    location.href = "../act" + itoStr(prvAct_no) + "/";
}


observerClass_fn($('.pop.feedback'), "show", popAppear_fn, popRemove_fn);//팝업창이 열리거나 닫힐때의 처리 - 빈칸, 정오답, 풀이 등 - observerClass_fn 은 제일 아래에 선언되어 있음
observerClass_fn($('.pop.solution'), "show", popAppear_fn, popRemove_fn);

function popAppear_fn(targetElm) {// 팝업창이 열렸을 때의 다른 버튼들은 탭키로 포커스 이동이 되지 않도록 처리
    var $popup = $(targetElm); // 팝업창을 선택
    //var $focusableElements = $popup.find('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    var $focusableElements = $popup.find('button');
    var $firstFocusableElement = $focusableElements.first();
    var $lastFocusableElement = $focusableElements.last();
    if ($popup.hasClass("incorrect1") || $popup.hasClass("incorrect2")) {
        $popup.addClass("btnshow");
        if ($('.pop.feedback .btn-pop-answer').length > 0 && dapHide_bool) {
            $popup.find(".btn-close").hide();//정답보기 버튼이 있는 경우만 닫기 버튼 감춤
            if ($('.correct').is('button')) {
                $('button.correct').removeClass('correct');
            } else if (!$(".correct").hasClass("point")) {
                $('.correct').css("visibility", "hidden");
            }
            $(window).trigger("CorrectHide");
        }
    } else {
        $popup.removeClass("btnshow");
        $popup.find(".btn-close").show();
    }
    // trapFocus 함수를 $popup 객체에 저장
    $popup.data('trapFocus', function (event) {
        var isTabPressed = (event.key === 'Tab' || event.keyCode === 9);
        if (!isTabPressed) {
            return;
        }
        if (event.shiftKey) {
            // Shift + Tab: 포커스를 첫 요소로 이동
            if (document.activeElement === $firstFocusableElement[0]) {
                $lastFocusableElement.focus();
                event.preventDefault();
            }
        } else {
            // Tab: 포커스를 마지막 요소로 이동
            if (document.activeElement === $lastFocusableElement[0]) {
                $firstFocusableElement.focus();
                event.preventDefault();
            }
        }
    });

    $popup.on('keydown', $popup.data('trapFocus'));

    // 팝업창이 열릴 때, 첫 번째 포커스 가능한 요소에 포커스를 맞춤
    //$popup.show(); // 팝업창을 보이게 함
    setTimeout(function () { $firstFocusableElement.focus(); }, 100);
}

function popRemove_fn(targetElm) {// 팝업창이 닫혔을 때의 팝업창에 대한 이벤트 제거 및 이전 포커스에 포커스를 둠
    var $popup = $(targetElm); // 팝업창을 선택
    // 저장된 trapFocus 함수를 이용해 이벤트 핸들러 제거
    $popup.off('keydown', $popup.data('trapFocus'));

    // 포커스를 원래 위치로 되돌리기
    if ($popup.is(".pop.feedback")) {
        if ($(".btn.btn-ok").is(":visible")) {
            $(".btn.btn-ok").focus();
        } else if ($(".btn.btn-save").is(":visible")) {
            $(".btn.btn-save").focus();
        } else if ($(".btn.btn-retry").is(":visible")) {
            $(".btn.btn-retry").focus();
        }
    } else if ($popup.is(".pop.solution")) {
        $(".btn.btn-solve").focus();
    }
}

function correctSet_fn(dap_arr,latex_bool=true) {//dap_array 내용을 correct 클래스에 순서대로 Mathml 형태로 변환해서 보여주는 함수
    for (var i = 0; i < dap_arr.length; i++) {
        var dap = dap_arr[i];
        if (Array.isArray(dap)) {
            dap = dap[0];
        }
        if(latex_bool){
            viewMathJaxStr(dap, $(".correct").eq(i));
        }else{
            $(".correct").eq(i).html(dap);
        }
    }
}

function compareAnsDap(ans, dap) {//사용자 입력값과 정답을 비교해서 리턴시키는 함수, dap 이 배열이면 dap 안에 ans가 있으면 참으로 처리
    if (Array.isArray(dap)) {
        return dap.includes(ans);
    } else {
        return ans === dap;
    }
}

/****  천재교육 자체 함수 관련 호출 ****/
function chkInputUp_fn() {
    if ($(".btn-blank-wrap input").length > 0) $(".btn-blank-wrap input").prop("checked", false);
}
function saveQuiz_fn(q_id, q_type, q_val, ip_val) {
    endTime = new Date(); // 현재 시간
    var timeDiff = (endTime - startTime) / 1000; // 초 단위로 계산
    chkInputUp_fn();//빈칸보기 택일형에 선택창이 올라와 있는 경우 내려가게 처리
    if (qCorrectType_bool) {//
        var o_str = ($(".pop.feedback").css("display") != "none" && $(".pop.feedback").attr("class").match(/\bcorrect/) && !$(".pop.feedback").attr("class").match(/\bincorrect/)) ? "1" : "0";
        if (ip_val == "") o_str = " ";
        QuizCorrectSave_fn(q_id, qType, o_str);
        if(!multiQuiz){//단일문제에서는 바로 view 도 complete 저장 처리
            viewSave_fn(pageNum, "complete", o_str);
        }
        if (location.href.indexOf("mtcontents.synology.me") > 0 || !web_bool) {//테스트용으로 임시로 처리
            showToast("QUIZ_INPUT 저장값:" + ip_val + ", QUIZ_CORRECT 저장값 : " + o_str);
        }
    }
    setActivityData(
        "QUIZ_INPUT",
        JSON.stringify({
            id: q_id,
            type: q_type
        }),
        JSON.stringify({
            input: ip_val,
            solveTime: String(timeDiff),
            answer: q_val
        })
    );
    /** @SET_PARAMS
        'QUIZ_INPUT',
        {
          "id": 퀴즈 아이디 (String)
          "type": 퀴즈 유형 (String)
          "answer": 퀴즈 정답 (String) - 다수일경우 구분자 "|" 사용
        },
        {
          "input": 사용자가 입력한 값 (String | Array | Object)
          "solveTime": 풀이 시간 (미정)
        }
    */
    /** @퀴즈유형
     * Q001 선택형
     * Q002 단답형
     * Q003 드래그앤드랍
     * Q004 영역선택형
     * Q005 그리기형
     * Q006 지오보드형
     * Q007 줄긋기형
     * Q008 레이어팝업(단답형)
     */
}
function getQuizVal_fn(q_id, q_type, q_fn) {//퀴즈에 입력한 값 불러오기 - q_fn 은 함수명(문자열)
    saveQuiz_type = "saveQuiz";
    var rtn_val = "";
    getActivityData(
        "QUIZ_INPUT",
        JSON.stringify({ id: q_id, type: q_type }),
        //JSON.stringify({ id: q_id, type: q_type, rnd_num: Math.random() }),
        q_fn
    );
    //return rtn_val;
    /** @RETURN_PARAMS
        {
          "id": 퀴즈 아이디 (String)
          "type": 퀴즈 유형 (String)
          "answer": 퀴즈 정답 (String) - 다수일경우 구분자 "|" 사용
          "input": 사용자가 입력한 값 (String | Array | Object)
          "solveTime": 풀이 시간 (미정)
        }
    */
   try{
        if(!isEmpty(chapNum) && Number(chapNum)%2==0){//짝수 챕터일때 토키 캐릭터로 강제 바꿈
            char_no =2;
        }
   }catch(e){
       
   }
}
function QuizCorrectSave_fn(q_id, q_type, o_val) {//퀴즈 타입인 경우 QUIZ_CORRECT 동시 저장을 위해 선언
    setActivityData(
        "QUIZ_CORRECT",
        JSON.stringify({
            id: q_id,
            type: q_type
        }),
        o_val
    );
}
function SaveQuizCorrect_fn(q_id, q_type, ip_val) {
    chkInputUp_fn();
    setActivityData(
        "QUIZ_CORRECT",
        JSON.stringify({
            id: q_id,
            type: q_type
        }),
        JSON.stringify({
            answer: ip_val
        })
    );
    /** @SET_PARAMS
        'QUIZ_CORRECT',
        {
          "id": 퀴즈 아이디 (String)
          "type": 퀴즈 유형 (String)
        },
        {
          answer: "0" //"정오답여부 (맞음 1, 틀림 0) (String)"
        }
    */
    /** @퀴즈유형
     * Q001 선택형
     * Q002 단답형
     * Q003 드래그앤드랍
     * Q004 영역선택형
     * Q005 그리기형
     * Q006 지오보드형
     * Q007 줄긋기형
     * Q008 레이어팝업(단답형)
     */
}
function getQuizCorrect_fn(q_id, q_type, q_fn) {//퀴즈에 입력한 값 불러오기 - q_fn 은 함수명(문자열)
    saveQuiz_type = "SaveQuizCorrect";
    var rtn_val = "";
    getActivityData(
        "QUIZ_CORRECT",
        JSON.stringify({ id: q_id, type: q_type }),
        q_fn
    );
    /** @SET_PARAMS
        'QUIZ_CORRECT',
        {
          "id": 퀴즈 아이디 (String)
          "type": 퀴즈 유형 (String)
        },
        {
          answer: "0" //"정오답여부 (맞음 1, 틀림 0) (String)"
        }
    */
    //return rtn_val;
}
function SaveStudyAct_fn(s_id, s_type, ip_val) {
    chkInputUp_fn();//빈칸보기 택일형에 선택창이 올라와 있는 경우 내려가게 처리
    setActivityData(
        "STUDY_ACT",
        JSON.stringify({ id: s_id, type: s_type }),
        JSON.stringify({ act: ip_val })
    );
    if (location.href.indexOf("mtcontents.synology.me") > 0 || !web_bool) showToast("STUDY_ACT 저장값:" + ip_val);
    /** @SET_PARAMS
        'STUDY_ACT',
        {
          "id": 학습활동 아이디 (String)
          "type": 학습활동 유형 (String)
        },
        "학습활동정보 (String | Array | Object)"
    */
    /** @학습활동유형
     * S001 선택형
     * S002 입력형
     * S003 서술형
     * S004 그리기형(이미지 저장형)
     */
}
function getStudyAct_fn(s_id, s_type, s_fn) {//학습활동에 입력한 값 불러오기 - s_fn 은 함수명(문자열)
    saveQuiz_type = "SaveStudyAct";
    var rtn_val = "";
    getActivityData(
        "STUDY_ACT",
        JSON.stringify({ id: s_id, type: s_type }),
        s_fn
    );
    /** @RETURN_PARAMS
        {
          "id": 학습활동 아이디 (String)
          "type": 학습활동 유형 (String)
          "data": 학습활동정보 (String | Array | Object)
        }
    */
    //return rtn_val;
}
function viewSave_fn(pgNum, pgType, oxVal) {//view 데이타 저장
    if (typeof (pgNum) == "undefined" || isEmpty(pgNum)) pgNum = pageNum;
    if (typeof (pgType) == "undefined" || isEmpty(pgType)) pgType = "complete";
    if (typeof (oxVal) == "undefined" || isEmpty(oxVal)) oxVal = "0";
    var view_no = String(pgNum);
    setActivityData("VIEW_CORRECT", JSON.stringify({view :view_no}), JSON.stringify({correct: oxVal}));
    setActivityData("VIEW_STATUS", JSON.stringify({view: view_no}), JSON.stringify({status: pgType}));
}
function setLastPage_fn(pgName = null) {//마지막 페이지 정보 저장
    if (isEmpty(pgName)) pgName = String(pageNum);
    setActivityData("LAST_PAGE", lastPgId, pgName);
    /** @SET_PARAMS
        "LAST_PAGE",
        "마지막 페이지 구분값 (String)"
        "마지막 페이지 정보 (String)"
    */
}
function getLastPage_fn(l_fn) {//마지막 페이지 정보 불러오기 - l_fn 은 함수명(문자열)
    getActivityData("LAST_PAGE", lastPgId, l_fn);
    /** @RETURN_PARAMS
        {
          "type": 구분값 (String) - 아이디값
          "data": 마지막 페이지 정보 (String)
        }
    */
}
function getUserType_fn(data) {//data 는 문자열로 "TE" 또는 "ST"
    if (typeof (data) == "undefined" || isEmpty(data)) return;
    setTimeout(function () {
        if (data == "TE") {
            $saveBtn.off("click").on("click", function () {
                fakeAns_fn();
                $(window).trigger("teacherSave");//교사정답보기 이벤트
                if (qType == "Q003") setDragAnswerForTeacher();//드래그형 정답을 설정하는 함수
                if (qType == "Q007") setDrawLineForTeacher();//선긋기형 정답을 설정하는 함수
                if ($(".quiz-ox-list").length > 0) setOXAnswerForTeacher();//OX형 정답을 설정하는 함수
                if (typeof (isWrong_fn) != "undefined"){
                    isWrong_fn();
                }
                if (typeof (chkDapAll_fn) != "undefined") chkDapAll_fn();
                if (typeof (chkDap_fn) != "undefined") chkDap_fn();
                if ($('.btn-mask').length > 0) $('.btn-mask').click();
                $(".correct").addClass("show");//그냥 정답 보이게 처리함
                $(".btn.btn-retry").css("display", "block");
                $(".btn.btn-solve").css("display", "block");
                $(".btn-board").css("display", "block");
                $(this).css("display", "none");
                $('.btn').addClass('reload');
            });
            $(window).trigger("teacherInit");//교사모드 초기 진입시
        }
    }, 100);
    function fakeAns_fn() {
        if (typeof (dap_array) == "undefined" || dap_array.length == 0) return;
        if (arraysEqual_fn(dap_array, ans_array)) return;
        for (var i = 0; i < dap_array.length; i++) {
            if (isEmpty(ans_array[i])) ans_array[i] = dap_array[i] + "_f";//가짜 정답으로 설정
        }
    }
}
// 교사용 드래그형 정답을 설정하는 함수
function setDragAnswerForTeacher() {
    if (typeof (dap_array) == "undefined" || dap_array.length == 0) return;
    ans_array = []; // 정답 배열 초기화
    for (var i = 0; i < dap_array.length; i++) {
        ans_array[i] = dap_array[i]; // 정답 배열에 정답 값 설정
        var button = $("#button-" + i);
        var correctPosition = $(".drag-top .ui-droppable").eq(dap_array[i] - 1);
        if (dap_array[i] - 1 < 0) continue;
        correctPosition.append(button); // 정답 위치에 버튼 배치
        button.css({
            left: 'auto',
            top: 'auto'
        });
        button.draggable('disable'); // 드래그 비활성화
        button.data("isDropped", true); // 드롭 상태 설정
    }
    $(".drag-list button").draggable('disable'); // 모든 버튼 드래그 비활성화
    quiz_on = false; // 퀴즈 진행 상태를 false로 설정
}
// 교사용 선긋기형 정답을 설정하는 함수
function setDrawLineForTeacher() {
    ans_array = [].concat(dap_array); // 정답 배열 초기화
    if (typeof (oLineDraw_fn) != "undefined") {
        oLineDraw_fn(); // 정답 선 그리기
        if (typeof (redrawLines) != "undefined") redrawLines();
    }
    if (typeof (loadLineDraw_fn) != "undefined") {
        load_bool = true;
        loadLineDraw_fn();
        load_bool = false;
    }
}
// 교사용 OX형 정답을 설정하는 함수
function setOXAnswerForTeacher() {
    if (typeof (dap_array) == "undefined" || dap_array.length == 0) return;
    ans_array = []; // 정답 배열 초기화
    for (var i = 0; i < dap_array.length; i++) {
        ans_array[i] = dap_array[i]; // 정답 배열에 정답 값 설정
        if (dap_array[i] == 1) {
            $(".quiz-ox-list .btn-o").eq(i).click();
        } else {
            $(".quiz-ox-list .btn-x").eq(i).click();
        }
    }
    quiz_on = false; // 퀴즈 진행 상태를 false로 설정
}
function chkOxType_fn(qclass){//발견하기만 빼고 모든 타입은 정오답 처리함
    if (qclass == "find") {
        return false;
    }
    return true;
}
function videoSet_fn(v_id) {//비디오의 아이디값을 지정받아 이벤트 미리 선언
    myVideo = document.getElementById(v_id);
    var hasStarted = false; // 비디오가 처음 시작되었는지 추적하는 플래그
    var intervalId;

    if (!myVideo) return;
    myVideo.addEventListener('volumechange', function () {
        if (video.muted) {
            setVideo_fn(v_id, "mute");
        }
    });

    myVideo.addEventListener('play', function () {
        if (!hasStarted) {
            setVideo_fn(v_id, "start");
            hasStarted = true; // 첫 재생이 확인되면 플래그 업데이트
        }
        intervalId = setInterval(function () {
            //console.log('Current Time:', video.currentTime);
            setVideo_fn(v_id, "playtime", String(myVideo.currentTime));
        }, 3000);
    });
    myVideo.addEventListener('pause', function () {
        setVideo_fn(v_id, "pause");
        clearInterval(intervalId);
    });
    myVideo.addEventListener('ended', function () {
        // 비디오 재생이 끝나면, 인터벌을 중지
        clearInterval(intervalId);
        //console.log('Video ended. Final time was:', video.currentTime);
    });
    //getVideo_fn(v_id, "goJumpTime_fn");
}
function setVideoInteractedAPI() {
    const videoData = document.querySelector("video");
    if (document.fullscreenElement === videoData) {
        setActivityData("VIDEO", JSON.stringify({ 'id': 'VID01', 'event': 'interacted' }), JSON.stringify({ volume: videoData.volume, isFullscreen: true, playbackRate: videoData.playbackRate }));
    } else {
        setActivityData("VIDEO", JSON.stringify({ 'id': 'VID01', 'event': 'interacted' }), JSON.stringify({ volume: videoData.volume, isFullscreen: false, playbackRate: videoData.playbackRate }));
    }
}
function goJumpTime_fn(data) {
    if (data.data) {
        if (myVideo) {
            myVideo.currentTime = data.data;
        }
    }
}
function setVideo_fn(v_id, evt_str, evt_val = "1") {//playtime일때만 evt_val 값을 문자열로 받음
    setActivityData(
        "VIDEO",
        JSON.stringify({ id: v_id, event: evt_str }),
        evt_val
    );
    /** @SET_PARAMS
        'VIDEO',
        {
          "id": 식별 아이디 (String)
          "event": 이벤트 (String) (start | pause | skip | mute | playtime)
        },
        "이벤트별 데이터 (String)"
        ### 이벤트별 데이터 유형
          start : 1 (String)
          pause : 1 (String)
          skip : 1 (String)
          mute : 1 (String)
          playtime : 재생시간 (String)
    */
}
function getVideo_fn(v_id, v_fn, evt_str = "playtime") {//getVideo("vidio04","rtn_fn") 형식으로 아이디값과 전달받을 함수명만 넘겨서 플레이 타임을 받아오도록 처리
    getActivityData(
        "VIDEO",
        JSON.stringify({ id: v_id, event: evt_str }),
        v_fn
    );
    /** @RETURN_PARAMS
        {
          "id": 식별 id (String)
          "event": 이벤트 (String)
          "data": 이벤트별 데이터 (String)
        }
    */
}
function call_OCR(ocr_idx) {// 수식입력기
    //latexStr_array 는 act.js 내에 선언
    //OcrRtn1, OcrRtn2 등 함수도 act.js 내에 선언
    callContentsTool(
        "OCR",
        JSON.stringify({
            id: "OCR_ID_0" + ocr_idx,
            type: "math",
            imgPath: "/img.png",
            callback: "OcrRtn" + ocr_idx,
        })
    );
}
function call_EXPRESS(exp_idx) {// 수식입력기
    //latexStr_array 는 act.js 내에 선언
    if (location.href.indexOf("mtcontents.synology.me") > 0 || !web_bool) {//테스트용으로 임시로 처리
        //if(isEmpty(ans_array[exp_idx - 1])){
        var idx = exp_idx - 1;
        if(multiQuiz){
            var no_idx = findQArange(exp_idx);//문제번호를 찾는 함수
	        ans_array = ansObj["ans" + no_idx];
        }
        ans_array[idx] = dap_array[idx];
        if (typeof (dap_array[idx]) == 'object') ans_array[idx] = dap_array[idx][0];//복수정답인 경우 첫번째 값만 사용
        //}
    }
    //ExpRtn1, ExpRtn2 등 함수도 act.js 내에 선언
    callContentsTool(
        "EXPRESS",
        JSON.stringify({
            id: "EXPRESS_0" + exp_idx,
            key: "M",
            latex: isEmpty(ans_array[exp_idx - 1]) ? "" : ans_array[exp_idx - 1],//ans_array 는 act.js 내에 선언
            callback: "ExpRtn" + exp_idx,
        })
    );
}

/*** MathJax 관련 ****/
async function insertLatex(btn) {//라텍스 구문의 버튼 클릭시 QuizInput에 라텍스 구문을 추가
    try {
        // btn이 문자열이면 그대로, HTML 요소면 innerHTML 사용
        var btnStr = (typeof btn === 'string') ? btn : btn.innerHTML;
        // 커서 위치에 수식 삽입
        const latexStr = `<span class="mathjax-rendered" contenteditable="false">${btnStr}</span>&nbsp;`;
        document.execCommand('insertHTML', false, latexStr);

        // MathJax로 수식 렌더링 동기 처리
        await MathJax.typesetPromise([QuizInput]);
        moveCursorToEndOfEditor();
    } catch (err) {
        console.error(err.message);
    }
}
async function insertLatex_fn(l_str) {//라텍스 구문의 버튼 클릭시 라텍스 구문문자열을 바로 받아 QuizInput에 라텍스 구문을 추가
    try {
        // 커서 위치에 수식 삽입
        const latexStr = `<span class="mathjax-rendered" contenteditable="false">${l_str}</span>&nbsp;`;
        document.execCommand('insertHTML', false, latexStr);

        // MathJax로 수식 렌더링 동기 처리
        await MathJax.typesetPromise([QuizInput]);
        moveCursorToEndOfEditor();
    } catch (err) {
        console.error(err.message);
    }
}
function moveCursorToEndOfEditor() {
    const range = document.createRange();
    const selection = window.getSelection();

    // 마지막 자식 요소를 찾고 그 끝에 커서를 배치
    range.selectNodeContents(QuizInput);
    range.collapse(false); // false: 끝으로 이동

    selection.removeAllRanges();
    selection.addRange(range);
}
function chglatexStr_fn(l_str) {
    if (typeof (l_str) != "string") l_str = String(l_str);
    if (l_str.substr(0, 4) == "sqrt") {
        return "\\" + l_str;
    }
    return l_str;
}
function chgMathJax(latexStr) {
    // MathJax가 처리할 수 있는 형태로 LaTeX 문자열 변환
    // LaTeX 수식을 \(...\)로 감싸서 인라인 수식으로 처리
    return "\\(" + latexStr + "\\)";
}
function escapeLatexStr(latexStr) {
    // 문자열 내의 모든 \를 \\로 바꾼다.
    return latexStr.replace(/\\/g, "\\\\");
}
function setMathJax() {//MathJax 관련 js를 인클루드 한 후 세팅
    MathJax = {
        chtml: {
            fontURL: "fonts" // 상대 경로로 폰트 URL 지정
        }
    };
    //jsInclude_fn(latex_js);//common 에 선언된 라텍스 js 파일을 인클루드시킴
}
function viewMathJaxStr(latexStr, jqInputEl) {//latex문자열과 jquery 개체를 받아 jquery개체에 뿌려줌
    var mjaxStr = chgMathJax(latexStr); // MathJax 형식으로 변환
    jqInputEl.html(mjaxStr);
    jqInputEl.prev(".btn-math").css("background-image", "none");//수식이 입력될때 버튼 배경을 없애줌
    // MathJax에게 새로운 수식을 렌더링하라고 명령
    MathJax.typesetPromise();
}
function canvasDraw_fn(ctx, img_src) {//캔바스 2D랜더링 컨텍스트 -ctx, img_src 에 해당하는 문자열
    var img = new Image();//임시로 이미지 객체 생성
    img.crossOrigin = "Anonymous"; // CORS 정책 준수를 위해 이 속성 설정
    img.src = img_src;
    img.onload = function () {// 이미지 로드가 완료되면 이 부분이 실행됩니다.
        ctx.drawImage(img, 0, 0, img.width, img.height);
    };
}
function shake_fn(button) {//button 은 jquery 개체
    var times = 8; // 애니메이션 횟수
    var distance = 5; // 떨림 거리
    var duration = 50; // 한 번 떨림의 지속 시간
    function shake(times, distance, duration) {
        if (times > 0) {
            button.css('transform', 'translateX(' + (times % 2 === 0 ? distance : -distance) + 'px)');
            setTimeout(function () {
                shake(--times, distance, duration);
            }, duration);
        } else {
            button.css('transform', 'translateX(0px)');
        }
    }
    shake(times, distance, duration);
}
function altJsonLoad() {//각 페이지 내의 img 태그에 json 파일에서 불러서 alt 태그 적용
    //var jsonFileName = pageName.replace(".html", ".json");
    var jsonFileName = pageName + ".json";
    $.getJSON("js/" + jsonFileName, function (data) {
        // 페이지 내의 모든 img 태그를 순회
        $('img').each(function () {
            var imgElement = $(this); // 현재 img 태그
            var src = imgElement.attr('src'); // img 태그의 src 속성 값

            // JSON 데이터에서 첫 번째 일치하는 src 속성을 가진 객체를 찾음
            var matchingItem = data.find(item => item.src === src);

            // 일치하는 항목이 있으면 alt와 title 속성을 설정
            if (matchingItem) {
                imgElement.attr("alt", matchingItem.alt);
                imgElement.attr("title", matchingItem.title);

                // 일치하는 항목을 data 배열에서 제거하여 중복 처리 방지
                data.splice(data.indexOf(matchingItem), 1);
            }
        });
    }).fail(function (jqXHR, textStatus, errorThrown) {
        console.log(textStatus);
    });
}
function viewAlt_fn() {
    // 모든 <img> 태그를 순회하며 alt 속성의 값을 title 속성에 설정
    document.querySelectorAll('img').forEach(function (img) {
        if (img.getAttribute('alt') && !img.getAttribute('title')) {
            img.setAttribute('title', img.getAttribute('alt'));
        }
    });
}


function isEmpty(ipStr) {//ipStr 은 문자열
    if (typeof (ipStr) == "undefined") return true;
    if (typeof (ipStr) == "string" && (ipStr.indexOf("mjx-container") > 0 && ipStr.indexOf("path") < 0)) return true;//처음 $("#QuizInput").html() 에 빈 mjx-container 값이 들어가서 임시로 처리
    if (!isNaN(ipStr) && typeof (ipStr) == "number") return false;
    if (ipStr == "" || ipStr == " " || ipStr == undefined) return true;
    return false;
}
function EmptyMsg_fn() {
    alert("내용을 입력해 주세요")
}
function saveMsg_fn() {
    alert("내용이 저장되었습니다.")
}
function isWeb() {
    if (protocol === "http:" || protocol === "https:") {
        return true
    } else {
        return false;
    }
}

function playMP3_fn(mp3Url, sec = 0) {
    mp3Play_array[mp3Url] = true;
    if (audio) audio.pause();
    audio = new Audio(mp3Url);
    var vol_data = loadData_fn("aim_vol");
    if (isEmpty(vol_data)) {
        vol_data = 50;
        saveData_fn("aim_vol", vol_data);
    }
    // sec초로 설정하고 play
    audio.addEventListener('loadedmetadata', () => {
        if ($(".btn-audio").hasClass("audio-off")) {
            audio.volume = 0;
        } else {
            audio.volume = vol_data / 100;
        }
        // 총 길이보다 클 경우 방지
        if (sec < audio.duration) {
            audio.currentTime = sec;
        }
        audio.play().catch(error => {
            console.log('재생 시작 실패:', error);
        });
    });
    // 종료 후 상태 초기화
    audio.addEventListener('ended', () => {
        mp3Play_array[mp3Url] = false;
    });
}

function isScriptIncluded(filename) {
    var scripts = $("script[src]");
    for (var i = 0; i < scripts.length; i++) {
        if (scripts[i].src.includes(filename)) {
            return true;
        }
    }
    return false;
}

function itoStr(n) {//두자리 이하숫자를 두자리 문자열로
    if (n < 10) return "0" + n;
    return String(n);
}
function roundTo3D(value) {//roundToThreeDecimals
    // 소수점 이하 3자리로 반올림하여 반환
    return Math.round(value * 1000) / 1000;
}

function ArrStrToInt(stringArray) {//숫자형 문자로 된 원소로 구성된 배열 원소를 숫자형으로 변환
    return stringArray.map(function (item) {
        return parseInt(item, 10); // 10진수로 변환
    });
}
function delElmFromArr(array, element) {//배열에서 해당 원소를 제거하는 함수
    let index;
    while ((index = array.indexOf(element)) !== -1) {
        array.splice(index, 1);
    }
}
function arraysEqual(arr1, arr2) {
    // 배열의 길이가 다르면 false 반환
    if (arr1.length !== arr2.length) return false;
    // 배열의 각 원소를 비교
    for (let i = 0; i < arr1.length; i++) {// 배열일 경우 재귀적으로 비교
        if (Array.isArray(arr1[i]) && Array.isArray(arr2[i])) {
            if (!arraysEqual(arr1[i], arr2[i])) return false;
        } else if (arr1[i] !== arr2[i]) {
            return false; // 원소가 다르면 false 반환
        }
    }
    return true; // 모든 원소가 같으면 true 반환
}
function arraysEqual_fn(arr1, arr2) {//다른 js 에서 arraysEqual 을 사용하고 있는 곳이 있어서 재선언함
    // 배열의 길이가 다르면 false 반환
    if (arr1.length !== arr2.length) return false;
    // 배열의 각 원소를 비교
    for (let i = 0; i < arr1.length; i++) {// 배열일 경우 재귀적으로 비교
        if (Array.isArray(arr1[i]) && Array.isArray(arr2[i])) {
            if (!arraysEqual_fn(arr1[i], arr2[i])) return false;
        } else if (arr1[i] !== arr2[i]) {
            return false; // 원소가 다르면 false 반환
        }
    }
    return true; // 모든 원소가 같으면 true 반환
}
function addElmSort(array, element) {
    // 중복된 원소가 없으면 배열에 추가
    if (!array.includes(element)) {
        array.push(element);
    }
    // 배열을 오름차순으로 정렬
    array.sort(function (a, b) {
        return a - b;
    });
}
// -- 언어에 따라 이미지명 바꾸기 -- //
function applyLanguageImages(lang) {
    const images = document.querySelectorAll('.lang-image');
    const imgToTxts = document.querySelectorAll('img.lang-text');

    images.forEach(img => {
        const originalSrc = img.getAttribute('data-orig-src') || img.getAttribute('src');
        img.setAttribute('data-orig-src', originalSrc); // 최초 원본 보관

        const newSrc = lang === 'ko'
            ? originalSrc
            : originalSrc.replace(/(\.[a-zA-Z0-9]+)$/, `_${lang}$1`);

        img.onerror = () => {
            img.onerror = null;
            img.src = originalSrc;
        };

        img.src = newSrc;
    });
    imgToTxts.forEach(img => {// 이미지에 alt 속성값을 텍스트로 변환
        const currentLang = getPageLang();
        const translatedSpan = img.nextElementSibling;
        const isTranslatedSpan = translatedSpan && !translatedSpan.classList.contains('translated-text');

        if (currentLang && currentLang !== 'ko') {
            // 한국어가 아닌 언어로 변경될 때
            if (!img.dataset.translationHandled) {
                const alt = img.getAttribute('alt');
                if (alt) {
                    const span = document.createElement('span');
                    span.className = 'translated-text';
                    span.textContent = alt;
                    img.style.display = 'none';
                    img.parentNode.insertBefore(span, img.nextSibling);
                    img.dataset.translationHandled = 'true';
                }
            }
        } else {
            // 한국어로 변경될 때
            if (img.dataset.translationHandled) {
                img.style.display = '';
                const span = img.nextElementSibling;
                if (span && span.classList.contains('translated-text')) {
                    span.remove();
                }
                delete img.dataset.translationHandled;
            }
        }
    });
}
function getPageLang() {
    return document.documentElement.lang || 'ko';
}
function chkChgLang_fn() {// 이후 lang 변경 감지
    const observer = new MutationObserver(() => {
        const newLang = getPageLang();
        applyLanguageImages(newLang);
    });
    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['lang']
    });
}

function observerClass_fn($Elm, classNm, appear_fn, remove_fn) {//$Elm-jquery개체,classNm-클래스명,appear_fn, remove_fn-반환함수
    // MutationObserver를 이용한 클래스 추가/제거 감지
    const targetNode = $Elm[0]; // jQuery 개체에서 DOM 요소로 변환
    if (!targetNode) {
        //console.log(`Element not found for selector: ${$Elm.selector}`);
        return; // 요소가 없으면 함수 종료
    }
    const observer = new MutationObserver((mutationsList) => {
        mutationsList.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const classList = mutation.target.classList;
                if (classList.contains(classNm)) {
                    // 클래스가 추가되었을 때
                    if (appear_fn) appear_fn(targetNode);
                } else {
                    // 클래스가 제거되었을 때
                    if (remove_fn) remove_fn(targetNode);
                }
            }
        });
    });
    try {
        observer.observe(targetNode, { attributes: true, attributeFilter: ['class'] });
    } catch (e) {
        //console.log(e);
    }
}
// Hex 색상을 RGBA로 변환하는 함수
function hexToRgba(hex, alpha) {
    // # 기호 제거
    hex = hex.replace('#', '');

    // R, G, B 값을 추출
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // RGBA 형식의 문자열 반환
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
function copyClipboard_fn(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('클립보드에 텍스트가 복사되었습니다.');
    }).catch(err => {
        console.error('클립보드 복사 실패:', err);
    });
}
function updateNumberInputs() {// 숫자 입력 필드에 inputmode, step, pattern 속성 추가
    $('input[type="number"]').each(function() {
      $(this)
        .attr('inputmode', 'decimal')
        .attr('step', '1')
        // 자바스크립트 문자열 내에서 역슬래시를 표현하기 위해 이스케이프 처리 필요합니다.
        .attr('pattern', '\\d*');
    });
}
// UTF-8 문자열을 Base64로 인코딩하는 함수
function utf8ToBase64(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (match, p1) {
        return String.fromCharCode('0x' + p1);
    }));
}

// Base64를 UTF-8 문자열로 디코딩하는 함수
function base64ToUtf8(str) {
    return decodeURIComponent(atob(str).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
}
function showToast(message) {//토스트 메시지 보이기
    var toast = $('#toast');
    toast.text(message);
    toast.fadeIn(400).delay(3000).fadeOut(400);
}
function saveData_fn(key, value) {//key는 문자열, value는 객체 - 로컬스토리지에 저장
    localStorage.setItem(key, JSON.stringify(value));
}
function loadData_fn(key) {
    return JSON.parse(localStorage.getItem(key));
}
function detectDevice() {
    const ua = navigator.userAgent;

    if (ua.includes("CrOS")) {
        return "chromebook"; // 크롬북
    } else if (/Windows/i.test(ua) && /Touch/i.test(ua)) {
        return "windows tablet"; // 윈도우 태블릿
    } else if (/Windows/i.test(ua)) {
        return "pc"; // 윈도우 PC
    } else if (/mobile/i.test(ua)) {
        return "smartphone"; // 스마트폰
    } else if (/tablet/i.test(ua) || /(iPad|PlayBook)/i.test(ua)) {
        return "tablet"; // 태블릿
    } else {
        return "pc"; // 기본적으로 PC로 간주
    }
}
// 브라우저 창크기에 맞춰 화면 스케일 조정
function adjustWrapScale() {
    const wrap = document.querySelector('.wrap');
    if (isEmpty(wrap)) return;
    const ratio = 1920 / 1080;
    const windowRatio = window.innerWidth / window.innerHeight;
    let scale;
    if (windowRatio < ratio) {
        scale = window.innerWidth / 1920; // 가로가 더 좁은 경우
    } else {
        scale = window.innerHeight / 1080; // 세로가 더 좁은 경우
    }
    win_scale = scale;
    wrap.style.transform = 'scale(' + scale + ')';
}
window.addEventListener('resize', adjustWrapScale); // 브라우저 창 크기가 변경될 때마다 실행
adjustWrapScale(); // 페이지 로드 시 실행
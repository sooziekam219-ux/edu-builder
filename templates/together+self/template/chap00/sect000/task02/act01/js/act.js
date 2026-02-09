var card_array=[0,0,0,0,0,0];//스티커 갯수만큼 원소를 생성함 - 스티커가 3개이면 [0,0,0]
//H 스티커벗기기
var chasi = "04";//차시별로 따로 지정해야 함
var qType_array = ["S002"];//입력형
var q_class = "selfquiz";//quiz 와 ssok, find 형 으로 구분 - 퀴즈 쏙 은 정답이 아니면 튕김
var char_no=1;//캐릭터 번호 1:당근, 2토끼

var saveType = "ok";// "ok"(확인 - btn-ok 클래스) or "save"(저장하기 - btn-save 클래스)
if (q_class == "ssok") saveType = "save";

var ans_array = [];
var pgQId = "Q" + chasi + "_" + curActNum + "_" + pageNum;//curActNum과 pageNum 은 common 에 선언되어 있음
var qId_array = [pgQId];// 여러개의 아이디가 필요한 경우 pgQId+"_1",pgQId+"_2" 형식으로 붙임
var qId = qId_array[0];
var qType = qType_array[0];
var quiz_on = true;
var card_len=card_array.length;

$(function() {
	BtnSet_fn();
	getStudyAct_fn(qId,qType,"getQData_fn");
});
function BtnSet_fn(){
	$saveBtn = (saveType == "ok") ? $(".btn.btn-ok") : $(".btn.btn-save");//btn-save or btn-ok
	$saveBtn.click(function(){//저장 버튼 클릭시
		for(var i=0;i<card_len;i++){
			if($(".btn-mask").eq(i).hasClass("hide")){
				card_array[i]=1;
			}	
		}
		var saveStr=card_array.join("|");
		SaveStudyAct_fn(qId,qType,saveStr);		
        $(".btn.btn-retry").css("display","block");
        $(this).css("display","none");
		$('.btn').addClass('reload');
		quiz_on=false
	})
	$(".btn.btn-retry").click(function(){
		retry_fn();	
	})
	$('.btn-mask').on('click', function(){
		if(!quiz_on) return;
        $(this).addClass('hide').nextAll().css({display:'inline'});
    });
}
function retry_fn(){
	$saveBtn.css("display","block");
	$(".btn.btn-retry").css("display","none");
	$('.btn').addClass('reload');
	$('.btn-mask').removeClass("hide");
	$('.btn-mask').nextAll().css({display:''});
	quiz_on=true;
}
function getQData_fn(data){//처음 페이지 진입시 데이타 받아오는 함수
	if(!isEmpty(data.data)){
		var loadData_array=data.data.act.split("|");
		if(loadData_array.length==card_len && chkAllOn_fn(loadData_array)){
			$("#QuizInput").html(data.answer);
	        $(".btn.btn-retry").css("display","block");
	        $saveBtn.css("display","none");
	        $('.btn-mask').addClass('hide').nextAll().css({display:'inline'});
			quiz_on=false;
		}else{
			for(var i=0;i<loadData_array.length;i++){
				if(loadData_array[i]=="1"){
					$('.btn-mask').eq(i).addClass('hide').nextAll().css({display:'inline'})
				}
			}
		}
	}
	function chkAllOn_fn(loadData_arr){//loadData_arr 가 모두 값이 "1" 인지
		var allOn=true;
		for(var i=0;i<loadData_arr.length;i++){
			if(loadData_arr[i]!="1"){
				allOn=false;
				break;
			}
		}
		return allOn;
	}
}
/**
 * main.js
 * 애플리케이션 진입점 및 연결
 */

let poseEngine;
let gameEngine;
let stabilizer;

async function init() {
  const startBtn = document.getElementById("startBtn"); // (Overlay 버튼)
  const overlay = document.getElementById("game-overlay");

  // 1. Overlay 숨기기 (게임 시작 준비)
  if (overlay) overlay.classList.add("hidden");

  try {
    // 이미 초기화되어 있다면 시작만
    if (!poseEngine) {
      // 1. PoseEngine 초기화
      poseEngine = new PoseEngine("./my_model/");
      await poseEngine.init({ size: 200, flip: true });

      // 2. Stabilizer 초기화
      stabilizer = new PredictionStabilizer({ threshold: 0.8, smoothingFrames: 5 });

      // 3. GameEngine 초기화
      gameEngine = new GameEngine();
      gameEngine.init("game-canvas");

      // 4. Callback 연결
      poseEngine.setPredictionCallback(handlePrediction);
      poseEngine.setDrawCallback(drawWebcamPose);

      // UI 업데이트 연결
      gameEngine.setGameStateCallback(updateGameUI);
    }

    // 5. 엔진 시작
    poseEngine.start();
    gameEngine.start();

  } catch (error) {
    console.error("Initialization failed:", error);
    alert("카메라를 사용할 수 없거나 모델 로딩에 실패했습니다.");
    if (overlay) overlay.classList.remove("hidden");
  }
}

function handlePrediction(predictions, pose) {
  if (!stabilizer || !gameEngine) return;

  // 1. 안정화 (Stabilization)
  const stabilized = stabilizer.stabilize(predictions);

  // 2. 포즈가 뚜렷할 때만 게임에 전달
  if (stabilized.className) {
    gameEngine.onPoseDetected(stabilized.className);

    // 웹캠 아래 텍스트 업데이트
    const poseLabel = document.getElementById("pose-prediction");
    if (poseLabel) poseLabel.innerText = `현재 동작: ${stabilized.className} (${(stabilized.probability * 100).toFixed(0)}%)`;

    // 디버그용 라벨바 (선택사항)
    updateLabelBar(predictions);
  }
}

function drawWebcamPose(pose) {
  // 웹캠 캔버스에 그리기
  const canvas = document.getElementById("webcam-canvas");
  if (!canvas || !poseEngine.webcam) return;

  const ctx = canvas.getContext("2d");

  // 웹캠 영상
  if (poseEngine.webcam.canvas) {
    ctx.drawImage(poseEngine.webcam.canvas, 0, 0);
  }

  // 스켈레톤
  if (pose) {
    tmPose.drawKeypoints(pose.keypoints, 0.5, ctx);
    tmPose.drawSkeleton(pose.keypoints, 0.5, ctx);
  }
}

function updateGameUI(stateData) {
  if (stateData.state === 'PLAYING') {
    document.getElementById("score").innerText = stateData.score;
    document.getElementById("timer").innerText = stateData.time;

    document.getElementById("life").innerText = "❤️".repeat(stateData.life);

  } else if (stateData.state === 'GAMEOVER') {
    // 게임 오버 화면 표시
    const overlay = document.getElementById("game-overlay");
    overlay.classList.remove("hidden");

    document.getElementById("overlay-title").innerText = "GAME OVER";
    let msg = "";
    if (stateData.reason === "TIME_OVER") msg = "시간 종료! 👏";
    if (stateData.reason === "BOMB") msg = "폭탄을 건드렸어요! 💥";
    if (stateData.reason === "LIFE_ZERO") msg = "과일을 너무 많이 놓쳤어요 ㅠㅠ";

    document.getElementById("overlay-msg").innerText = `${msg}\n최종 점수: ${stateData.score}점`;

    document.getElementById("start-btn").style.display = "none";
    document.getElementById("restart-btn").style.display = "inline-block";
  }
}

function updateLabelBar(predictions) {
  const container = document.getElementById("label-container");
  if (!container) return;

  // 최초 생성
  if (container.childElementCount === 0) {
    predictions.forEach(p => {
      const div = document.createElement("div");
      container.appendChild(div);
    });
  }

  // 업데이트
  predictions.forEach((p, i) => {
    const div = container.children[i];
    div.innerHTML = `<span>${p.className}</span> <span>${(p.probability * 100).toFixed(0)}%</span>`;
    // 하이라이트
    div.style.background = p.probability > 0.8 ? "#d4edda" : "#f8f9fa";
  });
}

function restartGame() {
  gameEngine.start();
  document.getElementById("game-overlay").classList.add("hidden");
}

/* PoseEngine.init 호출 시 웹캠 캔버스 크기 맞춤 */
// 라이브러리 로드 대기 후 실행할 수도 있음 window.onload 등

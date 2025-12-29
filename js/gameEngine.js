/**
 * gameEngine.js
 * 게임 로직, 렌더링, 상태 관리 담당
 */

class GameEngine {
  constructor() {
    this.score = 0;
    this.level = 1;
    this.timeLimit = 60;
    this.isGameActive = false;
    
    this.ctx = null;
    this.canvasWidth = 0;
    this.canvasHeight = 0;
    
    // 게임 상태
    this.playerLane = 1; // 0: Left, 1: Center, 2: Right
    this.items = []; // 떨어지는 아이템 배열
    this.lastTime = 0;
    this.dropInterval = 1000; // 아이템 생성 주기 (ms)
    this.lastDropTime = 0;

    // 콜백
    this.onScoreChange = null;
    this.onGameEnd = null;
  }

  /**
   * 캔버스 컨텍스트 설정
   */
  setCanvas(ctx) {
    this.ctx = ctx;
    this.canvasWidth = ctx.canvas.width;
    this.canvasHeight = ctx.canvas.height;
  }

  /**
   * 게임 시작
   */
  start(config = {}) {
    if (!this.ctx) {
      console.error("Canvas context not set!");
      return;
    }

    this.isGameActive = true;
    this.score = 0;
    this.level = 1;
    this.timeLimit = config.timeLimit || 60;
    this.items = [];
    this.playerLane = 1;
    this.lastTime = performance.now();
    this.lastDropTime = 0;

    // 게임 루프 시작
    this.loop();
    
    // 타이머 시작
    this.startTimer();
  }

  /**
   * 게임 중지
   */
  stop() {
    this.isGameActive = false;
    this.clearTimer();
    
    if (this.onGameEnd) {
      this.onGameEnd(this.score, this.level);
    }
  }

  /**
   * 게임 루프
   */
  loop(timestamp) {
    if (!this.isGameActive) return;

    const deltaTime = timestamp - this.lastTime;
    this.lastTime = timestamp;

    this.update(deltaTime, timestamp);
    this.draw();

    requestAnimationFrame((ts) => this.loop(ts));
  }

  /**
   * 상태 업데이트
   */
  update(deltaTime, timestamp) {
    if (!this.ctx) return;
    
    // 1. 아이템 생성
    if (timestamp - this.lastDropTime > this.dropInterval) {
      this.spawnItem();
      this.lastDropTime = timestamp;
      
      // 레벨에 따라 난이도 조절 (생성 속도 증가)
      this.dropInterval = Math.max(400, 1000 - (this.level * 50));
    }

    // 2. 아이템 이동 및 충돌 처리
    const laneWidth = this.canvasWidth / 3;
    const playerX = this.playerLane * laneWidth + laneWidth / 2;
    const playerY = this.canvasHeight - 50;
    const playerRadius = 30;

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      
      // 이동
      item.y += item.speed * (deltaTime / 16); // 60fps 기준 보정

      // 화면 벗어남 처리
      if (item.y > this.canvasHeight) {
        this.items.splice(i, 1);
        continue;
      }

      // 충돌 처리 (간단한 원형 충돌 or 같은 라인 Y축 체크)
      // 같은 라인이고, Y 좌표가 닿았는지 확인
      if (item.lane === this.playerLane && 
          item.y + 20 > playerY - playerRadius && 
          item.y - 20 < playerY + playerRadius) {
        
        // 아이템 효과 적용
        this.applyItemEffect(item);
        this.items.splice(i, 1);
      }
    }
  }

  /**
   * 아이템 생성
   */
  spawnItem() {
    const lane = Math.floor(Math.random() * 3);
    const typeRandom = Math.random();
    let type = "apple";
    let speed = 3 + (this.level * 0.5);

    if (typeRandom < 0.1) {
      type = "bomb";
      speed *= 1.2; // 폭탄은 더 빠름
    } else if (typeRandom < 0.3) {
      type = "orange";
      speed *= 1.1;
    }

    this.items.push({
      lane: lane,
      y: -50,
      type: type,
      speed: speed
    });
  }

  /**
   * 아이템 효과 적용
   */
  applyItemEffect(item) {
    if (item.type === "bomb") {
      // 게임 오버
      this.stop();
      alert("💥 폭탄을 건드렸습니다! 게임 오버!");
    } else if (item.type === "apple") {
      this.addScore(100);
    } else if (item.type === "orange") {
      this.addScore(200);
    }
  }

  /**
   * 화면 그리기
   */
  draw() {
    this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    const laneWidth = this.canvasWidth / 3;

    // 1. 라인 그리기
    this.ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(laneWidth, 0);
    this.ctx.lineTo(laneWidth, this.canvasHeight);
    this.ctx.moveTo(laneWidth * 2, 0);
    this.ctx.lineTo(laneWidth * 2, this.canvasHeight);
    this.ctx.stroke();

    // 2. 아이템 그리기
    this.items.forEach(item => {
      const itemX = item.lane * laneWidth + laneWidth / 2;
      
      this.ctx.font = "40px Arial";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      
      let emoji = "🍎";
      if (item.type === "orange") emoji = "🍊";
      else if (item.type === "bomb") emoji = "💣";
      
      this.ctx.fillText(emoji, itemX, item.y);
    });

    // 3. 플레이어 그리기 (바구니)
    const playerX = this.playerLane * laneWidth + laneWidth / 2;
    const playerY = this.canvasHeight - 50;
    
    this.ctx.fillStyle = "#FF5722";
    this.ctx.beginPath();
    this.ctx.arc(playerX, playerY, 30, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.ctx.fillStyle = "white";
    this.ctx.font = "14px Arial";
    this.ctx.fillText("BASKET", playerX, playerY + 5);
  }

  /**
   * 포즈 인식 결과 처리 (Player Movement)
   */
  onPoseDetected(className) {
    if (!this.isGameActive) return;

    if (className === "LEFT") {
      this.playerLane = 0;
    } else if (className === "CENTER") {
      this.playerLane = 1;
    } else if (className === "RIGHT") {
      this.playerLane = 2;
    }
  }

  /**
   * 점수 추가
   * @param {number} points - 추가할 점수
   */
  addScore(points) {
    this.score += points;

    // 레벨업 로직 (예: 500점마다)
    if (this.score >= this.level * 500) {
      this.level++;
    }

    if (this.onScoreChange) {
      this.onScoreChange(this.score, this.level, this.timeLimit);
    }
  }

  startTimer() {
    this.gameTimer = setInterval(() => {
      this.timeLimit--;
      
       // 시간 업데이트 콜백 (점수 콜백 재활용 또는 별도 분리)
       if (this.onScoreChange) {
         this.onScoreChange(this.score, this.level, this.timeLimit);
       }

      if (this.timeLimit <= 0) {
        this.stop();
      }
    }, 1000);
  }

  clearTimer() {
    if (this.gameTimer) {
      clearInterval(this.gameTimer);
      this.gameTimer = null;
    }
  }

  setScoreChangeCallback(callback) {
    this.onScoreChange = callback;
  }
  
  setGameEndCallback(callback) {
    this.onGameEnd = callback;
  }
  
  // Legacy support methods (empty for now)
  setCommandChangeCallback() {}
}

window.GameEngine = GameEngine;

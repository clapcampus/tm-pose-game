/**
 * gameEngine.js
 * 과일 받기 게임 (Fruit Catcher) - 3 Lane Version
 */

class GameEngine {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.isGameActive = false;

        // 게임 상태
        this.score = 0;
        this.timeLeft = 60;
        this.life = 3;
        this.level = 1;

        // 3 Lane 설정
        this.lanes = []; // [x1, x2, x3] Lane centers
        this.currentLane = 1; // 0: Left, 1: Center, 2: Right

        // 엔티티
        this.basket = {
            y: 0,
            width: 80,
            height: 40,
            color: '#e67e22',
            targetX: 0, // 목표 위치 (부드러운 이동용)
            x: 0        // 현재 위치
        };
        this.items = [];

        // 루프 관리
        this.animationId = null;
        this.lastTime = 0;
        this.spawnTimer = 0;

        // 콜백
        this.onGameStateChange = null;
    }

    init(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        // 3개 라인 좌표 계산
        const sectionWidth = this.canvas.width / 3;
        this.lanes = [
            sectionWidth * 0.5, // Left Center
            sectionWidth * 1.5, // Center Center
            sectionWidth * 2.5  // Right Center
        ];

        // 바구니 초기 설정
        this.basket.y = this.canvas.height - 50;
        this.currentLane = 1; // Center
        this.basket.x = this.lanes[1] - this.basket.width / 2;
        this.basket.targetX = this.basket.x;
    }

    start() {
        if (this.isGameActive) return;

        // 상태 초기화
        this.isGameActive = true;
        this.score = 0;
        this.timeLeft = 60;
        this.life = 3;
        this.level = 1;
        this.items = [];
        this.currentLane = 1;
        this.updateBasketPosition();

        this.updateUI();

        this.gameTimer = setInterval(() => {
            this.timeLeft--;
            this.checkLevel();
            this.updateUI();

            if (this.timeLeft <= 0) {
                this.gameOver("TIME_OVER");
            }
        }, 1000);

        this.lastTime = performance.now();
        this.loop();
    }

    stop() {
        this.isGameActive = false;
        if (this.gameTimer) clearInterval(this.gameTimer);
        if (this.animationId) cancelAnimationFrame(this.animationId);
    }

    gameOver(reason) {
        this.stop();
        if (this.onGameStateChange) {
            this.onGameStateChange({
                state: 'GAMEOVER',
                reason: reason,
                score: this.score
            });
        }
    }

    // 포즈 입력 처리 (Lane 변경)
    onPoseDetected(poseLabel) {
        if (!this.isGameActive) return;

        let targetLane = this.currentLane;

        if (poseLabel === "Left" || poseLabel === "왼쪽") {
            targetLane = 0;
        } else if (poseLabel === "Right" || poseLabel === "오른쪽") {
            targetLane = 2;
        } else if (poseLabel === "Center" || poseLabel === "정면") {
            targetLane = 1;
        }

        if (targetLane !== this.currentLane) {
            this.currentLane = targetLane;
            this.updateBasketPosition();
        }
    }

    updateBasketPosition() {
        // 목표 위치 설정 (중앙 정렬)
        this.basket.targetX = this.lanes[this.currentLane] - this.basket.width / 2;
    }

    loop(timestamp) {
        if (!this.isGameActive) return;

        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;

        this.update(deltaTime);
        this.draw();

        this.animationId = requestAnimationFrame((t) => this.loop(t));
    }

    update(deltaTime) {
        // 1. 바구니 부드러운 이동 (Lerp)
        const speed = 0.2; // 보간 속도
        this.basket.x += (this.basket.targetX - this.basket.x) * speed;

        // 2. 아이템 생성
        this.spawnTimer += deltaTime || 16;
        let spawnRate = 1200;
        if (this.level === 2) spawnRate = 900;
        if (this.level === 3) spawnRate = 600;

        if (this.spawnTimer > spawnRate) {
            this.spawnItem();
            this.spawnTimer = 0;
        }

        // 3. 아이템 이동 및 충돌
        for (let i = this.items.length - 1; i >= 0; i--) {
            let item = this.items[i];
            item.y += item.speed;

            // 충돌 체크 (거리 기반이 더 정확할 수 있지만 AABB 유지)
            // 3 Lane에서는 X축이 거의 고정이므로 Y축과 Lane Index로 체크 가능
            // 하지만 현재 구조상 좌표 충돌 체크가 범용적임
            if (
                item.x < this.basket.x + this.basket.width &&
                item.x + item.width > this.basket.x &&
                item.y < this.basket.y + this.basket.height &&
                item.y + item.height > this.basket.y
            ) {
                this.handleItemCollection(item);
                this.items.splice(i, 1);
                continue;
            }

            if (item.y > this.canvas.height) {
                if (item.type !== 'bomb') {
                    this.life--;
                    this.updateUI();
                    if (this.life <= 0) this.gameOver("LIFE_ZERO");
                }
                this.items.splice(i, 1);
            }
        }
    }

    spawnItem() {
        const types = [
            { type: 'apple', color: '#ff4d4d', score: 100, speed: 4, prob: 0.5 },
            { type: 'grape', color: '#8e44ad', score: 200, speed: 6, prob: 0.3 },
            { type: 'orange', color: '#f39c12', score: 300, speed: 8, prob: 0.15 },
            { type: 'bomb', color: '#2c3e50', score: 0, speed: 5, prob: 0.05 }
        ];

        if (this.level >= 2) types[3].prob = 0.15;
        if (this.level >= 3) types[3].prob = 0.25;

        let rand = Math.random();
        let selectedType = types[0];
        let cumulativeProb = 0;
        const totalProb = types.reduce((sum, t) => sum + t.prob, 0);

        for (let t of types) {
            cumulativeProb += (t.prob / totalProb);
            if (rand <= cumulativeProb) {
                selectedType = t;
                break;
            }
        }

        // 랜덤 Lane 선택 (0, 1, 2)
        const laneIndex = Math.floor(Math.random() * 3);
        const itemX = this.lanes[laneIndex] - 15; // 중앙 정렬 (width 30/2)

        this.items.push({
            x: itemX,
            y: -30,
            width: 30,
            height: 30,
            lane: laneIndex, // 디버깅용
            ...selectedType
        });
    }

    handleItemCollection(item) {
        if (item.type === 'bomb') {
            this.gameOver("BOMB");
        } else {
            this.score += item.score;
            this.updateUI();
        }
    }

    checkLevel() {
        if (this.timeLeft <= 40 && this.timeLeft > 20) this.level = 2;
        if (this.timeLeft <= 20) this.level = 3;
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Lane 가이드라인 그리기 (배경)
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
        this.ctx.lineWidth = 2;
        const sectionWidth = this.canvas.width / 3;
        for (let i = 1; i < 3; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(sectionWidth * i, 0);
            this.ctx.lineTo(sectionWidth * i, this.canvas.height);
            this.ctx.stroke();
        }

        // 바구니
        this.ctx.fillStyle = this.basket.color;
        this.ctx.fillRect(this.basket.x, this.basket.y, this.basket.width, this.basket.height);

        this.ctx.strokeStyle = '#d35400';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(this.basket.x, this.basket.y);
        this.ctx.quadraticCurveTo(this.basket.x + this.basket.width / 2, this.basket.y - 30, this.basket.x + this.basket.width, this.basket.y);
        this.ctx.stroke();

        // 아이템
        for (let item of this.items) {
            this.ctx.fillStyle = item.color;
            if (item.type === 'bomb') {
                this.ctx.beginPath();
                this.ctx.arc(item.x + 15, item.y + 15, 15, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.fillStyle = 'red';
                this.ctx.fillRect(item.x + 13, item.y - 5, 4, 6);
            } else {
                this.ctx.beginPath();
                this.ctx.arc(item.x + 15, item.y + 15, 15, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
    }

    updateUI() {
        if (this.onGameStateChange) {
            this.onGameStateChange({
                state: 'PLAYING',
                score: this.score,
                time: this.timeLeft,
                life: this.life
            });
        }
    }

    setGameStateCallback(callback) {
        this.onGameStateChange = callback;
    }
}

window.GameEngine = GameEngine;

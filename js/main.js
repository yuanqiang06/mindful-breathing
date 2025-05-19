class BreathingApp {
    constructor() {
        // 配置参数
        this.config = {
            inhaleTime: 4000,    // 吸气时间（毫秒）
            holdTime: 4000,      // 屏息时间（毫秒）
            exhaleTime: 6000,    // 呼气时间（毫秒）
            totalDuration: 5 * 60 * 1000,  // 总时长（毫秒）
            reminderInterval: 120 * 60 * 1000,  // 提醒间隔（毫秒）
            defaultBgImage: ''  // 默认背景图片
        };

        // DOM 元素
        this.elements = {
            breathingBall: document.querySelector('.breathing-ball'),
            breathingText: document.querySelector('.breathing-text'),
            progressRing: document.querySelector('.progress-ring__circle-progress'),
            startBtn: document.getElementById('startBtn'),
            pauseBtn: document.getElementById('pauseBtn'),
            resetBtn: document.getElementById('resetBtn'),
            settingsBtn: document.getElementById('settingsBtn'),
            settingsModal: document.getElementById('settingsModal'),
            closeSettings: document.getElementById('closeSettings'),
            durationSelect: document.getElementById('durationSelect'),
            reminderInterval: document.getElementById('reminderInterval'),
            ttsToggle: document.getElementById('ttsToggle'),
            bgSoundSelect: document.getElementById('bgSoundSelect'),
            bgImageUpload: document.getElementById('bgImageUpload'),
            removeBgImage: document.getElementById('removeBgImage')
        };

        // 立即设置文字颜色
        if (this.elements.breathingText) {
            this.elements.breathingText.style.cssText = 'color: #FFFFFF !important; text-shadow: 0 2px 4px rgba(0,0,0,0.2) !important; font-weight: 500 !important;';
        }

        // 立即设置语音提示
        if (this.elements.ttsToggle) {
            this.elements.ttsToggle.checked = true;
        }

        // 状态变量
        this.state = {
            isRunning: false,
            currentPhase: 'idle', // idle, inhale, hold, exhale
            startTime: null,
            remainingTime: this.config.totalDuration,
            reminderTimer: null,
            speechSynthesis: window.speechSynthesis,
            bgAudio: null,
            defaultSound: 'waves'  // 设置默认音效
        };

        // 初始化
        this.init();
    }

    init() {
        // 设置文字颜色
        this.elements.breathingText.style.cssText = 'color: #FFFFFF !important; text-shadow: 0 2px 4px rgba(0,0,0,0.2) !important; font-weight: 500 !important;';

        // 设置进度环
        const radius = this.elements.progressRing.r.baseVal.value;
        this.elements.progressRing.style.strokeDasharray = `${radius * 2 * Math.PI}`;
        this.elements.progressRing.style.strokeDashoffset = '0';

        // 设置默认背景图片
        if (this.config.defaultBgImage) {
            document.body.style.backgroundImage = `url(${this.config.defaultBgImage})`;
            document.body.style.backgroundSize = 'contain';
            document.body.style.backgroundPosition = 'center';
            document.body.style.backgroundRepeat = 'no-repeat';
        }

        // 确保语音提示开启
        this.elements.ttsToggle.checked = true;
        if (window.speechSynthesis) {
            const utterance = new SpeechSynthesisUtterance('语音提示已启用');
            utterance.lang = 'zh-CN';
            window.speechSynthesis.speak(utterance);
        }

        // 事件监听
        this.elements.startBtn.addEventListener('click', () => this.start());
        this.elements.pauseBtn.addEventListener('click', () => this.pause());
        this.elements.resetBtn.addEventListener('click', () => this.reset());
        this.elements.settingsBtn.addEventListener('click', () => this.openSettings());
        this.elements.closeSettings.addEventListener('click', () => this.closeSettings());
        
        // 设置变更监听
        this.elements.durationSelect.addEventListener('change', (e) => {
            this.config.totalDuration = parseInt(e.target.value) * 60 * 1000;
            this.reset();
        });

        this.elements.reminderInterval.addEventListener('change', (e) => {
            this.config.reminderInterval = parseInt(e.target.value) * 60 * 1000;
            this.resetReminder();
        });

        this.elements.ttsToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.speak('语音提示已启用');
            }
        });

        this.elements.bgSoundSelect.addEventListener('change', (e) => {
            this.changeBackgroundSound(e.target.value);
        });

        // 背景图片上传处理
        this.elements.bgImageUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    document.body.style.backgroundImage = `url(${e.target.result})`;
                    document.body.style.backgroundSize = 'contain';
                    document.body.style.backgroundPosition = 'center';
                    document.body.style.backgroundRepeat = 'no-repeat';
                };
                reader.readAsDataURL(file);
            }
        });

        // 移除背景图片
        this.elements.removeBgImage.addEventListener('click', () => {
            document.body.style.backgroundImage = 'none';
            document.body.style.backgroundSize = '';
            document.body.style.backgroundPosition = '';
            document.body.style.backgroundRepeat = '';
            this.elements.bgImageUpload.value = '';
        });

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                if (this.state.isRunning) {
                    this.pause();
                } else {
                    this.start();
                }
            } else if (e.code === 'Escape') {
                this.pause();
            }
        });

        // 设置默认音效
        this.elements.bgSoundSelect.value = this.state.defaultSound;
        this.changeBackgroundSound(this.state.defaultSound);
    }

    start() {
        if (!this.state.isRunning) {
            this.state.isRunning = true;
            this.state.startTime = performance.now();
            this.elements.startBtn.disabled = true;
            this.elements.pauseBtn.disabled = false;
            this.startBreathingCycle();
            this.startReminder();
            // 开始播放背景音乐
            if (this.state.bgAudio) {
                this.state.bgAudio.play();
            }
        }
    }

    pause() {
        if (this.state.isRunning) {
            this.state.isRunning = false;
            this.elements.startBtn.disabled = false;
            this.elements.pauseBtn.disabled = true;
            this.elements.breathingBall.style.animation = 'none';
            this.elements.breathingText.textContent = '已暂停';
            this.stopReminder();
            // 暂停背景音乐
            if (this.state.bgAudio) {
                this.state.bgAudio.pause();
            }
        }
    }

    reset() {
        this.pause();
        this.state.remainingTime = this.config.totalDuration;
        this.updateProgress(1);
        this.elements.breathingText.textContent = '准备开始';
        this.elements.breathingText.style.cssText = 'color: #FFFFFF !important; text-shadow: 0 2px 4px rgba(0,0,0,0.2) !important; font-weight: 500 !important;';
        this.elements.breathingBall.style.transform = 'scale(1)';
        // 重置时停止背景音乐
        if (this.state.bgAudio) {
            this.state.bgAudio.pause();
            this.state.bgAudio.currentTime = 0;
        }
    }

    startBreathingCycle() {
        const cycle = () => {
            if (!this.state.isRunning) return;

            // 吸气
            this.state.currentPhase = 'inhale';
            this.elements.breathingText.textContent = '吸气';
            this.animateBreathingBall('expand');
            this.speak('请缓慢吸气');

            setTimeout(() => {
                if (!this.state.isRunning) return;

                // 屏息
                this.state.currentPhase = 'hold';
                this.elements.breathingText.textContent = '屏息';
                this.animateBreathingBall('pulse');
                this.speak('保持');

                setTimeout(() => {
                    if (!this.state.isRunning) return;

                    // 呼气
                    this.state.currentPhase = 'exhale';
                    this.elements.breathingText.textContent = '呼气';
                    this.animateBreathingBall('contract');
                    this.speak('缓慢呼气');

                    setTimeout(() => {
                        if (!this.state.isRunning) return;
                        this.updateProgress();
                        if (this.state.remainingTime > 0) {
                            cycle();
                        } else {
                            this.complete();
                        }
                    }, this.config.exhaleTime);
                }, this.config.holdTime);
            }, this.config.inhaleTime);
        };

        cycle();
    }

    animateBreathingBall(action) {
        const ball = this.elements.breathingBall;
        ball.style.animation = 'none';
        void ball.offsetWidth; // 触发重排

        switch (action) {
            case 'expand':
                ball.style.animation = `expand ${this.config.inhaleTime}ms ease-in-out`;
                break;
            case 'pulse':
                ball.style.animation = `pulse ${this.config.holdTime}ms ease-in-out`;
                break;
            case 'contract':
                ball.style.animation = `contract ${this.config.exhaleTime}ms ease-in-out`;
                break;
        }
    }

    updateProgress() {
        const elapsed = performance.now() - this.state.startTime;
        this.state.remainingTime = Math.max(0, this.config.totalDuration - elapsed);
        const progress = this.state.remainingTime / this.config.totalDuration;
        
        const radius = this.elements.progressRing.r.baseVal.value;
        const circumference = radius * 2 * Math.PI;
        this.elements.progressRing.style.strokeDashoffset = circumference * (1 - progress);
    }

    complete() {
        this.state.isRunning = false;
        this.elements.startBtn.disabled = false;
        this.elements.pauseBtn.disabled = true;
        this.elements.breathingText.textContent = '训练完成';
        this.speak('训练完成，辛苦了');
        this.stopReminder();
    }

    speak(text) {
        if (this.elements.ttsToggle.checked && this.state.speechSynthesis) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'zh-CN';
            this.state.speechSynthesis.speak(utterance);
        }
    }

    startReminder() {
        this.stopReminder();
        this.state.reminderTimer = setInterval(() => {
            this.showReminder();
        }, this.config.reminderInterval);
    }

    stopReminder() {
        if (this.state.reminderTimer) {
            clearInterval(this.state.reminderTimer);
            this.state.reminderTimer = null;
        }
    }

    showReminder() {
        if (!document.hidden) {
            this.speak('该休息一下了，让我们做一次深呼吸');
            this.elements.breathingBall.style.animation = 'pulse 1s infinite';
            setTimeout(() => {
                this.elements.breathingBall.style.animation = '';
            }, 3000);
        }
    }

    openSettings() {
        this.elements.settingsModal.classList.add('active');
    }

    closeSettings() {
        this.elements.settingsModal.classList.remove('active');
    }

    changeBackgroundSound(sound) {
        if (this.state.bgAudio) {
            this.state.bgAudio.pause();
            this.state.bgAudio = null;
        }

        if (sound !== 'none') {
            this.state.bgAudio = new Audio(`sounds/${sound}.mp3`);
            this.state.bgAudio.loop = true;
            // 只有在训练运行时才播放
            if (this.state.isRunning) {
                this.state.bgAudio.play();
            }
        }
    }
}

// 添加动画关键帧
const style = document.createElement('style');
style.textContent = `
    @keyframes expand {
        0% { transform: scale(1); background-color: #FFD700 !important; }
        100% { transform: scale(1.5); background-color: #FFD700 !important; }
    }

    @keyframes pulse {
        0% { transform: scale(1.5); background-color: #FFD700 !important; }
        50% { transform: scale(1.6); background-color: #FFD700 !important; }
        100% { transform: scale(1.5); background-color: #FFD700 !important; }
    }

    @keyframes contract {
        0% { transform: scale(1.5); background-color: #FFD700 !important; }
        100% { transform: scale(1); background-color: #FFD700 !important; }
    }

    .breathing-ball {
        background-color: #FFD700 !important;
    }

    .progress-ring__circle-progress {
        stroke: #FFD700 !important;
    }

    /* 确保文字颜色为白色 */
    .breathing-text,
    body .container .breathing-container .breathing-text,
    div.breathing-text {
        color: #FFFFFF !important;
        text-shadow: 0 2px 4px rgba(0,0,0,0.2) !important;
        font-weight: 500 !important;
    }

    /* 覆盖所有可能的状态 */
    .breathing-text[style*="color"],
    body .container .breathing-container .breathing-text[style*="color"] {
        color: #FFFFFF !important;
    }

    /* 确保在所有状态下都是白色 */
    .breathing-text:not([style*="color"]),
    body .container .breathing-container .breathing-text:not([style*="color"]) {
        color: #FFFFFF !important;
    }
`;
document.head.appendChild(style);

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new BreathingApp();
}); 
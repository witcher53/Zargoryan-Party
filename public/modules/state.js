export const MAP_WIDTH = 2000;
export const MAP_HEIGHT = 2000;

export const state = {
    players: {},
    diamonds: [],
    tents: [],
    cube: {
        x: 1000, y: 1000, vx: 0, vy: 0,
        size: 3000, mass: 50, angle: 0, angularVel: 0,
        tent: { localX: -400, localY: -400, w: 500, h: 500, color: '#e67e22', label: 'ZAR ALANI' },
        localDiamonds: []
    },
    chunks: [],
    camera: {
        targetZoom: 0.8,
        zoom: 0.8,
        minZoom: 0.1,
        maxZoom: 2.0
    },
    activeMessages: {},
    keys: {},

    showDice: null,
    isRolling: false,
    diceCooldown: 0,

    collectedIds: [],
    floatingTexts: [],

    myPlayer: {
        x: 1000,
        y: 1000,
        vx: 0,
        vy: 0,
        acc: 0.8,
        friction: 0.985,
        momentum: 1.0,
        maxMomentum: 5.0,
        nextClick: 0,
        comboTimer: 0,
        speed: 10,
        playing: false,
        size: 20
    },

    minigame: {
        active: false,
        phase: 'countdown',
        countdownVal: 5,
        startTime: 0,
        timeLeft: 0,
        obstacles: [],
        collectibles: [],
        sessionScoreGained: 0,
        sessionScoreLost: 0
    },

    gpState: { lastLt: false, lastRt: false },

    hasGivenSalute: false,
    lastAsTime: 0,
    buttonPressed: false,
    isChatMenuOpen: false,
    currentPing: 0
};
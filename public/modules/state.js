export const MAP_WIDTH = 2000;
export const MAP_HEIGHT = 2000;

export const state = {
    players: {},
    diamonds: [],
    tents: [],
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
        acc: 1.5,       
        friction: 0.96,
        momentum: 1.0,  
        maxMomentum: 8.0, 
        nextClick: 0, 
        comboTimer: 0, 
        speed: 10,      
        playing: false, 
        size: 20 
    },

    // Minigame
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
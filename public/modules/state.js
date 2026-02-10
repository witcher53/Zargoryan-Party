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
        // --- YENİ FİZİK AYARLARI ---
        acc: 0.8,        // Düşük ivme = Araba gibi geç hızlanma
        friction: 0.985, // Çok yüksek kayganlık = Drift hissi
        momentum: 1.0,  
        maxMomentum: 5.0, // Hız sınırını biraz kıstık ki kontrol tamamen kaybolmasın
        // ---------------------------
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
import { state } from './state.js';

export function initInputs(socket, sendMessageFunc) {
    // Klavye
    document.addEventListener('keydown', (e) => { 
        if (document.activeElement === document.getElementById('chatInput')) return;
        if (e.key === 'Tab') {
            e.preventDefault(); 
            document.getElementById('scoreBoard').style.display = 'block';
            return;
        }
        state.keys[e.key] = true; 
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === 'Tab') document.getElementById('scoreBoard').style.display = 'none';
        state.keys[e.key] = false;
    });

    // Mouse Combo
    document.addEventListener('contextmenu', event => event.preventDefault());
    
    document.addEventListener('mousedown', (e) => {
        if (!state.myPlayer.playing) return;
        const mp = state.myPlayer;

        const isMoving = (Math.abs(mp.vx) > 0.5 || Math.abs(mp.vy) > 0.5);
        
        if (isMoving) {
            if (e.button === mp.nextClick) {
                if (e.button === 0) {
                    // SOL TIK -> SAĞ BEKLE
                    mp.nextClick = 2; 
                    mp.comboTimer = Date.now(); 
                    state.floatingTexts.push({ x: mp.x, y: mp.y - 40, text: 'SAĞA ABAN! ->', color: 'yellow', life: 20 });
                } else if (e.button === 2) {
                    // SAĞ TIK -> COMBO
                    if (Date.now() - mp.comboTimer < 2000) {
                        mp.momentum += 0.8; 
                        if (mp.momentum > mp.maxMomentum) mp.momentum = mp.maxMomentum;
                        state.floatingTexts.push({ x: mp.x, y: mp.y - 50, text: 'HIZLANDIN! 🔥', color: '#00ff00', life: 40 });
                        mp.nextClick = 0; 
                    } else {
                        mp.nextClick = 0;
                        mp.momentum = 1.0;
                        state.floatingTexts.push({ x: mp.x, y: mp.y - 40, text: 'YAVAŞSIN!', color: 'red', life: 30 });
                    }
                }
            }
        }
    });
}
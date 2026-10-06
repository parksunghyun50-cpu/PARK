const firebaseConfig = {
    apiKey: "여기에_본인_API_KEY",
    authDomain: "여기에_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://여기에_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "여기에_PROJECT_ID",
    storageBucket: "여기에_PROJECT_ID.appspot.com",
    messagingSenderId: "여기에_SENDER_ID",
    appId: "여기에_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ===== CHOICES & EMOJIS =====
const CHOICES = {
    scissors: { emoji: '✌️', name: '가위', beats: 'paper' },
    rock:     { emoji: '✊', name: '바위', beats: 'scissors' },
    paper:    { emoji: '🖐️', name: '보',   beats: 'rock' },
};

// ===== ADMIN CONFIG (관리자 정보) =====
const ADMIN_ID = 'jake0400';
const ADMIN_PW = '93189318q';

// ===== STATE & LOCAL STORAGE DATABASE =====
let currentUser = null;
let currentBet = 100;
let roomBet = 500;
let currentRoom = null;

// PVP State
let pvpState = {
    p1Name: '',
    p2Name: '상대방',
    betAmount: 500,
    p1Choice: null,
    p2Choice: null,
    isBot: false,
};

// Computer Game State
let isPlaying = false;
let currentStreak = 0;

// Initialize Storage
function getStorageUsers() {
    const data = localStorage.getItem('rps_arena_users');
    let users = data ? JSON.parse(data) : {};

    // 관리자 계정 생성/확인 (jake0400 / 93189318q)
    if (!users[ADMIN_ID] || users[ADMIN_ID].pw !== ADMIN_PW) {
        users[ADMIN_ID] = {
            id: ADMIN_ID,
            nickname: '최고관리자 (Jake)',
            pw: ADMIN_PW,
            coins: 999999,
            wins: 100,
            losses: 0,
            draws: 0,
            isAdmin: true,
            lastDaily: new Date().toDateString(),
            history: [],
            inventory: [],
            inbox: []
        };
    }

    // 기본 테스트 샘플 유저가 없으면 추가
    if (!users['pro']) {
        users['pro'] = { id: 'pro', nickname: '승리왕Pro', pw: '123456', coins: 12400, wins: 28, losses: 14, draws: 3, history: [], inventory: [], inbox: [] };
        users['lucky'] = { id: 'lucky', nickname: '행운아', pw: '123456', coins: 5500, wins: 15, losses: 8, draws: 1, history: [], inventory: [], inbox: [] };
    }

    // 모든 유저의 inventory 및 inbox 배열 보장 및 아이템 ID 채우기
    Object.keys(users).forEach(id => {
        if (!users[id].inventory) users[id].inventory = [];
        if (!users[id].inbox) users[id].inbox = [];
        users[id].inventory.forEach((inv, idx) => {
            if (!inv.id) inv.id = 'inv_' + Date.now() + '_' + idx;
        });
    });

    localStorage.setItem('rps_arena_users', JSON.stringify(users));
    return users;
}

function saveStorageUsers(users) {
    localStorage.setItem('rps_arena_users', JSON.stringify(users));
}

function getStorageRooms() {
    const data = localStorage.getItem('rps_arena_rooms');
    if (!data) return [];
    return JSON.parse(data);
}

function saveStorageRooms(rooms) {
    localStorage.setItem('rps_arena_rooms', JSON.stringify(rooms));
}

// ===== UI SCREEN NAVIGATION =====
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(screenId);
    if (target) {
        target.classList.add('active');
    }

    if (screenId === 'screen-lobby') {
        updateLobbyUI();
    } else if (screenId === 'screen-bet') {
        updateBetUI();
    } else if (screenId === 'screen-rooms') {
        renderRoomList();
    } else if (screenId === 'screen-shop') {
        renderShopUI();
    } else if (screenId === 'screen-inbox') {
        renderInbox();
    } else if (screenId === 'screen-profile') {
        renderProfile();
    } else if (screenId === 'screen-ranking') {
        renderRanking();
    } else if (screenId === 'screen-chat') {
        renderChatMessages();
    } else if (screenId === 'screen-admin') {
        renderAdminDashboard();
    } else if (screenId === 'screen-snail-race') {
        renderSnailRaceUI();
    } else if (screenId === 'screen-fishing') {
        renderFishingUI();
    }
}

// ===== CHAT LOGIC (전체 광장 채팅) =====
function getStorageChat() {
    const data = localStorage.getItem('rps_arena_chat');
    if (!data) {
        const defaultChat = [
            { sender: '아레나마스터', text: '가위바위보 아레나 전체 광장에 오신 것을 환영합니다! ⚔️', time: '오전 10:00', isAdmin: true }
        ];
        localStorage.setItem('rps_arena_chat', JSON.stringify(defaultChat));
        return defaultChat;
    }
    return JSON.parse(data);
}

function saveStorageChat(chats) {
    localStorage.setItem('rps_arena_chat', JSON.stringify(chats));
}

function renderChatMessages() {
    const chatBox = document.getElementById('chat-box');
    if (!chatBox) return;

    const chats = getStorageChat();
    const isAdmin = currentUser && (currentUser.isAdmin || currentUser.id === ADMIN_ID);

    chatBox.innerHTML = chats.map((c, idx) => {
        const titleBadge = c.title ? `<span class="user-custom-title" style="background:${c.titleBg || 'var(--accent-purple)'}">${escapeHtml(c.title)}</span>` : '';
        const nameColorStyle = c.nameColor ? `style="color:${c.nameColor}"` : '';

        return `
            <div class="chat-message ${c.isAdmin ? 'chat-admin' : ''}">
                <div class="chat-sender">
                    ${titleBadge}
                    <span ${nameColorStyle}>${escapeHtml(c.sender)}</span>
                    ${c.isAdmin ? '<span class="admin-tag">관리자</span>' : ''}
                    <span class="chat-time">${c.time}</span>
                    ${isAdmin ? `<button class="btn-delete-chat" onclick="deleteChatMessage(${idx})" title="메시지 삭제">❌</button>` : ''}
                </div>
                <div class="chat-text">${escapeHtml(c.text)}</div>
            </div>
        `;
    }).join('');

    chatBox.scrollTop = chatBox.scrollHeight;
}

function sendChatMessage(e) {
    e.preventDefault();
    if (!currentUser) return;

    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    const chats = getStorageChat();
    chats.push({
        sender: currentUser.nickname,
        title: currentUser.title || '',
        titleBg: currentUser.titleBg || '',
        nameColor: currentUser.nameColor || '',
        text: text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAdmin: currentUser.isAdmin || currentUser.id === ADMIN_ID
    });

    if (chats.length > 50) chats.shift();
    saveStorageChat(chats);

    input.value = '';
    renderChatMessages();
}

function deleteChatMessage(index) {
    if (!currentUser || (!currentUser.isAdmin && currentUser.id !== ADMIN_ID)) return;
    const chats = getStorageChat();
    chats.splice(index, 1);
    saveStorageChat(chats);
    renderChatMessages();
    showToast('채팅 메시지가 삭제되었습니다.');
}

// ===== ADMIN DASHBOARD LOGIC (관리자 전용 기능) =====
function renderAdminDashboard() {
    if (!currentUser || (currentUser.id !== ADMIN_ID && !currentUser.isAdmin)) {
        showToast('관리자 권한이 필요합니다!');
        showScreen('screen-lobby');
        return;
    }

    // 1. 대전방 관리 리스트 렌더링
    const rooms = getStorageRooms();
    const adminRoomList = document.getElementById('admin-room-list');
    if (rooms.length === 0) {
        adminRoomList.innerHTML = '<div class="history-empty">현재 생성된 대전방이 없습니다.</div>';
    } else {
        adminRoomList.innerHTML = rooms.map(r => `
            <div class="admin-user-card glass-card">
                <div class="admin-user-info">
                    <div class="admin-user-name">
                        🏠 ${escapeHtml(r.title)}
                        <span class="status-waiting">${r.status === 'playing' ? '게임 진행 중' : '대기 중'}</span>
                    </div>
                    <div class="admin-user-meta">
                        방장: <strong>${escapeHtml(r.hostName)}</strong> | 배팅금액: 🪙 ${r.bet.toLocaleString()}
                    </div>
                </div>
                <div class="admin-user-actions">
                    <button class="btn-admin-act btn-delete-user" onclick="adminDeleteRoom(${r.id})">🗑️ 방 강제 삭제</button>
                </div>
            </div>
        `).join('');
    }

    // 2. 유저 계정 리스트 렌더링
    const users = getStorageUsers();
    const adminList = document.getElementById('admin-user-list');

    const userKeys = Object.keys(users);
    if (userKeys.length === 0) {
        adminList.innerHTML = '<div class="history-empty">등록된 유저가 없습니다.</div>';
        return;
    }

    adminList.innerHTML = userKeys.map(id => {
        const u = users[id];
        const isAdminAccount = u.id === ADMIN_ID;
        return `
            <div class="admin-user-card glass-card">
                <div class="admin-user-info">
                    <div class="admin-user-name">
                        ${escapeHtml(u.nickname)} 
                        <span class="admin-user-id">(@${escapeHtml(u.id)})</span>
                        ${isAdminAccount ? '<span class="admin-tag">관리자</span>' : ''}
                    </div>
                    <div class="admin-user-meta">
                        보유 코인: 🪙 <strong>${u.coins.toLocaleString()}</strong> | 전적: ${u.wins}승 ${u.losses}패 ${u.draws}무
                    </div>
                </div>
                <div class="admin-user-actions">
                    <button class="btn-admin-act btn-edit-nick" onclick="adminEditNickname('${u.id}')">✏️ 닉네임 변경</button>
                    <button class="btn-admin-act btn-add-coin" onclick="adminAddCoins('${u.id}')">🪙 코인 지급/차감</button>
                    ${!isAdminAccount ? `<button class="btn-admin-act btn-delete-user" onclick="adminDeleteUser('${u.id}')">🗑️ 계정 삭제</button>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// 관리자 방 강제 삭제
function adminDeleteRoom(roomId) {
    if (confirm('이 대전방을 강제로 삭제하시겠습니까?')) {
        let rooms = getStorageRooms();
        rooms = rooms.filter(r => r.id !== roomId);
        saveStorageRooms(rooms);

        showToast('대전방이 강제 삭제되었습니다.');
        renderAdminDashboard();
    }
}
function showToast(msg) {
    const toast = document.getElementById('toast');
    const toastText = document.getElementById('toast-text');
    if (!toast || !toastText) return;
    toastText.textContent = msg;
    toast.classList.remove('hidden');
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hidden');
    }, 2500);
}

// ===== AUTHENTICATION =====
function switchAuthTab(tab) {
    const loginTab = document.getElementById('tab-login');
    const signupTab = document.getElementById('tab-signup');
    const formLogin = document.getElementById('form-login');
    const formSignup = document.getElementById('form-signup');
    const authError = document.getElementById('auth-error');

    authError.classList.add('hidden');

    if (tab === 'login') {
        loginTab.classList.add('active');
        signupTab.classList.remove('active');
        formLogin.classList.remove('hidden');
        formSignup.classList.add('hidden');
    } else {
        signupTab.classList.add('active');
        loginTab.classList.remove('active');
        formSignup.classList.remove('hidden');
        formLogin.classList.add('hidden');
    }
}

function handleLogin(e) {
    e.preventDefault();
    const id = document.getElementById('login-id').value.trim();
    const pw = document.getElementById('login-pw').value;
    const authError = document.getElementById('auth-error');

    const users = getStorageUsers();
    if (users[id] && users[id].pw === pw) {
        currentUser = users[id];
        authError.classList.add('hidden');
        checkDailyBonus();
        showScreen('screen-lobby');
        if (currentUser.isAdmin) {
            showToast(`👑 관리자(${currentUser.nickname}) 계정으로 로그인했습니다.`);
        } else {
            showToast(`🎉 환영합니다, ${currentUser.nickname}님!`);
        }
    } else {
        authError.textContent = '아이디 또는 비밀번호가 올바르지 않습니다.';
        authError.classList.remove('hidden');
    }
}

function handleSignup(e) {
    e.preventDefault();
    const id = document.getElementById('signup-id').value.trim();
    const nickname = document.getElementById('signup-nickname').value.trim();
    const pw = document.getElementById('signup-pw').value;
    const pw2 = document.getElementById('signup-pw2').value;
    const authError = document.getElementById('auth-error');

    if (pw !== pw2) {
        authError.textContent = '비밀번호가 일치하지 않습니다.';
        authError.classList.remove('hidden');
        return;
    }

    const users = getStorageUsers();
    if (users[id]) {
        authError.textContent = '이미 존재하는 아이디입니다.';
        authError.classList.remove('hidden');
        return;
    }

    users[id] = {
        id: id,
        nickname: nickname,
        pw: pw,
        coins: 1000,
        wins: 0,
        losses: 0,
        draws: 0,
        lastDaily: new Date().toDateString(),
        history: []
    };
    saveStorageUsers(users);

    currentUser = users[id];
    authError.classList.add('hidden');
    showScreen('screen-lobby');
    showToast(`✨ 가입을 축하합니다! 1,000 코인 지급 완료!`);
}

function logout() {
    currentUser = null;
    document.getElementById('login-id').value = '';
    document.getElementById('login-pw').value = '';
    showScreen('screen-auth');
    showToast('로그아웃 되었습니다.');
}

// ===== DAILY BONUS =====
function checkDailyBonus() {
    if (!currentUser) return;
    const today = new Date().toDateString();
    if (currentUser.lastDaily !== today) {
        document.getElementById('daily-bonus').classList.remove('hidden');
    } else {
        document.getElementById('daily-bonus').classList.add('hidden');
    }
}

function closeDailyBonus() {
    if (!currentUser) return;
    currentUser.coins += 1000;
    currentUser.lastDaily = new Date().toDateString();
    updateUserData();
    document.getElementById('daily-bonus').classList.add('hidden');
    showToast('🎁 출석 보너스 1,000 코인을 받았습니다!');
    updateLobbyUI();
}

function updateUserData() {
    if (!currentUser) return;
    const users = getStorageUsers();
    users[currentUser.id] = currentUser;
    saveStorageUsers(users);
}

// ===== LOBBY & BET UI =====
function updateLobbyUI() {
    if (!currentUser) return;
    document.getElementById('user-name').textContent = currentUser.nickname;
    document.getElementById('coin-amount').textContent = currentUser.coins.toLocaleString();

    const badge = document.getElementById('inbox-badge');
    if (badge) {
        const unclaimed = (currentUser.inbox || []).length;
        if (unclaimed > 0) {
            badge.textContent = unclaimed;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    const adminCard = document.getElementById('admin-lobby-card');
    if (currentUser.isAdmin || currentUser.id === ADMIN_ID) {
        adminCard.classList.remove('hidden');
    } else {
        adminCard.classList.add('hidden');
    }
}

function updateBetUI() {
    if (!currentUser) return;
    document.getElementById('bet-coin-display').textContent = currentUser.coins.toLocaleString();
    if (currentBet > currentUser.coins) {
        currentBet = Math.max(10, currentUser.coins);
    }
    document.getElementById('bet-amount-value').textContent = currentBet.toLocaleString();
}

function setBet(amount) {
    if (!currentUser) return;
    if (amount > currentUser.coins) {
        showToast('코인이 부족합니다!');
        return;
    }
    currentBet = amount;
    document.getElementById('bet-amount-value').textContent = currentBet.toLocaleString();
}

function setBetAll() {
    if (!currentUser) return;
    if (currentUser.coins <= 0) {
        showToast('배팅할 코인이 없습니다!');
        return;
    }
    currentBet = currentUser.coins;
    document.getElementById('bet-amount-value').textContent = currentBet.toLocaleString();
    showToast('🔥 ALL IN!');
}

function setBetCustom() {
    if (!currentUser) return;
    const val = parseInt(document.getElementById('bet-custom-input').value, 10);
    if (isNaN(val) || val <= 0) {
        showToast('올바른 배팅 금액을 입력하세요.');
        return;
    }
    if (val > currentUser.coins) {
        showToast('소지 코인을 초과할 수 없습니다.');
        return;
    }
    currentBet = val;
    document.getElementById('bet-amount-value').textContent = currentBet.toLocaleString();
    document.getElementById('bet-custom-input').value = '';
}

// ===== COMPUTER GAME LOGIC =====
function startComputerGame() {
    if (!currentUser) return;
    if (currentBet <= 0) {
        showToast('배팅 금액을 설정해주세요!');
        return;
    }
    if (currentBet > currentUser.coins) {
        showToast('코인이 부족합니다!');
        return;
    }

    document.getElementById('game-bet-amount').textContent = currentBet.toLocaleString();
    document.getElementById('game-player-name').textContent = currentUser.nickname;
    document.getElementById('game-player-hand').textContent = '❓';
    document.getElementById('game-opponent-hand').textContent = '❓';
    document.getElementById('game-result-text').textContent = '가위, 바위, 보 중 하나를 클릭하세요!';
    document.getElementById('game-result-coins').textContent = '';
    
    document.getElementById('game-choices').classList.remove('hidden');
    document.getElementById('game-actions').classList.add('hidden');
    
    const pHand = document.getElementById('game-player-hand');
    const oHand = document.getElementById('game-opponent-hand');
    pHand.className = 'arena-hand';
    oHand.className = 'arena-hand';

    showScreen('screen-game');
}

function makeChoice(playerChoice) {
    if (isPlaying || !currentUser) return;
    isPlaying = true;

    if (currentBet > currentUser.coins) {
        showToast('코인이 부족합니다!');
        isPlaying = false;
        return;
    }

    const keys = Object.keys(CHOICES);
    const opponentChoice = keys[Math.floor(Math.random() * keys.length)];

    const pHand = document.getElementById('game-player-hand');
    const oHand = document.getElementById('game-opponent-hand');
    const resultText = document.getElementById('game-result-text');
    const resultCoins = document.getElementById('game-result-coins');
    const clash = document.getElementById('game-clash');

    pHand.textContent = '❓';
    oHand.textContent = '❓';
    pHand.className = 'arena-hand shake';
    oHand.className = 'arena-hand shake';
    resultText.textContent = '두근두근...';

    setTimeout(() => {
        pHand.textContent = CHOICES[playerChoice].emoji;
        oHand.textContent = CHOICES[opponentChoice].emoji;

        pHand.className = 'arena-hand reveal';
        oHand.className = 'arena-hand reveal';

        clash.classList.add('show');
        setTimeout(() => clash.classList.remove('show'), 600);

        let outcome = 'draw';
        if (playerChoice === opponentChoice) {
            outcome = 'draw';
        } else if (CHOICES[playerChoice].beats === opponentChoice) {
            outcome = 'win';
        } else {
            outcome = 'lose';
        }

        if (outcome === 'win') {
            pHand.classList.add('win-glow');
            oHand.classList.add('lose-glow');
            const winCoins = currentBet;
            currentUser.coins += winCoins;
            currentUser.wins++;
            currentStreak++;

            resultText.textContent = '🎉 승리했습니다!';
            resultText.className = 'result-text win pop';
            resultCoins.textContent = `+${winCoins.toLocaleString()} 🪙 획득!`;
            resultCoins.className = 'game-result-coins win';

            showStreakBanner(currentStreak);
        } else if (outcome === 'lose') {
            pHand.classList.add('lose-glow');
            oHand.classList.add('win-glow');
            currentUser.coins -= currentBet;
            currentUser.losses++;
            currentStreak = 0;

            resultText.textContent = '😢 패배했습니다...';
            resultText.className = 'result-text lose pop';
            resultCoins.textContent = `-${currentBet.toLocaleString()} 🪙 차감`;
            resultCoins.className = 'game-result-coins lose';
        } else {
            currentUser.draws++;
            currentStreak = 0;
            resultText.textContent = '🤝 무승부!';
            resultText.className = 'result-text draw pop';
            resultCoins.textContent = '배팅 코인 보존';
            resultCoins.className = 'game-result-coins draw';
        }

        currentUser.history.unshift({
            date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            vs: '컴퓨터 (AI)',
            playerChoice,
            opponentChoice,
            outcome,
            bet: currentBet
        });
        if (currentUser.history.length > 20) currentUser.history.pop();

        updateUserData();

        document.getElementById('game-choices').classList.add('hidden');
        document.getElementById('game-actions').classList.remove('hidden');
        isPlaying = false;
    }, 600);
}

function playAgain() {
    startComputerGame();
}

function showStreakBanner(streak) {
    if (streak >= 3) {
        const banner = document.getElementById('streak-banner');
        const text = document.getElementById('streak-text');
        text.textContent = `🔥 ${streak}연승 달성!`;
        banner.classList.add('show');
        setTimeout(() => banner.classList.remove('show'), 2500);
    }
}

// ===== ROOMS & REAL-TIME PVP LOGIC =====
let syncChannel = null;
try {
    syncChannel = new BroadcastChannel('rps_arena_sync');
    syncChannel.onmessage = (event) => {
        handleRealtimeMessage(event.data);
    };
} catch (e) {
    console.log('BroadcastChannel not supported');
}

window.addEventListener('storage', (e) => {
    if (e.key === 'rps_arena_rooms') {
        onRoomDataChanged();
    }
});

// Periodic sync loop for active room screens (400ms)
setInterval(() => {
    onRoomDataChanged();
}, 400);

function broadcastRoomChange(type, payload) {
    if (syncChannel) {
        syncChannel.postMessage({ type, payload, time: Date.now() });
    }
}

function handleRealtimeMessage(msg) {
    if (!msg) return;
    onRoomDataChanged();
}

function onRoomDataChanged() {
    const activeScreen = document.querySelector('.screen.active');
    if (!activeScreen) return;

    if (activeScreen.id === 'screen-rooms') {
        renderRoomList();
    } else if (activeScreen.id === 'screen-pvp' && currentRoom) {
        syncActiveRoomState();
    }
}

function setRoomBet(amount) {
    roomBet = amount;
    document.getElementById('room-bet-value').textContent = roomBet.toLocaleString();
}

function showCreateRoom() {
    document.getElementById('create-room-modal').classList.remove('hidden');
}

function hideCreateRoom() {
    document.getElementById('create-room-modal').classList.add('hidden');
}

function createRoom() {
    if (!currentUser) return;
    const title = document.getElementById('room-name-input').value.trim() || '대전 한 판!';
    if (roomBet > currentUser.coins) {
        showToast('소지 코인이 부족합니다!');
        return;
    }

    const rooms = getStorageRooms();
    const newRoom = {
        id: Date.now(),
        title,
        hostId: currentUser.id,
        hostName: currentUser.nickname,
        bet: roomBet,
        guestId: null,
        guestName: null,
        status: 'waiting', // 'waiting' | 'playing' | 'result'
        hostChoice: null,
        guestChoice: null,
        rematchHost: false,
        rematchGuest: false,
        updatedAt: Date.now()
    };
    rooms.unshift(newRoom);
    saveStorageRooms(rooms);
    broadcastRoomChange('ROOM_CREATED', newRoom);

    hideCreateRoom();
    document.getElementById('room-name-input').value = '';
    renderRoomList();
    showToast('대전방이 성공적으로 생성되었습니다!');

    currentRoom = newRoom;
    startPvpGame(newRoom);
}

function renderRoomList() {
    const list = document.getElementById('room-list');
    const coinsDisplay = document.getElementById('rooms-coin-display');
    if (currentUser && coinsDisplay) coinsDisplay.textContent = currentUser.coins.toLocaleString();

    const rooms = getStorageRooms();
    if (!list) return;

    if (rooms.length === 0) {
        list.innerHTML = '<div class="room-empty">생성된 대전방이 없습니다.<br>방을 만들어 다른 플레이어를 기다려보세요!</div>';
        return;
    }

    list.innerHTML = rooms.map(r => {
        const isMyRoom = currentUser && r.hostId === currentUser.id;
        const statusBadge = r.status === 'playing' 
            ? '<span class="status-playing">게임 중</span>' 
            : (r.status === 'result' ? '<span class="status-playing">결과 발표</span>' : '<span class="status-waiting">대기 중</span>');
        
        return `
            <div class="room-card glass-card">
                <div class="room-info">
                    <div class="room-card-title">${escapeHtml(r.title)} ${statusBadge}</div>
                    <div class="room-card-meta">방장: ${escapeHtml(r.hostName)} ${r.guestName ? '| 상대: ' + escapeHtml(r.guestName) : ''} | 배팅: 🪙 ${r.bet.toLocaleString()}</div>
                </div>
                <div class="room-card-btn-group">
                    <button class="btn-primary btn-sm" onclick="joinRoom(${r.id})">${isMyRoom ? '방 입장' : '참가하기'}</button>
                    ${isMyRoom ? `<button class="btn-secondary btn-sm" onclick="deleteRoom(${r.id})">삭제</button>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function deleteRoom(roomId) {
    let rooms = getStorageRooms();
    rooms = rooms.filter(r => r.id !== roomId);
    saveStorageRooms(rooms);
    broadcastRoomChange('ROOM_DELETED', roomId);
    renderRoomList();
    showToast('대전방이 삭제되었습니다.');
}

function joinRoom(roomId) {
    if (!currentUser) return;
    const rooms = getStorageRooms();
    const roomIndex = rooms.findIndex(r => r.id === roomId);
    if (roomIndex === -1) {
        showToast('존재하지 않는 방입니다.');
        return;
    }
    const room = rooms[roomIndex];

    if (room.bet > currentUser.coins) {
        showToast('코인이 부족하여 입장할 수 없습니다!');
        return;
    }

    // 내가 방장이 아닌 도전자일 때
    if (room.hostId !== currentUser.id) {
        if (room.guestId && room.guestId !== currentUser.id && room.status === 'playing') {
            showToast('이미 다른 플레이어가 참가 중인 방입니다.');
            return;
        }
        room.guestId = currentUser.id;
        room.guestName = currentUser.nickname;
        room.status = 'playing';
        room.updatedAt = Date.now();
        rooms[roomIndex] = room;
        saveStorageRooms(rooms);
        broadcastRoomChange('PLAYER_JOINED', room);
    }

    currentRoom = room;
    startPvpGame(room);
}

function inviteBotToRoom() {
    if (!currentRoom || !currentUser || currentRoom.hostId !== currentUser.id) return;
    const rooms = getStorageRooms();
    const roomIndex = rooms.findIndex(r => r.id === currentRoom.id);
    if (roomIndex === -1) return;

    const room = rooms[roomIndex];
    room.guestId = 'bot_ai';
    room.guestName = '🤖 AI 봇 (연습용)';
    room.status = 'playing';
    const choices = ['scissors', 'rock', 'paper'];
    room.guestChoice = choices[Math.floor(Math.random() * choices.length)];
    room.updatedAt = Date.now();

    rooms[roomIndex] = room;
    saveStorageRooms(rooms);
    broadcastRoomChange('BOT_INVITED', room);
    showToast('🤖 AI 봇이 대전 상대로 참가했습니다!');
    startPvpGame(room);
}

function startPvpGame(room) {
    currentRoom = room;
    document.getElementById('pvp-bet-amount').textContent = room.bet.toLocaleString();

    showScreen('screen-pvp');
    syncActiveRoomState();
}

function syncActiveRoomState() {
    if (!currentRoom || !currentUser) return;
    const rooms = getStorageRooms();
    const room = rooms.find(r => r.id === currentRoom.id);
    if (!room) {
        showToast('방이 삭제되거나 종료되었습니다.');
        exitRoom();
        return;
    }
    currentRoom = room;

    const isHost = room.hostId === currentUser.id;
    const myChoice = isHost ? room.hostChoice : room.guestChoice;
    const opponentChoice = isHost ? room.guestChoice : room.hostChoice;
    const opponentName = isHost ? (room.guestName || '도전자 대기 중') : room.hostName;
    const myRoleLabel = isHost ? `나 (${room.hostName})` : `나 (${room.guestName})`;

    const phaseWaiting = document.getElementById('pvp-phase-waiting');
    const phaseChoice = document.getElementById('pvp-phase-choice');
    const phaseResult = document.getElementById('pvp-phase-result');

    phaseWaiting.classList.add('hidden');
    phaseChoice.classList.add('hidden');
    phaseResult.classList.add('hidden');

    // 1. 방장이 혼자 대기 중인 상태
    if (!room.guestId) {
        phaseWaiting.classList.remove('hidden');
        return;
    }

    // 2. 결과 렌더링 상태 (둘 다 선택 완료했거나 status가 result인 경우)
    if (room.hostChoice && room.guestChoice) {
        phaseResult.classList.remove('hidden');
        renderPvpResult(room);
        return;
    }

    // 3. 게임 진행 중 (선택 입력 단계)
    phaseChoice.classList.remove('hidden');
    document.getElementById('pvp-my-role-name').textContent = myRoleLabel;
    document.getElementById('pvp-opponent-role-name').textContent = opponentName;

    const choicesContainer = document.getElementById('pvp-choices-container');
    const waitingOpponentContainer = document.getElementById('pvp-waiting-opponent-choice');

    if (myChoice) {
        // 내 선택 완료 -> 상대방 대기 중 화면 표시
        choicesContainer.classList.add('hidden');
        waitingOpponentContainer.classList.remove('hidden');
    } else {
        // 내 선택 미완료 -> 가위바위보 선택 버튼 표시
        choicesContainer.classList.remove('hidden');
        waitingOpponentContainer.classList.add('hidden');
    }
}

function submitPvpChoice(choice) {
    if (!currentRoom || !currentUser) return;
    const rooms = getStorageRooms();
    const roomIndex = rooms.findIndex(r => r.id === currentRoom.id);
    if (roomIndex === -1) return;

    const room = rooms[roomIndex];
    const isHost = room.hostId === currentUser.id;

    if (isHost) {
        room.hostChoice = choice;
    } else {
        room.guestChoice = choice;
    }

    if (room.guestId === 'bot_ai' && !room.guestChoice) {
        const choices = ['scissors', 'rock', 'paper'];
        room.guestChoice = choices[Math.floor(Math.random() * choices.length)];
    }

    if (room.hostChoice && room.guestChoice) {
        room.status = 'result';
    }

    room.updatedAt = Date.now();
    rooms[roomIndex] = room;
    saveStorageRooms(rooms);
    broadcastRoomChange('CHOICE_SUBMITTED', room);

    syncActiveRoomState();
}

function renderPvpResult(room) {
    const isHost = room.hostId === currentUser.id;
    const p1Name = room.hostName;
    const p2Name = room.guestName || '도전자';
    const p1Choice = room.hostChoice;
    const p2Choice = room.guestChoice;

    document.getElementById('pvp-result-p1-name').textContent = p1Name + ' (방장)';
    document.getElementById('pvp-result-p2-name').textContent = p2Name + ' (도전자)';
    document.getElementById('pvp-result-p1-hand').textContent = CHOICES[p1Choice].emoji;
    document.getElementById('pvp-result-p2-hand').textContent = CHOICES[p2Choice].emoji;

    const resultText = document.getElementById('pvp-result-text');
    const resultCoins = document.getElementById('pvp-result-coins');

    let winner = 0; // 0: draw, 1: host, 2: guest
    if (p1Choice === p2Choice) {
        winner = 0;
    } else if (CHOICES[p1Choice].beats === p2Choice) {
        winner = 1;
    } else {
        winner = 2;
    }

    const isWinner = (isHost && winner === 1) || (!isHost && winner === 2);
    const isLoser = (isHost && winner === 2) || (!isHost && winner === 1);

    if (winner === 0) {
        resultText.textContent = '🤝 무승부!';
        resultText.className = 'result-text draw pop';
        resultCoins.textContent = '배팅 코인 보존';
        resultCoins.className = 'game-result-coins draw';
    } else if (isWinner) {
        resultText.textContent = '🎉 축하합니다! 승리하셨습니다!';
        resultText.className = 'result-text win pop';
        resultCoins.textContent = `+${room.bet.toLocaleString()} 🪙 코인 획득!`;
        resultCoins.className = 'game-result-coins win';
    } else {
        resultText.textContent = '😢 아쉽게 패배하셨습니다...';
        resultText.className = 'result-text lose pop';
        resultCoins.textContent = `-${room.bet.toLocaleString()} 🪙 차감`;
        resultCoins.className = 'game-result-coins lose';
    }

    const resultKey = `rps_result_processed_${room.id}_${room.updatedAt}`;
    if (!localStorage.getItem(resultKey)) {
        localStorage.setItem(resultKey, 'true');

        if (winner === 0) {
            currentUser.draws++;
        } else if (isWinner) {
            currentUser.coins += room.bet;
            currentUser.wins++;
        } else if (isLoser) {
            currentUser.coins -= room.bet;
            currentUser.losses++;
        }

        currentUser.history.unshift({
            date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            vs: `PVP (${isHost ? p2Name : p1Name})`,
            playerChoice: isHost ? p1Choice : p2Choice,
            opponentChoice: isHost ? p2Choice : p1Choice,
            outcome: winner === 0 ? 'draw' : (isWinner ? 'win' : 'lose'),
            bet: room.bet
        });
        if (currentUser.history.length > 20) currentUser.history.pop();

        updateUserData();
    }
}

function requestPvpRematch() {
    if (!currentRoom || !currentUser) return;
    const rooms = getStorageRooms();
    const roomIndex = rooms.findIndex(r => r.id === currentRoom.id);
    if (roomIndex === -1) return;

    const room = rooms[roomIndex];
    room.hostChoice = null;
    room.guestChoice = null;
    room.status = 'playing';

    if (room.guestId === 'bot_ai') {
        const choices = ['scissors', 'rock', 'paper'];
        room.guestChoice = choices[Math.floor(Math.random() * choices.length)];
    }

    room.updatedAt = Date.now();
    rooms[roomIndex] = room;
    saveStorageRooms(rooms);
    broadcastRoomChange('REMATCH_REQUESTED', room);

    syncActiveRoomState();
}

function exitRoom() {
    if (currentRoom) {
        if (currentUser && currentRoom.hostId === currentUser.id) {
            deleteRoom(currentRoom.id);
            showToast('방장이 나갔으므로 대전방이 삭제되었습니다.');
        } else {
            showToast('대전방에서 퇴장하셨습니다.');
        }
        currentRoom = null;
    }
    showScreen('screen-rooms');
}

// ===== PROFILE & RANKING =====
function renderProfile() {
    if (!currentUser) return;
    document.getElementById('profile-nickname').textContent = currentUser.nickname;
    document.getElementById('profile-id').textContent = `@${currentUser.id}`;
    document.getElementById('profile-coins').textContent = currentUser.coins.toLocaleString();

    // 칭호 착용 관리 및 해제
    const equippedBadge = document.getElementById('equipped-title-badge');
    if (equippedBadge) {
        if (currentUser.title) {
            equippedBadge.innerHTML = `
                <span class="user-custom-title" style="background:${currentUser.titleBg || 'var(--accent-purple)'}; padding:4px 10px; border-radius:12px; font-size:0.9rem; font-weight:bold;">${escapeHtml(currentUser.title)}</span>
                <button class="btn-secondary btn-sm" onclick="unequipTitle()" style="margin-left:8px; background:rgba(255,255,255,0.15);">❌ 착용 해제</button>
            `;
        } else {
            equippedBadge.innerHTML = '<span style="color:var(--text-secondary); font-size:0.85rem;">착용 중인 칭호 없음</span>';
        }
    }

    const titleActions = document.getElementById('profile-title-actions');
    if (titleActions) {
        const items = currentUser.inventory || [];
        if (items.length === 0) {
            titleActions.innerHTML = '<div style="grid-column:1/-1; color:var(--text-secondary); font-size:0.85rem;">보유 중인 칭호가 없습니다. 상점에서 칭호를 구매해보세요!</div>';
        } else {
            titleActions.innerHTML = items.map(item => {
                const isEquipped = currentUser.title === item.name;
                return `
                    <div style="background:rgba(255,255,255,0.05); padding:10px 12px; border-radius:10px; display:flex; justify-content:space-between; align-items:center;">
                        <span class="user-custom-title" style="background:${item.bg || 'var(--accent-purple)'}; font-size:0.8rem;">${escapeHtml(item.name)}</span>
                        ${isEquipped 
                            ? '<span style="color:#4caf50; font-size:0.8rem; font-weight:bold;">✨ 착용 중</span>' 
                            : `<button class="btn-primary btn-sm" onclick="equipTitleFromProfile('${escapeHtml(item.name)}', '${escapeHtml(item.bg)}')">✨ 착용</button>`}
                    </div>
                `;
            }).join('');
        }
    }

    const total = currentUser.wins + currentUser.losses + currentUser.draws;
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-wins').textContent = currentUser.wins;
    document.getElementById('stat-losses').textContent = currentUser.losses;
    document.getElementById('stat-draws').textContent = currentUser.draws;

    const winrate = total > 0 ? Math.round((currentUser.wins / total) * 100) : 0;
    document.getElementById('winrate-fill').style.width = `${winrate}%`;
    document.getElementById('winrate-value').textContent = `${winrate}%`;

    const list = document.getElementById('profile-history-list');
    if (!currentUser.history || currentUser.history.length === 0) {
        list.innerHTML = '<div class="history-empty">전적 기록이 없습니다</div>';
        return;
    }

    list.innerHTML = currentUser.history.map(item => {
        const resultLabel = { win: '승리', lose: '패배', draw: '무승부' };
        return `
            <div class="history-item">
                <span class="history-round">${item.date}</span>
                <div class="history-hands">
                    <span>${CHOICES[item.playerChoice].emoji}</span>
                    <span class="history-vs">VS</span>
                    <span>${CHOICES[item.opponentChoice].emoji}</span>
                </div>
                <span class="history-result ${item.outcome}">${resultLabel[item.outcome]} (${item.bet}🪙)</span>
            </div>
        `;
    }).join('');
}

function unequipTitle() {
    if (!currentUser) return;
    currentUser.title = '';
    currentUser.titleBg = '';
    updateUserData();
    showToast('칭호 착용을 해제했습니다.');
    renderProfile();
}

function equipTitleFromProfile(name, bg) {
    if (!currentUser) return;
    currentUser.title = name;
    currentUser.titleBg = bg;
    updateUserData();
    showToast(`'${name}' 칭호를 장착했습니다!`);
    renderProfile();
}

function renderRanking() {
    const usersObj = getStorageUsers();
    const sorted = Object.values(usersObj).sort((a, b) => b.coins - a.coins).slice(0, 10);
    const list = document.getElementById('ranking-list');

    if (sorted.length === 0) {
        list.innerHTML = '<div class="history-empty">랭킹 정보가 없습니다.</div>';
        return;
    }

    list.innerHTML = sorted.map((user, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
        return `
            <div class="ranking-card glass-card">
                <div class="ranking-rank">${medal}</div>
                <div class="ranking-info">
                    <div class="ranking-name">${escapeHtml(user.nickname)}</div>
                    <div class="ranking-sub">${user.wins}승 ${user.losses}패 ${user.draws}무</div>
                </div>
                <div class="ranking-coins">🪙 ${user.coins.toLocaleString()}</div>
            </div>
        `;
    }).join('');
}

// ===== ADMIN DASHBOARD LOGIC (관리자 전용 기능) =====
function renderAdminDashboard() {
    if (!currentUser || (currentUser.id !== ADMIN_ID && !currentUser.isAdmin)) {
        showToast('관리자 권한이 필요합니다!');
        showScreen('screen-lobby');
        return;
    }

    const users = getStorageUsers();
    const adminList = document.getElementById('admin-user-list');

    const userKeys = Object.keys(users);
    if (userKeys.length === 0) {
        adminList.innerHTML = '<div class="history-empty">등록된 유저가 없습니다.</div>';
        return;
    }

    adminList.innerHTML = userKeys.map(id => {
        const u = users[id];
        const isAdminAccount = u.id === ADMIN_ID;
        const titleBadge = u.title ? `<span class="user-custom-title" style="background:${u.titleBg || 'var(--accent-purple)'}">${escapeHtml(u.title)}</span>` : '';
        const nameColorStyle = u.nameColor ? `style="color:${u.nameColor}"` : '';

        return `
            <div class="admin-user-card glass-card">
                <div class="admin-user-info">
                    <div class="admin-user-name">
                        ${titleBadge}
                        <span ${nameColorStyle}>${escapeHtml(u.nickname)}</span>
                        <span class="admin-user-id">(@${escapeHtml(u.id)})</span>
                        ${isAdminAccount ? '<span class="admin-tag">관리자</span>' : ''}
                    </div>
                    <div class="admin-user-meta">
                        보유 코인: 🪙 <strong>${u.coins.toLocaleString()}</strong> | 전적: ${u.wins}승 ${u.losses}패 ${u.draws}무
                    </div>
                </div>
                <div class="admin-user-actions">
                    <button class="btn-admin-act btn-edit-nick" onclick="adminEditNickname('${u.id}')">✏️ 닉네임</button>
                    <button class="btn-admin-act btn-edit-title" onclick="adminEditTitle('${u.id}')">🏷️ 칭호 설정</button>
                    <button class="btn-admin-act btn-edit-color" onclick="adminEditColor('${u.id}')">🎨 닉네임 색상</button>
                    <button class="btn-admin-act btn-add-coin" onclick="adminAddCoins('${u.id}')">🪙 코인 지급/차감</button>
                    <button class="btn-admin-act btn-edit-title" onclick="adminSendGift('${u.id}')" style="background:var(--accent-pink);">🎁 선물 보내기</button>
                    ${!isAdminAccount ? `<button class="btn-admin-act btn-delete-user" onclick="adminDeleteUser('${u.id}')">🗑️ 계정 삭제</button>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

// 칭호 설정
function adminEditTitle(userId) {
    const users = getStorageUsers();
    const u = users[userId];
    if (!u) return;

    const newTitle = prompt(`[@${userId}] 님에게 부여할 칭호를 입력하세요 (빈칸 입력 시 제거):`, u.title || '전설의 승부사');
    if (newTitle !== null) {
        u.title = newTitle.trim();
        if (u.title) {
            const bg = prompt('칭호 배경 색상 코드(HEX/RGB) 또는 색상이름을 입력하세요:', u.titleBg || '#ff4081');
            if (bg) u.titleBg = bg.trim();
        }
        saveStorageUsers(users);
        if (currentUser.id === userId) currentUser.title = u.title;
        showToast(`[@${userId}] 님의 칭호가 '${u.title || '없음'}'(으)로 설정되었습니다.`);
        renderAdminDashboard();
    }
}

// 닉네임 색상 설정
function adminEditColor(userId) {
    const users = getStorageUsers();
    const u = users[userId];
    if (!u) return;

    const newColor = prompt(`[@${userId}] 님의 닉네임 글자 색상을 입력하세요 (예: #00e5ff, #ffab40, yellow, cyan) (빈칸 입력 시 기본값):`, u.nameColor || '#00e5ff');
    if (newColor !== null) {
        u.nameColor = newColor.trim();
        saveStorageUsers(users);
        if (currentUser.id === userId) currentUser.nameColor = u.nameColor;
        showToast(`[@${userId}] 님의 닉네임 색상이 변경되었습니다.`);
        renderAdminDashboard();
    }
}

// 1. 유저 계정 삭제
function adminDeleteUser(userId) {
    if (userId === ADMIN_ID) {
        showToast('관리자 본인 계정은 삭제할 수 없습니다!');
        return;
    }

    if (confirm(`정말로 아이디 [@${userId}] 계정을 삭제하시겠습니까?`)) {
        const users = getStorageUsers();
        delete users[userId];
        saveStorageUsers(users);

        showToast(`계정 [@${userId}] 이(가) 성공적으로 삭제되었습니다.`);
        renderAdminDashboard();
    }
}

// 2. 닉네임 변경
function adminEditNickname(userId) {
    const users = getStorageUsers();
    const u = users[userId];
    if (!u) return;

    const newNick = prompt(`[@${userId}] 님의 변경할 새 닉네임을 입력하세요:`, u.nickname);
    if (newNick && newNick.trim() !== '') {
        u.nickname = newNick.trim();
        saveStorageUsers(users);

        if (currentUser.id === userId) {
            currentUser.nickname = u.nickname;
        }

        showToast(`닉네임이 '${u.nickname}'(으)로 변경되었습니다.`);
        renderAdminDashboard();
    }
}

// 3. 코인 추가/차감
function adminAddCoins(userId) {
    const users = getStorageUsers();
    const u = users[userId];
    if (!u) return;

    const amountStr = prompt(`[@${userId}] 님에게 추가(지급)할 코인 수량을 입력하세요.\n(차감하려면 음수 입력 ex: -500):`, '1000');
    if (amountStr !== null) {
        const amount = parseInt(amountStr, 10);
        if (isNaN(amount)) {
            showToast('올바른 숫자를 입력하세요.');
            return;
        }

        u.coins = Math.max(0, u.coins + amount);
        saveStorageUsers(users);

        if (currentUser.id === userId) {
            currentUser.coins = u.coins;
        }

        showToast(`[@${userId}] 님의 코인이 ${amount >= 0 ? '+' : ''}${amount.toLocaleString()} 🪙 변경되었습니다.`);
        renderAdminDashboard();
    }
}

// ===== SHOP & MARKETPLACE & GIFT LOGIC =====
const DEFAULT_OFFICIAL_TITLES = [
    { id: 't_legend', name: '👑 가위바위보 전설', price: 10000, bg: 'linear-gradient(135deg, #ff4081, #7c4dff)', desc: '아레나 최강 승리자에게 부여되는 전설의 칭호' },
    { id: 't_master', name: '⚔️ 아레나 패왕', price: 5000, bg: 'linear-gradient(135deg, #ff6e40, #ff4081)', desc: '수많은 대전을 지배한 압도적 패왕의 칭호' },
    { id: 't_rich', name: '💎 억만장자', price: 3000, bg: 'linear-gradient(135deg, #00e5ff, #1de9b6)', desc: '엄청난 재력을 자랑하는 가위바위보 부호' },
    { id: 't_streak', name: '🔥 연승의 연금술사', price: 2000, bg: 'linear-gradient(135deg, #ffab40, #ff6d00)', desc: '멈추지 않는 연속 승리의 주인공' },
    { id: 't_lucky', name: '🍀 행운의 승부사', price: 1000, bg: 'linear-gradient(135deg, #00e676, #1de9b6)', desc: '언제나 운이 함께하는 플레이어' },
    { id: 't_rookie', name: '🐣 아레나 루키', price: 500, bg: 'linear-gradient(135deg, #ab47bc, #8e24aa)', desc: '새롭게 도전을 시작하는 도전자' }
];

function getStorageOfficialTitles() {
    const data = localStorage.getItem('rps_arena_official_titles');
    if (!data) {
        localStorage.setItem('rps_arena_official_titles', JSON.stringify(DEFAULT_OFFICIAL_TITLES));
        return DEFAULT_OFFICIAL_TITLES;
    }
    return JSON.parse(data);
}

function saveStorageOfficialTitles(titles) {
    localStorage.setItem('rps_arena_official_titles', JSON.stringify(titles));
}

function getStorageMarket() {
    const data = localStorage.getItem('rps_arena_market');
    return data ? JSON.parse(data) : [];
}

function saveStorageMarket(market) {
    localStorage.setItem('rps_arena_market', JSON.stringify(market));
}

let activeShopTab = 'buy';

function switchShopTab(tab) {
    activeShopTab = tab;
    document.getElementById('tab-shop-buy').classList.toggle('active', tab === 'buy');
    document.getElementById('tab-shop-market').classList.toggle('active', tab === 'market');
    document.getElementById('tab-shop-bag').classList.toggle('active', tab === 'bag');

    document.getElementById('shop-tab-buy').classList.toggle('hidden', tab !== 'buy');
    document.getElementById('shop-tab-market').classList.toggle('hidden', tab !== 'market');
    document.getElementById('shop-tab-bag').classList.toggle('hidden', tab !== 'bag');

    renderShopUI();
}

function renderShopUI() {
    if (!currentUser) return;
    const shopCoinDisplay = document.getElementById('shop-coin-display');
    if (shopCoinDisplay) shopCoinDisplay.textContent = currentUser.coins.toLocaleString();

    if (activeShopTab === 'buy') renderOfficialShop();
    else if (activeShopTab === 'market') renderUserMarket();
    else if (activeShopTab === 'bag') renderInventory();
}

function renderOfficialShop() {
    const list = document.getElementById('official-shop-list');
    if (!list) return;

    const titles = getStorageOfficialTitles();
    const isAdmin = currentUser && (currentUser.isAdmin || currentUser.id === ADMIN_ID);

    let html = '';
    if (isAdmin) {
        html += `
            <div class="glass-card" style="grid-column: 1 / -1; padding:14px 18px; display:flex; justify-content:space-between; align-items:center; background:rgba(255,64,129,0.12); border:1px dashed var(--accent-pink); border-radius:14px; margin-bottom:6px;">
                <span style="font-weight:bold; color:var(--accent-pink);">👑 관리자 전용: 공식 상점 칭호 관리 (추가/가격·이름 수정)</span>
                <button class="btn-primary btn-sm" onclick="adminAddOfficialTitle()" style="background:var(--accent-pink);">+ 새 공식 칭호 추가</button>
            </div>
        `;
    }

    html += titles.map(item => {
        const isOwned = (currentUser.inventory || []).some(inv => inv.name === item.name);
        return `
            <div class="glass-card" style="padding:16px; display:flex; flex-direction:column; justify-content:space-between; border-radius:14px; background:rgba(255,255,255,0.04);">
                <div>
                    <span class="user-custom-title" style="background:${item.bg}; padding:4px 10px; border-radius:12px; font-size:0.9rem; font-weight:bold; display:inline-block; margin-bottom:8px;">${escapeHtml(item.name)}</span>
                    <p style="font-size:0.85rem; color:var(--text-secondary); margin:6px 0 12px 0;">${escapeHtml(item.desc || '상점 공식 칭호')}</p>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; flex-wrap:wrap; gap:6px;">
                    <span style="font-weight:bold; color:var(--accent-yellow);">🪙 ${item.price.toLocaleString()} 코인</span>
                    <div style="display:flex; gap:6px; align-items:center;">
                        ${isAdmin ? `<button class="btn-secondary btn-sm" onclick="adminEditOfficialTitle('${item.id}')">✏️ 수정</button><button class="btn-secondary btn-sm" onclick="adminDeleteOfficialTitle('${item.id}')" style="background:rgba(244,67,54,0.3);">🗑️</button>` : ''}
                        ${isOwned 
                            ? '<span style="font-size:0.8rem; color:#4caf50; font-weight:bold;">✅ 보유 중</span>'
                            : `<button class="btn-primary btn-sm" onclick="buyOfficialTitle('${item.id}')">구매하기</button>`}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    list.innerHTML = html;
}

function buyOfficialTitle(titleId) {
    if (!currentUser) return;
    const titles = getStorageOfficialTitles();
    const title = titles.find(t => t.id === titleId);
    if (!title) return;

    if (currentUser.coins < title.price) {
        showToast('코인이 부족합니다!');
        return;
    }

    if ((currentUser.inventory || []).some(inv => inv.name === title.name)) {
        showToast('이미 보유하고 있는 칭호입니다!');
        return;
    }

    currentUser.coins -= title.price;
    if (!currentUser.inventory) currentUser.inventory = [];
    currentUser.inventory.push({
        id: title.id + '_' + Date.now(),
        name: title.name,
        bg: title.bg
    });

    currentUser.title = title.name;
    currentUser.titleBg = title.bg;

    updateUserData();
    showToast(`'${title.name}' 칭호를 구매하고 장착했습니다! 🎉`);
    renderShopUI();
}

function adminAddOfficialTitle() {
    if (!currentUser || (!currentUser.isAdmin && currentUser.id !== ADMIN_ID)) return;
    const name = prompt('추가할 새 공식 칭호 이름을 입력하세요 (예: ⚡ 가위바위보 신):', '⚡ 가위바위보 신');
    if (!name || !name.trim()) return;

    const priceStr = prompt('칭호 판매 가격 (코인)을 입력하세요:', '8000');
    const price = parseInt(priceStr, 10);
    if (isNaN(price) || price <= 0) {
        showToast('올바른 가격을 입력해주세요.');
        return;
    }

    const bg = prompt('칭호 배경 색상 코드를 입력하세요 (HEX/RGB/Gradient):', 'linear-gradient(135deg, #00e5ff, #7c4dff)');

    const titles = getStorageOfficialTitles();
    const newTitle = {
        id: 't_custom_' + Date.now(),
        name: name.trim(),
        price: price,
        bg: bg || 'linear-gradient(135deg, #00e5ff, #7c4dff)',
        desc: '관리자가 추가한 특별 공식 칭호'
    };
    titles.unshift(newTitle);
    saveStorageOfficialTitles(titles);

    showToast(`새 공식 칭호 '${newTitle.name}' 이(가) 상점에 등록되었습니다!`);
    renderShopUI();
}

function adminEditOfficialTitle(titleId) {
    if (!currentUser || (!currentUser.isAdmin && currentUser.id !== ADMIN_ID)) return;
    const titles = getStorageOfficialTitles();
    const title = titles.find(t => t.id === titleId);
    if (!title) return;

    const newName = prompt('변경할 칭호 이름을 입력하세요:', title.name);
    if (!newName || !newName.trim()) return;

    const priceStr = prompt('변경할 판매 가격 (코인)을 입력하세요:', title.price);
    const newPrice = parseInt(priceStr, 10);
    if (isNaN(newPrice) || newPrice <= 0) {
        showToast('올바른 가격을 입력해주세요.');
        return;
    }

    const newBg = prompt('변경할 칭호 배경 색상 코드를 입력하세요:', title.bg || 'linear-gradient(135deg, #ff4081, #7c4dff)');

    title.name = newName.trim();
    title.price = newPrice;
    if (newBg) title.bg = newBg.trim();

    saveStorageOfficialTitles(titles);
    showToast(`'${title.name}' 칭호 정보(이름/가격)가 수정되었습니다.`);
    renderShopUI();
}

function adminDeleteOfficialTitle(titleId) {
    if (!currentUser || (!currentUser.isAdmin && currentUser.id !== ADMIN_ID)) return;
    if (!confirm('정말로 이 공식 칭호를 상점에서 삭제하시겠습니까?')) return;

    let titles = getStorageOfficialTitles();
    titles = titles.filter(t => t.id !== titleId);
    saveStorageOfficialTitles(titles);

    showToast('공식 칭호가 상점에서 삭제되었습니다.');
    renderShopUI();
}

function renderUserMarket() {
    const list = document.getElementById('user-market-list');
    if (!list) return;
    const market = getStorageMarket();

    if (market.length === 0) {
        list.innerHTML = '<div class="room-empty" style="grid-column: 1 / -1;">등록된 유저 장터 매물이 없습니다.<br>내 가방의 칭호를 등록해보세요!</div>';
        return;
    }

    list.innerHTML = market.map(item => {
        const isMine = currentUser && item.sellerId === currentUser.id;
        return `
            <div class="glass-card" style="padding:16px; display:flex; flex-direction:column; justify-content:space-between; border-radius:14px; background:rgba(255,255,255,0.04);">
                <div>
                    <div style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:6px;">판매자: ${escapeHtml(item.sellerName)}</div>
                    <span class="user-custom-title" style="background:${item.title.bg || 'var(--accent-purple)'}; padding:4px 10px; border-radius:12px; font-size:0.9rem; font-weight:bold; display:inline-block; margin-bottom:8px;">${escapeHtml(item.title.name)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px;">
                    <span style="font-weight:bold; color:var(--accent-yellow);">🪙 ${item.price.toLocaleString()} 코인</span>
                    ${isMine 
                        ? `<button class="btn-secondary btn-sm" onclick="cancelMarketListing(${item.id})">등록 취소</button>`
                        : `<button class="btn-primary btn-sm" onclick="buyMarketTitle(${item.id})">구매하기</button>`}
                </div>
            </div>
        `;
    }).join('');
}

function showSellModal(selectedItemId) {
    if (!currentUser || !currentUser.inventory || currentUser.inventory.length === 0) {
        showToast('판매 등록할 보유 칭호가 없습니다! 상점에서 칭호를 구매해보세요.');
        return;
    }

    currentUser.inventory.forEach((inv, idx) => {
        if (!inv.id) inv.id = 'inv_' + Date.now() + '_' + idx;
    });

    if (selectedItemId) {
        sellTitleDirectly(selectedItemId);
        return;
    }

    if (currentUser.inventory.length === 1) {
        sellTitleDirectly(currentUser.inventory[0].id);
        return;
    }

    const optionsText = currentUser.inventory.map((item, idx) => `${idx + 1}: ${item.name}`).join('\n');
    const choiceStr = prompt(`유저 장터에 판매 등록할 칭호 번호를 선택하세요:\n${optionsText}`, '1');
    if (choiceStr === null) return;

    const choiceIdx = parseInt(choiceStr, 10) - 1;
    if (isNaN(choiceIdx) || choiceIdx < 0 || choiceIdx >= currentUser.inventory.length) {
        showToast('올바른 칭호 번호를 선택해주세요.');
        return;
    }

    const selectedItem = currentUser.inventory[choiceIdx];
    sellTitleDirectly(selectedItem.id);
}

function hideSellModal() {
    const modal = document.getElementById('sell-market-modal');
    if (modal) modal.classList.add('hidden');
}

function confirmListOnMarket() {
    if (!currentUser) return;
    const itemSelectId = document.getElementById('sell-title-select').value;
    const priceInput = document.getElementById('sell-price-input').value;
    const price = parseInt(priceInput, 10);

    if (isNaN(price) || price <= 0) {
        showToast('올바른 판매 가격을 입력하세요!');
        return;
    }

    if (!currentUser.inventory) currentUser.inventory = [];
    currentUser.inventory.forEach((inv, idx) => {
        if (!inv.id) inv.id = 'inv_' + Date.now() + '_' + idx;
    });

    const itemIndex = currentUser.inventory.findIndex(inv => String(inv.id) === String(itemSelectId));
    if (itemIndex === -1) {
        showToast('선택한 칭호를 가방에서 찾을 수 없습니다.');
        return;
    }

    const titleObj = currentUser.inventory.splice(itemIndex, 1)[0];

    if (currentUser.title === titleObj.name) {
        const stillHas = currentUser.inventory.some(inv => inv.name === titleObj.name);
        if (!stillHas) {
            currentUser.title = '';
            currentUser.titleBg = '';
        }
    }

    const market = getStorageMarket();
    const newListing = {
        id: Date.now(),
        sellerId: currentUser.id,
        sellerName: currentUser.nickname,
        title: titleObj,
        price: price,
        date: new Date().toLocaleTimeString()
    };

    market.unshift(newListing);
    saveStorageMarket(market);
    updateUserData();
    hideSellModal();
    showToast(`'${titleObj.name}' 칭호가 ${price.toLocaleString()} 코인에 장터 등록되었습니다! 🎉`);
    switchShopTab('market');
}

function sellTitleDirectly(itemId) {
    if (!currentUser || !currentUser.inventory) return;

    currentUser.inventory.forEach((inv, idx) => {
        if (!inv.id) inv.id = 'inv_' + Date.now() + '_' + idx;
    });

    const item = currentUser.inventory.find(inv => String(inv.id) === String(itemId));
    if (!item) {
        showToast('선택한 칭호를 가방에서 찾을 수 없습니다.');
        return;
    }

    const priceStr = prompt(`[${item.name}] 칭호를 유저 장터에 판매 등록합니다.\n원하는 판매 가격(코인 🪙)을 직접 입력하세요:`, '3000');
    if (priceStr === null) return;

    const price = parseInt(priceStr, 10);
    if (isNaN(price) || price <= 0) {
        showToast('올바른 판매 가격(1 이상의 숫자)을 입력하세요!');
        return;
    }

    currentUser.inventory = currentUser.inventory.filter(inv => String(inv.id) !== String(itemId));

    if (currentUser.title === item.name) {
        const stillHas = currentUser.inventory.some(inv => inv.name === item.name);
        if (!stillHas) {
            currentUser.title = '';
            currentUser.titleBg = '';
        }
    }

    const market = getStorageMarket();
    const newListing = {
        id: Date.now(),
        sellerId: currentUser.id,
        sellerName: currentUser.nickname,
        title: item,
        price: price,
        date: new Date().toLocaleTimeString()
    };

    market.unshift(newListing);
    saveStorageMarket(market);
    updateUserData();

    showToast(`'${item.name}' 칭호가 ${price.toLocaleString()} 코인에 장터 판매 등록되었습니다! 🎉`);
    switchShopTab('market');
}

function buyMarketTitle(marketId) {
    if (!currentUser) return;
    let market = getStorageMarket();
    const listing = market.find(m => m.id === marketId);
    if (!listing) {
        showToast('해당 매물이 존재하지 않거나 이미 판매되었습니다.');
        return;
    }

    if (listing.sellerId === currentUser.id) {
        showToast('본인의 매물은 구매할 수 없습니다.');
        return;
    }

    if (currentUser.coins < listing.price) {
        showToast('코인이 부족하여 구매할 수 없습니다!');
        return;
    }

    currentUser.coins -= listing.price;
    if (!currentUser.inventory) currentUser.inventory = [];
    if (!listing.title.id) listing.title.id = 'inv_' + Date.now();
    currentUser.inventory.push(listing.title);

    currentUser.title = listing.title.name;
    currentUser.titleBg = listing.title.bg;
    updateUserData();

    const users = getStorageUsers();
    if (users[listing.sellerId]) {
        users[listing.sellerId].coins += listing.price;
        if (!users[listing.sellerId].inbox) users[listing.sellerId].inbox = [];
        users[listing.sellerId].inbox.unshift({
            id: Date.now(),
            title: '⚖️ 장터 거래 성공 알림',
            content: `'${listing.title.name}' 칭호가 ${currentUser.nickname} 님에게 ${listing.price.toLocaleString()} 코인에 판매되었습니다! 🎉`,
            coins: 0,
            date: new Date().toLocaleTimeString()
        });
        saveStorageUsers(users);
    }

    market = market.filter(m => m.id !== marketId);
    saveStorageMarket(market);

    showToast(`'${listing.title.name}' 칭호를 장터에서 성공적으로 구매하였습니다! 🎉`);
    renderShopUI();
}

function cancelMarketListing(marketId) {
    if (!currentUser) return;
    let market = getStorageMarket();
    const listing = market.find(m => m.id === marketId);
    if (!listing || listing.sellerId !== currentUser.id) return;

    market = market.filter(m => m.id !== marketId);
    saveStorageMarket(market);

    if (!currentUser.inventory) currentUser.inventory = [];
    if (!listing.title.id) listing.title.id = 'inv_' + Date.now();
    currentUser.inventory.push(listing.title);
    updateUserData();

    showToast(`'${listing.title.name}' 매물 등록이 취소되어 가방으로 돌아왔습니다.`);
    renderShopUI();
}

function renderInventory() {
    const list = document.getElementById('inventory-list');
    if (!list) return;

    if (!currentUser.inventory) currentUser.inventory = [];
    currentUser.inventory.forEach((inv, idx) => {
        if (!inv.id) inv.id = 'inv_' + Date.now() + '_' + idx;
    });

    const items = currentUser.inventory;
    if (items.length === 0) {
        list.innerHTML = '<div class="room-empty" style="grid-column: 1 / -1;">보유 중인 칭호가 없습니다.<br>상점이나 장터에서 칭호를 구해보세요!</div>';
        return;
    }

    list.innerHTML = items.map(item => {
        const isEquipped = currentUser.title === item.name;
        return `
            <div class="glass-card" style="padding:16px; display:flex; flex-direction:column; justify-content:space-between; border-radius:14px; background:rgba(255,255,255,0.04);">
                <div>
                    <span class="user-custom-title" style="background:${item.bg || 'var(--accent-purple)'}; padding:4px 10px; border-radius:12px; font-size:0.9rem; font-weight:bold; display:inline-block; margin-bottom:8px;">${escapeHtml(item.name)}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; flex-wrap:wrap; gap:6px;">
                    ${isEquipped 
                        ? '<span style="color:#4caf50; font-weight:bold; font-size:0.85rem;">✨ 현재 장착 중</span>' 
                        : `<button class="btn-primary btn-sm" onclick="equipTitleFromInv('${escapeHtml(item.name)}', '${escapeHtml(item.bg)}')">장착하기</button>`}
                    <button class="btn-secondary btn-sm" onclick="sellTitleDirectly('${item.id}')" style="background:var(--accent-pink);">🏷️ 장터 판매 (가격을 직접 입력)</button>
                </div>
            </div>
        `;
    }).join('');
}

function equipTitleFromInv(name, bg) {
    if (!currentUser) return;
    currentUser.title = name;
    currentUser.titleBg = bg;
    updateUserData();
    showToast(`'${name}' 칭호를 장착했습니다!`);
    renderShopUI();
}

// ===== ADMIN GIFT LOGIC =====
function adminSendGift(userId) {
    const users = getStorageUsers();
    const u = users[userId];
    if (!u) return;

    const giftType = prompt(`[@${userId}] 님에게 전달할 선물 유형을 선택하세요:\n1: 🎁 한정판 칭호 선물\n2: 🪙 자유 코인 선물`, '1');
    if (!giftType) return;

    if (giftType === '1') {
        const titleName = prompt('부여할 칭호 이름을 입력하세요 (예: 👑 아레나 개발자 수호자):', '👑 최우수 승부사');
        if (!titleName) return;
        const bg = prompt('칭호 배경 색상 코드를 입력하세요:', 'linear-gradient(135deg, #ff4081, #00e5ff)');

        if (!u.inbox) u.inbox = [];
        u.inbox.unshift({
            id: Date.now(),
            title: '🎁 관리자의 특별 칭호 선물!',
            content: `최고 관리자로부터 특별 칭호 [${titleName}] 이(가) 도착했습니다!`,
            item: { id: 'admin_gift_' + Date.now(), name: titleName, bg: bg || 'var(--accent-purple)' },
            coins: 0,
            date: new Date().toLocaleTimeString()
        });
        saveStorageUsers(users);
        showToast(`[@${userId}] 님에게 특별 칭호 선물을 전송했습니다!`);
    } else if (giftType === '2') {
        const coinAmountStr = prompt('선물할 코인 수량을 입력하세요:', '5000');
        const coinAmount = parseInt(coinAmountStr, 10);
        if (isNaN(coinAmount) || coinAmount <= 0) {
            showToast('올바른 코인 수량을 입력하세요.');
            return;
        }

        if (!u.inbox) u.inbox = [];
        u.inbox.unshift({
            id: Date.now(),
            title: '🎁 관리자의 코인 선물!',
            content: `최고 관리자로부터 🪙 ${coinAmount.toLocaleString()} 코인 보너스가 도착했습니다!`,
            coins: coinAmount,
            date: new Date().toLocaleTimeString()
        });
        saveStorageUsers(users);
        showToast(`[@${userId}] 님에게 ${coinAmount.toLocaleString()} 코인 선물을 전송했습니다!`);
    }
}

// ===== INBOX LOGIC =====
function renderInbox() {
    if (!currentUser) return;
    const list = document.getElementById('inbox-list');
    if (!list) return;

    const inbox = currentUser.inbox || [];
    if (inbox.length === 0) {
        list.innerHTML = '<div class="room-empty">도착한 선물이나 알림이 없습니다.</div>';
        return;
    }

    list.innerHTML = inbox.map((item, idx) => {
        return `
            <div class="glass-card" style="padding:16px; margin-bottom:12px; border-radius:14px; background:rgba(255,255,255,0.04);">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="font-size:1rem; color:var(--accent-yellow);">${escapeHtml(item.title)}</strong>
                    <span style="font-size:0.75rem; color:var(--text-secondary);">${item.date || ''}</span>
                </div>
                <p style="font-size:0.9rem; margin:8px 0; color:#eee;">${escapeHtml(item.content)}</p>
                <div style="display:flex; justify-content:flex-end;">
                    <button class="btn-primary btn-sm" onclick="claimGift(${idx})">🎁 받기 / 수령</button>
                </div>
            </div>
        `;
    }).join('');
}

function claimGift(index) {
    if (!currentUser || !currentUser.inbox) return;
    const item = currentUser.inbox[index];
    if (!item) return;

    if (item.coins > 0) {
        currentUser.coins += item.coins;
        showToast(`🪙 ${item.coins.toLocaleString()} 코인을 받았습니다!`);
    }

    if (item.item) {
        if (!currentUser.inventory) currentUser.inventory = [];
        currentUser.inventory.push(item.item);
        currentUser.title = item.item.name;
        currentUser.titleBg = item.item.bg;
        showToast(`'${item.item.name}' 칭호를 수령하여 자동 장착했습니다! 🎉`);
    }

    currentUser.inbox.splice(index, 1);
    updateUserData();
    updateLobbyUI();
    renderInbox();
}

function escapeHtml(str) {
    return str ? str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;") : '';
}

// ===== SNAIL RACE MINI-GAME LOGIC (달팽이 경주) =====
let selectedSnailId = 1;
let isSnailRacing = false;

function renderSnailRaceUI() {
    if (!currentUser) return;
    const coinDisplay = document.getElementById('snail-coin-display');
    if (coinDisplay) coinDisplay.textContent = currentUser.coins.toLocaleString();
}

function selectSnail(snailId) {
    if (isSnailRacing) return;
    selectedSnailId = snailId;
    [1, 2, 3].forEach(id => {
        const btn = document.getElementById(`snail-btn-${id}`);
        if (btn) {
            btn.classList.toggle('active', id === snailId);
            btn.style.border = (id === snailId) ? '2px solid var(--accent-pink)' : 'none';
        }
    });
}

function setSnailBet(amount) {
    if (isSnailRacing) return;
    const input = document.getElementById('snail-bet-input');
    if (input) input.value = amount;
}

function setSnailBetAll() {
    if (isSnailRacing || !currentUser) return;
    const input = document.getElementById('snail-bet-input');
    if (input) input.value = Math.max(10, currentUser.coins);
}

function startSnailRace() {
    if (!currentUser) return;
    if (isSnailRacing) {
        showToast('경주가 이미 진행 중입니다!');
        return;
    }

    const input = document.getElementById('snail-bet-input');
    const bet = parseInt(input.value, 10);

    if (isNaN(bet) || bet <= 0) {
        showToast('올바른 배팅 코인을 입력하세요!');
        return;
    }

    if (currentUser.coins < bet) {
        showToast('배팅 코인이 부족합니다!');
        return;
    }

    // Deduct bet coins
    currentUser.coins -= bet;
    updateUserData();
    renderSnailRaceUI();

    isSnailRacing = true;
    const startBtn = document.getElementById('start-snail-race-btn');
    if (startBtn) {
        startBtn.disabled = true;
        startBtn.style.opacity = '0.5';
    }

    const statusEl = document.getElementById('snail-race-status');
    if (statusEl) statusEl.textContent = '🚀 출발! 3마리의 달팽이가 맹렬히 달리고 있습니다!';

    const positions = [0, 0, 0];
    const runners = [
        document.getElementById('snail-runner-1'),
        document.getElementById('snail-runner-2'),
        document.getElementById('snail-runner-3')
    ];

    runners.forEach(r => {
        if (r) r.style.left = '0%';
    });

    const snailNames = ['1번 스피디 🔴', '2번 터보 🔵', '3번 썬더 🟢'];

    const raceInterval = setInterval(() => {
        let maxPos = 0;
        let leadingIdx = 0;

        for (let i = 0; i < 3; i++) {
            const boost = Math.random() < 0.18 ? 5 : 0;
            positions[i] += (Math.random() * 5.5 + 1.5 + boost);
            if (positions[i] > 92) positions[i] = 92;

            if (runners[i]) runners[i].style.left = positions[i] + '%';

            if (positions[i] > maxPos) {
                maxPos = positions[i];
                leadingIdx = i;
            }
        }

        if (statusEl) {
            const comments = [
                `⚡ ${snailNames[leadingIdx]}가 선두로 치고 나갑니다!`,
                `🔥 치열한 접전! ${snailNames[leadingIdx]}가 아슬아슬하게 앞서갑니다!`,
                `💥 ${snailNames[leadingIdx]}의 질주! 결승선이 보입니다!`
            ];
            statusEl.textContent = comments[Math.floor(Math.random() * comments.length)];
        }

        // Check if leading snail reached finish line (90%+)
        if (maxPos >= 90) {
            clearInterval(raceInterval);

            // Determine rankings
            const ranked = [0, 1, 2].sort((a, b) => positions[b] - positions[a]);
            const winnerSnailId = ranked[0] + 1; // 1, 2, or 3
            const winnerName = snailNames[ranked[0]];

            const isWin = (selectedSnailId === winnerSnailId);
            const prize = isWin ? (bet * 3) : 0;

            setTimeout(() => {
                if (isWin) {
                    currentUser.coins += prize;
                    currentUser.wins += 1;
                    if (statusEl) {
                        statusEl.innerHTML = `<span style="color:#4caf50; font-size:1.1rem;">🎉 축하합니다! ${winnerName} 1등 결승선 통과!<br>배팅 성공으로 🪙 ${prize.toLocaleString()} 코인을 획득하셨습니다! (3배)</span>`;
                    }
                    showToast(`🎉 1등 예측 성공! ${prize.toLocaleString()} 코인 획득!`);
                } else {
                    currentUser.losses += 1;
                    if (statusEl) {
                        statusEl.innerHTML = `<span style="color:var(--accent-pink); font-size:1.05rem;">😢 ${winnerName}가 1등으로 들어왔습니다.<br>예측 실패로 ${bet.toLocaleString()} 코인을 잃었습니다.</span>`;
                    }
                    showToast(`😢 아쉽게도 ${winnerName}가 1등으로 들어왔습니다.`);
                }

                if (!currentUser.history) currentUser.history = [];
                currentUser.history.unshift({
                    date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    vs: `🐌 달팽이 레이스 (${selectedSnailId}번 선택)`,
                    outcome: isWin ? '승리' : '패배',
                    bet: isWin ? (prize - bet) : -bet
                });
                if (currentUser.history.length > 20) currentUser.history.pop();

                updateUserData();
                renderSnailRaceUI();

                isSnailRacing = false;
                if (startBtn) {
                    startBtn.disabled = false;
                    startBtn.style.opacity = '1';
                }
            }, 300);
        }
    }, 180);
}

// ===== FISHING SYSTEM DATA & LOGIC (아레나 낚시터) =====
const FISHING_RODS = [
    {
        id: 'rod_wood',
        name: '🪵 나무 낚시대',
        price: 0,
        waitTime: 3500,
        rareBonus: 0,
        priceMult: 1.0,
        bg: 'linear-gradient(135deg, #795548, #4e342e)',
        desc: '기본형 낚시대. 입질 속도가 느리지만 차분히 낚을 수 있습니다.'
    },
    {
        id: 'rod_silver',
        name: '🥈 은빛 낚시대',
        price: 3000,
        waitTime: 2500,
        rareBonus: 10,
        priceMult: 1.15,
        bg: 'linear-gradient(135deg, #9e9e9e, #616161)',
        desc: '은빛으로 빛나는 튼튼한 낚시대. 희귀 이상 획득 확률 +10%, 판매가 1.15배'
    },
    {
        id: 'rod_gold',
        name: '🥇 황금 낚시대',
        price: 15000,
        waitTime: 1800,
        rareBonus: 25,
        priceMult: 1.35,
        bg: 'linear-gradient(135deg, #ffb300, #ff6f00)',
        desc: '황금 가공 낚시대! 입질 속도 대폭 감소, 희귀+ 확률 +25%, 판매가 1.35배'
    },
    {
        id: 'rod_legend',
        name: '👑 전설의 찌 낚시대',
        price: 50000,
        waitTime: 1200,
        rareBonus: 45,
        priceMult: 1.7,
        bg: 'linear-gradient(135deg, #e91e63, #9c27b0)',
        desc: '전설의 입질을 불러오는 보물 낚시대! 전설 확률 대폭 상승, 판매가 1.7배!'
    }
];

const FISH_TYPES = [
    // 일반 (Common - ~50%)
    { name: '피라미', grade: '일반', gradeColor: '#b0bec5', basePrice: 150, minSize: 8, maxSize: 18, emoji: '🐟' },
    { name: '붕어', grade: '일반', gradeColor: '#b0bec5', basePrice: 300, minSize: 15, maxSize: 30, emoji: '🐟' },
    { name: '잉어', grade: '일반', gradeColor: '#b0bec5', basePrice: 500, minSize: 25, maxSize: 50, emoji: '🐟' },
    
    // 희귀 (Rare - ~30%)
    { name: '연어', grade: '희귀', gradeColor: '#00e5ff', basePrice: 1200, minSize: 40, maxSize: 80, emoji: '🐠' },
    { name: '광어', grade: '희귀', gradeColor: '#00e5ff', basePrice: 2500, minSize: 35, maxSize: 70, emoji: '🐠' },
    { name: '돔', grade: '희귀', gradeColor: '#00e5ff', basePrice: 4000, minSize: 30, maxSize: 60, emoji: '🐠' },

    // 영웅 (Epic - ~15%)
    { name: '참치', grade: '영웅', gradeColor: '#ab47bc', basePrice: 10000, minSize: 100, maxSize: 220, emoji: '🦈' },
    { name: '킹크랩', grade: '영웅', gradeColor: '#ab47bc', basePrice: 18000, minSize: 30, maxSize: 60, emoji: '🦀' },

    // 전설 (Legendary - ~5%)
    { name: '황금 등가시치', grade: '전설', gradeColor: '#ffb300', basePrice: 50000, minSize: 150, maxSize: 300, emoji: '🐉' },
    { name: '전설의 심해룡', grade: '전설', gradeColor: '#ff4081', basePrice: 120000, minSize: 300, maxSize: 600, emoji: '🐲' }
];

let activeFishingTab = 'spot';
let isFishingCasted = false;
let isFishingBiting = false;
let fishingBiteTimer = null;
let fishingWindowTimer = null;

function switchFishingTab(tab) {
    activeFishingTab = tab;
    ['spot', 'shop', 'bucket'].forEach(t => {
        const tabBtn = document.getElementById(`tab-fish-${t}`);
        const tabContent = document.getElementById(`fish-tab-${t}`);
        if (tabBtn) tabBtn.classList.toggle('active', t === tab);
        if (tabContent) tabContent.classList.toggle('hidden', t !== tab);
    });

    renderFishingUI();
}

function renderFishingUI() {
    if (!currentUser) return;

    if (!currentUser.equippedRod) currentUser.equippedRod = 'rod_wood';
    if (!currentUser.unlockedRods) currentUser.unlockedRods = ['rod_wood'];
    if (!currentUser.fishBucket) currentUser.fishBucket = [];

    const coinDisplay = document.getElementById('fishing-coin-display');
    if (coinDisplay) coinDisplay.textContent = currentUser.coins.toLocaleString();

    const countBadge = document.getElementById('fish-count-badge');
    if (countBadge) countBadge.textContent = currentUser.fishBucket.length;

    const currentRod = FISHING_RODS.find(r => r.id === currentUser.equippedRod) || FISHING_RODS[0];
    const rodNameEl = document.getElementById('current-rod-name');
    const rodEffectEl = document.getElementById('current-rod-effect');
    if (rodNameEl) rodNameEl.innerHTML = `${currentRod.name}`;
    if (rodEffectEl) rodEffectEl.textContent = `입질: ${(currentRod.waitTime/1000).toFixed(1)}초 | 희귀+ bonus: +${currentRod.rareBonus}% | 판매가 ${currentRod.priceMult}x`;

    if (activeFishingTab === 'shop') {
        renderRodShop();
    } else if (activeFishingTab === 'bucket') {
        renderFishBucket();
    }
}

function castFishingRod() {
    if (!currentUser) return;
    if (isFishingCasted || isFishingBiting) return;

    if (!currentUser.equippedRod) currentUser.equippedRod = 'rod_wood';
    const rod = FISHING_RODS.find(r => r.id === currentUser.equippedRod) || FISHING_RODS[0];

    isFishingCasted = true;
    isFishingBiting = false;

    const statusEl = document.getElementById('fish-status-text');
    const pondAnim = document.getElementById('fish-pond-animation');
    const castBtn = document.getElementById('btn-cast-rod');
    const pullBtn = document.getElementById('btn-pull-rod');

    if (castBtn) castBtn.classList.add('hidden');
    if (pullBtn) pullBtn.classList.add('hidden');

    if (statusEl) statusEl.innerHTML = '<span style="color:var(--accent-cyan);">🌊 찌를 멀리 던졌습니다... 입질을 기다리는 중...</span>';
    if (pondAnim) pondAnim.textContent = '🌊 🎣 〰️ 🌊';

    const actualWait = rod.waitTime + Math.random() * 1500;

    fishingBiteTimer = setTimeout(() => {
        if (!isFishingCasted) return;

        isFishingBiting = true;
        if (statusEl) statusEl.innerHTML = '<span style="color:var(--accent-pink); font-size:1.2rem; animation:pulse 0.4s infinite;">💥 찌가 강하게 낚여 들어갑니다!! 지금 [HIT!] 버튼을 누르세요!</span>';
        if (pondAnim) pondAnim.textContent = '💦 🐟 ⚡ 💦';

        if (pullBtn) pullBtn.classList.remove('hidden');

        fishingWindowTimer = setTimeout(() => {
            if (isFishingBiting) {
                isFishingCasted = false;
                isFishingBiting = false;
                if (statusEl) statusEl.innerHTML = '<span style="color:var(--lose-color);">💨 물고기가 떡밥만 먹고 도망쳤습니다!</span>';
                if (pondAnim) pondAnim.textContent = '🌊 🌊 🌊';
                if (pullBtn) pullBtn.classList.add('hidden');
                if (castBtn) castBtn.classList.remove('hidden');
                showToast('타이밍을 놓쳐 물고기가 도망쳤습니다!');
            }
        }, 2200);

    }, actualWait);
}

function pullFishingRod() {
    if (!currentUser || !isFishingBiting) return;

    clearTimeout(fishingWindowTimer);
    isFishingCasted = false;
    isFishingBiting = false;

    const castBtn = document.getElementById('btn-cast-rod');
    const pullBtn = document.getElementById('btn-pull-rod');
    const statusEl = document.getElementById('fish-status-text');
    const pondAnim = document.getElementById('fish-pond-animation');

    if (pullBtn) pullBtn.classList.add('hidden');
    if (castBtn) castBtn.classList.remove('hidden');

    const rod = FISHING_RODS.find(r => r.id === (currentUser.equippedRod || 'rod_wood')) || FISHING_RODS[0];

    // Rebalanced probabilities: Base Legendary 1.5%, Epic 6.5%, Rare 25%, Common 67%
    // Rod bonus is scaled appropriately so rare/legend rods increase chance without breaking economy
    const effectiveBonus = (rod.rareBonus || 0) * 0.25; // max +11.25% bonus for Legend Rod
    let roll = Math.random() * 100 - effectiveBonus;

    let possibleFish = [];
    if (roll < 1.5) {
        possibleFish = FISH_TYPES.filter(f => f.grade === '전설');
    } else if (roll < 8.0) {
        possibleFish = FISH_TYPES.filter(f => f.grade === '영웅');
    } else if (roll < 33.0) {
        possibleFish = FISH_TYPES.filter(f => f.grade === '희귀');
    } else {
        possibleFish = FISH_TYPES.filter(f => f.grade === '일반');
    }

    if (possibleFish.length === 0) possibleFish = FISH_TYPES.filter(f => f.grade === '일반');
    const caughtType = possibleFish[Math.floor(Math.random() * possibleFish.length)];

    const size = (caughtType.minSize + Math.random() * (caughtType.maxSize - caughtType.minSize)).toFixed(1);
    const sizeBonusMult = 1 + ((size - caughtType.minSize) / (caughtType.maxSize - caughtType.minSize)) * 0.3;
    const finalPrice = Math.round(caughtType.basePrice * rod.priceMult * sizeBonusMult);

    const fishItem = {
        id: 'fish_' + Date.now() + '_' + Math.floor(Math.random()*1000),
        name: caughtType.name,
        grade: caughtType.grade,
        gradeColor: caughtType.gradeColor,
        emoji: caughtType.emoji,
        size: parseFloat(size),
        price: finalPrice,
        date: new Date().toLocaleTimeString()
    };

    if (!currentUser.fishBucket) currentUser.fishBucket = [];
    currentUser.fishBucket.unshift(fishItem);
    updateUserData();

    if (pondAnim) pondAnim.textContent = caughtType.emoji + ' 🎉 ' + caughtType.emoji;
    if (statusEl) statusEl.innerHTML = `<span style="color:${caughtType.gradeColor}; font-size:1.15rem;">🎉 <b>[${caughtType.grade}] ${caughtType.name}</b> (${size} cm) 낚시 성공!!</span>`;

    const lastCard = document.getElementById('last-caught-card');
    const badge = document.getElementById('caught-fish-badge');
    const priceEl = document.getElementById('caught-fish-price');
    const sizeEl = document.getElementById('caught-fish-size');

    if (lastCard) lastCard.classList.remove('hidden');
    if (badge) {
        badge.textContent = `${caughtType.emoji} [${caughtType.grade}] ${caughtType.name}`;
        badge.style.background = caughtType.gradeColor;
        badge.style.color = '#000';
    }
    if (priceEl) priceEl.textContent = `🪙 ${finalPrice.toLocaleString()} 코인`;
    if (sizeEl) sizeEl.textContent = `크기: ${size} cm | 장착 낚시대 보너스 반영됨`;

    showToast(`🎉 [${caughtType.grade}] ${caughtType.name} (${size}cm)을 낚아 어망에 보관했습니다!`);
    renderFishingUI();
}

function renderRodShop() {
    const list = document.getElementById('rod-shop-list');
    if (!list) return;

    if (!currentUser.unlockedRods) currentUser.unlockedRods = ['rod_wood'];
    if (!currentUser.equippedRod) currentUser.equippedRod = 'rod_wood';

    list.innerHTML = FISHING_RODS.map(rod => {
        const isUnlocked = currentUser.unlockedRods.includes(rod.id);
        const isEquipped = currentUser.equippedRod === rod.id;

        return `
            <div class="glass-card" style="padding:16px; display:flex; flex-direction:column; justify-content:space-between; border-radius:14px; background:rgba(255,255,255,0.04);">
                <div>
                    <span style="background:${rod.bg}; padding:4px 10px; border-radius:12px; font-size:0.95rem; font-weight:bold; display:inline-block; margin-bottom:8px;">${escapeHtml(rod.name)}</span>
                    <p style="font-size:0.85rem; color:var(--text-secondary); margin:6px 0 10px 0;">${escapeHtml(rod.desc)}</p>
                    <div style="font-size:0.8rem; color:var(--accent-cyan); line-height:1.4;">
                        ⚡ 입질 속도: ${(rod.waitTime/1000).toFixed(1)}초<br>
                        ✨ 희귀+ 확률: +${rod.rareBonus}%<br>
                        💰 코인 판매가: ${rod.priceMult}배
                    </div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px;">
                    <span style="font-weight:bold; color:var(--accent-yellow);">${rod.price === 0 ? '기본 제공' : '🪙 ' + rod.price.toLocaleString() + ' 코인'}</span>
                    ${isEquipped 
                        ? '<span style="color:#4caf50; font-weight:bold; font-size:0.85rem;">✨ 장착 중</span>' 
                        : (isUnlocked 
                            ? `<button class="btn-primary btn-sm" onclick="equipRod('${rod.id}')">장착하기</button>` 
                            : `<button class="btn-primary btn-sm" onclick="buyRod('${rod.id}')">구매하기</button>`)}
                </div>
            </div>
        `;
    }).join('');
}

function buyRod(rodId) {
    if (!currentUser) return;
    const rod = FISHING_RODS.find(r => r.id === rodId);
    if (!rod) return;

    if (currentUser.coins < rod.price) {
        showToast('구매 코인이 부족합니다!');
        return;
    }

    currentUser.coins -= rod.price;
    if (!currentUser.unlockedRods) currentUser.unlockedRods = ['rod_wood'];
    currentUser.unlockedRods.push(rod.id);
    currentUser.equippedRod = rod.id;

    updateUserData();
    showToast(`'${rod.name}'을 구매하고 즉시 장착했습니다! 🎣`);
    renderFishingUI();
}

function equipRod(rodId) {
    if (!currentUser) return;
    currentUser.equippedRod = rodId;
    updateUserData();
    showToast(`낚시대를 변경했습니다!`);
    renderFishingUI();
}

function renderFishBucket() {
    const list = document.getElementById('fish-bucket-list');
    const totalValEl = document.getElementById('bucket-total-value');
    if (!list) return;

    const fishes = currentUser.fishBucket || [];
    const totalVal = fishes.reduce((sum, f) => sum + (f.price || 0), 0);
    if (totalValEl) totalValEl.textContent = `🪙 ${totalVal.toLocaleString()} 코인`;

    if (fishes.length === 0) {
        list.innerHTML = '<div class="room-empty" style="grid-column: 1 / -1;">어망이 비어있습니다.<br>낚시터에서 물고기를 낚아보세요!</div>';
        return;
    }

    list.innerHTML = fishes.map((f, idx) => {
        return `
            <div class="glass-card" style="padding:14px; display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.04); border-radius:12px;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <span style="font-size:2rem;">${f.emoji || '🐟'}</span>
                    <div>
                        <div>
                            <span style="background:${f.gradeColor || '#b0bec5'}; color:#000; padding:2px 8px; border-radius:10px; font-size:0.75rem; font-weight:bold;">${f.grade}</span>
                            <span style="font-weight:bold; font-size:0.95rem; margin-left:4px;">${escapeHtml(f.name)}</span>
                        </div>
                        <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:2px;">크기: ${f.size} cm | ${f.date || ''}</div>
                    </div>
                </div>
                <div style="text-align:right;">
                    <div style="font-weight:bold; color:var(--accent-yellow); font-size:0.95rem; margin-bottom:4px;">🪙 ${f.price.toLocaleString()}</div>
                    <button class="btn-secondary btn-sm" style="padding:4px 10px; font-size:0.75rem;" onclick="sellSingleFish(${idx})">판매</button>
                </div>
            </div>
        `;
    }).join('');
}

function sellSingleFish(index) {
    if (!currentUser || !currentUser.fishBucket) return;
    const fish = currentUser.fishBucket[index];
    if (!fish) return;

    currentUser.coins += fish.price;
    currentUser.fishBucket.splice(index, 1);

    updateUserData();
    showToast(`'${fish.name}'을 판매하여 🪙 ${fish.price.toLocaleString()} 코인을 획득했습니다!`);
    renderFishingUI();
}

function sellAllFish() {
    if (!currentUser || !currentUser.fishBucket || currentUser.fishBucket.length === 0) {
        showToast('판매할 물고기가 어망에 없습니다!');
        return;
    }

    const totalVal = currentUser.fishBucket.reduce((sum, f) => sum + (f.price || 0), 0);
    const count = currentUser.fishBucket.length;

    currentUser.coins += totalVal;
    currentUser.fishBucket = [];

    updateUserData();
    showToast(`어망의 물고기 ${count}마리를 일괄 판매하여 🪙 ${totalVal.toLocaleString()} 코인을 획득했습니다! 🎉`);
    renderFishingUI();
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
    getStorageUsers();
    getStorageRooms();
});

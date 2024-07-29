const board = document.getElementById('board');
const loading = document.getElementById('loading');
const log = document.getElementById('log');
const overlay = document.getElementById('overlay');
const size = 15;
let currentPlayer = 'black';
let gameBoard = Array(size).fill().map(() => Array(size).fill(null));
let isAIThinking = false;

const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];

// Web Worker 생성
const worker = new Worker('ai-worker.js');

function createBoard() {
    for (let i = 0; i < size * size; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.addEventListener('click', () => placeStone(i));
        board.appendChild(cell);
    }
}

function placeStone(index) {
    if (isAIThinking && currentPlayer === 'black') return;

    const row = Math.floor(index / size);
    const col = index % size;
    if (gameBoard[row][col]) return;

    gameBoard[row][col] = currentPlayer;
    const cell = board.children[index];
    const stone = document.createElement('div');
    stone.className = `stone ${currentPlayer}`;
    cell.appendChild(stone);

    logMove(row, col, currentPlayer);

    if (checkWin(gameBoard, row, col)) {
        setTimeout(() => {
            alert(`${currentPlayer === 'black' ? '흑' : '백'}이 이겼습니다!`);
            resetGame();
        }, 100);
        return;
    }

    if (isBoardFull(gameBoard)) {
        setTimeout(() => {
            alert('무승부입니다!');
            resetGame();
        }, 100);
        return;
    }

    currentPlayer = currentPlayer === 'black' ? 'white' : 'black';
    if (currentPlayer === 'white' && !isAIThinking) {
        isAIThinking = true;
        loading.style.display = 'block';
        overlay.style.display = 'block';
        setTimeout(requestAiMove, 100);
    }
}

function requestAiMove() {
    worker.postMessage({ board: gameBoard, player: 'white' });
}

worker.onmessage = function(e) {
    const { bestMove, logMessages } = e.data;
    logMessages.forEach(message => {
        const logEntry = document.createElement('div');
        logEntry.textContent = message;
        log.appendChild(logEntry);
    });
    
    // AI의 수를 화면에 표시
    const aiMoveIndex = bestMove.row * size + bestMove.col;
    placeStone(aiMoveIndex);
    
    loading.style.display = 'none';
    overlay.style.display = 'none';
    isAIThinking = false;
};

function checkWin(board, row, col) {
    for (const [dx, dy] of directions) {
        let count = 1;
        count += countDirection(board, row, col, dx, dy);
        count += countDirection(board, row, col, -dx, -dy);
        if (count >= 5) return true;
    }
    return false;
}

function countDirection(board, row, col, dx, dy) {
    let count = 0;
    let r = row + dx;
    let c = col + dy;
    while (r >= 0 && r < size && c >= 0 && c < size && board[r][c] === board[row][col]) {
        count++;
        r += dx;
        c += dy;
    }
    return count;
}

function isBoardFull(board) {
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            if (board[row][col] === null) {
                return false;
            }
        }
    }
    return true;
}

function resetGame() {
    board.innerHTML = '';
    gameBoard = Array(size).fill().map(() => Array(size).fill(null));
    currentPlayer = 'black';
    log.innerHTML = '<h3>게임 로그</h3>';
    isAIThinking = false;
    overlay.style.display = 'none';
    loading.style.display = 'none';
    createBoard();
}

function logMove(row, col, player) {
    const logEntry = document.createElement('div');
    logEntry.textContent = `${player === 'black' ? '흑' : '백'}: (${row}, ${col})`;
    log.appendChild(logEntry);
    log.scrollTop = log.scrollHeight;
}

createBoard();
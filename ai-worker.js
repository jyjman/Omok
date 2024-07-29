const size = 15;
const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
const MAX_DEPTH = 6;
const TIMEOUT = 5000;

const transpositionTable = new Map();
let patternWeights = {
    'OOOOO': 1000000,
    '.OOOO.': 50000,
    'OOO.O': 10000,
    'O.OOO': 10000,
    '.OOO.': 5000,
    '.OO.': 1000,
    'O.O.O': 500,
    '.O.': 100,
    'OO...': 50,
    '...OO': 50,
    'O....O': 30
};

// Simple neural network for board evaluation
class NeuralNetwork {
    constructor(inputSize, hiddenSize, outputSize) {
        this.weights1 = Array(inputSize).fill().map(() => Array(hiddenSize).fill().map(() => Math.random() - 0.5));
        this.weights2 = Array(hiddenSize).fill().map(() => Array(outputSize).fill().map(() => Math.random() - 0.5));
        this.bias1 = Array(hiddenSize).fill().map(() => Math.random() - 0.5);
        this.bias2 = Array(outputSize).fill().map(() => Math.random() - 0.5);
    }

    forward(input) {
        const hidden = input.map((x, i) => 
            this.weights1[i].reduce((sum, w, j) => sum + w * x, 0) + this.bias1[i]
        ).map(x => Math.max(0, x)); // ReLU activation
        const output = this.weights2[0].reduce((sum, w, j) => sum + w * hidden[j], 0) + this.bias2[0];
        return output;
    }

    train(input, target, learningRate = 0.01) {
        // Simplified backpropagation
        const hidden = input.map((x, i) => 
            this.weights1[i].reduce((sum, w, j) => sum + w * x, 0) + this.bias1[i]
        ).map(x => Math.max(0, x));
        const output = this.weights2[0].reduce((sum, w, j) => sum + w * hidden[j], 0) + this.bias2[0];
        
        const outputError = target - output;
        const hiddenError = this.weights2[0].map(w => w * outputError);

        // Update weights and biases
        this.weights2[0] = this.weights2[0].map((w, j) => w + learningRate * outputError * hidden[j]);
        this.bias2[0] += learningRate * outputError;

        this.weights1 = this.weights1.map((row, i) => 
            row.map((w, j) => w + learningRate * hiddenError[j] * input[i])
        );
        this.bias1 = this.bias1.map((b, j) => b + learningRate * hiddenError[j]);
    }
}

const neuralNet = new NeuralNetwork(size * size, 64, 1);

self.onmessage = function(e) {
    const { board, player, gameResult } = e.data;
    if (gameResult) {
        updateWeights(gameResult);
        trainNeuralNet(board, gameResult);
    } else {
        const logMessages = [];
        const bestMove = iterativeDeepening(board, player, logMessages);
        self.postMessage({ bestMove, logMessages });
    }
};

function updateWeights(gameResult) {
    const learningRate = 0.1;
    for (let pattern in patternWeights) {
        if (gameResult === 'win') {
            patternWeights[pattern] *= (1 + learningRate);
        } else if (gameResult === 'loss') {
            patternWeights[pattern] *= (1 - learningRate);
        }
    }
}

function trainNeuralNet(board, gameResult) {
    const input = board.flat().map(cell => cell === 'white' ? 1 : cell === 'black' ? -1 : 0);
    const target = gameResult === 'win' ? 1 : gameResult === 'loss' ? -1 : 0;
    neuralNet.train(input, target);
}

function iterativeDeepening(board, player, logMessages) {
    let bestMove = null;
    let depth = 1;
    const startTime = Date.now();

    while (Date.now() - startTime < TIMEOUT) {
        const dynamicDepth = getDynamicDepth(board);
        if (depth > dynamicDepth) break;

        const move = findBestMove(board, player, depth, logMessages);
        if (move) {
            bestMove = move;
        }
        logMessages.push(`Depth ${depth}: Best move found at (${move.row}, ${move.col})`);
        depth++;
    }

    return bestMove;
}

function getDynamicDepth(board) {
    const emptySpaces = board.flat().filter(cell => cell === null).length;
    if (emptySpaces > 200) return 3;
    if (emptySpaces > 150) return 4;
    if (emptySpaces > 100) return 5;
    return 6;
}

function findBestMove(board, player, maxDepth, logMessages) {
    let bestScore = -Infinity;
    let bestMove = null;
    const moves = getValidMoves(board);
    const threats = detectThreats(board, player);

    if (threats.length > 0) {
        moves.unshift(...threats);
    }

    moves.sort((a, b) => {
        board[a.row][a.col] = player;
        const scoreA = evaluateBoard(board, player);
        board[a.row][a.col] = null;

        board[b.row][b.col] = player;
        const scoreB = evaluateBoard(board, player);
        board[b.row][b.col] = null;

        return scoreB - scoreA;
    });

    for (const move of moves) {
        board[move.row][move.col] = player;
        let score = minimax(board, maxDepth, false, player, -Infinity, Infinity, logMessages);
        board[move.row][move.col] = null;

        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    }

    logMessages.push(`Best move at depth ${maxDepth}: (${bestMove.row}, ${bestMove.col}) with score ${bestScore}`);
    return bestMove;
}

function minimax(board, depth, isMaximizing, player, alpha, beta, logMessages) {
    const opponent = player === 'white' ? 'black' : 'white';
    const boardHash = boardToString(board);

    if (transpositionTable.has(boardHash)) {
        return transpositionTable.get(boardHash);
    }

    if (depth === 0 || checkWinForPlayer(board, player) || checkWinForPlayer(board, opponent)) {
        const score = evaluateBoard(board, player);
        transpositionTable.set(boardHash, score);
        return score;
    }

    const moves = getValidMoves(board);

    if (isMaximizing) {
        let maxScore = -Infinity;
        for (const move of moves) {
            board[move.row][move.col] = player;
            let score = minimax(board, depth - 1, false, player, alpha, beta, logMessages);
            board[move.row][move.col] = null;
            maxScore = Math.max(maxScore, score);
            alpha = Math.max(alpha, score);
            if (beta <= alpha) break;
        }
        transpositionTable.set(boardHash, maxScore);
        return maxScore;
    } else {
        let minScore = Infinity;
        for (const move of moves) {
            board[move.row][move.col] = opponent;
            let score = minimax(board, depth - 1, true, player, alpha, beta, logMessages);
            board[move.row][move.col] = null;
            minScore = Math.min(minScore, score);
            beta = Math.min(beta, score);
            if (beta <= alpha) break;
        }
        transpositionTable.set(boardHash, minScore);
        return minScore;
    }
}

function getValidMoves(board) {
    const moves = [];
    const occupied = new Set();

    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            if (board[row][col] !== null) {
                occupied.add(`${row},${col}`);
                for (let dr = -2; dr <= 2; dr++) {
                    for (let dc = -2; dc <= 2; dc++) {
                        const newRow = row + dr;
                        const newCol = col + dc;
                        if (newRow >= 0 && newRow < size && newCol >= 0 && newCol < size &&
                            board[newRow][newCol] === null && !occupied.has(`${newRow},${newCol}`)) {
                            moves.push({row: newRow, col: newCol});
                            occupied.add(`${newRow},${newCol}`);
                        }
                    }
                }
            }
        }
    }
    return moves;
}

function evaluateBoard(board, player) {
    let score = 0;
    const opponent = player === 'white' ? 'black' : 'white';

    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            if (board[row][col] === player) {
                score += evaluatePosition(board, row, col, player);
            } else if (board[row][col] === opponent) {
                score -= evaluatePosition(board, row, col, opponent);
            }
        }
    }

    // Add neural network evaluation
    const input = board.flat().map(cell => cell === player ? 1 : cell === opponent ? -1 : 0);
    const nnScore = neuralNet.forward(input);
    score += nnScore * 1000; // Scale the neural network score

    return score;
}

function evaluatePosition(board, row, col, player) {
    let score = 0;
    for (const [dx, dy] of directions) {
        const line = getLine(board, row, col, dx, dy, player);
        score += evaluateLine(line);
    }
    
    const centerPreference = 10 - (Math.abs(row - 7) + Math.abs(col - 7)) / 2;
    score += centerPreference;
    
    return score;
}

function getLine(board, row, col, dx, dy, player) {
    let line = '';
    for (let i = -4; i <= 4; i++) {
        const r = row + i * dx;
        const c = col + i * dy;
        if (r >= 0 && r < size && c >= 0 && c < size) {
            if (board[r][c] === player) line += 'O';
            else if (board[r][c] === null) line += '.';
            else line += 'X';
        }
    }
    return line;
}

function evaluateLine(line) {
    let score = 0;
    for (const [pattern, value] of Object.entries(patternWeights)) {
        const regex = new RegExp(pattern.replace(/\./g, '\\.'), 'g');
        score += (line.match(regex) || []).length * value;
    }
    return score;
}

function checkWinForPlayer(board, player) {
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            if (board[row][col] === player) {
                if (checkWin(board, row, col)) return true;
            }
        }
    }
    return false;
}

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
    const player = board[row][col];
    let r = row + dx;
    let c = col + dy;
    while (r >= 0 && r < size && c >= 0 && c < size && board[r][c] === player) {
        count++;
        r += dx;
        c += dy;
    }
    return count;
}

function detectThreats(board, player) {
    const opponent = player === 'white' ? 'black' : 'white';
    const threats = [];
    
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            if (board[row][col] === null) {
                board[row][col] = player;
                if (checkWinForPlayer(board, player)) {
                    threats.push({ row, col });
                }
                board[row][col] = opponent;
                if (checkWinForPlayer(board, opponent)) {
                    threats.push({ row, col });
                }
                board[row][col] = null;
            }
        }
    }
    
    return threats;
}

function boardToString(board) {
    return board.map(row => row.map(cell => (cell === null ? '.' : cell)).join('')).join('');
}

// ... (MCTS 관련 코드는 그대로 유지)
// Monte Carlo Tree Search Integration
function mcts(board, player, iterations) {
    const root = new Node(null, board, player);
    for (let i = 0; i < iterations; i++) {
        let node = selectNode(root);
        let result = simulate(node);
        backpropagate(node, result);
    }
    return getBestMove(root);
}

function selectNode(node) {
    while (node.isFullyExpanded() && !node.isTerminal()) {
        node = node.getBestChild();
    }
    if (!node.isFullyExpanded()) {
        return node.expand();
    }
    return node;
}

function simulate(node) {
    let board = node.board.clone();
    let player = node.player;
    while (!isTerminal(board)) {
        const moves = getValidMoves(board);
        const move = moves[Math.floor(Math.random() * moves.length)];
        board[move.row][move.col] = player;
        player = (player === 'white') ? 'black' : 'white';
    }
    return evaluateBoard(board, node.player);
}

function backpropagate(node, result) {
    while (node !== null) {
        node.update(result);
        node = node.parent;
    }
}

function getBestMove(root) {
    let bestMove = null;
    let bestWinRate = -Infinity;
    for (let child of root.children) {
        const winRate = child.wins / child.visits;
        if (winRate > bestWinRate) {
            bestWinRate = winRate;
            bestMove = child.move;
        }
    }
    return bestMove;
}

// Node class for MCTS
class Node {
    constructor(parent, board, player) {
        this.parent = parent;
        this.board = board;
        this.player = player;
        this.children = [];
        this.wins = 0;
        this.visits = 0;
        this.move = null;
    }

    isFullyExpanded() {
        return this.children.length === getValidMoves(this.board).length;
    }

    isTerminal() {
        return checkWinForPlayer(this.board, this.player) || checkWinForPlayer(this.board, this.player === 'white' ? 'black' : 'white');
    }

    getBestChild() {
        let bestChild = null;
        let bestUCB1 = -Infinity;
        for (let child of this.children) {
            const ucb1 = child.wins / child.visits + Math.sqrt(2 * Math.log(this.visits) / child.visits);
            if (ucb1 > bestUCB1) {
                bestUCB1 = ucb1;
                bestChild = child;
            }
        }
        return bestChild;
    }

    expand() {
        const moves = getValidMoves(this.board);
        for (const move of moves) {
            if (!this.children.some(child => child.move.row === move.row && child.move.col === move.col)) {
                const newBoard = this.board.map(row => row.slice());
                newBoard[move.row][move.col] = this.player;
                const child = new Node(this, newBoard, this.player === 'white' ? 'black' : 'white');
                child.move = move;
                this.children.push(child);
                return child;
            }
        }
        return this;
    }

    update(result) {
        this.visits++;
        this.wins += result;
    }
}

function isTerminal(board) {
    return checkWinForPlayer(board, 'white') || checkWinForPlayer(board, 'black') || getValidMoves(board).length === 0;
}

// Integrating MCTS with Minimax
function findBestMoveWithMCTS(board, player, iterations) {
    const mctsMove = mcts(board, player, iterations);
    if (mctsMove) {
        return mctsMove;
    }
    return findBestMove(board, player, MAX_DEPTH, []);
}

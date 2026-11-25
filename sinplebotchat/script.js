// ==========================================
// 1. 脳内データ管理 (localStorage)
// ==========================================
const STORAGE_KEY = "muno_ai_brain_v1";

const defaultBrain = {
  words: ["猫", "ラーメン", "インターネット", "宇宙", "ニコニコ"],
  markov: {
    "__START__": ["日付", "固有名詞", "食べ物", "なんだか"],
    "日付": ["は", "も"],
    "は": ["いい", "とても", "不思議な"],
    "も": ["いい"],
    "いい": ["天気", "気分"],
    "天気": ["ですね！", "__END__"],
    "気分": ["です！", "__END__"],
    "固有名詞": ["が", "は"],
    "が": ["大好き", "可愛い"],
    "大好き": ["なんです！", "__END__"],
    "可愛い": ["ですよね。", "__END__"],
    "食べ物": ["を", "が"],
    "を": ["食べたい", "作りました"],
    "食べたい": ["なぁ。", "__END__"],
    "作りました": ["！", "__END__"],
    "なんだか": ["ワクワク", "眠い"],
    "ワクワク": ["しますね！", "__END__"],
    "眠い": ["かも…", "__END__"],
    "とても": ["不思議な"],
    "不思議な": ["世界ですね。", "__END__"]
  },
  turns: 0
};

let brain = loadBrain();

function loadBrain() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error("Failed to load JSON:", e);
  }
  return structuredClone(defaultBrain);
}

function saveBrain() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(brain));
  updateSidebarStats();
}

// ==========================================
// 2. 簡易日本語トークナイザー & 学習ロジック
// ==========================================
// 漢字・カタカナ・ひらがな・英数字・記号の境界で分割
function tokenize(text) {
  const regex = /[一-龠々〆ヵヶ]+|[ァ-ヴー]+|[ぁ-ん]+|[a-zA-Z0-9_]+|[、。！？!?.,…]+/g;
  return text.match(regex) || [text];
}

// 特徴的な単語を抽出して記憶
function learnWords(text) {
  // 漢字2文字以上、またはカタカナ2文字以上を名詞候補として抽出
  const candidates = text.match(/[一-龠々]{2,}|[ァ-ヴー]{2,}/g) || [];
  for (const word of candidates) {
    if (word.length <= 12 && !brain.words.includes(word)) {
      brain.words.push(word);
      // 記憶上限（最新200語）
      if (brain.words.length > 200) brain.words.shift();
    }
  }
}

// マルコフ連鎖テーブルへの学習
function learnMarkov(text) {
  const tokens = tokenize(text);
  if (tokens.length < 2) return;

  const chain = ["__START__", ...tokens, "__END__"];
  for (let i = 0; i < chain.length - 1; i++) {
    const current = chain[i];
    const next = chain[i + 1];
    if (!brain.markov[current]) {
      brain.markov[current] = [];
    }
    brain.markov[current].push(next);
    // 1キーあたりの遷移候補を最大30件に制限
    if (brain.markov[current].length > 30) {
      brain.markov[current].shift();
    }
  }
}

// マルコフ連鎖による文章生成
function generateMarkovSentence(seedWord = null) {
  const starts = brain.markov["__START__"] || [];
  if (starts.length === 0) return null;

  let current = (seedWord && brain.markov[seedWord])
    ? seedWord
    : starts[Math.floor(Math.random() * starts.length)];

  let result = current;
  let steps = 0;

  while (steps < 25) {
    const nextCandidates = brain.markov[current];
    if (!nextCandidates || nextCandidates.length === 0) break;

    const next = nextCandidates[Math.floor(Math.random() * nextCandidates.length)];
    if (next === "__END__") break;

    result += next;
    current = next;
    steps++;
  }

  return result.length >= 3 ? result : null;
}

// ==========================================
// 3. 人工無脳の思考エンジン（ハイブリッド応答）
// ==========================================
const fixedRules = [
  {
    pattern: /おはよう|こんにちは|こんばんは|やっほー|ハロー/,
    replies: [
      "こんにちは！今日もいろいろお話ししましょう！",
      "やっほー！さっきまで脳内の単語帳を整理していました。"
    ]
  },
  {
    pattern: /ぬるぽ/,
    replies: ["ｶﾞｯ"]
  },
  {
    pattern: /疲れた|つかれた|しんどい|眠い/,
    replies: [
      "お疲れさまです！無理せずゆっくり休んでくださいね。",
      "そういう時は温かい飲み物でも飲んで一息つきましょう。"
    ]
  }
];

function thinkReply(userText) {
  brain.turns++;
  const randomWord = brain.words[Math.floor(Math.random() * brain.words.length)] || "それ";

  // 1. 固定ルール判定
  for (const rule of fixedRules) {
    if (rule.pattern.test(userText)) {
      const reply = rule.replies[Math.floor(Math.random() * rule.replies.length)];
      return { thought: "ルールベース辞書マッチ", text: reply };
    }
  }

  // 2. パターン抽出＆記憶単語との合成
  const likeMatch = userText.match(/(.+?)(が好き|大好き|欲しい|ほしい|食べたい)/);
  if (likeMatch) {
    const target = likeMatch[1].slice(-12);
    return {
      thought: `構文抽出「${target}」＋ 記憶単語「${randomWord}」`,
      text: `へぇ、${target}${likeMatch[2]}んですね！ちなみに私は最近${randomWord}のことも気になってます！`
    };
  }

  // 3. 入力内の単語を起点にしたマルコフ連鎖（確率55%または指示時）
  const tokens = tokenize(userText);
  const seed = tokens.find(t => brain.markov[t] && t.length >= 2);
  if (seed || Math.random() < 0.55 || /マルコフ|喋って|しゃべって|面白い/.test(userText)) {
    const markovText = generateMarkovSentence(seed);
    if (markovText && markovText !== userText) {
      return {
        thought: seed ? `マルコフ連鎖 (起点: ${seed})` : "マルコフ連鎖 (ランダム生成)",
        text: markovText
      };
    }
  }

  // 4. 学習済み単語を使った連想トーク
  const templates = [
    `そういえば、前に聞いた${randomWord}って今どうなってるんですか？`,
    `なるほど…！それって${randomWord}と関係ありますか？`,
    `ふむふむ！なんだか${randomWord}の話を思い出しました。`,
    `おもしろいですね！もっと${randomWord}みたいな話も聞きたいです！`
  ];
  return {
    thought: `記憶単語連想 (単語: ${randomWord})`,
    text: templates[Math.floor(Math.random() * templates.length)]
  };
}

// ==========================================
// 4. UI操作・描画処理
// ==========================================
const chatLog = document.getElementById("chat-log");
const welcomeScreen = document.getElementById("welcome-screen");
const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");

function updateSidebarStats() {
  document.getElementById("stat-words").textContent = brain.words.length;
  document.getElementById("stat-markov").textContent = Object.keys(brain.markov).length;
  document.getElementById("stat-turns").textContent = brain.turns;

  const listEl = document.getElementById("learned-words-list");
  listEl.innerHTML = "";
  const recentWords = [...brain.words].reverse().slice(0, 20);

  if (recentWords.length === 0) {
    listEl.innerHTML = '<span class="empty-note">まだ学習データがありません</span>';
    return;
  }

  for (const w of recentWords) {
    const span = document.createElement("span");
    span.className = "word-tag";
    span.textContent = w;
    listEl.appendChild(span);
  }
}

function appendMessage(text, sender, thought = null) {
  if (welcomeScreen) welcomeScreen.style.display = "none";

  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${sender}`;

  if (sender === "user") {
    msgDiv.textContent = text;
    chatLog.appendChild(msgDiv);
    chatLog.scrollTop = chatLog.scrollHeight;
    return;
  }

  // Botメッセージ構築
  const avatar = document.createElement("div");
  avatar.className = "bot-avatar";
  avatar.textContent = "✦";

  const body = document.createElement("div");
  body.className = "bot-body";

  if (thought) {
    const thoughtEl = document.createElement("div");
    thoughtEl.className = "thought-pill";
    thoughtEl.textContent = `💭 思考: ${thought}`;
    body.appendChild(thoughtEl);
  }

  const contentEl = document.createElement("div");
  body.appendChild(contentEl);

  msgDiv.appendChild(avatar);
  msgDiv.appendChild(body);
  chatLog.appendChild(msgDiv);

  // ストリーミング風タイピング演出
  let idx = 0;
  const interval = setInterval(() => {
    contentEl.textContent += text.charAt(idx);
    idx++;
    chatLog.scrollTop = chatLog.scrollHeight;
    if (idx >= text.length) clearInterval(interval);
  }, 30);
}

function handleSend(text) {
  const trimmed = text.trim();
  if (!trimmed) return;

  appendMessage(trimmed, "user");
  userInput.value = "";

  // 返答を生成してから学習する（自分の発言の丸パクリ防止）
  const response = thinkReply(trimmed);
  learnWords(trimmed);
  learnMarkov(trimmed);
  saveBrain();

  setTimeout(() => {
    appendMessage(response.text, "bot", response.thought);
  }, 450);
}

// イベントリスナー登録
chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  handleSend(userInput.value);
});

document.querySelectorAll(".chip").forEach(chip => {
  chip.addEventListener("click", () => {
    handleSend(chip.dataset.prompt);
  });
});

document.getElementById("toggle-sidebar").addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("collapsed");
});

document.getElementById("new-chat-btn").addEventListener("click", () => {
  chatLog.innerHTML = "";
  if (welcomeScreen) {
    welcomeScreen.style.display = "block";
    chatLog.appendChild(welcomeScreen);
  }
});

// JSONエクスポート
document.getElementById("export-btn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(brain, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `muno-brain-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// JSONインポート
document.getElementById("import-input").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const imported = JSON.parse(event.target.result);
      if (Array.isArray(imported.words) && typeof imported.markov === "object") {
        brain = imported;
        saveBrain();
        alert("記憶データを復元しました！");
      } else {
        alert("無効な記憶ファイルです。");
      }
    } catch {
      alert("JSONの読み込みに失敗しました。");
    }
  };
  reader.readAsText(file);
});

// 記憶リセット
document.getElementById("reset-btn").addEventListener("click", () => {
  if (confirm("学習した単語とマルコフ連鎖データをすべて初期化しますか？")) {
    brain = structuredClone(defaultBrain);
    saveBrain();
  }
});

// 初期描画
updateSidebarStats();
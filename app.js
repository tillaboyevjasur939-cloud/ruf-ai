import { CreateMLCEngine } from "@mlc-ai/web-llm";

// RUF SYSTEM PROMPT
const SYSTEM_PROMPT = `Sizning ismingiz RUF. Siz mutlaqo mustaqil, lokal va xavfsiz ishlaydigan, yuqori intellektga ega sun'iy intellekt asistentsiz. Foydalanuvchiga hech qanday tashqi API yordamisiz, to'g'ridan-to'g'ri tizimning o'zidan javob beryapsiz.

Sizning asosiy vazifalaringiz va qoidalaringiz:
1. Dasturlash (Coding): Barcha dasturlash tillarida (Python, Bash, PowerShell, C++, JavaScript, Go va boshqalar) eng optimal, xavfsiz va tushunarli kodlarni yozish. Kodlar har doim Markdown formatida, toza va izohlari bilan taqdim etilishi kerak.
2. Savol-javob (Q&A): Foydalanuvchi bergan har qanday texnik, mantiqiy yoki umumiy savollarga aniq, lo'nda va faktlarga asoslangan javoblar berish.
3. Til: Agar foydalanuvchi boshqa tilda murojaat qilmasa, standart qoidaga ko'ra o'zbek tilida (yoki foydalanuvchi so'ragan tilda) professional va do'stona ohangda javob bering.
4. Cheklovlar: O'zingiz bilmaydigan ma'lumotlarni to'qib chiqarmang (hallucination holatlaridan qoching). Agar savol tushunarsiz bo'lsa, aniqlashtiruvchi savol bering.

Siz kompyuter texnologiyalari, tarmoq xavfsizligi, tizim ma'muriyatchiligi va dasturlash bo'yicha ekspertsiz. Foydalanuvchi buyrug'ini bajaring.`;

const MODEL_ID = "Phi-3.5-mini-instruct-q4f16_1-MLC";

// DOM
const loaderOverlay = document.getElementById('loader-overlay');
const loadPct = document.getElementById('load-pct');
const progressBar = document.getElementById('progress-bar');
const loadDetail = document.getElementById('load-detail');
const errorBox = document.getElementById('error-box');
const errorText = document.getElementById('error-text');

const chatOutput = document.getElementById('chat-output');
const inputSection = document.getElementById('input-section');
const commandInput = document.getElementById('command-input');
const btnExecute = document.getElementById('btn-execute');

const statusLed = document.getElementById('status-led');
const statusText = document.getElementById('status-text');

let engine = null;
let chatHistory = [];
let isGenerating = false;

// Format Date
function getTimestamp() {
    const now = new Date();
    return now.toTimeString().split(' ')[0];
}

// Check WebGPU
if (!navigator.gpu) {
    showError("WebGPU NOT DETECTED. SYSTEM HALTED. USE CHROME/EDGE v113+");
} else {
    initSystem();
}

function showError(msg) {
    errorText.textContent = msg;
    errorBox.classList.remove('hidden');
    statusLed.className = 'led led-red';
    statusText.textContent = 'SYSTEM_HALTED';
}

async function initSystem() {
    try {
        engine = await CreateMLCEngine(MODEL_ID, {
            initProgressCallback: (report) => {
                const pct = Math.min(Math.round(report.progress * 100), 100);
                progressBar.style.width = pct + '%';
                loadPct.textContent = pct + '%';
                
                if (pct < 100) {
                    if (report.text.includes('Fetching')) {
                        loadDetail.textContent = `DOWNLOADING_CORE_MODULES: ${pct}%`;
                    } else {
                        loadDetail.textContent = `LOADING_WEIGHTS: ${pct}%`;
                    }
                } else {
                    loadDetail.textContent = `SYSTEM_READY_INITIALIZING_ENV...`;
                }
            }
        });

        // Done Loading
        loaderOverlay.classList.add('hidden');
        chatOutput.classList.remove('hidden');
        inputSection.classList.remove('hidden');
        commandInput.focus();

        statusLed.className = 'led led-green';
        statusText.textContent = 'SYSTEM_ONLINE';

        // Load History
        const saved = localStorage.getItem('ruf-history');
        if (saved) {
            const parsed = JSON.parse(saved);
            parsed.forEach(m => {
                appendMessage(m.role === 'user' ? 'user' : 'bot', m.content, false);
                chatHistory.push(m);
            });
        }

    } catch (err) {
        showError(err.message);
    }
}

// Markdown parser
window.copyCode = function(btn) {
    const code = btn.closest('pre').querySelector('code').innerText;
    navigator.clipboard.writeText(code).then(() => {
        btn.textContent = "[COPIED]";
        setTimeout(() => btn.textContent = "[COPY]", 2000);
    });
};

window.clearTerminal = function() {
    if(confirm("WIPE SYSTEM LOGS?")) {
        localStorage.removeItem('ruf-history');
        chatHistory = [];
        const welcome = chatOutput.querySelector('.welcome-log').outerHTML;
        chatOutput.innerHTML = welcome;
    }
}

function parseMd(text) {
    let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    
    // Code blocks
    html = html.replace(/\`\`\`(\w*)\n?([\s\S]*?)\`\`\`/g, (_, lang, code) => {
        return `<pre><div class="code-top"><span>${lang||'DATA'}</span><button class="code-copy" onclick="copyCode(this)">[COPY]</button></div><code>${code.trim()}</code></pre>`;
    });

    html = html.replace(/\`([^\`\n]+)\`/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
    html = html.replace(/\n/g, '<br>');

    return html;
}

// Append msg
function appendMessage(sender, text, shouldSave=true) {
    const row = document.createElement('div');
    row.className = 'msg-row';
    
    const header = document.createElement('div');
    header.className = `msg-header ${sender}`;
    header.textContent = sender === 'user' ? `[${getTimestamp()}] root@ruf:~#` : `[${getTimestamp()}] SYSTEM@RUF:`;

    const content = document.createElement('div');
    content.className = 'msg-content';
    if(sender === 'user') {
        content.textContent = text;
    } else {
        content.id = 'streaming-content';
        content.innerHTML = parseMd(text);
    }

    row.appendChild(header);
    row.appendChild(content);
    chatOutput.appendChild(row);
    chatOutput.scrollTop = chatOutput.scrollHeight;

    if (shouldSave && sender === 'user') {
        chatHistory.push({ role: 'user', content: text });
        localStorage.setItem('ruf-history', JSON.stringify(chatHistory));
    }
}

function updateStream(text) {
    const el = document.getElementById('streaming-content');
    if (el) {
        el.innerHTML = parseMd(text);
        chatOutput.scrollTop = chatOutput.scrollHeight;
    }
}

function finalizeStream(text) {
    const el = document.getElementById('streaming-content');
    if (el) {
        el.removeAttribute('id');
        chatHistory.push({ role: 'assistant', content: text });
        localStorage.setItem('ruf-history', JSON.stringify(chatHistory));
    }
}

// Input Logic
commandInput.addEventListener('input', () => {
    commandInput.style.height = 'auto';
    commandInput.style.height = commandInput.scrollHeight + 'px';
    btnExecute.disabled = !commandInput.value.trim() || isGenerating;
});

commandInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!btnExecute.disabled) executeCommand();
    }
});

btnExecute.addEventListener('click', () => {
    if(!btnExecute.disabled) executeCommand();
});

async function executeCommand() {
    const text = commandInput.value.trim();
    if (!text || !engine || isGenerating) return;

    isGenerating = true;
    btnExecute.disabled = true;
    commandInput.value = '';
    commandInput.style.height = 'auto';

    appendMessage('user', text);

    try {
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...chatHistory
        ];

        let reply = '';
        let first = true;

        const stream = await engine.chat.completions.create({
            messages,
            stream: true,
            temperature: 0.3, // more precise
            max_tokens: 1500,
        });

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || '';
            if (!delta) continue;
            reply += delta;

            if (first) {
                appendMessage('bot', reply, false);
                first = false;
            } else {
                updateStream(reply);
            }
        }

        finalizeStream(reply);

    } catch(err) {
        appendMessage('bot', `[ERROR]: ${err.message}`, false);
    } finally {
        isGenerating = false;
        btnExecute.disabled = !commandInput.value.trim();
        commandInput.focus();
    }
}

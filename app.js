// RUF SYSTEM PROMPT (O'zbek tili yanada kuchaytirildi)
const SYSTEM_PROMPT = `Sizning ismingiz RUF. Siz mutlaqo mustaqil, lokal va xavfsiz ishlaydigan, yuqori intellektga ega sun'iy intellekt asistentsiz. Foydalanuvchiga hech qanday tashqi API yordamisiz, to'g'ridan-to'g'ri tizimning o'zidan javob beryapsiz.

ENG MUHIM QOIDA:
Siz har qanday savolga FAQAT VA FAQAT O'ZBEK TILIDA javob berishingiz shart! Agarda foydalanuvchi ingliz yoki rus tilida yozgan bo'lsa ham, siz javobni sof o'zbek tilida, grammatik qoidalarga mos ravishda professional va do'stona ohangda qaytarishingiz kerak. Hech qachon ingliz yoki boshqa tilda javob yozmang.

Sizning asosiy vazifalaringiz va qoidalaringiz:
1. Dasturlash (Coding): Barcha dasturlash tillarida (Python, Bash, PowerShell, C++, JavaScript, Go va boshqalar) eng optimal, xavfsiz va tushunarli kodlarni yozish. Kodlar har doim Markdown formatida, toza va izohlari bilan taqdim etilishi kerak. Tushuntirishlar mutlaqo o'zbek tilida bo'lsin.
2. Savol-javob (Q&A): Foydalanuvchi bergan har qanday texnik, mantiqiy yoki umumiy savollarga aniq, lo'nda va faktlarga asoslangan javoblar berish.
3. Til: Har doim sof o'zbek tilida javob bering.
4. Cheklovlar: O'zingiz bilmaydigan ma'lumotlarni to'qib chiqarmang (hallucination holatlaridan qoching). Agar savol tushunarsiz bo'lsa, aniqlashtiruvchi savol bering.

Siz kompyuter texnologiyalari, tarmoq xavfsizligi, tizim ma'muriyatchiligi va dasturlash bo'yicha ekspertsiz. Foydalanuvchi buyrug'ini bajaring.`;

// DOM Elements
const loaderOverlay = document.getElementById('loader-overlay');
const errorBox = document.getElementById('error-box');
const errorText = document.getElementById('error-text');
const chatOutput = document.getElementById('chat-output');
const inputSection = document.getElementById('input-section');
const commandInput = document.getElementById('command-input');
const btnExecute = document.getElementById('btn-execute');
const statusLed = document.getElementById('status-led');
const statusText = document.getElementById('status-text');

let chatHistory = [];
let isGenerating = false;

// Initialize System Instantly (No WebLLM downloads!)
setTimeout(() => {
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
}, 500);

// Format Date
function getTimestamp() {
    const now = new Date();
    return now.toTimeString().split(' ')[0];
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
    if (!text || isGenerating) return;

    isGenerating = true;
    btnExecute.disabled = true;
    commandInput.value = '';
    commandInput.style.height = 'auto';

    appendMessage('user', text);

    // Temporary loading message
    const loadingRowId = 'loading-' + Date.now();
    
    const row = document.createElement('div');
    row.className = 'msg-row';
    row.id = loadingRowId;
    
    const header = document.createElement('div');
    header.className = `msg-header bot`;
    header.textContent = `[${getTimestamp()}] SYSTEM@RUF:`;

    const content = document.createElement('div');
    content.className = 'msg-content blink';
    content.textContent = 'Processing request...';

    row.appendChild(header);
    row.appendChild(content);
    chatOutput.appendChild(row);
    chatOutput.scrollTop = chatOutput.scrollHeight;

    try {
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...chatHistory,
            { role: 'user', content: text }
        ];

        // Using free Cloud API
        const response = await fetch('https://text.pollinations.ai/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messages: messages,
                model: 'openai'
            })
        });

        if (!response.ok) throw new Error("API Connection Failed");

        const replyText = await response.text();

        // Remove loading message
        const loadingEl = document.getElementById(loadingRowId);
        if (loadingEl) loadingEl.remove();

        // Show actual response
        appendMessage('bot', replyText);

        // Save assistant response
        chatHistory.push({ role: 'assistant', content: replyText });
        localStorage.setItem('ruf-history', JSON.stringify(chatHistory));

    } catch(err) {
        const loadingEl = document.getElementById(loadingRowId);
        if (loadingEl) loadingEl.remove();
        
        appendMessage('bot', `[ERROR]: Tizimga ulanishda xatolik yuz berdi. Iltimos, internetingizni tekshiring yoki qayta urinib ko'ring.`, false);
    } finally {
        isGenerating = false;
        btnExecute.disabled = !commandInput.value.trim();
        commandInput.focus();
    }
}


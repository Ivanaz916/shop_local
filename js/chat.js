/* ================================================================
   chat.js — Search page controller
   Handles user input, calls LLM via Supabase Edge Function
   (or falls back to local keyword search), and renders responses.
   ================================================================ */

const ChatApp = (() => {
    let isProcessing = false;
    let currentShopId = null;
    let mode = 'gallery';

    function init() {
        const input = document.getElementById('chat-input');
        const sendBtn = document.getElementById('chat-send');
        const chips = document.querySelectorAll('.chip');

        // Send on button click
        sendBtn.addEventListener('click', () => handleSend());

        // Send on Enter key
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        });

        // Prompt chip clicks
        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                input.value = chip.dataset.prompt;
                handleSend();
            });
        });
    }

    async function handleSend() {
        const input = document.getElementById('chat-input');
        const question = input.value.trim();
        if (!question || isProcessing) return;

        isProcessing = true;
        input.value = '';
        document.getElementById('chat-send').disabled = true;

        // Hide prompt chips after first message
        const chipsEl = document.getElementById('prompt-chips');
        if (chipsEl) chipsEl.classList.add('hidden');

        // Add user message
        addMessage(question, 'user');

        // Show typing indicator
        const typingEl = addTypingIndicator();

        try {
            // Call LLM / local search, scoped if inside shop
            const answer = await SupabaseClient.askQuestion(question, currentShopId);

            // Remove typing indicator
            typingEl.remove();

            // Add AI response
            addMessage(answer, 'ai');
        } catch (err) {
            console.error('Chat error:', err);
            typingEl.remove();
            addMessage("Sorry, I'm having trouble connecting right now. Please try again in a moment.", 'ai', true);
        }

        isProcessing = false;
        document.getElementById('chat-send').disabled = false;
        document.getElementById('chat-input').focus();
    }

    function addMessage(text, role, isError) {
        const messages = document.getElementById('chat-messages');
        const msg = document.createElement('div');
        msg.className = `message message-${role}${isError ? ' message-error' : ''}`;

        const avatar = role === 'ai' ? '🏘️' : '👤';

        // Simple markdown-like formatting: **bold** and \n\n for paragraphs
        const formatted = text
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .split('\n\n')
            .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
            .join('');

        msg.innerHTML = `
            <div class="message-avatar">${avatar}</div>
            <div class="message-bubble">${formatted}</div>
        `;

        messages.appendChild(msg);
        messages.scrollTop = messages.scrollHeight;
        return msg;
    }

    function addTypingIndicator() {
        const messages = document.getElementById('chat-messages');
        const msg = document.createElement('div');
        msg.className = 'message message-ai';
        msg.innerHTML = `
            <div class="message-avatar">🏘️</div>
            <div class="message-bubble typing-indicator">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
            </div>
        `;
        messages.appendChild(msg);
        messages.scrollTop = messages.scrollHeight;
        return msg;
    }

    function setScope(shop) {
        currentShopId = shop.id;
        mode = 'interior';
        updateChips(shop);
        clearMessages();
        const label = document.getElementById('chat-scope-label');
        if (label) label.textContent = `Searching only ${shop.name}`;
    }

    function clearScope() {
        currentShopId = null;
        mode = 'gallery';
        updateChips();
        clearMessages();
        const label = document.getElementById('chat-scope-label');
        if (label) label.textContent = 'Searching all shops on Mass Ave';
    }

    function updateChips(shop) {
        const chipsEl = document.getElementById('prompt-chips');
        if (!chipsEl) return;
        chipsEl.innerHTML = '';
        if (shop) {
            chipsEl.innerHTML = `
                <button class="chip" data-prompt="What's in stock?">🛒 Inventory</button>
                <button class="chip" data-prompt="What are your hours?">⏰ Hours</button>
                <button class="chip" data-prompt="How do I contact you?">📞 Contact</button>
            `;
        } else {
            chipsEl.innerHTML = `
                <button class="chip" data-prompt="What shops are open right now?">🕐 Open now?</button>
                <button class="chip" data-prompt="Are there any good restaurants on Mass Ave?">🍽️ Restaurants</button>
                <button class="chip" data-prompt="Where can I find books in Arlington?">📚 Bookstores</button>
                <button class="chip" data-prompt="Tell me about Arlington Center">🏠 About Arlington</button>
            `;
        }
        chipsEl.classList.remove('hidden');
        chipsEl.querySelectorAll('.chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.getElementById('chat-input').value = chip.dataset.prompt;
                handleSend();
            });
        });
    }

    function clearMessages() {
        const messages = document.getElementById('chat-messages');
        if (messages) messages.innerHTML = `
            <div class="message message-ai">
                <div class="message-avatar">🏘️</div>
                <div class="message-bubble">
                    <p>Hi! I know what's happening on Mass Ave. Ask me about local shops or anything Arlington.</p>
                </div>
            </div>
        `;
    }

    return { init, setScope, clearScope, updateChips };
})();

// Initialize on load
document.addEventListener('DOMContentLoaded', () => ChatApp.init());

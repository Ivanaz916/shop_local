/* ================================================================
   chat.js — Search page controller
   Handles user input, calls LLM via Supabase Edge Function
   (or falls back to local keyword search), and renders responses.
   ================================================================ */

const ChatApp = (() => {
    let isProcessing = false;

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
            // Call LLM / local search
            const answer = await SupabaseClient.askQuestion(question);

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

    return { init };
})();

// Initialize on load
document.addEventListener('DOMContentLoaded', () => ChatApp.init());

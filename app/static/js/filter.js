/**
 * filter.js — Content moderation filter.
 *
 * Blocks messages that contain:
 *   - Political terms
 *   - Discriminatory / hate speech
 *   - Profanity / vulgar language
 *   - URLs / links
 *
 * Exports via window.ContentFilter:
 *   - check(text) → { ok: boolean, reason: string }
 */

(function () {
    // ===== Banned word lists =====

    // Political terms (Chinese)
    const POLITICAL = [
        '政治', '選舉', '投票', '民進黨', '國民黨', '共產黨', '民眾黨',
        '台獨', '統獨', '統一', '獨立', '兩岸', '一中', '九二共識',
        '總統', '立委', '議員', '黨派', '藍綠', '綠營', '藍營',
        '柯文哲', '賴清德', '蔡英文', '韓國瑜', '侯友宜', '習近平',
        '共匪', '支那', '中共', '台灣獨立', '中國統一',
    ];

    // Discriminatory / hate speech
    const DISCRIMINATORY = [
        '歧視', '種族歧視', '性別歧視', '噁心死了', '去死',
        '低端', '賤民', '賤人', '下等人', '殘廢',
        '黑鬼', '外勞', '越勞', '死同性戀', '死gay', '娘炮',
        'nigger', 'negro', 'chink', 'gook', 'spic', 'kike',
        'faggot', 'retard', 'retarded',
    ];

    // Profanity / vulgar (Chinese + English)
    const PROFANITY = [
        '幹你', '操你', '肏你', '靠北', '靠杯', '靠邀', '靠腰',
        '他媽', '你媽', '老母', '王八', '王八蛋', '狗娘',
        '白癡', '智障', '廢物', '腦殘', '死全家', '去死',
        '幹你娘', '操你媽', '你他媽', '媽的', '他媽的',
        '機掰', '雞掰', '機巴', '雞巴', '懶叫', '屌',
        '三小', '啥小', '殺小', '衝三小', '哩洗咧',
        '垃圾', '死肥宅', '噁男',
        'fuck', 'fucking', 'fucked', 'fucker',
        'shit', 'bullshit', 'shitty',
        'bitch', 'asshole', 'bastard', 'dick', 'pussy',
        'damn', 'damned', 'crap', 'wtf', 'stfu',
    ];

    // Combine all banned words into a single list (lowercase for matching)
    const ALL_BANNED = [...POLITICAL, ...DISCRIMINATORY, ...PROFANITY].map(
        (w) => w.toLowerCase()
    );

    // URL pattern — matches http(s), ftp, www., and domain-like patterns
    const URL_REGEX =
        /(?:https?|ftp):\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\/[^\s]*)?/gi;

    /**
     * Check if a message is allowed.
     * @param {string} text — the message content
     * @returns {{ ok: boolean, reason: string }}
     */
    function check(text) {
        if (!text || !text.trim()) {
            return { ok: false, reason: '訊息不得為空。' };
        }

        const lower = text.toLowerCase();

        // Check for URLs
        if (URL_REGEX.test(text)) {
            // Reset regex lastIndex (global flag)
            URL_REGEX.lastIndex = 0;
            return { ok: false, reason: '訊息中不允許包含網址或連結。' };
        }
        URL_REGEX.lastIndex = 0;

        // Check for banned words
        for (const word of ALL_BANNED) {
            if (lower.includes(word)) {
                return {
                    ok: false,
                    reason: '訊息包含不當內容，請修改後重新發送。',
                };
            }
        }

        return { ok: true, reason: '' };
    }

    window.ContentFilter = { check };
})();

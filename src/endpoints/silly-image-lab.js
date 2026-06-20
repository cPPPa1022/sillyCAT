// ============================================================
// SillyImage Lab — 后端API路由
// ============================================================
import fetch from 'node-fetch';
import express from 'express';

export const router = express.Router();

// POST /ping — 测试ComfyUI连接（浏览器CORS限制，走后端转发）
router.post('/ping', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: '缺少 url' });
        const resp = await fetchWithTimeout(url.replace(/\/+$/, '') + '/system_stats', {}, 5000);
        if (!resp.ok) return res.status(resp.status).json({ error: 'ComfyUI HTTP ' + resp.status });
        const data = await resp.json();
        res.json({ ok: true, device: data?.devices?.[0]?.name || '未知设备' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 安全超时 fetch（兼容旧Node）
async function fetchWithTimeout(url, opts = {}, ms = 60000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    try {
        const resp = await fetch(url, { ...opts, signal: controller.signal });
        return resp;
    } finally {
        clearTimeout(timer);
    }
}

// POST /api/silly-image/list-models — 代理拉取 OpenAI 兼容模型列表
router.post('/list-models', async (req, res) => {
    try {
        const { url, apiKey } = req.body;
        if (!url) return res.status(400).json({ error: '缺少 url' });
        const base = url.replace(/\/+$/, '');
        const headers = {};
        if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;
        console.log(`[SillyImage] 拉取模型列表: ${base}/models`);
        const resp = await fetchWithTimeout(`${base}/models`, { headers }, 15000);
        if (!resp.ok) {
            const et = await resp.text().catch(() => '');
            return res.status(resp.status).json({ error: `模型列表 HTTP ${resp.status}`, detail: et.slice(0, 500) });
        }
        const data = await resp.json();
        const models = (data.data || []).map(m => typeof m === 'string' ? { id: m } : { id: m.id }).filter(m => m.id);
        res.json({ ok: true, models });
    } catch (err) {
        console.error('[SillyImage] list-models异常:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/silly-image/aux-call — 代理辅助LLM调用
router.post('/aux-call', async (req, res) => {
    try {
        const { endpoint, apiKey, model, messages, maxTokens, temperature } = req.body;

        if (!endpoint) return res.status(400).json({ error: '缺少 endpoint' });
        if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: '缺少 messages' });

        const url = endpoint.replace(/\/+$/, '');
        const headers = { 'Content-Type': 'application/json' };
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

        const body = {
            messages,
            max_tokens: maxTokens || 4096,
            temperature: temperature ?? 0.7,
            stream: false,
        };
        if (model) body.model = model;

        console.log(`[SillyImage] 代理调用: ${url} model=${model || 'default'}`);

        const resp = await fetchWithTimeout(url, { method: 'POST', headers, body: JSON.stringify(body) }, 180000);

        if (!resp.ok) {
            const errText = await resp.text().catch(() => '');
            console.error(`[SillyImage] 辅助API错误 ${resp.status}:`, errText.slice(0, 500));
            return res.status(resp.status).json({ error: `辅助API返回 ${resp.status}`, detail: errText.slice(0, 1000) });
        }

        const data = await resp.json();
        res.json(data);
    } catch (err) {
        console.error('[SillyImage] aux-call异常:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/silly-image/comfy-models — 代理拉取 ComfyUI 模型列表
router.get('/comfy-models', async (req, res) => {
    try {
        const comfyUrl = req.query.url;
        if (!comfyUrl) return res.status(400).json({ error: '缺少 url 参数' });

        const base = comfyUrl.replace(/\/+$/, '');
        const resp = await fetchWithTimeout(`${base}/object_info`, {}, 15000);

        if (!resp.ok) {
            return res.status(resp.status).json({ error: `ComfyUI 返回 ${resp.status}` });
        }

        const info = await resp.json();
        const models = { checkpoints: [], unets: [], clips: [], vaes: [] };

        for (const [, obj] of Object.entries(info)) {
            if (!obj?.input?.required) continue;
            for (const k of Object.keys(obj.input.required)) {
                const v = obj.input.required[k];
                if (!Array.isArray(v) || v.length < 2) continue;
                const list = v[0];
                if (!Array.isArray(list)) continue;

                let cat = null;
                if (k.includes('checkpoint') || k.includes('ckpt')) cat = 'checkpoints';
                else if (k.includes('unet')) cat = 'unets';
                else if (k.includes('clip')) cat = 'clips';
                else if (k.includes('vae')) cat = 'vaes';
                if (cat) for (const m of list) { if (!models[cat].includes(m)) models[cat].push(m); }
            }
        }

        res.json({ ok: true, models });
    } catch (err) {
        console.error('[SillyImage] comfy-models异常:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/silly-image/comfy-system-stats — 代理测试 ComfyUI 连接
router.post('/comfy-system-stats', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: '缺少 url' });

        const base = url.replace(/\/+$/, '');
        const resp = await fetchWithTimeout(`${base}/system_stats`, {}, 8000);

        if (!resp.ok) {
            return res.status(resp.status).json({ error: `ComfyUI 返回 ${resp.status}` });
        }

        const data = await resp.json();
        res.json({ ok: true, device: data?.device?.devices?.[0]?.name || '未知设备' });
    } catch (err) {
        console.error('[SillyImage] comfy-system-stats异常:', err.message);
        res.status(500).json({ error: err.message });
    }
});

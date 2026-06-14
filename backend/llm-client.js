// LLM 客户端 - 兼容 NewAPI / OpenAI 协议
// 配置在 .env 中

import { config } from './config.js';

/**
 * 调用 LLM 生成回复(非流式)
 * @param {Object} params
 * @param {string} params.system - 系统提示
 * @param {Array<{role:string,content:string}>} params.messages - 消息历史
 * @param {number} [params.temperature=0.7]
 * @param {number} [params.max_tokens=1500]
 * @returns {Promise<string>}
 */
export async function callLLM({ system, messages, temperature = 0.7, max_tokens = 1500 }) {
  const url = `${config.llm.url.replace(/\/$/, '')}/v1/chat/completions`;

  const body = {
    model: config.llm.model,
    messages: [
      { role: 'system', content: system },
      ...messages
    ],
    temperature,
    max_tokens,
    stream: false
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.llm.key}`
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`LLM 调用失败: ${resp.status} ${resp.statusText}\n${text.slice(0, 500)}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * 调用 LLM 流式生成
 */
export async function callLLMStream({ system, messages, temperature = 0.7, max_tokens = 1500 }) {
  const url = `${config.llm.url.replace(/\/$/, '')}/v1/chat/completions`;

  const body = {
    model: config.llm.model,
    messages: [
      { role: 'system', content: system },
      ...messages
    ],
    temperature,
    max_tokens,
    stream: true
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.llm.key}`
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`LLM 流式调用失败: ${resp.status} ${resp.statusText}\n${text.slice(0, 500)}`);
  }

  return resp.body;
}

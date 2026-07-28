import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.PORT || 3000);
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || 'gpt-5.4-mini';
const publicDir = __dirname;

const zodiacRanges = [
  { name: '염소자리', start: [12, 22], end: [1, 19], trait: '책임감, 현실감각, 꾸준함' },
  { name: '물병자리', start: [1, 20], end: [2, 18], trait: '독창성, 유연함, 실험정신' },
  { name: '물고기자리', start: [2, 19], end: [3, 20], trait: '감수성, 직관, 흐름' },
  { name: '양자리', start: [3, 21], end: [4, 19], trait: '에너지, 추진력, 시작' },
  { name: '황소자리', start: [4, 20], end: [5, 20], trait: '안정감, 인내, 균형' },
  { name: '쌍둥이자리', start: [5, 21], end: [6, 21], trait: '호기심, 속도, 소통' },
  { name: '게자리', start: [6, 22], end: [7, 22], trait: '보호본능, 감정, 직감' },
  { name: '사자자리', start: [7, 23], end: [8, 22], trait: '자신감, 존재감, 확장' },
  { name: '처녀자리', start: [8, 23], end: [9, 22], trait: '정교함, 분석, 정돈' },
  { name: '천칭자리', start: [9, 23], end: [10, 22], trait: '조화, 감각, 선택' },
  { name: '전갈자리', start: [10, 23], end: [11, 22], trait: '집중력, 강도, 몰입' },
  { name: '사수자리', start: [11, 23], end: [12, 21], trait: '확장, 낙관, 모험' }
];

function send(res, status, data, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });
  res.end(type.startsWith('application/json') ? JSON.stringify(data) : data);
}

function getZodiac(month, day) {
  for (const z of zodiacRanges) {
    const [sm, sd] = z.start;
    const [em, ed] = z.end;
    const inRange = (month === sm && day >= sd) || (month === em && day <= ed);
    if (inRange) return z;
  }
  return zodiacRanges[0];
}

function seedFromString(str) {
  let seed = 0;
  for (let i = 0; i < str.length; i++) seed = (seed * 31 + str.charCodeAt(i)) >>> 0;
  return seed || 1;
}

function seededRandom(seed) {
  let x = seed >>> 0;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}

function drawNumbers(seedText) {
  const random = seededRandom(seedFromString(seedText));
  const pool = Array.from({ length: 45 }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picks = pool.slice(0, 7).sort((a, b) => a - b);
  return { main: picks.slice(0, 6), bonus: picks[6] };
}

function parseBirth(input) {
  const m = input.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return { year, month, day };
}

async function openAIRecommend(birthDate) {
  const parsed = parseBirth(birthDate);
  if (!parsed) throw new Error('생년월일은 YYYY-MM-DD 형식이어야 합니다.');

  const zodiac = getZodiac(parsed.month, parsed.day);
  const seedText = `${birthDate} ${zodiac.name}`;
  const numbers = drawNumbers(seedText);

  if (!apiKey) {
    return {
      birthDate,
      zodiac,
      numbers,
      explanation: [
        `${zodiac.name}(${parsed.month}월 ${parsed.day}일)는 ${zodiac.trait}의 분위기를 가진 별자리로 봤습니다.`,
        `그래서 번호는 ${zodiac.name}의 느낌에 맞게 안정형 숫자와 변동형 숫자를 섞어 추천했습니다.`,
        `본번호는 ${numbers.main.map((n) => String(n).padStart(2, '0')).join(', ')}이고, 보너스는 ${String(numbers.bonus).padStart(2, '0')}입니다.`,
        `현재는 OPENAI_API_KEY가 없어서, 로컬 규칙으로 대체 응답을 돌려줬습니다.`
      ].join('\n\n')
    };
  }

  const prompt = [
    '너는 생년월일 기반 로또 번호 추천 챗봇이다.',
    '반드시 한국어로 답하고, 아래 JSON 스키마에 맞는 정보만 제공해라.',
    '번호는 1~45의 정수 6개와 보너스 1개로 구성하라.',
    '동일한 생년월일이면 같은 추천이 나오는 느낌으로 일관된 설명을 써라.',
    '너무 과장된 점괘 말투는 피하고, 따뜻하고 친근하게 설명하라.'
  ].join(' ');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: prompt },
        {
          role: 'user',
          content: `생년월일: ${birthDate}\n별자리: ${zodiac.name}\n별자리 성향: ${zodiac.trait}\n\n출력 JSON 형식:\n{"birthDate":"YYYY-MM-DD","zodiac":{"name":"","trait":""},"numbers":{"main":[1,2,3,4,5,6],"bonus":7},"explanation":"..."}`
        }
      ],
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI API 오류: ${response.status} ${text}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content || '{}';
  let parsedJson;
  try {
    parsedJson = JSON.parse(content);
  } catch {
    throw new Error('모델 응답을 JSON으로 해석하지 못했습니다.');
  }

  return {
    birthDate: parsedJson.birthDate || birthDate,
    zodiac: parsedJson.zodiac || zodiac,
    numbers: parsedJson.numbers || numbers,
    explanation: parsedJson.explanation || '설명을 생성하지 못했습니다.'
  };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'OPTIONS') {
      return send(res, 204, '');
    }

    if (url.pathname === '/api/recommend' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const data = JSON.parse(body || '{}');
          const result = await openAIRecommend(data.birthDate || '');
          send(res, 200, result);
        } catch (error) {
          send(res, 400, { error: error.message });
        }
      });
      return;
    }

    const filePath = path.join(publicDir, url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
    const content = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const type = ext === '.html' ? 'text/html; charset=utf-8' : ext === '.js' ? 'text/javascript; charset=utf-8' : 'text/plain; charset=utf-8';
    return send(res, 200, content.toString('utf8'), type);
  } catch (error) {
    return send(res, 500, { error: error.message });
  }
});

server.listen(port, () => {
  console.log(`별자리 로또 챗봇 서버 실행 중: http://localhost:${port}`);
});

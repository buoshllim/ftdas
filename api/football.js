// ESPN proxy — FOOTBALL_API_KEY 환경변수 불필요 (ESPN은 인증 없음)
// data.js가 ESPN을 직접 호출하므로 이 프록시는 현재 미사용
module.exports = async function handler(req, res) {
  return res.status(200).json({ status: 'ok', note: 'ESPN API called directly from browser' });
};

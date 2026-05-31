// 한글 → 로마자 간단 변환 (의존성 0). 초/중/종성 1:1 매핑, 정확도 ~70% — 자동 제안용(사용자 수정 가능)

const CHO = ["g","kk","n","d","tt","r","m","b","pp","s","ss","","j","jj","ch","k","t","p","h"];
const JUNG = ["a","ae","ya","yae","eo","e","yeo","ye","o","wa","wae","oe","yo","u","wo","we","wi","yu","eu","ui","i"];
const JONG = ["","k","k","ks","n","nj","nh","t","l","lg","lm","lb","ls","lt","lp","lh","m","b","bs","s","ss","ng","j","ch","k","t","p","h"];

export function hangulToRoman(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) {
      const i = code - 0xac00;
      out += CHO[Math.floor(i / 588)] + JUNG[Math.floor((i % 588) / 28)] + JONG[i % 28];
    } else if (/[A-Za-z0-9]/.test(ch)) {
      out += ch;
    }
    // 공백/기호는 무시
  }
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : "";
}

// 트리거 워드 자동 제안 — 영문명만 깔고 사용자가 이어서 작성 (중립 템플릿)
export function suggestTriggerWord(roman: string): string {
  return roman ? `${roman}, ` : "";
}

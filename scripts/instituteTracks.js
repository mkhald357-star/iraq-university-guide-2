// مساعدات مسارات المعاهد/الكليات التقنية («التخصصات الطبية/الهندسية/الإدارية/الزراعية» و«الفنون التطبيقية»).
// مشتركة بين scripts/build-universities-data.js ومولِّد data/institute-tracks.json.
const UMBRELLA_RE = /^(قسم )?(التخصصات|الفنون التطبيقية)/;

/** اسم المسار من نص يحوي «التخصصات X»؛ الاسم المختصر: طبية | هندسية | ادارية | زراعية | فنون تطبيقية. */
function trackFromText(t) {
  const s = String(t || "").replace(/[\s\t⇥]+/g, "");
  const i = s.search(/التخصصات|تخصصات/);
  if (i < 0) return null;
  const k = s.slice(i, i + 18);
  if (/طب|صحي/.test(k)) return "طبية";
  if (/دس|هند|لند/.test(k)) return "هندسية";
  if (/دار/.test(k)) return "ادارية";
  if (/زراع/.test(k)) return "زراعية";
  if (/فنون/.test(k)) return "فنون تطبيقية";
  return null;
}

/** مسار «قسم المظلة» (القسم الذي تحمله المنصة باسم المسار نفسه)، أو null لقسم حقيقي. */
function umbrellaTrack(name) {
  if (!UMBRELLA_RE.test(String(name || ""))) return null;
  if (/^(قسم )?الفنون التطبيقية/.test(name)) return "فنون تطبيقية";
  return trackFromText(name);
}

const TRACK_LABEL = {
  طبية: "التخصصات الطبية",
  هندسية: "التخصصات الهندسية",
  ادارية: "التخصصات الإدارية",
  زراعية: "التخصصات الزراعية",
  "فنون تطبيقية": "الفنون التطبيقية",
};

module.exports = { UMBRELLA_RE, trackFromText, umbrellaTrack, TRACK_LABEL };

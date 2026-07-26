"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import knowledgeData from "../../data/assistant_knowledge.json";
import { findBestAnswer, SUGGESTED_QUESTION_IDS, type AssistantEntry } from "../../lib/assistant";

const KNOWLEDGE = knowledgeData as AssistantEntry[];
const SUGGESTED = SUGGESTED_QUESTION_IDS.map((id) => KNOWLEDGE.find((e) => e.id === id)).filter(
  (e): e is AssistantEntry => Boolean(e)
);

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

const GREETING =
  "أهلاً! أنا مساعد المنصة — أجيب فوراً على الأسئلة الشائعة حول آلية القبول، الاختبار، والتقرير. جرّب أحد الأسئلة أدناه أو اكتب سؤالك مباشرة.";

// المكوّن يُدمَج مرة واحدة في app/layout.tsx فيبقى حياً (وتبقى حالته) عبر كل
// تنقّل بين الصفحات دون إعادة تحميل، بلا حاجة لأي حفظ في localStorage.
export function AssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", text: GREETING }]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const ask = (rawQuery: string) => {
    const query = rawQuery.trim();
    if (!query) return;
    const match = findBestAnswer(query, KNOWLEDGE);
    const reply =
      match?.entry.answer ?? "لم أفهم سؤالك تحديداً بعد — جرّب صياغة أبسط، أو اختر أحد الأسئلة المقترحة أدناه.";
    setMessages((prev) => [...prev, { role: "user", text: query }, { role: "assistant", text: reply }]);
    setInput("");
  };

  return (
    // يمين أسفل الشاشة عمداً لا يسار: مؤشر أدوات Next.js في وضع التطوير
    // (badge صغير "N") يشغل يسار أسفل الشاشة افتراضياً ويتداخل بصرياً مع أي
    // عنصر عائم هناك -- لوحظ فعلياً أثناء الاختبار الحي. غير موجود في
    // الإنتاج، لكن اليمين أسفل موقع خالٍ ومألوف لعناصر الدردشة العائمة على
    // أي حال.
    <div className="fixed bottom-5 right-5 z-50">
      {isOpen && (
        <div className="mb-3 w-[min(22rem,calc(100vw-2.5rem))] h-[28rem] max-h-[70vh] glass rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* رأس النافذة */}
          <div className="bg-primary text-white px-4 py-3 flex items-center justify-between shrink-0">
            <div>
              <h3 className="font-bold text-sm">المساعد الذكي</h3>
              <p className="text-[11px] text-white/80">يعمل محلياً بلا اتصال خارجي — إجابات فورية</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="إغلاق المساعد"
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* الرسائل */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-white/60">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === "user" ? "bg-slate-100 text-slate-800" : "bg-primary/10 text-slate-800"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {messages.length <= 1 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTED.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => ask(e.question)}
                    className="text-xs bg-white border border-slate-200 rounded-full px-3 py-1.5 hover:bg-slate-50 transition-colors text-slate-600"
                  >
                    {e.question}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* الإدخال */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="p-2 border-t border-slate-200 flex gap-2 shrink-0 bg-white/80"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اكتب سؤالك..."
              className="flex-1 text-sm px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              type="submit"
              aria-label="إرسال"
              className="bg-primary text-white p-2 rounded-xl hover:bg-primary-700 transition-colors shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? "إغلاق المساعد" : "افتح المساعد الذكي"}
        className="w-14 h-14 rounded-full bg-primary text-white shadow-xl flex items-center justify-center hover:bg-primary-700 transition-all hover:scale-105 active:scale-95"
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </div>
  );
}

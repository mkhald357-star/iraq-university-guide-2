"use client";
import { useState } from "react";
import { clearAppData } from "../../lib/safeStorage";

/**
 * «امسح بياناتي من هذا الجهاز»: المنصة لا ترسل أي بيانات، لكن نتيجة الاختبار والمعدّل والرغبات تبقى في
 * متصفح هذا الجهاز. زر واحد يمسحها كلها (مهم على جهاز مشترك).
 */
export default function ClearDataButton() {
  const [done, setDone] = useState(false);
  return (
    <div className="text-xs text-ink-muted">
      {done ? (
        <span role="status">مُسحت بياناتك من هذا الجهاز.</span>
      ) : (
        <button
          type="button"
          onClick={() => {
            if (!window.confirm("سيُمسح من هذا الجهاز: نتيجة الاختبار، ومعدّلك، وقائمة رغباتك. هل تريد المتابعة؟"))
              return;
            clearAppData();
            setDone(true);
            window.setTimeout(() => window.location.assign("/"), 800);
          }}
          className="underline underline-offset-2 hover:text-ink"
        >
          امسح بياناتي من هذا الجهاز
        </button>
      )}
    </div>
  );
}

/** رابط "تخطَّ إلى المحتوى" -- أول عنصر قابل للتركيز في الصفحة، مخفي بصرياً
 *  إلى أن يصله تركيز لوحة المفاتيح (Tab). يستخدم أنماط Tailwind sr-only/
 *  focus:not-sr-only الجاهزة، ونمط :focus-visible المُعرَّف فعلاً في
 *  app/globals.css -- لا CSS جديد. */
export default function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50
                 focus:rounded-md focus:bg-primary-solid focus:px-4 focus:py-2 focus:text-white
                 focus:font-bold focus-visible:outline focus-visible:outline-2
                 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
    >
      تخطَّ إلى المحتوى
    </a>
  );
}

"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import Link from "next/link";

/**
 * خصائص مكون ErrorBoundary
 */
interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * حالة مكون ErrorBoundary
 */
interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * مكونErrorBoundary لالتقاط ومعالجة الأخطاء غير المتوقعة في شجرة المكونات الفرعية.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  /**
   * دالة لتحديث الحالة عند حدوث خطأ حتى تعرض واجهة الاسترداد
   */
  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  /**
   * تسجيل تفاصيل الخطأ في الكونسول أو أي خدمة مراقبة خارجية
   */
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  /**
   * إعادة محاولة تشغيل المكونات وحذف حالة الخطأ
   */
  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-8 shadow-xl text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-950/50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-8 h-8 text-red-600 dark:text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">حدث خطأ ما</h2>

            <p
              className="text-slate-600 dark:text-slate-400 text-sm mb-6 break-words"
              title={this.state.error?.message}
            >
              {this.state.error?.message || "حدث خطأ غير متوقع أثناء تشغيل التطبيق."}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium transition-all shadow-md active:scale-95 text-sm dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900"
              >
                إعادة المحاولة
              </button>

              <Link
                href="/"
                className="px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-medium transition-all active:scale-95 text-sm dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700"
              >
                الرئيسية
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
